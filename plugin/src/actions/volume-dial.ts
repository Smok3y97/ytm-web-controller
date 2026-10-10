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
	private lastTargetVolume: Map<string, number> = new Map();

	override async onWillAppear(ev: WillAppearEvent<VolumeDialSettings>): Promise<void> {
		if ("title" in ev.payload && typeof ev.payload.title === "string" && ev.payload.title) {
			this.dialTitles.set(ev.action.id, ev.payload.title);
		}
		await super.onWillAppear(ev);
	}

	override async onWillDisappear(ev: WillDisappearEvent<VolumeDialSettings>): Promise<void> {
		const actionId = ev.action.id;
		this.dialTitles.delete(actionId);
		this.lastTargetVolume.delete(actionId);
		await super.onWillDisappear(ev);
	}

	override async onDialDown(ev: DialDownEvent<VolumeDialSettings>): Promise<void> {
		this.lastTargetVolume.delete(ev.action.id);
		await super.onDialDown(ev);
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
		if (ev.payload.settings) {
			this.actionSettings.set(ev.action.id, ev.payload.settings);
		}

		await this.handleRotaryStream(ev.action, ev.payload.ticks, {
			renderOptimistic: async (ticks) => {
				await this.renderOptimisticFeedback(ev.action, ev.action.id, ticks);
			},
			flush: async (ticks, alreadyRendered) => {
				await this.dispatchVolumeDelta(ev.action, ev.action.id, ticks, alreadyRendered);
			},
			settle: () => {
				this.lastTargetVolume.delete(ev.action.id);
			},
		});
	}

	private async renderVolumeLcd(
		action: WillAppearEvent<VolumeDialSettings>["action"],
		volume: number,
		muted: boolean,
	): Promise<void> {
		if (!action.isDial()) return;
		const valueText = muted ? "MUTED" : `${volume}%`;
		const indicatorValue = muted ? 0 : volume;

		try {
			await action.setFeedback({
				value: valueText,
				indicator: indicatorValue,
			});
		} catch {}
	}

	private async renderOptimisticFeedback(
		action: DialRotateEvent<VolumeDialSettings>["action"],
		actionId: string,
		ticks: number,
	): Promise<void> {
		if (!action.isDial()) return;
		const settings = this.actionSettings.get(actionId) || {};
		const step = Math.min(50, Math.max(1, settings.step || 5));
		const currentState = StateManager.getInstance().getState();
		const baseVol = this.lastTargetVolume.get(actionId) ?? currentState.volume ?? 100;
		const optimisticVolume = Math.min(100, Math.max(0, baseVol + ticks * step));

		await this.renderVolumeLcd(action, optimisticVolume, currentState.muted);
	}

	private async dispatchVolumeDelta(
		action: WillAppearEvent<VolumeDialSettings>["action"],
		actionId: string,
		ticks: number,
		alreadyRendered?: boolean,
	): Promise<void> {
		const settings = this.actionSettings.get(actionId) || {};
		const step = Math.min(50, Math.max(1, settings.step || 5));
		const currentState = StateManager.getInstance().getState();
		const baseVol = this.lastTargetVolume.get(actionId) ?? currentState.volume ?? 100;
		const targetVol = Math.min(100, Math.max(0, baseVol + ticks * step));
		this.lastTargetVolume.set(actionId, targetVol);

		if (!alreadyRendered) {
			await this.renderVolumeLcd(action, targetVol, currentState.muted);
		}

		WebSocketService.getInstance().sendCommand("setVolume", { volume: targetVol });
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

				const isRotating = this.rotationStreamTimer.has(dialAction.id) || this.rotationTimer.has(dialAction.id);
				const volPercent =
					isRotating && this.lastTargetVolume.has(dialAction.id)
						? this.lastTargetVolume.get(dialAction.id)!
						: Math.min(100, Math.max(0, state.volume ?? 100));

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
