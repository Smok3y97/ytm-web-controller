/**
 * Base class for Volume Up / Down Keypad Actions
 */
import { KeyDownEvent } from "@elgato/streamdeck";

import { StateManager } from "../services/state-manager.js";
import { WebSocketService } from "../services/websocket-server.js";
import { VolumeSettings, YTMPlaybackState } from "../types/index.js";
import { BaseKeypadTemplateAction } from "./base-keypad-action.js";

export abstract class BaseVolumeAction extends BaseKeypadTemplateAction<VolumeSettings> {
	protected abstract readonly command: "volumeDown" | "volumeUp";
	protected abstract calculateOptimisticVolume(currentVolume: number, step: number): number;

	protected override get actionKey(): string {
		return this.command === "volumeUp" ? "volumeup" : "volumedown";
	}

	protected override async handleActionKeyDown(ev: KeyDownEvent<VolumeSettings>): Promise<void> {
		const step = Math.min(50, Math.max(1, ev.payload.settings.step || 5));
		const currentState = StateManager.getInstance().getState();
		const optimisticVolume = this.calculateOptimisticVolume(currentState.volume, step);

		// Instant optimistic feedback on key
		if (ev.payload.settings.showVolumeTitle !== false) {
			const template = ev.payload.settings.titleTemplate || "{volume}%";
			const text = StateManager.getInstance().formatVolumeTemplate(template, optimisticVolume, false);
			await this.setOptimisticTitle(ev.action, text);
		}

		WebSocketService.getInstance().sendCommand("setVolume", { volume: optimisticVolume });
	}

	protected override formatDisplayTitle(state: YTMPlaybackState, settings: VolumeSettings): string {
		if (settings.showVolumeTitle !== false) {
			const template = settings.titleTemplate || "{volume}%";
			return StateManager.getInstance().formatVolumeTemplate(template, state.volume, state.muted);
		}
		return "";
	}
}
