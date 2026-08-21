/**
 * Play / Pause Action
 *
 * UUID: com.smok3y97.ytmusicweb.playpause
 * Supports single-state dynamic playback icon toggling, in-RAM song cover button backgrounds,
 * full native Title Styler compatibility, and live multi-line marquee text overlay.
 */
import {
	action,
	DidReceiveSettingsEvent,
	KeyDownEvent,
	KeyUpEvent,
	SingletonAction,
	WillAppearEvent,
	WillDisappearEvent,
} from "@elgato/streamdeck";

import { ImageRenderer } from "../services/image-renderer.js";
import { MarqueeService } from "../services/marquee-service.js";
import { StateManager } from "../services/state-manager.js";
import { getActionWarningSvgDataUrl } from "../services/warning-icons.js";
import { WebSocketService } from "../services/websocket-server.js";
import { WindowFocusService } from "../services/window-focus.js";
import { PlayPauseSettings, YTMPlaybackState } from "../types/index.js";

export const DEFAULT_PLAYPAUSE_TEMPLATE = "{artist}\n\n{song}\n\n{both}";

@action({ UUID: "com.smok3y97.ytmusicweb.playpause" })
export class PlayPauseAction extends SingletonAction<PlayPauseSettings> {
	private activeActions: Set<WillAppearEvent<PlayPauseSettings>["action"]> = new Set();
	private lastRenderedImage: Map<string, string | undefined> = new Map();
	private lastRenderedTitle: Map<string, string> = new Map();
	private lastRenderedMismatch: Map<string, boolean> = new Map();
	private registeredConsumers: Set<string> = new Set();
	private keyPressTimers: Map<string, NodeJS.Timeout> = new Map();
	private isLongPressTriggered: Map<string, boolean> = new Map();
	private readonly LONG_PRESS_THRESHOLD_MS = 450;

	constructor() {
		super();

		const stateManager = StateManager.getInstance();
		stateManager.on("stateChanged", (state: YTMPlaybackState) => {
			this.updateAllInstances(state);
		});

		const marqueeService = MarqueeService.getInstance();
		marqueeService.on("tick", () => {
			this.handleMarqueeTick();
		});
	}

	override async onWillAppear(ev: WillAppearEvent<PlayPauseSettings>): Promise<void> {
		this.activeActions.add(ev.action);
		this.lastRenderedImage.delete(ev.action.id);
		this.lastRenderedTitle.delete(ev.action.id);
		this.lastRenderedMismatch.delete(ev.action.id);
		const state = StateManager.getInstance().getState();
		await this.updateInstance(ev.action, state, ev.payload.settings);
		WebSocketService.getInstance().sendCommand("requestState");
	}

	override async onWillDisappear(ev: WillDisappearEvent<PlayPauseSettings>): Promise<void> {
		const actionId = ev.action.id;
		if (this.keyPressTimers.has(actionId)) {
			clearTimeout(this.keyPressTimers.get(actionId)!);
			this.keyPressTimers.delete(actionId);
		}
		this.isLongPressTriggered.delete(actionId);
		this.lastRenderedImage.delete(actionId);
		this.lastRenderedTitle.delete(actionId);
		this.lastRenderedMismatch.delete(actionId);
		this.syncConsumerState(actionId, false);
		this.removeActiveAction(actionId);
	}

	private removeActiveAction(actionId: string): void {
		for (const a of this.activeActions) {
			if (a.id === actionId) {
				this.activeActions.delete(a);
				break;
			}
		}
	}

	private syncConsumerState(actionId: string, needsMarquee: boolean): void {
		const isRegistered = this.registeredConsumers.has(actionId);
		if (needsMarquee && !isRegistered) {
			this.registeredConsumers.add(actionId);
			MarqueeService.getInstance().registerConsumer();
		} else if (!needsMarquee && isRegistered) {
			this.registeredConsumers.delete(actionId);
			MarqueeService.getInstance().unregisterConsumer();
		}
	}

	override async onKeyDown(ev: KeyDownEvent<PlayPauseSettings>): Promise<void> {
		if (StateManager.getInstance().isVersionMismatch()) {
			if (ev.action.isKey()) {
				await ev.action.showAlert();
			}
			return;
		}

		const actionId = ev.action.id;
		this.isLongPressTriggered.set(actionId, false);

		if (this.keyPressTimers.has(actionId)) {
			clearTimeout(this.keyPressTimers.get(actionId)!);
			this.keyPressTimers.delete(actionId);
		}

		const timer = setTimeout(async () => {
			this.isLongPressTriggered.set(actionId, true);
			this.keyPressTimers.delete(actionId);

			// 1. Send WebSocket focus command to browser extension
			WebSocketService.getInstance().sendCommand("focusTab");

			// 2. Bring window to front at OS level via Win32 bypass
			WindowFocusService.getInstance().bringToFront();

			if (ev.action.isKey()) {
				await ev.action.showOk();
			}
		}, this.LONG_PRESS_THRESHOLD_MS);

		this.keyPressTimers.set(actionId, timer);
	}

	override async onKeyUp(ev: KeyUpEvent<PlayPauseSettings>): Promise<void> {
		const actionId = ev.action.id;

		if (this.keyPressTimers.has(actionId)) {
			clearTimeout(this.keyPressTimers.get(actionId)!);
			this.keyPressTimers.delete(actionId);
		}

		const wasLongPress = this.isLongPressTriggered.get(actionId);
		this.isLongPressTriggered.delete(actionId);

		if (wasLongPress) {
			// Handled in long press timer; ignore release
			return;
		}

		if (StateManager.getInstance().isVersionMismatch()) {
			return;
		}

		// Normal short press: toggle play / pause
		WebSocketService.getInstance().sendCommand("playPause");
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<PlayPauseSettings>): Promise<void> {
		this.lastRenderedImage.delete(ev.action.id);
		this.lastRenderedTitle.delete(ev.action.id);
		const state = StateManager.getInstance().getState();
		await this.updateInstance(ev.action, state, ev.payload.settings);
	}

	private async updateAllInstances(state: YTMPlaybackState): Promise<void> {
		for (const actionInstance of this.activeActions) {
			try {
				const settings = await actionInstance.getSettings();
				await this.updateInstance(actionInstance, state, settings);
			} catch {}
		}
	}

	private async handleMarqueeTick(): Promise<void> {
		const state = StateManager.getInstance().getState();
		if (state.paused || state.isVersionMismatch) return;

		for (const actionInstance of this.activeActions) {
			if (!actionInstance.isKey()) continue;
			try {
				const settings = await actionInstance.getSettings();
				if (!settings.showTitle) continue;

				const rawTemplate = settings.titleTemplate?.trim();
				const template = rawTemplate ? settings.titleTemplate : DEFAULT_PLAYPAUSE_TEMPLATE;
				const rawFormatted = StateManager.getInstance().formatTrackText(template, state);
				const marqueeTitle = MarqueeService.getInstance().formatKeypadMarqueeText(rawFormatted);

				const prevTitle = this.lastRenderedTitle.get(actionInstance.id);
				if (prevTitle !== marqueeTitle) {
					await actionInstance.setTitle(marqueeTitle);
					this.lastRenderedTitle.set(actionInstance.id, marqueeTitle);
				}
			} catch {}
		}
	}

	private async updateInstance(
		actionInstance: WillAppearEvent<PlayPauseSettings>["action"],
		state: YTMPlaybackState,
		settings: PlayPauseSettings,
	): Promise<void> {
		if (!actionInstance.isKey()) return;

		try {
			const isMismatch = !!state.isVersionMismatch;
			const prevMismatch = this.lastRenderedMismatch.get(actionInstance.id);

			if (isMismatch) {
				this.syncConsumerState(actionInstance.id, false);
				if (prevMismatch !== true) {
					await actionInstance.setTitle("");
					await actionInstance.setImage(getActionWarningSvgDataUrl("playpause"));
					this.lastRenderedMismatch.set(actionInstance.id, true);
					this.lastRenderedImage.set(actionInstance.id, getActionWarningSvgDataUrl("playpause"));
					this.lastRenderedTitle.set(actionInstance.id, "");
				}
				return;
			}

			// 1. Calculate target custom image (Cover art or standard Play/Pause SVG icon)
			let targetImage: string | undefined = undefined;
			if (settings.showCoverAsBackground !== false && (state.coverBase64 || state.coverUrl)) {
				const rawCover = state.coverBase64 || (await ImageRenderer.getInstance().getCoverAsBase64(state.coverUrl));
				if (rawCover) {
					targetImage = ImageRenderer.getInstance().getCoverWithPlaybackOverlay(rawCover, state.paused);
				}
			}

			if (!targetImage) {
				targetImage = state.paused ? "assets/actions/playpause/play.svg" : "assets/actions/playpause/pause.svg";
			}

			const hasPrevImage = this.lastRenderedImage.has(actionInstance.id);
			const prevImage = this.lastRenderedImage.get(actionInstance.id);
			if (!hasPrevImage || prevImage !== targetImage || prevMismatch === true) {
				await actionInstance.setImage(targetImage);
				this.lastRenderedImage.set(actionInstance.id, targetImage);
			}

			// 2. Calculate and set key title (Artist / Title / Time with Marquee support)
			let titleText = "";
			const needsMarquee = !!settings.showTitle;
			this.syncConsumerState(actionInstance.id, needsMarquee);

			if (settings.showTitle) {
				const rawTemplate = settings.titleTemplate?.trim();
				const template = rawTemplate ? settings.titleTemplate : DEFAULT_PLAYPAUSE_TEMPLATE;
				const rawFormatted = StateManager.getInstance().formatTrackText(template, state);
				titleText = MarqueeService.getInstance().formatKeypadMarqueeText(rawFormatted);
			}

			const prevTitle = this.lastRenderedTitle.get(actionInstance.id);
			if (prevTitle !== titleText || prevMismatch === true) {
				await actionInstance.setTitle(titleText);
				this.lastRenderedTitle.set(actionInstance.id, titleText);
			}

			this.lastRenderedMismatch.set(actionInstance.id, false);
		} catch {}
	}
}
