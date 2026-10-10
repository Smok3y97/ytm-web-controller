/**
 * Base class for Volume Up / Down Keypad Actions
 */
import {
	DidReceiveSettingsEvent,
	KeyDownEvent,
	SingletonAction,
	WillAppearEvent,
	WillDisappearEvent,
} from "@elgato/streamdeck";

import { StateManager } from "../services/state-manager.js";
import { handleKeypadMismatch } from "../services/warning-icons.js";
import { WebSocketService } from "../services/websocket-server.js";
import { VolumeSettings, YTMPlaybackState } from "../types/index.js";

export abstract class BaseVolumeAction extends SingletonAction<VolumeSettings> {
	protected activeActions: Map<string, WillAppearEvent<VolumeSettings>["action"]> = new Map();
	protected abstract readonly command: "volumeDown" | "volumeUp";
	protected actionKey: string = "";
	protected abstract calculateOptimisticVolume(currentVolume: number, step: number): number;
	protected actionSettings: Map<string, VolumeSettings> = new Map();
	private lastRenderedTitle: Map<string, string> = new Map();
	private lastRenderedMismatch: Map<string, boolean> = new Map();

	constructor() {
		super();

		StateManager.getInstance().on("stateChanged", (state: YTMPlaybackState) => {
			this.updateAllInstances(state);
		});
	}

	override async onWillAppear(ev: WillAppearEvent<VolumeSettings>): Promise<void> {
		this.activeActions.set(ev.action.id, ev.action);
		this.actionSettings.set(ev.action.id, ev.payload.settings);
		this.lastRenderedTitle.delete(ev.action.id);
		this.lastRenderedMismatch.delete(ev.action.id);
		const state = StateManager.getInstance().getState();
		await this.updateInstance(ev.action, state, ev.payload.settings);
		WebSocketService.getInstance().sendCommand("requestState");
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<VolumeSettings>): Promise<void> {
		this.actionSettings.set(ev.action.id, ev.payload.settings);
		this.lastRenderedTitle.delete(ev.action.id);
		const state = StateManager.getInstance().getState();
		await this.updateInstance(ev.action, state, ev.payload.settings);
	}

	override async onWillDisappear(ev: WillDisappearEvent<VolumeSettings>): Promise<void> {
		this.lastRenderedTitle.delete(ev.action.id);
		this.lastRenderedMismatch.delete(ev.action.id);
		this.actionSettings.delete(ev.action.id);
		this.activeActions.delete(ev.action.id);
	}

	override async onKeyDown(ev: KeyDownEvent<VolumeSettings>): Promise<void> {
		if (StateManager.getInstance().isVersionMismatch()) {
			if (ev.action.isKey()) {
				await ev.action.showAlert();
			}
			return;
		}

		const step = Math.min(50, Math.max(1, ev.payload.settings.step || 5));
		const currentState = StateManager.getInstance().getState();
		const optimisticVolume = this.calculateOptimisticVolume(currentState.volume, step);

		// Instant optimistic feedback on key
		if (ev.action.isKey() && ev.payload.settings.showVolumeTitle !== false) {
			const template = ev.payload.settings.titleTemplate || "{volume}%";
			const text = StateManager.getInstance().formatVolumeTemplate(template, optimisticVolume, false);
			await ev.action.setTitle(text);
			this.lastRenderedTitle.set(ev.action.id, text);
		}

		WebSocketService.getInstance().sendCommand("setVolume", { volume: optimisticVolume });
	}

	protected async updateAllInstances(state: YTMPlaybackState): Promise<void> {
		for (const actionInstance of this.activeActions.values()) {
			try {
				const settings =
					this.actionSettings.get(actionInstance.id) || (await actionInstance.getSettings().catch(() => ({})));
				await this.updateInstance(actionInstance, state, settings);
			} catch {}
		}
	}

	protected async updateInstance(
		actionInstance: WillAppearEvent<VolumeSettings>["action"],
		state: YTMPlaybackState,
		settings: VolumeSettings,
	): Promise<void> {
		if (!actionInstance.isKey()) return;

		try {
			const key = this.actionKey || (this.command === "volumeUp" ? "volumeup" : "volumedown");
			const { isHandled, recoveredFromMismatch } = await handleKeypadMismatch(
				actionInstance,
				actionInstance.id,
				!!state.isVersionMismatch,
				key,
				this.lastRenderedMismatch,
			);
			if (isHandled) return;

			let text = "";
			if (settings.showVolumeTitle !== false) {
				const template = settings.titleTemplate || "{volume}%";
				text = StateManager.getInstance().formatVolumeTemplate(template, state.volume, state.muted);
			}

			const prevText = this.lastRenderedTitle.get(actionInstance.id);

			if (prevText !== text || recoveredFromMismatch) {
				if (recoveredFromMismatch) {
					await actionInstance.setImage(undefined);
				}
				await actionInstance.setTitle(text);
				this.lastRenderedTitle.set(actionInstance.id, text);
			}
		} catch {}
	}
}
