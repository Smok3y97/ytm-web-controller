/**
 * Seek Dial Action for Stream Deck +
 *
 * UUID: com.smok3y97.ytmusicweb.seekdial
 * Features:
 * - Encoder rotation: Quick Seeking / Scrubbing in Track (customizable 5s - 120s step, default 10s)
 * - Dial push & touch tap: Play / Pause toggle
 * - Push-Jitter Lock: eliminates accidental track seeking during dial push
 * - Dynamic LCD Touchstrip feedback: Album Cover, Song Title (Marquee), Live Time / Duration, Progress Bar
 */
import {
	action,
	DialDownEvent,
	DialRotateEvent,
	KeyDownEvent,
	TouchTapEvent,
	WillAppearEvent,
	WillDisappearEvent,
} from "@elgato/streamdeck";

import { ImageRenderer } from "../services/image-renderer.js";
import { StateManager } from "../services/state-manager.js";
import { WebSocketService } from "../services/websocket-server.js";
import { SeekDialSettings, YTMPlaybackState } from "../types/index.js";
import { BaseDialAction } from "./base-dial-action.js";

@action({ UUID: "com.smok3y97.ytmusicweb.seekdial" })
export class SeekDialAction extends BaseDialAction<SeekDialSettings> {
	private lastTargetSeconds: Map<string, number> = new Map();

	override async onWillDisappear(ev: WillDisappearEvent<SeekDialSettings>): Promise<void> {
		const actionId = ev.action.id;
		this.lastTargetSeconds.delete(actionId);
		await super.onWillDisappear(ev);
	}

	override async onDialDown(ev: DialDownEvent<SeekDialSettings>): Promise<void> {
		this.lastTargetSeconds.delete(ev.action.id);
		await super.onDialDown(ev);
	}

	protected handleDialPress(
		_ev: DialDownEvent<SeekDialSettings> | KeyDownEvent<SeekDialSettings> | TouchTapEvent<SeekDialSettings>,
	): void {
		WebSocketService.getInstance().sendCommand("playPause");
	}

	override async onDialRotate(ev: DialRotateEvent<SeekDialSettings>): Promise<void> {
		if (ev.payload.settings) {
			this.actionSettings.set(ev.action.id, ev.payload.settings);
		}

		await this.handleRotaryStream(ev.action, ev.payload.ticks, {
			renderOptimistic: async (ticks) => {
				await this.renderOptimisticFeedback(ev.action, ev.action.id, ticks);
			},
			flush: async (ticks) => {
				await this.dispatchSeekDelta(ev.action, ev.action.id, ticks);
			},
			settle: () => {
				this.lastTargetSeconds.delete(ev.action.id);
			},
		});
	}

	private async renderOptimisticFeedback(
		action: DialRotateEvent<SeekDialSettings>["action"],
		actionId: string,
		ticks: number,
	): Promise<void> {
		if (!action.isDial()) return;
		const settings = this.actionSettings.get(actionId) || {};
		const step = Math.min(120, Math.max(1, settings.seekStep || 10));
		const currentState = StateManager.getInstance().getState();
		const baseSeconds = this.lastTargetSeconds.get(actionId) ?? StateManager.getInstance().getInterpolatedCurrentTime();
		const optimisticSeconds = Math.min(currentState.duration || Infinity, Math.max(0, baseSeconds + ticks * step));

		const indicatorValue =
			currentState.duration > 0
				? Math.min(100, Math.max(0, Math.round((optimisticSeconds / currentState.duration) * 100)))
				: 0;

		const timeTemplate = settings.timeTemplate || "{both}";
		const valueText = StateManager.getInstance().formatTimeTemplate(
			timeTemplate,
			optimisticSeconds,
			currentState.duration,
		);

		this.lastRenderedValue.set(actionId, valueText);
		this.lastRenderedIndicator.set(actionId, indicatorValue);

		try {
			await action.setFeedback({
				value: valueText,
				indicator: indicatorValue,
			});
		} catch {}
	}

	private async dispatchSeekDelta(
		action: WillAppearEvent<SeekDialSettings>["action"],
		actionId: string,
		ticks: number,
	): Promise<void> {
		const settings = this.actionSettings.get(actionId) || {};
		const step = Math.min(120, Math.max(1, settings.seekStep || 10));
		const deltaSeconds = ticks * step;

		const currentState = StateManager.getInstance().getState();
		const baseSeconds = this.lastTargetSeconds.get(actionId) ?? StateManager.getInstance().getInterpolatedCurrentTime();
		const optimisticSeconds = Math.min(currentState.duration || Infinity, Math.max(0, baseSeconds + deltaSeconds));
		this.lastTargetSeconds.set(actionId, optimisticSeconds);

		// Render LCD touchstrip feedback at 10-Hz boundary
		if (action.isDial()) {
			const indicatorValue =
				currentState.duration > 0
					? Math.min(100, Math.max(0, Math.round((optimisticSeconds / currentState.duration) * 100)))
					: 0;
			const timeTemplate = settings.timeTemplate || "{both}";
			const valueText = StateManager.getInstance().formatTimeTemplate(
				timeTemplate,
				optimisticSeconds,
				currentState.duration,
			);
			this.lastRenderedValue.set(actionId, valueText);
			this.lastRenderedIndicator.set(actionId, indicatorValue);
			try {
				await action.setFeedback({
					value: valueText,
					indicator: indicatorValue,
				});
			} catch {}
		}

		WebSocketService.getInstance().sendCommand("seekRelative", { seconds: deltaSeconds });
	}

	protected override getAdditionalMarqueeFeedback(
		settings: SeekDialSettings,
		state: YTMPlaybackState,
	): { value?: string; indicator?: number } | null {
		if (state.paused || state.duration <= 0) return null;
		const curTime = StateManager.getInstance().getInterpolatedCurrentTime();
		const clamped = Math.min(curTime, state.duration);
		const indicator = Math.min(100, Math.max(0, Math.round((clamped / state.duration) * 100)));
		const value = StateManager.getInstance().formatTimeTemplate(
			settings.timeTemplate || "{both}",
			curTime,
			state.duration,
		);
		return { value, indicator };
	}

	protected async updateDialDisplay(
		dialAction: WillAppearEvent<SeekDialSettings>["action"],
		state: YTMPlaybackState,
		settings: SeekDialSettings,
	): Promise<void> {
		try {
			if (dialAction.isDial()) {
				if (await this.renderMismatchFeedback(dialAction, state, "assets/actions/seekdial/icon.svg")) {
					return;
				}

				const isRotating = this.rotationStreamTimer.has(dialAction.id) || this.rotationTimer.has(dialAction.id);
				const curTime =
					isRotating && this.lastTargetSeconds.has(dialAction.id)
						? this.lastTargetSeconds.get(dialAction.id)!
						: StateManager.getInstance().getInterpolatedCurrentTime();

				const marqueeTitle = this.getFormattedMarqueeTitle(settings, dialAction.id);
				const timeTemplate = settings.timeTemplate || "{both}";
				const timeText = StateManager.getInstance().formatTimeTemplate(timeTemplate, curTime, state.duration);
				const indicatorValue =
					state.duration > 0 ? Math.min(100, Math.max(0, Math.round((curTime / state.duration) * 100))) : 0;

				const coverImage =
					settings.showCover !== false && state.coverBase64
						? ImageRenderer.getInstance().getCoverWithPlaybackOverlay(state.coverBase64, state.paused)
						: state.paused
							? "assets/actions/playpause/play.svg"
							: "assets/actions/seekdial/icon.svg";

				this.lastRenderedTitle.set(dialAction.id, marqueeTitle);
				this.lastRenderedValue.set(dialAction.id, timeText);
				this.lastRenderedIndicator.set(dialAction.id, indicatorValue);

				await dialAction.setFeedback({
					title: marqueeTitle,
					value: timeText,
					icon: coverImage,
					indicator: indicatorValue,
				});
			} else if (dialAction.isKey()) {
				await this.updateKeyCoverImage(dialAction, state, settings.showCover);
			}
		} catch {}
	}
}
