/**
 * Dial Action for Stream Deck +
 * 
 * UUID: com.smok3y97.ytmusicweb.dial
 * Features:
 * - Encoder rotation: Skip Next Track (clockwise) / Previous Track (counter-clockwise)
 * - Dial push & touch tap: Play / Pause toggle
 * - Push-Jitter Lock: eliminates accidental track skipping during dial push
 * - Dynamic LCD Touchstrip feedback: Album Cover, Song Title (Full-Width Marquee), Remaining Time, Progress Bar
 */

import {
  action,
  DialDownEvent,
  DialUpEvent,
  DialRotateEvent,
  KeyDownEvent,
  SingletonAction,
  TouchTapEvent,
  WillAppearEvent,
  WillDisappearEvent,
  DidReceiveSettingsEvent
} from '@elgato/streamdeck';
import { WebSocketService } from '../services/websocket-server.js';
import { StateManager } from '../services/state-manager.js';
import { DialSettings, YTMPlaybackState } from '../types/index.js';

const FULL_LCD_CHAR_WIDTH = 26; // Full 184px width on custom dial_layout.json
const MARQUEE_SPEED_MS = 320;    // Fluid, smooth scroll interval
const INITIAL_PAUSE_TICKS = 6;   // ~1.9 seconds readable pause at track start

@action({ UUID: 'com.smok3y97.ytmusicweb.dial' })
export class DialAction extends SingletonAction<DialSettings> {
  private activeDials: Set<WillAppearEvent<DialSettings>['action']> = new Set();
  private rotationTimer: NodeJS.Timeout | null = null;
  private pendingTicks: number = 0;
  private lastTrackSkipTime: number = 0;

  // Push-Jitter Suppression Lock
  private lastDialPressTime: number = 0;

  // Marquee auto-scroller state
  private marqueeTimer: NodeJS.Timeout | null = null;
  private marqueeOffset: number = 0;
  private marqueePauseTicks: number = INITIAL_PAUSE_TICKS;
  private lastTrackKey: string = '';

  constructor() {
    super();

    const stateManager = StateManager.getInstance();
    stateManager.on('stateChanged', (state: YTMPlaybackState) => {
      this.handleStateChange(state);
    });
  }

  override async onWillAppear(ev: WillAppearEvent<DialSettings>): Promise<void> {
    this.activeDials.add(ev.action);
    if (ev.action.isDial()) {
      try {
        await ev.action.setFeedbackLayout('layouts/dial_layout.json');
      } catch { }
    }
    const state = StateManager.getInstance().getState();
    this.ensureMarqueeRunning(state);
    await this.updateDialDisplay(ev.action, state, ev.payload.settings);

    // Request instantaneous state sync from browser
    WebSocketService.getInstance().sendCommand('requestState');
  }

  override async onWillDisappear(ev: WillDisappearEvent<DialSettings>): Promise<void> {
    for (const dial of this.activeDials) {
      if (dial.id === ev.action.id) {
        this.activeDials.delete(dial);
        break;
      }
    }
    if (this.activeDials.size === 0 && this.marqueeTimer) {
      clearInterval(this.marqueeTimer);
      this.marqueeTimer = null;
    }
  }

  override async onDialDown(_ev: DialDownEvent<DialSettings>): Promise<void> {
    this.lastDialPressTime = Date.now();
    this.pendingTicks = 0;
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
      this.rotationTimer = null;
    }

    WebSocketService.getInstance().sendCommand('playPause');
  }

  override async onDialUp(_ev: DialUpEvent<DialSettings>): Promise<void> {
    this.lastDialPressTime = Date.now();
    this.pendingTicks = 0;
  }

  override async onTouchTap(_ev: TouchTapEvent<DialSettings>): Promise<void> {
    WebSocketService.getInstance().sendCommand('playPause');
  }

  override async onKeyDown(_ev: KeyDownEvent<DialSettings>): Promise<void> {
    WebSocketService.getInstance().sendCommand('playPause');
  }

  override async onDialRotate(ev: DialRotateEvent<DialSettings>): Promise<void> {
    // Ignore physical push jitter within 250ms of a dial press
    if (Date.now() - this.lastDialPressTime < 250) {
      return;
    }

    this.pendingTicks += ev.payload.ticks;

    if (!this.rotationTimer) {
      this.rotationTimer = setTimeout(() => {
        this.flushRotation();
      }, 50);
    }
  }

  private flushRotation(): void {
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
      this.rotationTimer = null;
    }

    if (Date.now() - this.lastDialPressTime < 250) {
      this.pendingTicks = 0;
      return;
    }

    const ticks = this.pendingTicks;
    this.pendingTicks = 0;

    if (ticks === 0) return;

    // Debounce track skipping
    const now = Date.now();
    if (now - this.lastTrackSkipTime < 200) {
      return;
    }
    this.lastTrackSkipTime = now;

    const ws = WebSocketService.getInstance();

    if (ticks > 0) {
      ws.sendCommand('next');
    } else {
      ws.sendCommand('previous');
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<DialSettings>): Promise<void> {
    const state = StateManager.getInstance().getState();
    await this.updateDialDisplay(ev.action, state, ev.payload.settings);
  }

  private handleStateChange(state: YTMPlaybackState): void {
    const trackKey = `${state.artist} - ${state.title}`;
    if (trackKey !== this.lastTrackKey) {
      this.lastTrackKey = trackKey;
      this.marqueeOffset = 0;
      this.marqueePauseTicks = INITIAL_PAUSE_TICKS;
    }

    this.ensureMarqueeRunning(state);
    this.updateAllDials(state);
  }

  private ensureMarqueeRunning(state: YTMPlaybackState): void {
    if (this.activeDials.size === 0) return;

    const fullTitle = StateManager.getInstance().formatTitleTemplate('{artist} - {title}');
    const needsScroll = fullTitle.length > FULL_LCD_CHAR_WIDTH;

    if (needsScroll && !state.paused) {
      if (!this.marqueeTimer) {
        this.marqueeTimer = setInterval(() => {
          this.tickMarquee();
        }, MARQUEE_SPEED_MS);
      }
    } else {
      if (this.marqueeTimer) {
        clearInterval(this.marqueeTimer);
        this.marqueeTimer = null;
      }
    }
  }

  private async tickMarquee(): Promise<void> {
    if (this.marqueePauseTicks > 0) {
      this.marqueePauseTicks--;
      return;
    }

    const fullTitle = StateManager.getInstance().formatTitleTemplate('{artist} - {title}');
    const spacer = '    •    ';
    const loopLength = fullTitle.length + spacer.length;

    this.marqueeOffset = (this.marqueeOffset + 1) % loopLength;
    if (this.marqueeOffset === 0) {
      this.marqueePauseTicks = INITIAL_PAUSE_TICKS;
    }

    const currentText = this.getDisplayText(fullTitle);

    for (const dialAction of this.activeDials) {
      try {
        if (dialAction.isDial()) {
          await dialAction.setFeedback({ title: currentText });
        }
      } catch { }
    }
  }

  private getDisplayText(fullText: string): string {
    if (fullText.length <= FULL_LCD_CHAR_WIDTH) {
      return fullText;
    }

    if (this.marqueePauseTicks > 0 && this.marqueeOffset === 0) {
      return fullText.substring(0, FULL_LCD_CHAR_WIDTH);
    }

    const spacer = '    •    ';
    const loopString = fullText + spacer;
    const doubleString = loopString + loopString;
    const start = this.marqueeOffset % loopString.length;

    return doubleString.substring(start, start + FULL_LCD_CHAR_WIDTH);
  }

  private async updateAllDials(state: YTMPlaybackState): Promise<void> {
    for (const dialAction of this.activeDials) {
      try {
        const settings = await dialAction.getSettings();
        await this.updateDialDisplay(dialAction, state, settings);
      } catch {
        this.activeDials.delete(dialAction);
      }
    }
  }

  private async updateDialDisplay(
    dialAction: WillAppearEvent<DialSettings>['action'],
    state: YTMPlaybackState,
    settings: DialSettings
  ): Promise<void> {
    try {
      if (dialAction.isDial()) {
        const progressPercent = (state.duration > 0 && state.currentTime >= 0)
          ? Math.min(100, Math.max(0, Math.round((Math.min(state.currentTime, state.duration) / state.duration) * 100)))
          : 0;
        const rawTitle = StateManager.getInstance().formatTitleTemplate(settings.titleTemplate || '{artist} - {title}');
        const titleText = this.getDisplayText(rawTitle);

        const timeText = StateManager.getInstance().formatTimeTemplate(settings.timeTemplate || '{remaining}');

        const coverImage = (settings.showCover !== false && state.coverBase64)
          ? state.coverBase64
          : 'assets/actions/dial/icon.png';

        await dialAction.setFeedback({
          title: titleText,
          value: timeText,
          icon: coverImage,
          indicator: progressPercent
        });
      } else if (dialAction.isKey()) {
        if (settings.showCover !== false && state.coverBase64) {
          await dialAction.setImage(state.coverBase64);
        } else {
          await dialAction.setImage(undefined);
        }
      }
    } catch { }
  }
}
