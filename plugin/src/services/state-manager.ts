/**
 * State Manager Service
 *
 * Central in-memory state hub for YouTube Music playback data, version status, and formatting.
 */
import { EventEmitter } from "events";

import { YTMPlaybackState } from "../types/index.js";
import { ImageRenderer } from "./image-renderer.js";
import { MetadataSanitizer } from "./metadata-sanitizer.js";
import { TemplateEngine } from "./template-engine.js";

export class StateManager extends EventEmitter {
	private static instance: StateManager;
	private currentState: YTMPlaybackState = {
		title: "",
		artist: "",
		album: "",
		coverUrl: "",
		trackUrl: "",
		artistUrl: "",
		albumUrl: "",
		currentTime: 0,
		duration: 0,
		volume: 100,
		paused: true,
		playbackRate: 1,
		timestamp: Date.now(),
		muted: false,
		isLiked: false,
		isDisliked: false,
		shuffleActive: false,
		repeatMode: "OFF",
		isVersionMismatch: false,
		extensionVersion: undefined,
	};

	private constructor() {
		super();
	}

	public static getInstance(): StateManager {
		if (!StateManager.instance) {
			StateManager.instance = new StateManager();
		}
		return StateManager.instance;
	}

	public updateState(state: YTMPlaybackState): void {
		if (this.currentState.isVersionMismatch) {
			return;
		}

		const prevState = { ...this.currentState };
		const isMismatch =
			state.isVersionMismatch !== undefined ? state.isVersionMismatch : this.currentState.isVersionMismatch;
		const extVer = state.extensionVersion !== undefined ? state.extensionVersion : this.currentState.extensionVersion;

		const sanitizedAlbum = MetadataSanitizer.sanitizeAlbum(state.album);

		// Retain existing in-RAM coverBase64 if coverUrl is identical and incoming snapshot has no coverBase64
		let coverBase64 = state.coverBase64;
		if (!coverBase64 && state.coverUrl && state.coverUrl === this.currentState.coverUrl) {
			coverBase64 = this.currentState.coverBase64;
		}

		let currentTime = typeof state.currentTime === "number" && !isNaN(state.currentTime) ? state.currentTime : 0;
		const duration = typeof state.duration === "number" && !isNaN(state.duration) ? state.duration : 0;

		// Detect track transition
		const isTrackChange = Boolean(
			prevState.title &&
			state.title &&
			(prevState.title !== state.title ||
				(prevState.trackUrl && state.trackUrl && prevState.trackUrl !== state.trackUrl)),
		);

		if (isTrackChange) {
			const hasTimestampInUrl = Boolean(state.trackUrl && /[?&]t=(\d+)/.test(state.trackUrl));
			// If a new track starts without an explicit timestamp query param, reset to 0
			// This prevents continuous MSE playback offsets or stale video.currentTime from carrying over
			if (!hasTimestampInUrl && currentTime > 3) {
				currentTime = 0;
			}
		}

		// Ensure sanity: currentTime can never exceed or equal duration upon start
		if (duration > 0 && currentTime >= duration) {
			currentTime = 0;
		}

		const timestamp = state.timestamp && Math.abs(Date.now() - state.timestamp) < 60000 ? state.timestamp : Date.now();

		this.currentState = {
			...state,
			currentTime,
			duration,
			timestamp,
			coverBase64,
			album: sanitizedAlbum,
			isVersionMismatch: isMismatch,
			extensionVersion: extVer,
		};

		this.emit("stateChanged", this.currentState, prevState);

		// Asynchronously fetch cover in RAM if not yet available in Base64
		if (state.coverUrl && !this.currentState.coverBase64) {
			ImageRenderer.getInstance()
				.getCoverAsBase64(state.coverUrl)
				.then((base64) => {
					if (base64 && this.currentState.coverUrl === state.coverUrl) {
						this.currentState.coverBase64 = base64;
						this.emit("stateChanged", this.currentState, prevState);
					}
				})
				.catch(() => {});
		}
	}

	public setVersionMismatch(isMismatch: boolean, extensionVersion?: string): void {
		if (this.currentState.isVersionMismatch === isMismatch && this.currentState.extensionVersion === extensionVersion) {
			return;
		}

		const prevState = { ...this.currentState };
		this.currentState.isVersionMismatch = isMismatch;
		this.currentState.extensionVersion = extensionVersion;

		if (isMismatch) {
			this.currentState.title = "";
			this.currentState.artist = "";
			this.currentState.album = "";
			this.currentState.coverBase64 = undefined;
			this.currentState.coverUrl = "";
			this.currentState.paused = true;
			this.currentState.currentTime = 0;
			this.currentState.duration = 0;
		}

		this.emit("stateChanged", this.currentState, prevState);
	}

	public isVersionMismatch(): boolean {
		return !!this.currentState.isVersionMismatch;
	}

	public resetVersionStatus(): void {
		if (this.currentState.isVersionMismatch || this.currentState.extensionVersion) {
			const prevState = { ...this.currentState };
			this.currentState.isVersionMismatch = false;
			this.currentState.extensionVersion = undefined;
			this.emit("stateChanged", this.currentState, prevState);
		}
	}

	/**
	 * Called when all browser clients disconnect to reset active playback state
	 */
	public handleClientsDisconnected(): void {
		const prevState = { ...this.currentState };
		this.currentState.title = "";
		this.currentState.artist = "";
		this.currentState.album = "";
		this.currentState.coverUrl = "";
		this.currentState.coverBase64 = undefined;
		this.currentState.trackUrl = "";
		this.currentState.artistUrl = "";
		this.currentState.albumUrl = "";
		this.currentState.currentTime = 0;
		this.currentState.duration = 0;
		this.currentState.paused = true;
		this.currentState.isLiked = false;
		this.currentState.isDisliked = false;
		this.currentState.isVersionMismatch = false;
		this.currentState.extensionVersion = undefined;
		this.emit("stateChanged", this.currentState, prevState);
	}

	/**
	 * Computes interpolated playback position in seconds based on snapshot timestamp and playback rate
	 */
	public getInterpolatedCurrentTime(): number {
		const state = this.currentState;
		if (state.paused || !state.timestamp) {
			return Math.min(state.duration || 0, Math.max(0, state.currentTime || 0));
		}
		const elapsedSec = ((Date.now() - state.timestamp) * (state.playbackRate || 1)) / 1000;
		const interpolated = (state.currentTime || 0) + elapsedSec;
		if (state.duration > 0 && interpolated > state.duration) {
			return state.duration;
		}
		return Math.max(0, interpolated);
	}

	public getState(): YTMPlaybackState {
		return {
			...this.currentState,
			currentTime: Math.floor(this.getInterpolatedCurrentTime()),
		};
	}

	/**
	 * Format seconds to standard mm:ss or hh:mm:ss string
	 */
	public formatTime(totalSeconds: number): string {
		return TemplateEngine.formatTime(totalSeconds);
	}

	/**
	 * Render custom title template with placeholders: {artist}, {title}, {album}
	 */
	public formatTitleTemplate(template: string = "{artist} - {title}"): string {
		return TemplateEngine.formatTitleTemplate(
			template,
			this.currentState.title,
			this.currentState.artist,
			this.currentState.album,
		);
	}

	/**
	 * Render custom time template with placeholders: {current}, {duration}, {remaining}, {both}
	 */
	public formatTimeTemplate(template: string = "{both}", currentTime?: number, duration?: number): string {
		return TemplateEngine.formatTimeTemplate(
			template,
			currentTime !== undefined ? currentTime : this.getInterpolatedCurrentTime(),
			duration !== undefined ? duration : this.currentState.duration,
			this.currentState.title,
			this.currentState.artist,
		);
	}

	/**
	 * Render custom track text with placeholders: {url}, {title}, {artist}, {album}, {duration}, {currentTime}, {remaining}, {both}
	 */
	public formatTrackText(template?: string, targetState?: YTMPlaybackState): string {
		const state = targetState || this.currentState;
		const curSeconds = targetState ? targetState.currentTime : this.getInterpolatedCurrentTime();
		return TemplateEngine.formatTrackText(template, state, curSeconds);
	}

	/**
	 * Render custom volume template with placeholders: {volume}
	 */
	public formatVolumeTemplate(template: string = "{volume}%", volume?: number, muted?: boolean): string {
		return TemplateEngine.formatVolumeTemplate(
			template,
			volume !== undefined ? volume : this.currentState.volume,
			muted !== undefined ? muted : this.currentState.muted,
		);
	}

	/**
	 * Render custom seek button template with placeholders: {step}, {seconds}, {sign}
	 */
	public formatSeekButtonTemplate(template?: string, step: number = 10, isForward: boolean = true): string {
		return TemplateEngine.formatSeekButtonTemplate(template, step, isForward);
	}
}
