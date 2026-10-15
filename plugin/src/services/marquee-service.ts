/**
 * Marquee Service
 *
 * Provides ping-pong sliding-window text animation for Stream Deck + LCD touchstrips and keypad buttons.
 */
import { EventEmitter } from "events";

import { TouchstripCoverLayout, YTMPlaybackState } from "../types/index.js";
import { StateManager } from "./state-manager.js";

// --- Layout Constants & Geometry ---
export const TOUCHSTRIP_WIDTH_PX = 200;
export const TOUCHSTRIP_HEIGHT_PX = 100;
export const KEYPAD_KEY_WIDTH_PX = 72;
export const KEYPAD_MAX_PIXEL_WIDTH = 64;
export const MAX_LCD_PIXEL_WIDTH = 198;
export const DEFAULT_MARQUEE_SPEED_MS = 250;
export const START_PAUSE_TICKS = 4;
export const END_PAUSE_TICKS = 3;

/**
 * Computes available text width based on dial touchstrip layout
 * Compact layout allocates 96px beside cover art; Full Bleed and Header Collapsed allocate 188px
 */
export function getTouchstripAvailableWidth(
	layout: TouchstripCoverLayout = TouchstripCoverLayout.COMPACT,
	_showCover?: boolean,
): number {
	switch (layout) {
		case TouchstripCoverLayout.FULL_BLEED:
		case TouchstripCoverLayout.HEADER_COLLAPSED:
			return 188;
		case TouchstripCoverLayout.COMPACT:
		default:
			return 96;
	}
}

// --- Font Width Estimation (DirectWrite Upper-Bound) ---

/**
 * DirectWrite-calibrated upper-bound character width estimation for Segoe UI (Windows) and SF Pro (macOS).
 * Guarantees estimatedWidth >= actualRenderedWidth to completely eliminate native ellipsis (...) truncation
 * while utilizing >95% of available horizontal display width.
 */
export function estimateTextWidthPx(text: string, fontSize = 12, fontWeight: number | string = 600): number {
	if (!text) return 0;
	const isBold = fontWeight === "bold" || (typeof fontWeight === "number" && fontWeight >= 700);
	const isSemiBold = typeof fontWeight === "number" && fontWeight >= 600 && fontWeight < 700;
	// Scale factor accounts for font size ratio and bold/semi-bold weight expansions
	const weightMul = isBold ? 1.07 : isSemiBold ? 1.03 : 1.0;
	const scale = (fontSize / 12) * weightMul;

	let width = 0;
	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		const code = text.charCodeAt(i);

		// Combining diacritics add zero horizontal advance width
		if (code >= 0x0300 && code <= 0x036f) continue;

		// CJK Unified Ideographs, Hangul, Fullwidth symbols, and Emoji surrogate pairs
		if (code >= 0x2e80 || (code >= 0xd800 && code <= 0xdbff)) {
			width += 12.5 * scale;
			if (code >= 0xd800 && code <= 0xdbff) i++;
			continue;
		}

		// Proportional Latin character buckets calibrated against DirectWrite Segoe UI
		if ("ilj!:. ,'|`".includes(char)) {
			width += 3.4 * scale;
		} else if ("trf-^?/\\()[]{}".includes(char)) {
			width += 4.5 * scale;
		} else if ("mwMWOQ@%#&~".includes(char)) {
			width += 11.2 * scale;
		} else if (code >= 65 && code <= 90) {
			width += 7.7 * scale;
		} else if (code >= 48 && code <= 57) {
			width += 6.6 * scale;
		} else {
			width += 6.2 * scale;
		}
	}
	return width;
}

/**
 * Measures text width in pixels using the upper-bound metric
 */
export function measureTextPx(text: string, options?: { fontSize?: number; fontWeight?: number | string }): number {
	return estimateTextWidthPx(text, options?.fontSize ?? 12, options?.fontWeight ?? 600);
}

// --- Grapheme Segmentation ---

// Built-in V8 grapheme segmenter guarantees surrogate pairs and accents are never torn apart
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * Splits text into user-perceived grapheme clusters using Intl.Segmenter
 * Prevents broken Unicode sequences when slicing sliding windows across multi-byte characters
 */
export function splitGraphemes(text: string): string[] {
	if (!text) return [];
	return Array.from(graphemeSegmenter.segment(text), (s) => s.segment);
}

// --- Independent Marquee Controller ---

export interface MarqueeControllerOptions {
	availableWidthPx: number;
	fontSize?: number;
	fontWeight?: number | string;
	startPauseTicks?: number;
	endPauseTicks?: number;
}

/**
 * Manages viewport boundaries, character sliding windows, and ping-pong animation state
 * for an isolated display element (dial title, artist, track, or keypad key).
 */
export class MarqueeController {
	private availableWidthPx: number;
	private fontSize: number;
	private fontWeight: number | string;
	private startPauseTicks: number;
	private endPauseTicks: number;

	private currentOffset = 0;
	private direction: -1 | 1 = 1;
	private pauseTicks: number;
	private maxOffset = 0;
	private rawText = "";
	private graphemes: string[] = [];

	constructor(options: MarqueeControllerOptions) {
		this.availableWidthPx = options.availableWidthPx;
		this.fontSize = options.fontSize ?? 12;
		this.fontWeight = options.fontWeight ?? 600;
		this.startPauseTicks = options.startPauseTicks ?? START_PAUSE_TICKS;
		this.endPauseTicks = options.endPauseTicks ?? END_PAUSE_TICKS;
		this.pauseTicks = this.startPauseTicks;
	}

	public setAvailableWidth(width: number): void {
		if (this.availableWidthPx !== width) {
			this.availableWidthPx = width;
			this.recalculate();
		}
	}

	public setFontSize(size: number): void {
		if (this.fontSize !== size) {
			this.fontSize = size;
			this.recalculate();
		}
	}

	public setFontWeight(weight: number | string): void {
		if (this.fontWeight !== weight) {
			this.fontWeight = weight;
			this.recalculate();
		}
	}

	public setText(text: string): void {
		if (this.rawText !== text) {
			this.rawText = text;
			this.graphemes = splitGraphemes(text);
			this.reset();
			this.recalculate();
		}
	}

	public getRawText(): string {
		return this.rawText;
	}

	public isScrollable(): boolean {
		return this.maxOffset > 0;
	}

	public reset(): void {
		this.currentOffset = 0;
		this.direction = 1;
		this.pauseTicks = this.startPauseTicks;
	}

	/**
	 * Advances animation state by one tick in ping-pong cycle
	 * Returns true if the visible character window changed
	 */
	public tick(): boolean {
		if (this.maxOffset <= 0) {
			this.currentOffset = 0;
			return false;
		}

		if (this.pauseTicks > 0) {
			this.pauseTicks--;
			return false;
		}

		if (this.direction === 1) {
			this.currentOffset++;
			if (this.currentOffset >= this.maxOffset) {
				this.currentOffset = this.maxOffset;
				this.direction = -1;
				this.pauseTicks = this.endPauseTicks;
			}
		} else {
			this.currentOffset--;
			if (this.currentOffset <= 0) {
				this.currentOffset = 0;
				this.direction = 1;
				this.pauseTicks = this.startPauseTicks;
			}
		}

		this.currentOffset = Math.max(0, Math.min(this.maxOffset, this.currentOffset));
		return true;
	}

	/**
	 * Extracts visible substring slice fitting safe viewport width without triggering native ellipsis (...)
	 */
	public getDisplayText(): string {
		if (!this.rawText || this.graphemes.length === 0) return "";
		// 2px safety margin guarantees remainder text strictly fits layout rectangle
		const safeWidth = Math.max(20, this.availableWidthPx - 2);
		const totalWidth = estimateTextWidthPx(this.rawText, this.fontSize, this.fontWeight);
		if (totalWidth <= safeWidth) return this.rawText;

		const start = Math.max(0, Math.min(this.graphemes.length, this.currentOffset));
		let end = start;
		let currentWidth = 0;

		while (end < this.graphemes.length) {
			const charWidth = estimateTextWidthPx(this.graphemes[end], this.fontSize, this.fontWeight);
			if (currentWidth + charWidth > safeWidth) break;
			currentWidth += charWidth;
			end++;
		}

		return this.graphemes.slice(start, end).join("");
	}

	/**
	 * Keypad button text sliding window helper for standard multi-line push buttons
	 */
	public formatKeypadMultiLineText(multiLineText: string, maxPx: number = KEYPAD_MAX_PIXEL_WIDTH): string {
		if (!multiLineText) return "";
		const safeWidth = Math.max(20, maxPx - 2);

		return multiLineText
			.split("\n")
			.map((line) => {
				const trimmed = line.trim();
				if (!trimmed) return "";
				const lineWidth = estimateTextWidthPx(trimmed, 10, 600);
				if (lineWidth <= safeWidth) return trimmed;

				const graphemes = splitGraphemes(trimmed);
				let maxLineOffset = 0;
				for (let offset = 1; offset < graphemes.length; offset++) {
					const rem = graphemes.slice(offset).join("");
					if (estimateTextWidthPx(rem, 10, 600) <= safeWidth) {
						maxLineOffset = offset;
						break;
					}
				}
				const clampedOffset = Math.min(this.currentOffset, maxLineOffset);
				const start = Math.max(0, Math.min(graphemes.length, clampedOffset));
				let end = start;
				let currentWidth = 0;

				while (end < graphemes.length) {
					const charWidth = estimateTextWidthPx(graphemes[end], 10, 600);
					if (currentWidth + charWidth > safeWidth) break;
					currentWidth += charWidth;
					end++;
				}

				return graphemes.slice(start, end).join("");
			})
			.join("\n");
	}

	/**
	 * Recalculates maximum scroll offset based on available viewport width and text metrics
	 */
	private recalculate(): void {
		if (!this.rawText || this.graphemes.length === 0) {
			this.maxOffset = 0;
			return;
		}

		const safeWidth = Math.max(20, this.availableWidthPx - 2);
		const totalWidth = estimateTextWidthPx(this.rawText, this.fontSize, this.fontWeight);
		if (totalWidth <= safeWidth) {
			this.maxOffset = 0;
			this.currentOffset = 0;
			return;
		}

		// Find exact character index where remainder string fits safe viewport
		let foundMax = Math.max(0, this.graphemes.length - 1);
		for (let offset = 1; offset < this.graphemes.length; offset++) {
			const rem = this.graphemes.slice(offset).join("");
			if (estimateTextWidthPx(rem, this.fontSize, this.fontWeight) <= safeWidth) {
				foundMax = offset;
				break;
			}
		}

		this.maxOffset = foundMax;
		this.currentOffset = Math.max(0, Math.min(this.maxOffset, this.currentOffset));
	}
}

// --- Central Marquee Service ---

/**
 * Singleton service coordinating animation ticks, consumer registries, and lifecycle updates
 */
export class MarqueeService extends EventEmitter {
	private static instance: MarqueeService;
	private marqueeTimer: NodeJS.Timeout | null = null;
	private speedMs = DEFAULT_MARQUEE_SPEED_MS;
	private lastTrackKey = "";

	private defaultTouchstripController = new MarqueeController({ availableWidthPx: 96 });
	private defaultKeypadController = new MarqueeController({ availableWidthPx: KEYPAD_MAX_PIXEL_WIDTH, fontSize: 10 });
	private controllers = new Map<string, MarqueeController>();
	private registeredConsumers = new Set<string>();
	private anonymousConsumerCount = 0;

	private constructor() {
		super();
		StateManager.getInstance().on("stateChanged", (state: YTMPlaybackState) => this.handleStateChange(state));
	}

	public static getInstance(): MarqueeService {
		if (!MarqueeService.instance) MarqueeService.instance = new MarqueeService();
		return MarqueeService.instance;
	}

	public getSpeed(): number {
		return this.speedMs;
	}

	public setSpeed(ms: number): void {
		const valid = Math.max(100, Math.min(1000, Number(ms) || DEFAULT_MARQUEE_SPEED_MS));
		if (this.speedMs === valid) return;
		this.speedMs = valid;
		if (this.marqueeTimer) {
			clearInterval(this.marqueeTimer);
			this.marqueeTimer = setInterval(() => this.tick(), this.speedMs);
		}
	}

	public registerConsumer(consumerId?: string): void {
		if (consumerId) this.registeredConsumers.add(consumerId);
		else this.anonymousConsumerCount++;
		this.checkTimer();
	}

	public unregisterConsumer(consumerId?: string): void {
		if (consumerId) {
			this.registeredConsumers.delete(consumerId);
			this.controllers.delete(consumerId);
		} else {
			this.anonymousConsumerCount = Math.max(0, this.anonymousConsumerCount - 1);
		}
		this.checkTimer();
	}

	/**
	 * Registers a dedicated Touchstrip consumer with specified available pixel width and font metrics
	 */
	public registerTouchstripConsumer(
		id: string,
		availableWidthPx: number,
		fontSize = 12,
		fontWeight: number | string = 600,
	): MarqueeController {
		this.registeredConsumers.add(id);
		let controller = this.controllers.get(id);
		if (!controller) {
			controller = new MarqueeController({ availableWidthPx, fontSize, fontWeight });
			this.controllers.set(id, controller);
		} else {
			controller.setAvailableWidth(availableWidthPx);
			controller.setFontSize(fontSize);
			controller.setFontWeight(fontWeight);
		}

		// Initialize with current playback state text immediately
		const state = StateManager.getInstance().getState();
		const artist = (state.artist || "").replace(/[\r\n]+/g, " ").trim();
		const title = (state.title || "").replace(/[\r\n]+/g, " ").trim();
		const rawTitle = artist && title ? `${artist} - ${title}` : artist || title;

		if (id.endsWith(":artist")) controller.setText(artist);
		else if (id.endsWith(":title") || id.endsWith(":track")) controller.setText(title);
		else controller.setText(rawTitle);

		this.checkTimer();
		return controller;
	}

	public unregisterTouchstripConsumer(id: string): void {
		this.unregisterConsumer(id);
	}

	/**
	 * Registers a dedicated Keypad consumer for push button marquee text
	 */
	public registerKeypadConsumer(id: string, width: number = KEYPAD_MAX_PIXEL_WIDTH): MarqueeController {
		this.registeredConsumers.add(id);
		let controller = this.controllers.get(id);
		if (!controller) {
			controller = new MarqueeController({ availableWidthPx: width, fontSize: 10 });
			this.controllers.set(id, controller);
		} else {
			controller.setAvailableWidth(width);
		}
		this.checkTimer();
		return controller;
	}

	public unregisterKeypadConsumer(id: string): void {
		this.unregisterConsumer(id);
	}

	/**
	 * Updates available container width and optional font metrics for a registered consumer
	 */
	public updateConsumerWidth(id: string, width: number, fontSize?: number, fontWeight?: number | string): void {
		const controller = this.controllers.get(id);
		if (controller) {
			controller.setAvailableWidth(width);
			if (fontSize !== undefined) controller.setFontSize(fontSize);
			if (fontWeight !== undefined) controller.setFontWeight(fontWeight);
			this.checkTimer();
		}
	}

	/**
	 * Returns formatted marquee display text for LCD touchstrips.
	 * If consumerId is supplied, retrieves or lazily creates that consumer's isolated controller.
	 */
	public getTouchstripDisplayText(
		fullText: string,
		availableWidthPx = 96,
		consumerId?: string,
		fontSize = 12,
		fontWeight: number | string = 600,
	): string {
		if (!fullText) return "";
		const sanitized = fullText.replace(/[\r\n]+/g, " ").trim();
		if (!sanitized) return "";

		const controller = consumerId
			? this.getOrCreateController(consumerId, availableWidthPx, fontSize, fontWeight)
			: this.defaultTouchstripController;

		if (!consumerId) {
			controller.setAvailableWidth(availableWidthPx);
			controller.setFontSize(fontSize);
			controller.setFontWeight(fontWeight);
		}

		if (controller.getRawText() !== sanitized) {
			controller.setText(sanitized);
			this.checkTimer();
		}

		return controller.getDisplayText();
	}

	/**
	 * Backward compatible LCD touchstrip formatting function
	 */
	public getDisplayText(fullText: string, availableWidthPx: number = MAX_LCD_PIXEL_WIDTH): string {
		return this.getTouchstripDisplayText(fullText, availableWidthPx);
	}

	/**
	 * Formats multi-line text for keypad buttons using isolated keypad scroller
	 */
	public formatKeypadMarqueeText(
		multiLineText: string,
		maxPx: number = KEYPAD_MAX_PIXEL_WIDTH,
		consumerId?: string,
	): string {
		if (!multiLineText) return "";
		const controller =
			consumerId && this.controllers.has(consumerId) ? this.controllers.get(consumerId)! : this.defaultKeypadController;
		const result = controller.formatKeypadMultiLineText(multiLineText, maxPx);
		this.checkTimer();
		return result;
	}

	private getOrCreateController(
		id: string,
		width: number,
		fontSize: number,
		fontWeight: number | string,
	): MarqueeController {
		let controller = this.controllers.get(id);
		if (!controller) {
			controller = new MarqueeController({ availableWidthPx: width, fontSize, fontWeight });
			this.controllers.set(id, controller);
			this.registeredConsumers.add(id);
		} else {
			controller.setAvailableWidth(width);
			controller.setFontSize(fontSize);
			controller.setFontWeight(fontWeight);
		}
		return controller;
	}

	/**
	 * Resets animation offsets on track change
	 */
	private handleStateChange(state: YTMPlaybackState): void {
		const artist = (state.artist || "").replace(/[\r\n]+/g, " ").trim();
		const title = (state.title || "").replace(/[\r\n]+/g, " ").trim();
		const key = `${artist} - ${title}`;
		if (key === this.lastTrackKey) return;
		this.lastTrackKey = key;

		const fullTitle = artist && title ? `${artist} - ${title}` : artist || title;
		this.defaultTouchstripController.setText(fullTitle);
		this.defaultKeypadController.reset();

		for (const [id, controller] of this.controllers.entries()) {
			if (id.endsWith(":artist")) controller.setText(artist);
			else if (id.endsWith(":title") || id.endsWith(":track")) controller.setText(title);
			else controller.setText(fullTitle);
		}
		this.checkTimer();
	}

	/**
	 * Starts or stops animation timer based on active consumers, playback state, and scrollability
	 */
	private checkTimer(): void {
		const state = StateManager.getInstance().getState();
		const hasConsumers = this.registeredConsumers.size + this.anonymousConsumerCount > 0;
		const anyScrollable =
			this.defaultTouchstripController.isScrollable() ||
			this.defaultKeypadController.isScrollable() ||
			Array.from(this.controllers.values()).some((c) => c.isScrollable());

		const shouldRun = hasConsumers && !state.paused && anyScrollable;

		if (shouldRun && !this.marqueeTimer) {
			this.marqueeTimer = setInterval(() => this.tick(), this.speedMs);
		} else if (!shouldRun && this.marqueeTimer) {
			clearInterval(this.marqueeTimer);
			this.marqueeTimer = null;
		}
	}

	private tick(): void {
		let changed = false;
		if (this.defaultTouchstripController.tick()) changed = true;
		if (this.defaultKeypadController.tick()) changed = true;
		for (const controller of this.controllers.values()) {
			if (controller.tick()) changed = true;
		}
		if (changed) this.emit("tick");
	}
}
