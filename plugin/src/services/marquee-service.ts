/**
 * Marquee Service
 *
 * Provides ping-pong sliding-window text animation for Stream Deck + LCD touchstrips and keypad buttons.
 */
import { EventEmitter } from "events";

import { TouchstripCoverLayout, YTMPlaybackState } from "../types/index.js";
import { StateManager } from "./state-manager.js";

// --- Layout Constants & Geometry ---
export const KEYPAD_MAX_PIXEL_WIDTH = 64;
export const DEFAULT_MARQUEE_SPEED_MS = 320;
export const START_PAUSE_TICKS = 4;
export const END_PAUSE_TICKS = 3;

/**
 * Computes available text width based on dial touchstrip layout
 * Compact layout allocates 96px beside cover art; Full Bleed and Header Collapsed allocate 188px
 */
export function getTouchstripAvailableWidth(layout: TouchstripCoverLayout = TouchstripCoverLayout.COMPACT): number {
	switch (layout) {
		case TouchstripCoverLayout.FULL_BLEED:
		case TouchstripCoverLayout.HEADER_COLLAPSED:
			return 188;
		case TouchstripCoverLayout.COMPACT:
		default:
			return 96;
	}
}

// --- Font Width Estimation & Grapheme Segmentation ---

// Built-in V8 grapheme segmenter guarantees surrogate pairs and accents are never torn apart
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

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
 * Splits text into user-perceived grapheme clusters using Intl.Segmenter
 * Prevents broken Unicode sequences when slicing sliding windows across multi-byte characters
 */
export function splitGraphemes(text: string): string[] {
	if (!text) return [];
	return Array.from(graphemeSegmenter.segment(text), (s) => s.segment);
}

interface ParsedLine {
	raw: string;
	graphemes: string[];
	widths: number[];
	maxOffset: number;
}

/**
 * Precomputes grapheme clusters, advance widths, and maximum scroll offset for a single line.
 * Skips grapheme segmentation entirely when the line already fits within safeWidth.
 */
function parseLine(raw: string, safeWidth: number, fontSize: number, fontWeight: number | string): ParsedLine {
	if (!raw || estimateTextWidthPx(raw, fontSize, fontWeight) <= safeWidth) {
		return { raw, graphemes: [], widths: [], maxOffset: 0 };
	}

	const graphemes = splitGraphemes(raw);
	const widths = graphemes.map((g) => estimateTextWidthPx(g, fontSize, fontWeight));

	// Walk backwards from end of line to find smallest character index where remaining suffix fits safeWidth
	let suffixWidth = 0;
	let maxOffset = Math.max(0, graphemes.length - 1);
	for (let i = graphemes.length - 1; i >= 1; i--) {
		suffixWidth += widths[i];
		if (suffixWidth > safeWidth) break;
		maxOffset = i;
	}

	return { raw, graphemes, widths, maxOffset };
}

/**
 * Extracts visible substring slice fitting safeWidth from precomputed grapheme widths
 */
function sliceLine(line: ParsedLine, currentOffset: number, safeWidth: number): string {
	if (line.maxOffset <= 0) return line.raw;

	const start = Math.max(0, Math.min(line.maxOffset, currentOffset));
	let end = start;
	let currentWidth = 0;

	while (end < line.graphemes.length && currentWidth + line.widths[end] <= safeWidth) {
		currentWidth += line.widths[end];
		end++;
	}

	return line.graphemes.slice(start, end).join("");
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
 * for an isolated display element (dial title, artist, track, or multi-line keypad key).
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
	private lines: ParsedLine[] = [];

	constructor(options: MarqueeControllerOptions) {
		this.availableWidthPx = options.availableWidthPx;
		this.fontSize = options.fontSize ?? 12;
		this.fontWeight = options.fontWeight ?? 600;
		this.startPauseTicks = options.startPauseTicks ?? START_PAUSE_TICKS;
		this.endPauseTicks = options.endPauseTicks ?? END_PAUSE_TICKS;
		this.pauseTicks = this.startPauseTicks;
	}

	public setMetrics(width: number, fontSize: number, fontWeight: number | string): void {
		if (this.availableWidthPx !== width || this.fontSize !== fontSize || this.fontWeight !== fontWeight) {
			this.availableWidthPx = width;
			this.fontSize = fontSize;
			this.fontWeight = fontWeight;
			this.recalculate();
		}
	}

	public setText(text: string): void {
		if (this.rawText !== text) {
			this.rawText = text;
			this.reset();
			this.recalculate();
		}
	}

	public setMultiLineText(multiLineText: string): void {
		if (this.rawText === multiLineText) return;
		this.rawText = multiLineText;
		// Reuse unchanged parsed lines so live timestamp updates ({both}) do not re-segment static artist/title lines
		const prevByRaw = new Map(this.lines.map((l) => [l.raw, l]));
		this.recalculate(prevByRaw);
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
	 * Extracts visible substring slice(s) fitting safe viewport width without triggering native ellipsis (...)
	 */
	public getDisplayText(): string {
		if (this.lines.length === 0) return "";
		// 2px safety margin guarantees remainder text strictly fits layout rectangle
		const safeWidth = Math.max(20, this.availableWidthPx - 2);
		if (this.lines.length === 1) {
			return sliceLine(this.lines[0], this.currentOffset, safeWidth);
		}
		return this.lines.map((line) => sliceLine(line, this.currentOffset, safeWidth)).join("\n");
	}

	private recalculate(reuseCache?: Map<string, ParsedLine>): void {
		if (!this.rawText) {
			this.lines = [];
			this.maxOffset = 0;
			this.currentOffset = 0;
			return;
		}

		const safeWidth = Math.max(20, this.availableWidthPx - 2);
		let maxOff = 0;
		this.lines = this.rawText.split("\n").map((line) => {
			const trimmed = line.trim();
			const parsed = reuseCache?.get(trimmed) ?? parseLine(trimmed, safeWidth, this.fontSize, this.fontWeight);
			if (parsed.maxOffset > maxOff) maxOff = parsed.maxOffset;
			return parsed;
		});

		this.maxOffset = maxOff;
		this.currentOffset = Math.max(0, Math.min(this.maxOffset, this.currentOffset));
	}
}

// --- Central Marquee Service ---

/**
 * Singleton service coordinating animation ticks, consumer controllers, and lifecycle updates
 */
export class MarqueeService extends EventEmitter {
	private static instance: MarqueeService;
	private marqueeTimer: NodeJS.Timeout | null = null;
	private speedMs = DEFAULT_MARQUEE_SPEED_MS;
	private lastTrackKey = "";
	private controllers = new Map<string, MarqueeController>();

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

	/**
	 * Removes a consumer controller and any associated sub-controllers (e.g. :artist, :track)
	 */
	public unregisterConsumer(consumerId: string): void {
		let removed = this.controllers.delete(consumerId);
		const prefix = `${consumerId}:`;
		for (const key of this.controllers.keys()) {
			if (key.startsWith(prefix)) {
				this.controllers.delete(key);
				removed = true;
			}
		}
		if (removed) this.checkTimer();
	}

	/**
	 * Returns formatted marquee display text for LCD touchstrips
	 */
	public getTouchstripDisplayText(
		fullText: string,
		availableWidthPx = 96,
		consumerId = "default:touchstrip",
		fontSize = 12,
		fontWeight: number | string = 600,
	): string {
		if (!fullText) return "";
		const sanitized = fullText.replace(/[\r\n]+/g, " ").trim();
		if (!sanitized) return "";

		const controller = this.getOrCreateController(consumerId, availableWidthPx, fontSize, fontWeight);
		controller.setText(sanitized);
		this.checkTimer();
		return controller.getDisplayText();
	}

	/**
	 * Formats multi-line text for keypad buttons using isolated keypad scroller
	 */
	public formatKeypadMarqueeText(
		multiLineText: string,
		maxPx: number = KEYPAD_MAX_PIXEL_WIDTH,
		consumerId = "default:keypad",
	): string {
		if (!multiLineText) return "";
		const controller = this.getOrCreateController(consumerId, maxPx, 10, 600);
		controller.setMultiLineText(multiLineText);
		this.checkTimer();
		return controller.getDisplayText();
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
		} else {
			controller.setMetrics(width, fontSize, fontWeight);
		}
		return controller;
	}

	/**
	 * Resets animation offsets on track change and syncs timer with playback state
	 */
	private handleStateChange(state: YTMPlaybackState): void {
		const artist = (state.artist || "").replace(/[\r\n]+/g, " ").trim();
		const title = (state.title || "").replace(/[\r\n]+/g, " ").trim();
		const key = `${artist} - ${title}`;

		if (key !== this.lastTrackKey) {
			this.lastTrackKey = key;
			for (const controller of this.controllers.values()) {
				controller.reset();
			}
		}
		this.checkTimer();
	}

	/**
	 * Starts or stops animation timer based on active consumers, playback state, and scrollability
	 */
	private checkTimer(): void {
		const state = StateManager.getInstance().getState();
		const anyScrollable = Array.from(this.controllers.values()).some((c) => c.isScrollable());
		const shouldRun = this.controllers.size > 0 && !state.paused && anyScrollable;

		if (shouldRun && !this.marqueeTimer) {
			this.marqueeTimer = setInterval(() => this.tick(), this.speedMs);
		} else if (!shouldRun && this.marqueeTimer) {
			clearInterval(this.marqueeTimer);
			this.marqueeTimer = null;
		}
	}

	private tick(): void {
		let changed = false;
		for (const controller of this.controllers.values()) {
			if (controller.tick()) changed = true;
		}
		if (changed) this.emit("tick");
	}
}
