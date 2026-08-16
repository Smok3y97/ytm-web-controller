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
import { MarqueeService } from '../services/marquee-service.js';
import { VersionControlService } from '../services/version-control.js';
import { DialSettings, YTMPlaybackState } from '../types/index.js';

@action({ UUID: 'com.smok3y97.ytmusicweb.dial' })
export class DialAction extends SingletonAction<DialSettings> {
  private activeDials: Set<WillAppearEvent<DialSettings>['action']> = new Set();
  private rotationTimer: NodeJS.Timeout | null = null;
  private pendingTicks: number = 0;
  private lastTrackSkipTime: number = 0;

  // Push-Jitter Suppression Lock
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

  override async onWillAppear(ev: WillAppearEvent<DialSettings>): Promise<void> {
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

  override async onWillDisappear(ev: WillDisappearEvent<DialSettings>): Promise<void> {
    for (const dial of this.activeDials) {
      if (dial.id === ev.action.id) {
        this.activeDials.delete(dial);
        break;
      }
    }
    MarqueeService.getInstance().unregisterConsumer();
  }

  override async onDialDown(ev: DialDownEvent<DialSettings>): Promise<void> {
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

  override async onDialUp(_ev: DialUpEvent<DialSettings>): Promise<void> {
    this.lastDialPressTime = Date.now();
    this.pendingTicks = 0;
  }

  override async onTouchTap(ev: TouchTapEvent<DialSettings>): Promise<void> {
    if (StateManager.getInstance().isVersionMismatch()) {
      await ev.action.showAlert();
      return;
    }
    WebSocketService.getInstance().sendCommand('playPause');
  }

  override async onKeyDown(ev: KeyDownEvent<DialSettings>): Promise<void> {
    if (StateManager.getInstance().isVersionMismatch()) {
      await ev.action.showAlert();
      return;
    }
    WebSocketService.getInstance().sendCommand('playPause');
  }

  override async onDialRotate(ev: DialRotateEvent<DialSettings>): Promise<void> {
    // Ignore physical push jitter within 250ms of a dial press
    if (Date.now() - this.lastDialPressTime < 250) {
      return;
    }

    if (StateManager.getInstance().isVersionMismatch()) {
      await ev.action.showAlert();
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
    dialAction: WillAppearEvent<DialSettings>['action'],
    state: YTMPlaybackState,
    settings: DialSettings
  ): Promise<void> {
    try {
      if (dialAction.isDial()) {
        if (state.isVersionMismatch) {
          const warningTitle = VersionControlService.getInstance().getDialWarningTitle(state.extensionVersion);
          await dialAction.setFeedback({
            title: warningTitle,
            value: 'Mismatch',
            icon: 'assets/actions/dial/icon.svg',
            indicator: 0
          });
          return;
        }

        const progressPercent = (state.duration > 0 && state.currentTime >= 0)
          ? Math.min(100, Math.max(0, Math.round((Math.min(state.currentTime, state.duration) / state.duration) * 100)))
          : 0;
        const rawTitle = StateManager.getInstance().formatTitleTemplate(settings.titleTemplate || '{artist} - {title}');
        const titleText = MarqueeService.getInstance().getDisplayText(rawTitle);

        const timeText = StateManager.getInstance().formatTimeTemplate(settings.timeTemplate || '{remaining}');

        const coverImage = (settings.showCover !== false && state.coverBase64)
          ? state.coverBase64
          : 'assets/actions/dial/icon.svg';

        await dialAction.setFeedback({
          title: titleText,
          value: timeText,
          icon: coverImage,
          indicator: progressPercent
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
