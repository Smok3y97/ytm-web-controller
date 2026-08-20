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
import { getActionWarningSvgDataUrl } from "../services/warning-icons.js";
import { WebSocketService } from "../services/websocket-server.js";
import { VolumeSettings, YTMPlaybackState } from "../types/index.js";

export abstract class BaseVolumeAction extends SingletonAction<VolumeSettings> {
	protected activeActions: Set<WillAppearEvent<VolumeSettings>["action"]> = new Set();
	protected abstract readonly command: "volumeDown" | "volumeUp";
	protected actionKey: string = "";
	protected abstract calculateOptimisticVolume(currentVolume: number, step: number): number;
	private lastRenderedTitle: Map<string, string> = new Map();
	private lastRenderedMismatch: Map<string, boolean> = new Map();

	constructor() {
		super();

		StateManager.getInstance().on("stateChanged", (state: YTMPlaybackState) => {
			this.updateAllInstances(state);
		});
	}

	override async onWillAppear(ev: WillAppearEvent<VolumeSettings>): Promise<void> {
		this.activeActions.add(ev.action);
		this.lastRenderedTitle.delete(ev.action.id);
		this.lastRenderedMismatch.delete(ev.action.id);
		const state = StateManager.getInstance().getState();
		await this.updateInstance(ev.action, state, ev.payload.settings);
		WebSocketService.getInstance().sendCommand("requestState");
	}

	override async onWillDisappear(ev: WillDisappearEvent<VolumeSettings>): Promise<void> {
		this.lastRenderedTitle.delete(ev.action.id);
		this.lastRenderedMismatch.delete(ev.action.id);
		this.removeActiveAction(ev.action.id);
	}

	protected removeActiveAction(actionId: string): void {
		for (const a of this.activeActions) {
			if (a.id === actionId) {
				this.activeActions.delete(a);
				break;
			}
		}
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<VolumeSettings>): Promise<void> {
		this.lastRenderedTitle.delete(ev.action.id);
		const state = StateManager.getInstance().getState();
		await this.updateInstance(ev.action, state, ev.payload.settings);
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

		WebSocketService.getInstance().sendCommand(this.command, { step });
	}

	protected async updateAllInstances(state: YTMPlaybackState): Promise<void> {
		for (const actionInstance of this.activeActions) {
			try {
				const settings = await actionInstance.getSettings();
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
			const isMismatch = !!state.isVersionMismatch;
			const prevMismatch = this.lastRenderedMismatch.get(actionInstance.id);

			if (isMismatch) {
				if (prevMismatch !== true) {
					await actionInstance.setTitle("");
					const key = this.actionKey || (this.command === "volumeUp" ? "volumeup" : "volumedown");
					await actionInstance.setImage(getActionWarningSvgDataUrl(key));
					this.lastRenderedMismatch.set(actionInstance.id, true);
				}
				return;
			}

			let text = "";
			if (settings.showVolumeTitle !== false) {
				const template = settings.titleTemplate || "{volume}%";
				text = StateManager.getInstance().formatVolumeTemplate(template, state.volume, state.muted);
			}

			const prevText = this.lastRenderedTitle.get(actionInstance.id);

			if (prevText !== text || prevMismatch === true) {
				if (prevMismatch === true) {
					await actionInstance.setImage(undefined);
				}
				await actionInstance.setTitle(text);
				this.lastRenderedTitle.set(actionInstance.id, text);
				this.lastRenderedMismatch.set(actionInstance.id, false);
			}
		} catch {}
	}
}
