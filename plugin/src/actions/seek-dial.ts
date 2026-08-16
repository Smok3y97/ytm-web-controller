/**
 * Seek Dial Action for Stream Deck +
 * 
 * UUID: com.smok3y97.ytmusicweb.seekdial
 * Features:
 * - Encoder rotation: Quick Seeking / Scrubbing in Track (customizable 1s - 60s step, default 10s)
 * - Dial push & touch tap: Play / Pause toggle
 * - Push-Jitter Lock: eliminates accidental track seeking during dial push
 * - Dynamic LCD Touchstrip feedback: Album Cover, Song Title (Marquee), Live Time / Duration, Progress Bar
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
import { MarqueeService } from '../services/marquee-service.js';
import { VersionControlService } from '../services/version-control.js';
import { SeekDialSettings, YTMPlaybackState } from '../types/index.js';

@action({ UUID: 'com.smok3y97.ytmusicweb.seekdial' })
export class SeekDialAction extends SingletonAction<SeekDialSettings> {
  private activeDials: Set<WillAppearEvent<SeekDialSettings>['action']> = new Set();
  private rotationTimer: NodeJS.Timeout | null = null;
  private pendingTicks: number = 0;

  // Push-Jitter Lock
  private lastDialPressTime: number = 0;

  constructor() {
    super();

    const stateManager = StateManager.getInstance();
    stateManager.on('stateChanged', (state: YTMPlaybackState) => {
      this.updateAllDials(state);
    });

    const marqueeService = MarqueeService.getInstance();
    marqueeService.on('tick', () => {
      this.updateMarqueeTitles();
    });
  }

  override async onWillAppear(ev: WillAppearEvent<SeekDialSettings>): Promise<void> {
    this.activeDials.add(ev.action);
    MarqueeService.getInstance().registerConsumer();

    if (ev.action.isDial()) {
      try {
        await ev.action.setFeedbackLayout('layouts/dial_layout.json');
      } catch { }
    }
    const state = StateManager.getInstance().getState();
    await this.updateDialDisplay(ev.action, state, ev.payload.settings);

    // Request instantaneous state sync from browser
    WebSocketService.getInstance().sendCommand('requestState');
  }

  override async onWillDisappear(ev: WillDisappearEvent<SeekDialSettings>): Promise<void> {
    for (const dial of this.activeDials) {
      if (dial.id === ev.action.id) {
        this.activeDials.delete(dial);
        break;
      }
    }
    MarqueeService.getInstance().unregisterConsumer();
  }

  override async onDialDown(ev: DialDownEvent<SeekDialSettings>): Promise<void> {
    this.lastDialPressTime = Date.now();
    this.pendingTicks = 0;
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
      this.rotationTimer = null;
    }

    if (StateManager.getInstance().isVersionMismatch()) {
      await ev.action.showAlert();
      return;
    }

    WebSocketService.getInstance().sendCommand('playPause');
  }

  override async onDialUp(_ev: DialUpEvent<SeekDialSettings>): Promise<void> {
    this.lastDialPressTime = Date.now();
    this.pendingTicks = 0;
  }

  override async onTouchTap(ev: TouchTapEvent<SeekDialSettings>): Promise<void> {
    if (StateManager.getInstance().isVersionMismatch()) {
      await ev.action.showAlert();
      return;
    }
    WebSocketService.getInstance().sendCommand('playPause');
  }

  override async onKeyDown(ev: KeyDownEvent<SeekDialSettings>): Promise<void> {
    if (StateManager.getInstance().isVersionMismatch()) {
      await ev.action.showAlert();
      return;
    }
    WebSocketService.getInstance().sendCommand('playPause');
  }

  override async onDialRotate(ev: DialRotateEvent<SeekDialSettings>): Promise<void> {
    // Ignore push jitter within 250ms of a dial press
    if (Date.now() - this.lastDialPressTime < 250) {
      return;
    }

    if (StateManager.getInstance().isVersionMismatch()) {
      await ev.action.showAlert();
      return;
    }

    this.pendingTicks += ev.payload.ticks;

    // Instant optimistic LCD feedback
    if (ev.action.isDial()) {
      const step = Math.min(60, Math.max(1, ev.payload.settings.seekStep || 10));
      const currentState = StateManager.getInstance().getState();
      const optimisticSeconds = Math.min(
        currentState.duration || Infinity,
        Math.max(0, currentState.currentTime + this.pendingTicks * step)
      );

      const indicatorValue = currentState.duration > 0
        ? Math.min(100, Math.max(0, Math.round((optimisticSeconds / currentState.duration) * 100)))
        : 0;

      const timeTemplate = ev.payload.settings.timeTemplate || '{current} / {duration}';
      const valueText = StateManager.getInstance().formatTimeTemplate(
        timeTemplate,
        optimisticSeconds,
        currentState.duration
      );

      try {
        await ev.action.setFeedback({
          value: valueText,
          indicator: indicatorValue
        });
      } catch { }
    }

    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
    }

    // Smooth 85ms debounce window batches rotary clicks cleanly
    this.rotationTimer = setTimeout(() => {
      this.flushRotation(ev.payload.settings);
    }, 85);
  }

  private flushRotation(settings: SeekDialSettings): void {
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

    const step = Math.min(60, Math.max(1, settings.seekStep || 10));
    const deltaSeconds = ticks * step;

    WebSocketService.getInstance().sendCommand('seekRelative', { seconds: deltaSeconds });
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<SeekDialSettings>): Promise<void> {
    const state = StateManager.getInstance().getState();
    await this.updateDialDisplay(ev.action, state, ev.payload.settings);
  }

  private async updateMarqueeTitles(): Promise<void> {
    if (StateManager.getInstance().isVersionMismatch()) {
      return;
    }

    for (const dialAction of this.activeDials) {
      try {
        if (dialAction.isDial()) {
          const settings = await dialAction.getSettings();
          const fullTitle = StateManager.getInstance().formatTitleTemplate(settings.titleTemplate || '{artist} - {title}');
          const currentText = MarqueeService.getInstance().getDisplayText(fullTitle);
          await dialAction.setFeedback({ title: currentText });
        }
      } catch { }
    }
  }

  private async updateAllDials(state: YTMPlaybackState): Promise<void> {
    for (const dialAction of this.activeDials) {
      try {
        const settings = await dialAction.getSettings();
        await this.updateDialDisplay(dialAction, state, settings);
      } catch { }
    }
  }

  private async updateDialDisplay(
    dialAction: WillAppearEvent<SeekDialSettings>['action'],
    state: YTMPlaybackState,
    settings: SeekDialSettings
  ): Promise<void> {
    try {
      if (dialAction.isDial()) {
        if (state.isVersionMismatch) {
          const warningTitle = VersionControlService.getInstance().getDialWarningTitle(state.extensionVersion);
          await dialAction.setFeedback({
            title: warningTitle,
            value: 'Mismatch',
            icon: 'assets/actions/seekdial/icon.svg',
            indicator: 0
          });
          return;
        }

        const fullTitle = StateManager.getInstance().formatTitleTemplate(settings.titleTemplate || '{artist} - {title}');
        const marqueeTitle = MarqueeService.getInstance().getDisplayText(fullTitle);

        const timeTemplate = settings.timeTemplate || '{current} / {duration}';
        const timeText = StateManager.getInstance().formatTimeTemplate(
          timeTemplate,
          state.currentTime,
          state.duration
        );
        const indicatorValue = state.duration > 0
          ? Math.min(100, Math.max(0, Math.round((state.currentTime / state.duration) * 100)))
          : 0;

        const coverImage = (settings.showCover !== false && state.coverBase64)
          ? state.coverBase64
          : (state.paused ? 'assets/actions/playpause/play.svg' : 'assets/actions/seekdial/icon.svg');

        await dialAction.setFeedback({
          title: marqueeTitle,
          value: timeText,
          icon: coverImage,
          indicator: indicatorValue
        });
      } else if (dialAction.isKey()) {
        if (settings.showCover !== false && state.coverBase64 && !state.isVersionMismatch) {
          await dialAction.setImage(state.coverBase64);
        } else {
          await dialAction.setImage(undefined);
        }
      }
    } catch { }
  }
}
