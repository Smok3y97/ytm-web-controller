import { EventEmitter } from "events";

import { YTMPlaybackState } from "../types/index.js";
import { StateManager } from "./state-manager.js";

export const MAX_LCD_PIXEL_WIDTH = 198; // Full 200px touchstrip width for Stream Deck +
export const KEYPAD_MAX_PIXEL_WIDTH = 64; // Usable text width for standard 72x72 px Stream Deck key (with margin padding)
export const DEFAULT_MARQUEE_SPEED_MS = 320; // ~3.1 Hz default reading pace
export const START_PAUSE_TICKS = 4; // Pause at the beginning before scrolling (~1.2s)
export const END_PAUSE_TICKS = 3; // Pause at the end before reversing scroll (~1.0s)

function estimateCharWidthPx(char: string): number {
	const code = char.charCodeAt(0);
	// Full-width CJK Radicals, Unified Ideographs, Hangul, Fullwidth Forms
	if (
		(code >= 0x2e80 && code <= 0x9fff) ||
		(code >= 0xac00 && code <= 0xd7af) ||
		(code >= 0xf900 && code <= 0xfaff) ||
		(code >= 0xff01 && code <= 0xff60) ||
		(code >= 0xffe0 && code <= 0xffe6)
	) {
		return 11.5;
	}
	if ("ilj!:. ,'|/\\()[]{}".includes(char)) return 3.4;
	if ("mwMW".includes(char)) return 10.5;
	if (char >= "A" && char <= "Z") return 7.8;
	if ("@%#&".includes(char)) return 9.0;
	if (char >= "0" && char <= "9") return 6.8;
	if ("-–—+*".includes(char)) return 5.0;
	return 6.2; // standard lowercase characters
}

const textWidthCache: Map<string, number> = new Map();
const maxOffsetCache: Map<string, number> = new Map();
const MAX_CACHE_ENTRIES = 50;

export function estimateTextWidthPx(text: string): number {
	if (!text) return 0;
	const cached = textWidthCache.get(text);
	if (cached !== undefined) {
		// True LRU promotion: re-insert entry at the end of the Map
		textWidthCache.delete(text);
		textWidthCache.set(text, cached);
		return cached;
	}

	let width = 0;
	for (let i = 0; i < text.length; i++) {
		width += estimateCharWidthPx(text[i]);
	}

	if (textWidthCache.size >= MAX_CACHE_ENTRIES) {
		const firstKey = textWidthCache.keys().next().value;
		if (firstKey) textWidthCache.delete(firstKey);
	}
	textWidthCache.set(text, width);
	return width;
}

export function findMaxMarqueeOffset(fullText: string, maxPx: number = MAX_LCD_PIXEL_WIDTH): number {
	if (!fullText) return 0;
	const cacheKey = `${maxPx}:${fullText}`;
	const cached = maxOffsetCache.get(cacheKey);
	if (cached !== undefined) {
		// True LRU promotion: re-insert entry at the end of the Map
		maxOffsetCache.delete(cacheKey);
		maxOffsetCache.set(cacheKey, cached);
		return cached;
	}

	let remainingWidth = estimateTextWidthPx(fullText);
	let result = 0;
	if (remainingWidth > maxPx) {
		for (let offset = 0; offset < fullText.length - 1; offset++) {
			remainingWidth -= estimateCharWidthPx(fullText[offset]);
			if (remainingWidth <= maxPx) {
				result = offset + 1;
				break;
			}
		}
		if (result === 0) {
			result = Math.max(0, fullText.length - 1);
		}
	}

	if (maxOffsetCache.size >= MAX_CACHE_ENTRIES) {
		const firstKey = maxOffsetCache.keys().next().value;
		if (firstKey) maxOffsetCache.delete(firstKey);
	}
	maxOffsetCache.set(cacheKey, result);
	return result;
}

export function getFittingTextSlice(
	fullText: string,
	startOffset: number,
	maxPx: number = MAX_LCD_PIXEL_WIDTH,
): string {
	if (!fullText) return "";
	if (estimateTextWidthPx(fullText) <= maxPx) {
		return fullText;
	}

	let currentWidth = 0;
	let end = startOffset;

	while (end < fullText.length) {
		const charWidth = estimateCharWidthPx(fullText[end]);
		if (currentWidth + charWidth > maxPx) {
			break;
		}
		currentWidth += charWidth;
		end++;
	}

	return fullText.substring(startOffset, end);
}

export class MarqueeService extends EventEmitter {
	private static instance: MarqueeService;
	private marqueeTimer: NodeJS.Timeout | null = null;
	private currentOffset: number = 0;
	private direction: number = 1; // 1 = scroll forward/left, -1 = scroll backward/right
	private pauseTicks: number = START_PAUSE_TICKS;
	private lastTrackKey: string = "";
	private activeConsumerCount: number = 0;
	private speedMs: number = DEFAULT_MARQUEE_SPEED_MS;
	private cachedMaxOffset: number = 0;

	private constructor() {
		super();

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

	public registerConsumer(): void {
		this.activeConsumerCount++;
		this.checkTimer();
	}

	public unregisterConsumer(): void {
		this.activeConsumerCount = Math.max(0, this.activeConsumerCount - 1);
		this.checkTimer();
	}

	private handleStateChange(state: YTMPlaybackState): void {
		const trackKey = `${state.artist} - ${state.title}`;
		if (trackKey !== this.lastTrackKey) {
			this.lastTrackKey = trackKey;
			this.currentOffset = 0;
			this.direction = 1;
			this.pauseTicks = START_PAUSE_TICKS;

			const artistStr = (state.artist || "").trim();
			const titleStr = (state.title || "").trim();
			const rawTitle = `${artistStr} - ${titleStr}`;

			const lcdMaxOffset = findMaxMarqueeOffset(rawTitle, MAX_LCD_PIXEL_WIDTH);
			const keypadArtistMaxOffset = findMaxMarqueeOffset(artistStr, KEYPAD_MAX_PIXEL_WIDTH);
			const keypadTitleMaxOffset = findMaxMarqueeOffset(titleStr, KEYPAD_MAX_PIXEL_WIDTH);
			this.cachedMaxOffset = Math.max(lcdMaxOffset, keypadArtistMaxOffset, keypadTitleMaxOffset);
		}
		this.checkTimer();
	}

	private checkTimer(): void {
		const state = StateManager.getInstance().getState();
		const shouldRun = this.activeConsumerCount > 0 && !state.paused;

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
		if (this.pauseTicks > 0) {
			this.pauseTicks--;
			return;
		}

		const maxOffset = this.cachedMaxOffset;
		if (maxOffset <= 0) {
			this.currentOffset = 0;
			return;
		}

		if (this.direction === 1) {
			this.currentOffset++;
			if (this.currentOffset >= maxOffset) {
				this.currentOffset = maxOffset;
				this.direction = -1;
				this.pauseTicks = END_PAUSE_TICKS;
			}
		} else {
			this.currentOffset--;
			if (this.currentOffset <= 0) {
				this.currentOffset = 0;
				this.direction = 1;
				this.pauseTicks = START_PAUSE_TICKS;
			}
		}

		this.emit("tick");
	}

	/**
	 * Pure formatting function to get the current pixel-fitted marquee slice for a given full string (Stream Deck + LCD)
	 */
	public getDisplayText(fullText: string): string {
		if (!fullText) return "";
		return getFittingTextSlice(fullText, this.currentOffset, MAX_LCD_PIXEL_WIDTH);
	}

	/**
	 * Pure formatting function to get current pixel-fitted marquee text for keypad buttons (multi-line aware).
	 * Fits each line to maxPx width (default: 64 px for standard 72x72 Stream Deck key).
	 */
	public formatKeypadMarqueeText(multiLineText: string, maxPx: number = KEYPAD_MAX_PIXEL_WIDTH): string {
		if (!multiLineText) return "";
		const lines = multiLineText.split("\n");
		const formattedLines = lines.map((line) => {
			const trimmed = line.trim();
			if (!trimmed || estimateTextWidthPx(trimmed) <= maxPx) {
				return trimmed;
			}
			const lineMaxOffset = findMaxMarqueeOffset(trimmed, maxPx);
			const effectiveOffset = Math.min(lineMaxOffset, Math.max(0, this.currentOffset));
			return getFittingTextSlice(trimmed, effectiveOffset, maxPx);
		});
		return formattedLines.join("\n");
	}
}
