/**
 * Base class for Seek Keypad Actions (Fast Forward / Rewind)
 */
import { KeyDownEvent } from "@elgato/streamdeck";

import { StateManager } from "../services/state-manager.js";
import { WebSocketService } from "../services/websocket-server.js";
import { SeekButtonSettings, YTMPlaybackState } from "../types/index.js";
import { BaseKeypadTemplateAction } from "./base-keypad-action.js";

export abstract class BaseSeekAction extends BaseKeypadTemplateAction<SeekButtonSettings> {
	protected abstract readonly direction: "backward" | "forward";
	protected abstract readonly actionKey: "seekbackward" | "seekforward";

	protected override async handleActionKeyDown(ev: KeyDownEvent<SeekButtonSettings>): Promise<void> {
		const step = Math.min(120, Math.max(1, ev.payload.settings.step || 10));
		const delta = this.direction === "forward" ? step : -step;

		// Instant optimistic feedback on key
		if (ev.payload.settings.showSeekTitle !== false) {
			const text = StateManager.getInstance().formatSeekButtonTemplate(
				ev.payload.settings.titleTemplate,
				step,
				this.direction === "forward",
			);
			await this.setOptimisticTitle(ev.action, text);
		}

		WebSocketService.getInstance().sendCommand("seekRelative", { seconds: delta });
	}

	protected override formatDisplayTitle(_state: YTMPlaybackState, settings: SeekButtonSettings): string {
		if (settings.showSeekTitle !== false) {
			const step = Math.min(120, Math.max(1, settings.step || 10));
			return StateManager.getInstance().formatSeekButtonTemplate(
				settings.titleTemplate,
				step,
				this.direction === "forward",
			);
		}
		return "";
	}
}
