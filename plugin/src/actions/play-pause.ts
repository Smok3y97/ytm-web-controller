/**
 * Play / Pause Action
 * 
 * UUID: com.smok3y97.ytmusicweb.playpause
 * Supports dual-state playback toggling and in-RAM album artwork button backgrounds.
 */

import { action, KeyDownEvent, KeyUpEvent, SingletonAction, WillAppearEvent, WillDisappearEvent, DidReceiveSettingsEvent } from '@elgato/streamdeck';
import { WebSocketService } from '../services/websocket-server.js';
import { StateManager } from '../services/state-manager.js';
import { ImageRenderer } from '../services/image-renderer.js';
import { WindowFocusService } from '../services/window-focus.js';
import { PlayPauseSettings, YTMPlaybackState } from '../types/index.js';
import { getActionWarningSvgDataUrl } from '../services/warning-icons.js';

@action({ UUID: 'com.smok3y97.ytmusicweb.playpause' })
export class PlayPauseAction extends SingletonAction<PlayPauseSettings> {
  private activeActions: Set<WillAppearEvent<PlayPauseSettings>['action']> = new Set();
  private lastRenderedState: Map<string, number> = new Map();
  private lastRenderedImage: Map<string, string | undefined> = new Map();
  private lastRenderedMismatch: Map<string, boolean> = new Map();
  private keyPressTimers: Map<string, NodeJS.Timeout> = new Map();
  private isLongPressTriggered: Map<string, boolean> = new Map();
  private readonly LONG_PRESS_THRESHOLD_MS = 450;

  constructor() {
    super();

    const stateManager = StateManager.getInstance();
    stateManager.on('stateChanged', (state: YTMPlaybackState) => {
      this.updateAllInstances(state);
    });
  }

  override async onWillAppear(ev: WillAppearEvent<PlayPauseSettings>): Promise<void> {
    this.activeActions.add(ev.action);
    this.lastRenderedState.delete(ev.action.id);
    this.lastRenderedImage.delete(ev.action.id);
    this.lastRenderedMismatch.delete(ev.action.id);
    const state = StateManager.getInstance().getState();
    await this.updateInstance(ev.action, state, ev.payload.settings);
    WebSocketService.getInstance().sendCommand('requestState');
  }

  override async onWillDisappear(ev: WillDisappearEvent<PlayPauseSettings>): Promise<void> {
    const actionId = ev.action.id;
    if (this.keyPressTimers.has(actionId)) {
      clearTimeout(this.keyPressTimers.get(actionId)!);
      this.keyPressTimers.delete(actionId);
    }
    this.isLongPressTriggered.delete(actionId);
    this.lastRenderedState.delete(actionId);
    this.lastRenderedImage.delete(actionId);
    this.lastRenderedMismatch.delete(actionId);
    for (const a of this.activeActions) {
      if (a.id === actionId) {
        this.activeActions.delete(a);
        break;
      }
    }
  }

  override async onKeyDown(ev: KeyDownEvent<PlayPauseSettings>): Promise<void> {
    if (StateManager.getInstance().isVersionMismatch()) {
      if (ev.action.isKey()) {
        await ev.action.setState(0);
        await ev.action.showAlert();
      }
      return;
    }

    const actionId = ev.action.id;
    this.isLongPressTriggered.set(actionId, false);

    if (this.keyPressTimers.has(actionId)) {
      clearTimeout(this.keyPressTimers.get(actionId)!);
      this.keyPressTimers.delete(actionId);
    }

    const timer = setTimeout(async () => {
      this.isLongPressTriggered.set(actionId, true);
      this.keyPressTimers.delete(actionId);

      // 1. Send WebSocket focus command to browser extension
      WebSocketService.getInstance().sendCommand('focusTab');

      // 2. Bring window to front at OS level via Win32 bypass
      WindowFocusService.getInstance().bringToFront();

      if (ev.action.isKey()) {
        await ev.action.showOk();
      }
    }, this.LONG_PRESS_THRESHOLD_MS);

    this.keyPressTimers.set(actionId, timer);
  }

  override async onKeyUp(ev: KeyUpEvent<PlayPauseSettings>): Promise<void> {
    const actionId = ev.action.id;

    if (this.keyPressTimers.has(actionId)) {
      clearTimeout(this.keyPressTimers.get(actionId)!);
      this.keyPressTimers.delete(actionId);
    }

    const wasLongPress = this.isLongPressTriggered.get(actionId);
    this.isLongPressTriggered.delete(actionId);

    if (wasLongPress) {
      // Handled in long press timer; ignore release
      return;
    }

    if (StateManager.getInstance().isVersionMismatch()) {
      return;
    }

    // Normal short press: toggle play / pause
    WebSocketService.getInstance().sendCommand('playPause');
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<PlayPauseSettings>): Promise<void> {
    this.lastRenderedImage.delete(ev.action.id);
    const state = StateManager.getInstance().getState();
    await this.updateInstance(ev.action, state, ev.payload.settings);
  }

  private async updateAllInstances(state: YTMPlaybackState): Promise<void> {
    for (const actionInstance of this.activeActions) {
      try {
        const settings = await actionInstance.getSettings();
        await this.updateInstance(actionInstance, state, settings);
      } catch { }
    }
  }

  private async updateInstance(
    actionInstance: WillAppearEvent<PlayPauseSettings>['action'],
    state: YTMPlaybackState,
    settings: PlayPauseSettings
  ): Promise<void> {
    if (!actionInstance.isKey()) return;

    try {
      const isMismatch = !!state.isVersionMismatch;
      const prevMismatch = this.lastRenderedMismatch.get(actionInstance.id);

      if (isMismatch) {
        if (prevMismatch !== true) {
          await actionInstance.setTitle('');
          await actionInstance.setImage(getActionWarningSvgDataUrl('playpause'));
          await actionInstance.setState(0);
          this.lastRenderedMismatch.set(actionInstance.id, true);
          this.lastRenderedState.set(actionInstance.id, 0);
          this.lastRenderedImage.set(actionInstance.id, getActionWarningSvgDataUrl('playpause'));
        }
        return;
      }

      const targetState = state.paused ? 0 : 1;
      const prevState = this.lastRenderedState.get(actionInstance.id);

      if (prevState !== targetState || prevMismatch === true) {
        await actionInstance.setState(targetState);
        this.lastRenderedState.set(actionInstance.id, targetState);
      }

      // Calculate target custom image (default enabled unless explicitly unchecked)
      let targetImage: string | undefined = undefined;
      if (settings.showCoverAsBackground !== false && (state.coverBase64 || state.coverUrl)) {
        const rawCover = state.coverBase64 || await ImageRenderer.getInstance().getCoverAsBase64(state.coverUrl);
        if (rawCover) {
          targetImage = ImageRenderer.getInstance().getCoverWithPlaybackOverlay(rawCover, state.paused);
        }
      }

      const hasPrevImage = this.lastRenderedImage.has(actionInstance.id);
      const prevImage = this.lastRenderedImage.get(actionInstance.id);
      if (!hasPrevImage || prevImage !== targetImage || prevMismatch === true) {
        await actionInstance.setImage(targetImage);
        this.lastRenderedImage.set(actionInstance.id, targetImage);
      }

      this.lastRenderedMismatch.set(actionInstance.id, false);
    } catch { }
  }
}
