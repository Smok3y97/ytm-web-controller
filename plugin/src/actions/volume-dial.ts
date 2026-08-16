/**
 * Volume Dial Action for Stream Deck +
 * 
 * UUID: com.smok3y97.ytmusicweb.volumedial
 * Features:
 * - Encoder rotation: Volume Up (clockwise) / Volume Down (counter-clockwise) with 1%-25% step
 * - Dial push & touch tap: Toggle Mute / Unmute
 * - Push-Jitter Lock: eliminates accidental volume changes during dial push
 * - Dynamic LCD Touchstrip feedback: Volume Bar, Volume %, Muted state indicator, and Album Art / Icon
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
  DidReceiveSettingsEvent,
  TitleParametersDidChangeEvent
} from '@elgato/streamdeck';
import { WebSocketService } from '../services/websocket-server.js';
import { StateManager } from '../services/state-manager.js';
import { MarqueeService } from '../services/marquee-service.js';
import { VersionControlService } from '../services/version-control.js';
import { VolumeDialSettings, YTMPlaybackState } from '../types/index.js';

@action({ UUID: 'com.smok3y97.ytmusicweb.volumedial' })
export class VolumeDialAction extends SingletonAction<VolumeDialSettings> {
  private activeDials: Set<WillAppearEvent<VolumeDialSettings>['action']> = new Set();
  private dialTitles: Map<string, string> = new Map();
  private rotationTimer: NodeJS.Timeout | null = null;
  private pendingTicks: number = 0;
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

  override async onWillAppear(ev: WillAppearEvent<VolumeDialSettings>): Promise<void> {
    this.activeDials.add(ev.action);
    if ('title' in ev.payload && typeof ev.payload.title === 'string' && ev.payload.title) {
      this.dialTitles.set(ev.action.id, ev.payload.title);
    }
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

  override async onWillDisappear(ev: WillDisappearEvent<VolumeDialSettings>): Promise<void> {
    for (const dial of this.activeDials) {
      if (dial.id === ev.action.id) {
        this.activeDials.delete(dial);
        break;
      }
    }
    this.dialTitles.delete(ev.action.id);
    MarqueeService.getInstance().unregisterConsumer();
  }

  override async onTitleParametersDidChange(ev: TitleParametersDidChangeEvent<VolumeDialSettings>): Promise<void> {
    if (ev.payload.title) {
      this.dialTitles.set(ev.action.id, ev.payload.title);
    } else {
      this.dialTitles.delete(ev.action.id);
    }
    const state = StateManager.getInstance().getState();
    await this.updateDialDisplay(ev.action, state, ev.payload.settings);
  }

  override async onDialDown(ev: DialDownEvent<VolumeDialSettings>): Promise<void> {
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

    WebSocketService.getInstance().sendCommand('toggleMute');
  }

  override async onDialUp(_ev: DialUpEvent<VolumeDialSettings>): Promise<void> {
    this.lastDialPressTime = Date.now();
    this.pendingTicks = 0;
  }

  override async onTouchTap(ev: TouchTapEvent<VolumeDialSettings>): Promise<void> {
    if (StateManager.getInstance().isVersionMismatch()) {
      await ev.action.showAlert();
      return;
    }
    WebSocketService.getInstance().sendCommand('toggleMute');
  }

  override async onKeyDown(ev: KeyDownEvent<VolumeDialSettings>): Promise<void> {
    if (StateManager.getInstance().isVersionMismatch()) {
      await ev.action.showAlert();
      return;
    }
    WebSocketService.getInstance().sendCommand('toggleMute');
  }

  override async onDialRotate(ev: DialRotateEvent<VolumeDialSettings>): Promise<void> {
    // Ignore physical push jitter within 250ms of a dial press
    if (Date.now() - this.lastDialPressTime < 250) {
      return;
    }

    if (StateManager.getInstance().isVersionMismatch()) {
      await ev.action.showAlert();
      return;
    }

    this.pendingTicks += ev.payload.ticks;

    // Instant optimistic feedback on LCD touchstrip
    if (ev.action.isDial()) {
      const step = Math.min(25, Math.max(1, ev.payload.settings.step || 5));
      const currentState = StateManager.getInstance().getState();
      const optimisticVolume = Math.min(100, Math.max(0, currentState.volume + this.pendingTicks * step));
      const valueText = currentState.muted ? 'MUTED' : `${optimisticVolume}%`;
      const indicatorValue = currentState.muted ? 0 : optimisticVolume;

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

  private flushRotation(settings: VolumeDialSettings): void {
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

    const step = Math.min(25, Math.max(1, settings.step || 5));
    const delta = ticks * step;

    WebSocketService.getInstance().sendCommand('adjustVolume', { delta });
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<VolumeDialSettings>): Promise<void> {
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
          const rawTitle = this.dialTitles.get(dialAction.id) || 'YouTube Music Volume';
          const fullTitle = StateManager.getInstance().formatTitleTemplate(rawTitle);
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
    dialAction: WillAppearEvent<VolumeDialSettings>['action'],
    state: YTMPlaybackState,
    settings: VolumeDialSettings
  ): Promise<void> {
    try {
      if (dialAction.isDial()) {
        if (state.isVersionMismatch) {
          const warningTitle = VersionControlService.getInstance().getDialWarningTitle(state.extensionVersion);
          await dialAction.setFeedback({
            title: warningTitle,
            value: 'Mismatch',
            icon: 'assets/actions/volumedial/icon.svg',
            indicator: 0
          });
          return;
        }

        const volPercent = Math.min(100, Math.max(0, state.volume ?? 100));
        const valueText = state.muted ? 'MUTED' : `${volPercent}%`;
        const indicatorValue = state.muted ? 0 : volPercent;

        const rawTitle = this.dialTitles.get(dialAction.id) || 'YouTube Music Volume';
        const fullTitle = StateManager.getInstance().formatTitleTemplate(rawTitle);
        const titleText = MarqueeService.getInstance().getDisplayText(fullTitle);

        const coverImage = (settings.showCover !== false && state.coverBase64)
          ? state.coverBase64
          : (state.muted ? 'assets/actions/mute/muted.svg' : 'assets/actions/volumedial/icon.svg');

        await dialAction.setFeedback({
          title: titleText,
          value: valueText,
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
