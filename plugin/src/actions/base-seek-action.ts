/**
 * Base class for Seek Keypad Actions (Fast Forward / Rewind)
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
import { SeekButtonSettings, YTMPlaybackState } from "../types/index.js";

export abstract class BaseSeekAction extends SingletonAction<SeekButtonSettings> {
	protected activeActions: Set<WillAppearEvent<SeekButtonSettings>["action"]> = new Set();
	protected abstract readonly direction: "backward" | "forward";
	protected abstract readonly actionKey: "seekbackward" | "seekforward";
	private lastRenderedTitle: Map<string, string> = new Map();
	private lastRenderedMismatch: Map<string, boolean> = new Map();

	constructor() {
		super();

		StateManager.getInstance().on("stateChanged", (state: YTMPlaybackState) => {
			this.updateAllInstances(state);
		});
	}

	override async onWillAppear(ev: WillAppearEvent<SeekButtonSettings>): Promise<void> {
		this.activeActions.add(ev.action);
		this.lastRenderedTitle.delete(ev.action.id);
		this.lastRenderedMismatch.delete(ev.action.id);
		const state = StateManager.getInstance().getState();
		await this.updateInstance(ev.action, state, ev.payload.settings);
		WebSocketService.getInstance().sendCommand("requestState");
	}

	override async onWillDisappear(ev: WillDisappearEvent<SeekButtonSettings>): Promise<void> {
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

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<SeekButtonSettings>): Promise<void> {
		this.lastRenderedTitle.delete(ev.action.id);
		const state = StateManager.getInstance().getState();
		await this.updateInstance(ev.action, state, ev.payload.settings);
	}

	override async onKeyDown(ev: KeyDownEvent<SeekButtonSettings>): Promise<void> {
		if (StateManager.getInstance().isVersionMismatch()) {
			if (ev.action.isKey()) {
				await ev.action.showAlert();
			}
			return;
		}

		const step = Math.min(120, Math.max(1, ev.payload.settings.step || 10));
		const delta = this.direction === "forward" ? step : -step;

		// Instant optimistic feedback on key
		if (ev.action.isKey() && ev.payload.settings.showSeekTitle !== false) {
			const text = StateManager.getInstance().formatSeekButtonTemplate(
				ev.payload.settings.titleTemplate,
				step,
				this.direction === "forward",
			);
			await ev.action.setTitle(text);
			this.lastRenderedTitle.set(ev.action.id, text);
		}

		WebSocketService.getInstance().sendCommand("seekRelative", { seconds: delta });
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
		actionInstance: WillAppearEvent<SeekButtonSettings>["action"],
		state: YTMPlaybackState,
		settings: SeekButtonSettings,
	): Promise<void> {
		if (!actionInstance.isKey()) return;

		try {
			const isMismatch = !!state.isVersionMismatch;
			const prevMismatch = this.lastRenderedMismatch.get(actionInstance.id);

			if (isMismatch) {
				if (prevMismatch !== true) {
					await actionInstance.setTitle("");
					await actionInstance.setImage(getActionWarningSvgDataUrl(this.actionKey));
					this.lastRenderedMismatch.set(actionInstance.id, true);
				}
				return;
			}

			let text = "";
			const step = Math.min(120, Math.max(1, settings.step || 10));
			if (settings.showSeekTitle !== false) {
				text = StateManager.getInstance().formatSeekButtonTemplate(
					settings.titleTemplate,
					step,
					this.direction === "forward",
				);
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
