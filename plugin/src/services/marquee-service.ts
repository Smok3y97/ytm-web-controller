import { EventEmitter } from "events";

import { TouchstripCoverLayout, YTMPlaybackState } from "../types/index.js";
import { StateManager } from "./state-manager.js";

export const TOUCHSTRIP_WIDTH_PX = 200;
export const TOUCHSTRIP_HEIGHT_PX = 100;
export const KEYPAD_KEY_WIDTH_PX = 72;
export const KEYPAD_MAX_PIXEL_WIDTH = 64; // Usable text width for standard 72x72 px Stream Deck key
export const MAX_LCD_PIXEL_WIDTH = 198; // Full touchstrip width fallback
export const DEFAULT_MARQUEE_SPEED_MS = 320; // ~3.1 Hz default reading pace
export const START_PAUSE_TICKS = 4; // Pause at the beginning before scrolling (~1.2s)
export const END_PAUSE_TICKS = 3; // Pause at the end before reversing scroll (~1.0s)

/**
 * Calculates dynamically available text width for Touchstrip layouts,
 * subtracting cover art dimensions and margins.
 */
export function getTouchstripAvailableWidth(
	layout: TouchstripCoverLayout = TouchstripCoverLayout.COMPACT,
	_showCover?: boolean,
): number {
	switch (layout) {
		case TouchstripCoverLayout.FULL_BLEED:
			// Cover renders as full 200x100 background; title overlays 200px width minus 6px padding each side
			return 188;
		case TouchstripCoverLayout.HEADER_COLLAPSED:
			// Title header spans across top 200px width minus 6px padding each side
			return 188;
		case TouchstripCoverLayout.COMPACT:
		default:
			// Side-by-Side: 200px - 88px cover - 16px (left margin + inter-item gap + right margin)
			return 96;
	}
}

export interface TextMeasureOptions {
	fontSize?: number;
	fontFamily?: string;
	fontWeight?: number | string;
}

// Bounded LRU cache for text measurements
const textWidthCache: Map<string, number> = new Map();
const MAX_CACHE_ENTRIES = 150;

type MeasureCanvasContext = {
	measureText: (text: string) => { width: number };
	font: string;
};

let cachedCanvasContext: MeasureCanvasContext | null | undefined = undefined;

function getCanvasContext(): MeasureCanvasContext | null {
	if (cachedCanvasContext !== undefined) {
		return cachedCanvasContext;
	}

	try {
		if (typeof OffscreenCanvas !== "undefined") {
			const offscreen = new OffscreenCanvas(256, 64);
			const ctx = offscreen.getContext("2d");
			if (ctx && typeof ctx.measureText === "function") {
				cachedCanvasContext = ctx as unknown as MeasureCanvasContext;
				return cachedCanvasContext;
			}
		}
	} catch {}

	try {
		if (typeof document !== "undefined" && typeof document.createElement === "function") {
			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d");
			if (ctx && typeof ctx.measureText === "function") {
				cachedCanvasContext = ctx as unknown as MeasureCanvasContext;
				return cachedCanvasContext;
			}
		}
	} catch {}

	cachedCanvasContext = null;
	return null;
}

/**
 * Proportional font metrics fallback (scales accurately with fontSize)
 * Handles multilingual text (CJK ideographs, Hangul, Katakana/Hiragana),
 * combining diacritics, umlauts/accents, emoji, and kerning heuristics.
 */
function measureProportionalTextFallback(text: string, fontSize: number, fontWeight: number | string = 600): number {
	if (!text) return 0;

	// Normalize unicode (NFC canonical composition)
	const normalized = text.normalize("NFC");
	const isBold = fontWeight === "bold" || (typeof fontWeight === "number" && fontWeight >= 700);
	const isSemiBold = typeof fontWeight === "number" && fontWeight >= 600 && fontWeight < 700;
	const weightMultiplier = isBold ? 1.08 : isSemiBold ? 1.035 : 1.0;
	const scale = (fontSize / 10) * weightMultiplier;
	let totalWidth = 0;

	for (let i = 0; i < normalized.length; i++) {
		const char = normalized[i];
		const code = char.charCodeAt(0);

		// Combining Diacritical Marks (\u0300-\u036F): zero advance width
		if (code >= 0x0300 && code <= 0x036f) {
			continue;
		}

		// Surrogate pair detection (e.g. Emoji >= 0x10000)
		if (code >= 0xd800 && code <= 0xdbff && i + 1 < normalized.length) {
			const nextCode = normalized.charCodeAt(i + 1);
			if (nextCode >= 0xdc00 && nextCode <= 0xdfff) {
				totalWidth += 11.5 * scale; // Standard emoji width (~1.15 em)
				i++; // Skip low surrogate
				continue;
			}
		}

		// Full-width CJK Unified Ideographs, Hangul, Hiragana, Katakana, Fullwidth ASCII
		if (
			(code >= 0x4e00 && code <= 0x9fff) ||
			(code >= 0x3400 && code <= 0x4dbf) ||
			(code >= 0xac00 && code <= 0xd7af) ||
			(code >= 0x3040 && code <= 0x309f) ||
			(code >= 0x30a0 && code <= 0x30ff) ||
			(code >= 0x2e80 && code <= 0x2eff) ||
			(code >= 0xf900 && code <= 0xfaff) ||
			(code >= 0xff01 && code <= 0xff60) ||
			(code >= 0xffe0 && code <= 0xffe6)
		) {
			totalWidth += 10.5 * scale; // 1.05 em
			continue;
		}

		// Halfwidth CJK Katakana (\uff61 - \uff9f)
		if (code >= 0xff61 && code <= 0xff9f) {
			totalWidth += 5.5 * scale;
			continue;
		}

		// Strip accents for base letter width measurement so ä has width of a, Ö has width of O
		const baseChar = char.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
		const checkChar = baseChar.length > 0 ? baseChar[0] : char;

		// Latin / Cyrillic / Greek glyph width categories calibrated for Segoe UI / SF Pro / Roboto
		if ("ilj!:. ,'|`".includes(checkChar)) {
			totalWidth += 2.7 * scale; // Very narrow
		} else if ("frtI[](){}/\\-^?".includes(checkChar)) {
			totalWidth += 3.6 * scale; // Narrow
		} else if ("mwMW@%#&~".includes(checkChar)) {
			totalWidth += 8.5 * scale; // Wide
		} else if (checkChar >= "A" && checkChar <= "Z") {
			totalWidth += 6.4 * scale; // Standard uppercase
		} else if (checkChar >= "0" && checkChar <= "9") {
			totalWidth += 5.5 * scale; // Standard digits
		} else if ("ШЩЖЮшщжюы".includes(checkChar)) {
			totalWidth += 8.2 * scale; // Wide Cyrillic
		} else if (checkChar.charCodeAt(0) >= 0x0370 && checkChar.charCodeAt(0) <= 0x04ff) {
			totalWidth += 5.6 * scale; // Standard Greek & Cyrillic
		} else {
			totalWidth += 5.2 * scale; // Standard lowercase
		}

		// Kerning heuristic for common tight letter pairs
		if (i + 1 < normalized.length) {
			const nextChar = normalized[i + 1];
			const pair = checkChar + nextChar;
			if (
				pair === "AV" ||
				pair === "AW" ||
				pair === "AY" ||
				pair === "Ta" ||
				pair === "Te" ||
				pair === "To" ||
				pair === "Tr" ||
				pair === "Tu" ||
				pair === "Tw" ||
				pair === "Ty" ||
				pair === "Wa" ||
				pair === "We" ||
				pair === "Wi" ||
				pair === "Wo" ||
				pair === "Ya" ||
				pair === "Ye" ||
				pair === "Yo" ||
				pair === "Vo" ||
				pair === "Va"
			) {
				totalWidth -= 0.6 * scale;
			}
		}
	}

	return totalWidth;
}

/**
 * Measures text width in pixels using native Canvas when available,
 * or proportional multilingual font metrics fallback.
 */
export function measureTextPx(text: string, options?: TextMeasureOptions): number {
	if (!text) return 0;

	const fontSize = options?.fontSize ?? 12;
	const fontFamily = options?.fontFamily ?? "system-ui, -apple-system, sans-serif";
	const fontWeight = options?.fontWeight ?? 600;
	const cacheKey = `${fontSize}:${fontWeight}:${fontFamily}:${text}`;

	const cached = textWidthCache.get(cacheKey);
	if (cached !== undefined) {
		textWidthCache.delete(cacheKey);
		textWidthCache.set(cacheKey, cached);
		return cached;
	}

	let width: number;
	const canvasCtx = getCanvasContext();
	if (canvasCtx) {
		canvasCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
		width = canvasCtx.measureText(text).width;
	} else {
		width = measureProportionalTextFallback(text, fontSize, fontWeight);
	}

	if (textWidthCache.size >= MAX_CACHE_ENTRIES) {
		const firstKey = textWidthCache.keys().next().value;
		if (firstKey !== undefined) textWidthCache.delete(firstKey);
	}

	textWidthCache.set(cacheKey, width);
	return width;
}

/**
 * Legacy wrapper for backward compatibility with existing tests/callers
 */
export function estimateTextWidthPx(text: string): number {
	return measureTextPx(text, { fontSize: 12 });
}

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * Splits text into user-perceived grapheme clusters using Intl.Segmenter.
 * Guarantees that surrogate pairs (emoji), zero-width joiners, and combining accents
 * are never torn apart when slicing marquee text.
 */
export function splitGraphemes(text: string): string[] {
	if (!text) return [];
	return Array.from(graphemeSegmenter.segment(text), (s) => s.segment);
}

/**
 * Computes maximum character scroll offset for marquee animation.
 * Returns 0 if text completely fits within maxPx (never animated).
 * Otherwise finds the exact start index where remainder text fits within maxPx.
 */
export function findMaxMarqueeOffset(
	fullText: string,
	maxPx: number = MAX_LCD_PIXEL_WIDTH,
	fontSize: number = 12,
	fontFamily: string = "system-ui, -apple-system, sans-serif",
	fontWeight: number | string = 600,
	graphemesInput?: string[],
): number {
	if (!fullText) return 0;
	// 2px safety padding guarantees that remainder text fits Stream Deck's native LCD text box without ellipsis truncation
	const safeMaxPx = Math.max(20, maxPx - 2);
	const totalWidth = measureTextPx(fullText, { fontSize, fontFamily, fontWeight });
	if (totalWidth <= safeMaxPx) {
		return 0; // Text fits completely, zero scroll offset needed
	}

	const graphemes = graphemesInput ?? splitGraphemes(fullText);
	for (let offset = 1; offset < graphemes.length; offset++) {
		const remaining = graphemes.slice(offset).join("");
		if (measureTextPx(remaining, { fontSize, fontFamily, fontWeight }) <= safeMaxPx) {
			return offset;
		}
	}

	return Math.max(0, graphemes.length - 1);
}

/**
 * Extracts the visible text substring starting at startOffset that fits within maxPx.
 * Slices strictly along grapheme cluster boundaries to prevent broken unicode or trailing high surrogates.
 */
export function getFittingTextSlice(
	fullText: string,
	startOffset: number,
	maxPx: number = MAX_LCD_PIXEL_WIDTH,
	fontSize: number = 12,
	fontFamily: string = "system-ui, -apple-system, sans-serif",
	fontWeight: number | string = 600,
	graphemesInput?: string[],
): string {
	if (!fullText) return "";
	// 2px safety padding prevents Stream Deck's layout engine from appending native ellipsis (...) during marquee scrolls
	const safeMaxPx = Math.max(20, maxPx - 2);
	if (measureTextPx(fullText, { fontSize, fontFamily, fontWeight }) <= safeMaxPx) {
		return fullText;
	}

	const graphemes = graphemesInput ?? splitGraphemes(fullText);
	const clampedStart = Math.max(0, Math.min(graphemes.length, startOffset));
	let end = clampedStart;

	while (end < graphemes.length) {
		const candidate = graphemes.slice(clampedStart, end + 1).join("");
		if (measureTextPx(candidate, { fontSize, fontFamily, fontWeight }) > safeMaxPx) {
			break;
		}
		end++;
	}

	return graphemes.slice(clampedStart, end).join("");
}

export interface MarqueeControllerOptions {
	availableWidthPx: number;
	fontSize?: number;
	fontFamily?: string;
	fontWeight?: number | string;
	startPauseTicks?: number;
	endPauseTicks?: number;
}

/**
 * Independent Marquee Controller maintaining its own scroll state,
 * available viewport width, and ping-pong animation boundaries.
 */
export class MarqueeController {
	private availableWidthPx: number;
	private fontSize: number;
	private fontFamily: string;
	private fontWeight: number | string;
	private startPauseTicks: number;
	private endPauseTicks: number;

	private currentOffset: number = 0;
	private direction: -1 | 1 = 1; // 1 = forward, -1 = reverse
	private pauseTicks: number;
	private maxOffset: number = 0;
	private rawText: string = "";
	private graphemes: string[] = [];

	constructor(options: MarqueeControllerOptions) {
		this.availableWidthPx = options.availableWidthPx;
		this.fontSize = options.fontSize ?? 12;
		this.fontFamily = options.fontFamily ?? "system-ui, -apple-system, sans-serif";
		this.fontWeight = options.fontWeight ?? 600;
		this.startPauseTicks = options.startPauseTicks ?? START_PAUSE_TICKS;
		this.endPauseTicks = options.endPauseTicks ?? END_PAUSE_TICKS;
		this.pauseTicks = this.startPauseTicks;
	}

	public setAvailableWidth(widthPx: number): void {
		if (this.availableWidthPx === widthPx) return;
		this.availableWidthPx = widthPx;
		this.recalculateMaxOffset();
	}

	public setFontSize(fontSize: number): void {
		if (this.fontSize === fontSize) return;
		this.fontSize = fontSize;
		this.recalculateMaxOffset();
	}

	public setFontWeight(fontWeight: number | string): void {
		if (this.fontWeight === fontWeight) return;
		this.fontWeight = fontWeight;
		this.recalculateMaxOffset();
	}

	public getAvailableWidth(): number {
		return this.availableWidthPx;
	}

	public setText(text: string): void {
		const normalized = (text || "").replace(/[\r\n]+/g, " ").trim();
		if (this.rawText === normalized) return;
		this.rawText = normalized;
		this.graphemes = splitGraphemes(normalized);
		this.reset();
		this.recalculateMaxOffset();
	}

	public getRawText(): string {
		return this.rawText;
	}

	private recalculateMaxOffset(): void {
		if (!this.rawText) {
			this.maxOffset = 0;
			this.currentOffset = 0;
			return;
		}

		this.maxOffset = findMaxMarqueeOffset(
			this.rawText,
			this.availableWidthPx,
			this.fontSize,
			this.fontFamily,
			this.fontWeight,
			this.graphemes,
		);
		// Strictly clamp offset to prevent scrolling past text boundary
		this.currentOffset = Math.max(0, Math.min(this.maxOffset, this.currentOffset));
	}

	public getMaxOffset(): number {
		return this.maxOffset;
	}

	public getCurrentOffset(): number {
		return this.currentOffset;
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
	 * Advances the marquee animation by one tick.
	 * Returns true if the displayed offset changed.
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

		// Hard clamp: never exceed maxOffset or dip below 0
		this.currentOffset = Math.max(0, Math.min(this.maxOffset, this.currentOffset));
		return true;
	}

	/**
	 * Returns the visible text slice formatted for the controller's viewport
	 */
	public getDisplayText(overrideText?: string): string {
		const text = overrideText !== undefined ? overrideText.replace(/[\r\n]+/g, " ").trim() : this.rawText;
		if (!text) return "";
		if (this.maxOffset <= 0) {
			return text;
		}
		const clampedOffset = Math.max(0, Math.min(this.maxOffset, this.currentOffset));
		const graphemes = overrideText !== undefined && text !== this.rawText ? splitGraphemes(text) : this.graphemes;
		return getFittingTextSlice(
			text,
			clampedOffset,
			this.availableWidthPx,
			this.fontSize,
			this.fontFamily,
			this.fontWeight,
			graphemes,
		);
	}

	/**
	 * Multi-line aware keypad marquee formatter.
	 * Each line's max offset is calculated, and lines are clamped independently.
	 */
	public formatKeypadMultiLineText(multiLineText: string, maxPx: number = KEYPAD_MAX_PIXEL_WIDTH): string {
		if (!multiLineText) return "";
		const lines = multiLineText.split("\n");

		let maxLineOffset = 0;
		for (const line of lines) {
			const trimmed = line.trim();
			if (trimmed) {
				const offset = findMaxMarqueeOffset(trimmed, maxPx, this.fontSize, this.fontFamily);
				if (offset > maxLineOffset) maxLineOffset = offset;
			}
		}

		if (maxLineOffset !== this.maxOffset) {
			this.maxOffset = maxLineOffset;
			this.currentOffset = Math.max(0, Math.min(this.maxOffset, this.currentOffset));
		}

		const formattedLines = lines.map((line) => {
			const trimmed = line.trim();
			if (!trimmed || measureTextPx(trimmed, { fontSize: this.fontSize, fontFamily: this.fontFamily }) <= maxPx) {
				return trimmed;
			}
			const lineMax = findMaxMarqueeOffset(trimmed, maxPx, this.fontSize, this.fontFamily);
			const effectiveOffset = Math.min(lineMax, Math.max(0, this.currentOffset));
			return getFittingTextSlice(trimmed, effectiveOffset, maxPx, this.fontSize, this.fontFamily, this.fontWeight);
		});

		return formattedLines.join("\n");
	}
}

/**
 * Central Marquee Service coordinating independent marquee viewports,
 * managing master tick generation, and handling playback state transitions.
 */
export class MarqueeService extends EventEmitter {
	private static instance: MarqueeService;
	private marqueeTimer: NodeJS.Timeout | null = null;
	private speedMs: number = DEFAULT_MARQUEE_SPEED_MS;
	private lastTrackKey: string = "";

	// Autonomous marquee controllers
	private defaultTouchstripController: MarqueeController;
	private defaultKeypadController: MarqueeController;
	private controllers: Map<string, MarqueeController> = new Map();
	private registeredConsumers: Set<string> = new Set();
	private anonymousConsumerCount: number = 0;

	private constructor() {
		super();

		this.defaultTouchstripController = new MarqueeController({
			availableWidthPx: 96, // Default Compact Side-by-Side layout
			fontSize: 12,
		});

		this.defaultKeypadController = new MarqueeController({
			availableWidthPx: KEYPAD_MAX_PIXEL_WIDTH,
			fontSize: 10,
		});

		const stateManager = StateManager.getInstance();
		stateManager.on("stateChanged", (state: YTMPlaybackState) => {
			this.handleStateChange(state);
		});
	}

	public static getInstance(): MarqueeService {
		if (!MarqueeService.instance) {
			MarqueeService.instance = new MarqueeService();
		}
		return MarqueeService.instance;
	}

	public getSpeed(): number {
		return this.speedMs;
	}

	public setSpeed(speedMs: number): void {
		const validSpeed = Math.max(100, Math.min(1000, Number(speedMs) || DEFAULT_MARQUEE_SPEED_MS));
		if (this.speedMs === validSpeed) return;

		this.speedMs = validSpeed;
		if (this.marqueeTimer) {
			clearInterval(this.marqueeTimer);
			this.marqueeTimer = setInterval(() => {
				this.tick();
			}, this.speedMs);
		}
	}

	public getTouchstripMarquee(): MarqueeController {
		return this.defaultTouchstripController;
	}

	public getKeypadMarquee(): MarqueeController {
		return this.defaultKeypadController;
	}

	/**
	 * Registers a consumer with an optional consumer ID.
	 * If no ID is provided, increments anonymous consumer count (backward compatibility).
	 */
	public registerConsumer(consumerId?: string): void {
		if (consumerId) {
			this.registeredConsumers.add(consumerId);
		} else {
			this.anonymousConsumerCount++;
		}
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
	 * Registers a dedicated Touchstrip consumer with specified available pixel width
	 */
	public registerTouchstripConsumer(
		consumerId: string,
		availableWidthPx: number,
		fontSize: number = 12,
		fontWeight: number | string = 600,
	): MarqueeController {
		this.registeredConsumers.add(consumerId);
		let controller = this.controllers.get(consumerId);
		if (!controller) {
			controller = new MarqueeController({
				availableWidthPx,
				fontSize,
				fontWeight,
			});
			this.controllers.set(consumerId, controller);
		} else {
			controller.setAvailableWidth(availableWidthPx);
			controller.setFontSize(fontSize);
			controller.setFontWeight(fontWeight);
		}

		// Initialize with current track text
		const state = StateManager.getInstance().getState();
		const artistStr = (state.artist || "").replace(/[\r\n]+/g, " ").trim();
		const titleStr = (state.title || "").replace(/[\r\n]+/g, " ").trim();
		const rawTitle = artistStr && titleStr ? `${artistStr} - ${titleStr}` : artistStr || titleStr;

		if (consumerId.endsWith(":artist")) {
			controller.setText(artistStr);
		} else if (consumerId.endsWith(":title") || consumerId.endsWith(":track")) {
			controller.setText(titleStr);
		} else {
			controller.setText(rawTitle);
		}

		this.checkTimer();
		return controller;
	}

	public unregisterTouchstripConsumer(consumerId: string): void {
		this.registeredConsumers.delete(consumerId);
		this.controllers.delete(consumerId);
		this.checkTimer();
	}

	/**
	 * Registers a dedicated Keypad consumer
	 */
	public registerKeypadConsumer(
		consumerId: string,
		availableWidthPx: number = KEYPAD_MAX_PIXEL_WIDTH,
	): MarqueeController {
		this.registeredConsumers.add(consumerId);
		let controller = this.controllers.get(consumerId);
		if (!controller) {
			controller = new MarqueeController({
				availableWidthPx,
				fontSize: 10,
			});
			this.controllers.set(consumerId, controller);
		} else {
			controller.setAvailableWidth(availableWidthPx);
		}

		this.checkTimer();
		return controller;
	}

	public unregisterKeypadConsumer(consumerId: string): void {
		this.registeredConsumers.delete(consumerId);
		this.controllers.delete(consumerId);
		this.checkTimer();
	}

	public updateConsumerWidth(
		consumerId: string,
		availableWidthPx: number,
		fontSize?: number,
		fontWeight?: number | string,
	): void {
		const controller = this.controllers.get(consumerId);
		if (controller) {
			controller.setAvailableWidth(availableWidthPx);
			if (fontSize !== undefined) {
				controller.setFontSize(fontSize);
			}
			if (fontWeight !== undefined) {
				controller.setFontWeight(fontWeight);
			}
			this.checkTimer();
		}
	}

	private handleStateChange(state: YTMPlaybackState): void {
		const artistStr = (state.artist || "").replace(/[\r\n]+/g, " ").trim();
		const titleStr = (state.title || "").replace(/[\r\n]+/g, " ").trim();
		const trackKey = `${artistStr} - ${titleStr}`;
		if (trackKey !== this.lastTrackKey) {
			this.lastTrackKey = trackKey;

			const rawTitle = artistStr && titleStr ? `${artistStr} - ${titleStr}` : artistStr || titleStr;

			this.defaultTouchstripController.setText(rawTitle);
			this.defaultKeypadController.reset();

			for (const [id, controller] of this.controllers.entries()) {
				if (id.endsWith(":artist")) {
					controller.setText(artistStr);
				} else if (id.endsWith(":title") || id.endsWith(":track")) {
					controller.setText(titleStr);
				} else {
					controller.setText(rawTitle);
				}
			}
		}
		this.checkTimer();
	}

	private hasActiveScrollableText(): boolean {
		if (this.defaultTouchstripController.isScrollable()) return true;
		if (this.defaultKeypadController.isScrollable()) return true;

		for (const controller of this.controllers.values()) {
			if (controller.isScrollable()) return true;
		}
		return false;
	}

	private checkTimer(): void {
		const state = StateManager.getInstance().getState();
		const totalConsumers = this.registeredConsumers.size + this.anonymousConsumerCount;
		const shouldRun = totalConsumers > 0 && !state.paused && this.hasActiveScrollableText();

		if (shouldRun) {
			if (!this.marqueeTimer) {
				this.marqueeTimer = setInterval(() => {
					this.tick();
				}, this.speedMs);
			}
		} else if (this.marqueeTimer) {
			clearInterval(this.marqueeTimer);
			this.marqueeTimer = null;
		}
	}

	private tick(): void {
		let anyChanged = false;

		if (this.defaultTouchstripController.tick()) anyChanged = true;
		if (this.defaultKeypadController.tick()) anyChanged = true;

		for (const controller of this.controllers.values()) {
			if (controller.tick()) anyChanged = true;
		}

		if (anyChanged) {
			this.emit("tick");
		}
	}

	/**
	 * Formats LCD touchstrip text with dedicated viewport clamping.
	 * If consumerId is provided, uses that consumer's isolated controller.
	 */
	public getTouchstripDisplayText(
		fullText: string,
		availableWidthPx: number = 96,
		consumerId?: string,
		fontSize?: number,
		fontWeight?: number | string,
	): string {
		if (!fullText) return "";
		const sanitizedText = fullText.replace(/[\r\n]+/g, " ").trim();
		if (!sanitizedText) return "";

		if (consumerId) {
			let controller = this.controllers.get(consumerId);
			if (!controller) {
				controller = new MarqueeController({
					availableWidthPx,
					fontSize: fontSize ?? 12,
					fontWeight: fontWeight ?? 600,
				});
				this.controllers.set(consumerId, controller);
				this.registeredConsumers.add(consumerId);
			} else {
				controller.setAvailableWidth(availableWidthPx);
				if (fontSize !== undefined) {
					controller.setFontSize(fontSize);
				}
				if (fontWeight !== undefined) {
					controller.setFontWeight(fontWeight);
				}
			}
			if (controller.getRawText() !== sanitizedText) {
				controller.setText(sanitizedText);
				this.checkTimer();
			}
			return controller.getDisplayText();
		}

		this.defaultTouchstripController.setAvailableWidth(availableWidthPx);
		if (fontSize !== undefined) {
			this.defaultTouchstripController.setFontSize(fontSize);
		}
		if (fontWeight !== undefined) {
			this.defaultTouchstripController.setFontWeight(fontWeight);
		}
		if (this.defaultTouchstripController.getRawText() !== sanitizedText) {
			this.defaultTouchstripController.setText(sanitizedText);
			this.checkTimer();
		}
		return this.defaultTouchstripController.getDisplayText();
	}

	/**
	 * Backward compatible LCD touchstrip formatting function
	 */
	public getDisplayText(fullText: string, availableWidthPx: number = MAX_LCD_PIXEL_WIDTH): string {
		return this.getTouchstripDisplayText(fullText, availableWidthPx);
	}

	/**
	 * Formats multi-line text for keypad buttons using isolated keypad scroller.
	 * Each line's max offset is calculated and strictly clamped to prevent overscrolling.
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
}
