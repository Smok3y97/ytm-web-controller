import { EventEmitter } from "events";

import { YTMPlaybackState } from "../types/index.js";
import { StateManager } from "./state-manager.js";

export const MAX_LCD_PIXEL_WIDTH = 198; // Full 200px touchstrip width for Stream Deck +
export const MARQUEE_SPEED_MS = 320; // ~3.1 Hz: calm, pleasant and easy-to-follow reading pace
export const START_PAUSE_TICKS = 9; // ~2.9 seconds comfortable pause at beginning of song title
export const END_PAUSE_TICKS = 8; // ~2.5 seconds comfortable pause at the end of song title

function estimateCharWidthPx(char: string): number {
	if ("ilj!:. ,'|/\\()[]{}".includes(char)) return 3.4;
	if ("mwMW".includes(char)) return 10.5;
	if (char >= "A" && char <= "Z") return 7.8;
	if ("@%#&".includes(char)) return 9.0;
	if (char >= "0" && char <= "9") return 6.8;
	if ("-–—+*".includes(char)) return 5.0;
	return 6.2; // standard lowercase characters
}

export function estimateTextWidthPx(text: string): number {
	let width = 0;
	for (let i = 0; i < text.length; i++) {
		width += estimateCharWidthPx(text[i]);
	}
	return width;
}

export function findMaxMarqueeOffset(fullText: string, maxPx: number = MAX_LCD_PIXEL_WIDTH): number {
	if (!fullText || estimateTextWidthPx(fullText) <= maxPx) {
		return 0;
	}
	for (let offset = 0; offset < fullText.length; offset++) {
		if (estimateTextWidthPx(fullText.substring(offset)) <= maxPx) {
			return offset;
		}
	}
	return Math.max(0, fullText.length - 1);
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
				}, MARQUEE_SPEED_MS);
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

		const rawTitle = StateManager.getInstance().formatTitleTemplate("{artist} - {title}");
		const maxOffset = findMaxMarqueeOffset(rawTitle, MAX_LCD_PIXEL_WIDTH);

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
	 * Pure formatting function to get the current pixel-fitted marquee slice for a given full string
	 */
	public getDisplayText(fullText: string): string {
		if (!fullText) return "";
		return getFittingTextSlice(fullText, this.currentOffset, MAX_LCD_PIXEL_WIDTH);
	}
}
