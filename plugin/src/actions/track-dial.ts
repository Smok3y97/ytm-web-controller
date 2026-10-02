/**
 * Track Controller Dial Action for Stream Deck +
 *
 * UUID: com.smok3y97.ytmusicweb.trackdial
 * Features:
 * - Encoder rotation: Skip Next Track (clockwise) / Previous Track (counter-clockwise)
 * - Dial push & touch tap: Play / Pause toggle
 * - Push-Jitter Lock: eliminates accidental track skipping during dial push
 * - Dynamic LCD Touchstrip feedback: Album Cover (with pause overlay), Song Title (Full-Width Marquee), Remaining Time, Progress Bar
 */
import {
	action,
	DialDownEvent,
	DialRotateEvent,
	KeyDownEvent,
	TouchTapEvent,
	WillAppearEvent,
} from "@elgato/streamdeck";

import { ImageRenderer } from "../services/image-renderer.js";
import { StateManager } from "../services/state-manager.js";
import { WebSocketService } from "../services/websocket-server.js";
import { TrackDialSettings, YTMPlaybackState } from "../types/index.js";
import { BaseDialAction } from "./base-dial-action.js";

@action({ UUID: "com.smok3y97.ytmusicweb.trackdial" })
export class TrackDialAction extends BaseDialAction<TrackDialSettings> {
	private lastTrackSkipTime: number = 0;

	protected handleDialPress(
		_ev: DialDownEvent<TrackDialSettings> | KeyDownEvent<TrackDialSettings> | TouchTapEvent<TrackDialSettings>,
	): void {
		WebSocketService.getInstance().sendCommand("playPause");
	}

	override async onDialRotate(ev: DialRotateEvent<TrackDialSettings>): Promise<void> {
		const actionId = ev.action.id;
		if (this.isPushJitterActive(actionId)) return;

		if (StateManager.getInstance().isVersionMismatch()) {
			await ev.action.showAlert();
			return;
		}

		const currentTicks = (this.pendingTicks.get(actionId) || 0) + ev.payload.ticks;
		this.pendingTicks.set(actionId, currentTicks);

		const timer = this.rotationTimer.get(actionId);
		if (!timer) {
			const newTimer = setTimeout(() => {
				this.flushRotation(actionId);
			}, 50);
			this.rotationTimer.set(actionId, newTimer);
		}
	}

	private flushRotation(actionId: string): void {
		const timer = this.rotationTimer.get(actionId);
		if (timer) {
			clearTimeout(timer);
			this.rotationTimer.delete(actionId);
		}

		if (this.isPushJitterActive(actionId)) {
			this.pendingTicks.set(actionId, 0);
			return;
		}

		const ticks = this.pendingTicks.get(actionId) || 0;
		this.pendingTicks.set(actionId, 0);

		if (ticks === 0) return;

		// Prevent rapid duplicate track skip commands during continuous dial detent rotation
		const now = Date.now();
		if (now - this.lastTrackSkipTime < 200) {
			return;
		}
		this.lastTrackSkipTime = now;

		const ws = WebSocketService.getInstance();
		if (ticks > 0) {
			ws.sendCommand("next");
		} else {
			ws.sendCommand("previous");
		}
	}

	protected override getAdditionalMarqueeFeedback(
		settings: TrackDialSettings,
		state: YTMPlaybackState,
	): { value?: string; indicator?: number } | null {
		if (state.paused || state.duration <= 0) return null;
		const curTime = StateManager.getInstance().getInterpolatedCurrentTime();
		const clampedTime = Math.min(curTime, state.duration);
		const indicator = Math.min(100, Math.max(0, Math.round((clampedTime / state.duration) * 100)));
		const value = StateManager.getInstance().formatTimeTemplate(
			settings.timeTemplate || "{both}",
			curTime,
			state.duration,
		);
		return { value, indicator };
	}

	protected async updateDialDisplay(
		dialAction: WillAppearEvent<TrackDialSettings>["action"],
		state: YTMPlaybackState,
		settings: TrackDialSettings,
	): Promise<void> {
		try {
			if (dialAction.isDial()) {
				if (await this.renderMismatchFeedback(dialAction, state, "assets/actions/trackdial/icon.svg")) {
					return;
				}

				let progressPercent = 0;
				const curTime = StateManager.getInstance().getInterpolatedCurrentTime();
				if (state.duration > 0 && curTime >= 0) {
					const clampedTime = Math.min(curTime, state.duration);
					progressPercent = Math.min(100, Math.max(0, Math.round((clampedTime / state.duration) * 100)));
				}
				const titleText = this.getFormattedMarqueeTitle(settings, dialAction.id);
				const timeText = StateManager.getInstance().formatTimeTemplate(
					settings.timeTemplate || "{both}",
					curTime,
					state.duration,
				);

				const coverImage =
					settings.showCover !== false && state.coverBase64
						? ImageRenderer.getInstance().getCoverWithPlaybackOverlay(state.coverBase64, state.paused)
						: "assets/actions/trackdial/icon.svg";

				this.lastRenderedTitle.set(dialAction.id, titleText);
				this.lastRenderedValue.set(dialAction.id, timeText);
				this.lastRenderedIndicator.set(dialAction.id, progressPercent);

				await dialAction.setFeedback({
					title: titleText,
					value: timeText,
					icon: coverImage,
					indicator: progressPercent,
				});
			} else if (dialAction.isKey()) {
				await this.updateKeyCoverImage(dialAction, state, settings.showCover);
			}
		} catch {}
	}
}
