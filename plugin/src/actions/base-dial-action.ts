/**
 * Base Class for Stream Deck + Dial & LCD Touchstrip Actions
 *
 * Centralizes lifecycle management, feedback layout registration, marquee subscriptions,
 * rotary streamer delegation, and unified state rendering.
 */
import {
	type DialAction,
	DialDownEvent,
	DialUpEvent,
	DidReceiveSettingsEvent,
	KeyDownEvent,
	SingletonAction,
	TouchTapEvent,
	WillAppearEvent,
	WillDisappearEvent,
} from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";

import { ImageRenderer } from "../services/image-renderer.js";
import { MarqueeService } from "../services/marquee-service.js";
import { DialRotaryStreamer, RotaryStreamHandlers } from "../services/rotary-streamer.js";
import { StateManager } from "../services/state-manager.js";
import { VersionControlService } from "../services/version-control.js";
import { WebSocketService } from "../services/websocket-server.js";
import { YTMPlaybackState } from "../types/index.js";

export abstract class BaseDialAction<TSettings extends JsonObject = JsonObject> extends SingletonAction<TSettings> {
	protected activeDials: Map<string, WillAppearEvent<TSettings>["action"]> = new Map();
	protected actionSettings: Map<string, TSettings> = new Map();
	protected rotaryStreamer: DialRotaryStreamer = new DialRotaryStreamer();
	protected playbackTimer: NodeJS.Timeout | null = null;
	protected renderDebounceTimer: NodeJS.Timeout | null = null;
	protected lastRenderedValue: Map<string, string> = new Map();
	protected lastRenderedIndicator: Map<string, number> = new Map();
	protected lastRenderedTitle: Map<string, string> = new Map();

	constructor() {
		super();

		const stateManager = StateManager.getInstance();
		stateManager.on("stateChanged", (state: YTMPlaybackState) => {
			this.updateAllDials(state);
		});

		const marqueeService = MarqueeService.getInstance();
		marqueeService.on("tick", () => {
			this.updateMarqueeTitles();
		});
	}

	override async onWillAppear(ev: WillAppearEvent<TSettings>): Promise<void> {
		this.activeDials.set(ev.action.id, ev.action);
		this.actionSettings.set(ev.action.id, ev.payload.settings);
		MarqueeService.getInstance().registerConsumer();

		if (ev.action.isDial()) {
			try {
				await ev.action.setFeedbackLayout("layouts/dial_layout.json");
			} catch {}
		}
		const state = StateManager.getInstance().getState();
		await this.updateDialDisplay(ev.action, state, ev.payload.settings);
		this.checkPlaybackTimer();

		// Synchronize initial dial LCD graphics immediately upon action appearance
		WebSocketService.getInstance().sendCommand("requestState");
	}

	override async onWillDisappear(ev: WillDisappearEvent<TSettings>): Promise<void> {
		const id = ev.action.id;
		this.lastRenderedValue.delete(id);
		this.lastRenderedIndicator.delete(id);
		this.lastRenderedTitle.delete(id);
		this.rotaryStreamer.cleanup(id);
		this.activeDials.delete(id);
		this.actionSettings.delete(id);
		if (this.activeDials.size === 0 && this.renderDebounceTimer) {
			clearTimeout(this.renderDebounceTimer);
			this.renderDebounceTimer = null;
		}
		MarqueeService.getInstance().unregisterConsumer();
		this.checkPlaybackTimer();
	}

	override async onDialDown(ev: DialDownEvent<TSettings>): Promise<void> {
		this.rotaryStreamer.recordPress(ev.action.id);

		if (StateManager.getInstance().isVersionMismatch()) {
			await ev.action.showAlert();
			return;
		}

		await this.handleDialPress(ev);
	}

	override async onDialUp(ev: DialUpEvent<TSettings>): Promise<void> {
		this.rotaryStreamer.recordPress(ev.action.id);
	}

	override async onTouchTap(ev: TouchTapEvent<TSettings>): Promise<void> {
		if (StateManager.getInstance().isVersionMismatch()) {
			await ev.action.showAlert();
			return;
		}
		await this.handleDialPress(ev);
	}

	override async onKeyDown(ev: KeyDownEvent<TSettings>): Promise<void> {
		if (StateManager.getInstance().isVersionMismatch()) {
			await ev.action.showAlert();
			return;
		}
		await this.handleDialPress(ev);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<TSettings>): Promise<void> {
		this.actionSettings.set(ev.action.id, ev.payload.settings);
		const state = StateManager.getInstance().getState();
		await this.updateDialDisplay(ev.action, state, ev.payload.settings);
	}

	/**
	 * Returns true if an action is currently actively rotating or settling
	 */
	protected isRotating(actionId: string): boolean {
		return this.rotaryStreamer.isRotating(actionId);
	}

	/**
	 * Push-jitter suppression: returns true if dial was pressed within last 250ms
	 */
	protected isPushJitterActive(actionId: string): boolean {
		return this.rotaryStreamer.isPushJitterActive(actionId);
	}

	/**
	 * Unified 10-Hz rotary streamer & settle controller for Stream Deck + dials
	 */
	protected async handleRotaryStream(
		dialAction: DialAction<TSettings>,
		ticksDelta: number,
		handlers: RotaryStreamHandlers,
	): Promise<void> {
		return this.rotaryStreamer.handleRotaryStream(dialAction, ticksDelta, handlers);
	}

	/**
	 * Resolves the title template for marquee LCD display (can be overridden)
	 */
	protected getTitleTemplate(settings: TSettings, _actionId?: string): string {
		return ((settings as Record<string, unknown>).titleTemplate as string) || "{artist} - {title}";
	}

	/**
	 * Gets the formatted, marquee-scrolled display title for LCD touchstrips
	 */
	protected getFormattedMarqueeTitle(settings: TSettings, actionId?: string): string {
		const rawTitle = this.getTitleTemplate(settings, actionId);
		const fullTitle = StateManager.getInstance().formatTitleTemplate(rawTitle);
		return MarqueeService.getInstance().getDisplayText(fullTitle);
	}

	/**
	 * Renders version mismatch feedback if mismatch is active. Returns true if handled.
	 */
	protected async renderMismatchFeedback(
		dialAction: WillAppearEvent<TSettings>["action"],
		state: YTMPlaybackState,
		iconPath: string,
	): Promise<boolean> {
		if (!state.isVersionMismatch) return false;
		if (dialAction.isDial()) {
			const warningTitle = VersionControlService.getInstance().getDialWarningTitle(state.extensionVersion);
			await dialAction.setFeedback({
				title: warningTitle,
				value: "Mismatch",
				icon: iconPath,
				indicator: 0,
			});
		}
		return true;
	}

	/**
	 * Renders in-RAM album cover with playback overlay for keypads (used when dial action is placed on standard key)
	 */
	protected async updateKeyCoverImage(
		dialAction: WillAppearEvent<TSettings>["action"],
		state: YTMPlaybackState,
		showCover: boolean = true,
	): Promise<void> {
		if (!dialAction.isKey()) return;
		if (showCover !== false && state.coverBase64 && !state.isVersionMismatch) {
			const keyImage = ImageRenderer.getInstance().getCoverWithPlaybackOverlay(state.coverBase64, state.paused);
			await dialAction.setImage(keyImage);
		} else {
			await dialAction.setImage(undefined);
		}
	}

	/**
	 * Action to perform on dial push, touch tap, or key down
	 */
	protected abstract handleDialPress(
		ev: DialDownEvent<TSettings> | KeyDownEvent<TSettings> | TouchTapEvent<TSettings>,
	): Promise<void> | void;

	/**
	 * Updates dial LCD touchstrip feedback and key image
	 */
	protected abstract updateDialDisplay(
		dialAction: WillAppearEvent<TSettings>["action"],
		state: YTMPlaybackState,
		settings: TSettings,
	): Promise<void>;

	/**
	 * Hook for derived dial classes to optionally provide live feedback (e.g. time/progress) on periodic ticks
	 */
	protected getPlaybackProgressFeedback(
		_settings: TSettings,
		_state: YTMPlaybackState,
	): { value?: string; indicator?: number } | null {
		return null;
	}

	/**
	 * Declares whether the dial action requires a periodic 500-ms playback timer
	 * (e.g. for time/progress bar rendering). Actions without time displays (e.g. VolumeDialAction)
	 * return false to avoid unnecessary event-loop timer wakeups.
	 */
	protected needsPlaybackTimer(): boolean {
		return false;
	}

	protected checkPlaybackTimer(): void {
		const state = StateManager.getInstance().getState();
		const shouldRun =
			this.needsPlaybackTimer() && this.activeDials.size > 0 && !state.paused && !state.isVersionMismatch;

		if (shouldRun) {
			if (!this.playbackTimer) {
				this.playbackTimer = setInterval(() => {
					this.updatePlaybackTime();
				}, 500);
			}
		} else if (this.playbackTimer) {
			clearInterval(this.playbackTimer);
			this.playbackTimer = null;
		}
	}

	protected async updatePlaybackTime(): Promise<void> {
		if (StateManager.getInstance().isVersionMismatch()) {
			return;
		}

		const state = StateManager.getInstance().getState();
		if (state.paused) {
			this.checkPlaybackTimer();
			return;
		}

		for (const [actionId, dialAction] of this.activeDials) {
			if (this.rotaryStreamer.isRotating(actionId)) {
				continue;
			}

			try {
				if (dialAction.isDial()) {
					const settings = this.actionSettings.get(actionId) ?? (await dialAction.getSettings());
					const extra = this.getPlaybackProgressFeedback(settings, state);
					if (extra) {
						const prevValue = this.lastRenderedValue.get(dialAction.id);
						const prevIndicator = this.lastRenderedIndicator.get(dialAction.id);

						const valueChanged = extra.value !== undefined && extra.value !== prevValue;
						const indicatorChanged = extra.indicator !== undefined && extra.indicator !== prevIndicator;

						if (valueChanged || indicatorChanged) {
							const feedback: { value?: string; indicator?: number } = {};
							if (extra.value !== undefined) {
								feedback.value = extra.value;
								this.lastRenderedValue.set(dialAction.id, extra.value);
							}
							if (extra.indicator !== undefined) {
								feedback.indicator = extra.indicator;
								this.lastRenderedIndicator.set(dialAction.id, extra.indicator);
							}
							await dialAction.setFeedback(feedback);
						}
					}
				}
			} catch {}
		}
	}

	protected async updateMarqueeTitles(): Promise<void> {
		if (StateManager.getInstance().isVersionMismatch()) {
			return;
		}

		const state = StateManager.getInstance().getState();

		for (const [actionId, dialAction] of this.activeDials) {
			try {
				if (dialAction.isDial()) {
					const settings = this.actionSettings.get(actionId) ?? (await dialAction.getSettings());
					const rawTitle = this.getTitleTemplate(settings, dialAction.id);
					const fullTitle = StateManager.getInstance().formatTitleTemplate(rawTitle);
					const currentText = MarqueeService.getInstance().getDisplayText(fullTitle);

					const titleChanged = currentText !== this.lastRenderedTitle.get(dialAction.id);
					const feedback: { title?: string; value?: string; indicator?: number } = {};

					if (titleChanged) {
						this.lastRenderedTitle.set(dialAction.id, currentText);
						feedback.title = currentText;
					}

					// Harmonize: Bundle progress updates into same feedback packet if changed and not actively rotating
					if (!this.rotaryStreamer.isRotating(actionId)) {
						const extra = this.getPlaybackProgressFeedback(settings, state);
						if (extra) {
							const prevValue = this.lastRenderedValue.get(dialAction.id);
							const prevIndicator = this.lastRenderedIndicator.get(dialAction.id);
							if (extra.value !== undefined && extra.value !== prevValue) {
								feedback.value = extra.value;
								this.lastRenderedValue.set(dialAction.id, extra.value);
							}
							if (extra.indicator !== undefined && extra.indicator !== prevIndicator) {
								feedback.indicator = extra.indicator;
								this.lastRenderedIndicator.set(dialAction.id, extra.indicator);
							}
						}
					}

					if (Object.keys(feedback).length > 0) {
						await dialAction.setFeedback(feedback);
					}
				}
			} catch {}
		}
	}

	protected updateAllDials(state: YTMPlaybackState): void {
		this.checkPlaybackTimer();
		if (this.renderDebounceTimer) {
			clearTimeout(this.renderDebounceTimer);
		}
		this.renderDebounceTimer = setTimeout(async () => {
			this.renderDebounceTimer = null;
			for (const [actionId, dialAction] of this.activeDials) {
				try {
					const settings = this.actionSettings.get(actionId) ?? (await dialAction.getSettings());
					await this.updateDialDisplay(dialAction, state, settings);
				} catch {}
			}
		}, 30);
	}
}
