/**
 * Volume Dial Action for Stream Deck +
 *
 * UUID: com.smok3y97.ytmusicweb.volumedial
 * Features:
 * - Encoder rotation: Volume Up (clockwise) / Volume Down (counter-clockwise) with 1%-50% step
 * - Dial push & touch tap: Toggle Mute / Unmute
 * - Push-Jitter Lock: eliminates accidental volume changes during dial push
 * - Dynamic LCD Touchstrip feedback: Volume Bar, Volume %, Muted state indicator, and Album Art / Icon
 */
import {
	action,
	DialDownEvent,
	DialRotateEvent,
	KeyDownEvent,
	TitleParametersDidChangeEvent,
	TouchTapEvent,
	WillAppearEvent,
	WillDisappearEvent,
} from "@elgato/streamdeck";

import { ImageRenderer } from "../services/image-renderer.js";
import { StateManager } from "../services/state-manager.js";
import { WebSocketService } from "../services/websocket-server.js";
import { VolumeDialSettings, YTMPlaybackState } from "../types/index.js";
import { BaseDialAction } from "./base-dial-action.js";

@action({ UUID: "com.smok3y97.ytmusicweb.volumedial" })
export class VolumeDialAction extends BaseDialAction<VolumeDialSettings> {
	private dialTitles: Map<string, string> = new Map();

	override async onWillAppear(ev: WillAppearEvent<VolumeDialSettings>): Promise<void> {
		if ("title" in ev.payload && typeof ev.payload.title === "string" && ev.payload.title) {
			this.dialTitles.set(ev.action.id, ev.payload.title);
		}
		await super.onWillAppear(ev);
	}

	override async onWillDisappear(ev: WillDisappearEvent<VolumeDialSettings>): Promise<void> {
		this.dialTitles.delete(ev.action.id);
		await super.onWillDisappear(ev);
	}

	override async onTitleParametersDidChange(ev: TitleParametersDidChangeEvent<VolumeDialSettings>): Promise<void> {
		if (ev.payload.title) {
			this.dialTitles.set(ev.action.id, ev.payload.title);
		} else {
			this.dialTitles.delete(ev.action.id);
		}
		const state = StateManager.getInstance().getState();
		await this.updateDialDisplay(ev.action, state, ev.payload.settings);
	}

	protected override getTitleTemplate(settings: VolumeDialSettings, actionId?: string): string {
		return (
			(actionId && this.dialTitles.get(actionId)) ||
			((settings as Record<string, unknown>).titleTemplate as string) ||
			"YouTube Music Volume"
		);
	}

	protected handleDialPress(
		_ev: DialDownEvent<VolumeDialSettings> | KeyDownEvent<VolumeDialSettings> | TouchTapEvent<VolumeDialSettings>,
	): void {
		WebSocketService.getInstance().sendCommand("toggleMute");
	}

	override async onDialRotate(ev: DialRotateEvent<VolumeDialSettings>): Promise<void> {
		if (this.isPushJitterActive()) return;

		if (StateManager.getInstance().isVersionMismatch()) {
			await ev.action.showAlert();
			return;
		}

		this.pendingTicks += ev.payload.ticks;

		// Instant optimistic feedback on LCD touchstrip
		if (ev.action.isDial()) {
			const step = Math.min(50, Math.max(1, ev.payload.settings.step || 5));
			const currentState = StateManager.getInstance().getState();
			const optimisticVolume = Math.min(100, Math.max(0, currentState.volume + this.pendingTicks * step));
			const valueText = currentState.muted ? "MUTED" : `${optimisticVolume}%`;
			const indicatorValue = currentState.muted ? 0 : optimisticVolume;

			try {
				await ev.action.setFeedback({
					value: valueText,
					indicator: indicatorValue,
				});
			} catch {}
		}

		if (this.rotationTimer) {
			clearTimeout(this.rotationTimer);
		}

		this.rotationTimer = setTimeout(() => {
			this.flushRotation(ev.payload.settings);
		}, 85);
	}

	private flushRotation(settings: VolumeDialSettings): void {
		if (this.rotationTimer) {
			clearTimeout(this.rotationTimer);
			this.rotationTimer = null;
		}

		if (this.isPushJitterActive()) {
			this.pendingTicks = 0;
			return;
		}

		const ticks = this.pendingTicks;
		this.pendingTicks = 0;

		if (ticks === 0) return;

		const step = Math.min(50, Math.max(1, settings.step || 5));
		const delta = ticks * step;

		WebSocketService.getInstance().sendCommand("adjustVolume", { delta });
	}

	protected async updateDialDisplay(
		dialAction: WillAppearEvent<VolumeDialSettings>["action"],
		state: YTMPlaybackState,
		settings: VolumeDialSettings,
	): Promise<void> {
		try {
			if (dialAction.isDial()) {
				if (await this.renderMismatchFeedback(dialAction, state, "assets/actions/volumedial/icon.svg")) {
					return;
				}

				const volPercent = Math.min(100, Math.max(0, state.volume ?? 100));
				const valueText = state.muted ? "MUTED" : `${volPercent}%`;
				const indicatorValue = state.muted ? 0 : volPercent;
				const titleText = this.getFormattedMarqueeTitle(settings, dialAction.id);

				const coverImage =
					settings.showCover !== false && state.coverBase64
						? ImageRenderer.getInstance().getCoverWithPlaybackOverlay(state.coverBase64, state.paused)
						: state.muted
							? "assets/actions/mute/muted.svg"
							: "assets/actions/volumedial/icon.svg";

				await dialAction.setFeedback({
					title: titleText,
					value: valueText,
					icon: coverImage,
					indicator: indicatorValue,
				});
			} else if (dialAction.isKey()) {
				await this.updateKeyCoverImage(dialAction, state, settings.showCover);
			}
		} catch {}
	}
}
