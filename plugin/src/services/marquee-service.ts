import { EventEmitter } from 'events';
import { StateManager } from './state-manager.js';
import { YTMPlaybackState } from '../types/index.js';

export const FULL_LCD_CHAR_WIDTH = 26; // 184px width at 13px font
export const MARQUEE_SPEED_MS = 320;    // Fluid, smooth scroll interval
export const INITIAL_PAUSE_TICKS = 6;   // ~1.9 seconds readable pause at track start

export class MarqueeService extends EventEmitter {
  private static instance: MarqueeService;
  private marqueeTimer: NodeJS.Timeout | null = null;
  private marqueeOffset: number = 0;
  private marqueePauseTicks: number = INITIAL_PAUSE_TICKS;
  private lastTrackKey: string = '';
  private activeConsumerCount: number = 0;

  private constructor() {
    super();

    const stateManager = StateManager.getInstance();
    stateManager.on('stateChanged', (state: YTMPlaybackState) => {
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
      this.marqueeOffset = 0;
      this.marqueePauseTicks = INITIAL_PAUSE_TICKS;
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
    if (this.marqueePauseTicks > 0) {
      this.marqueePauseTicks--;
      return;
    }

    this.marqueeOffset++;
    this.emit('tick');
  }

  /**
   * Pure formatting function to get the current marquee slice for a given full string
   */
  public getDisplayText(fullText: string, charWidth: number = FULL_LCD_CHAR_WIDTH): string {
    if (!fullText || fullText.length <= charWidth) {
      return fullText || '';
    }

    const spacer = '    •    ';
    const loopString = fullText + spacer;
    const doubleString = loopString + loopString;
    const start = this.marqueeOffset % loopString.length;

    if (start === 0 && this.marqueeOffset > 0) {
      this.marqueePauseTicks = INITIAL_PAUSE_TICKS;
    }

    if (this.marqueePauseTicks > 0 && start === 0) {
      return fullText.substring(0, charWidth);
    }

    return doubleString.substring(start, start + charWidth);
  }
}
