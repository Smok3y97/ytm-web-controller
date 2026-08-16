/**
 * Play / Pause Action
 * 
 * UUID: com.smok3y97.ytmusicweb.playpause
 * Supports dual-state playback toggling and in-RAM album artwork button backgrounds.
 */

import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent, DidReceiveSettingsEvent } from '@elgato/streamdeck';
import { WebSocketService } from '../services/websocket-server.js';
import { StateManager } from '../services/state-manager.js';
import { ImageRenderer } from '../services/image-renderer.js';
import { PlayPauseSettings, YTMPlaybackState } from '../types/index.js';
import { getActionWarningSvgDataUrl } from '../services/warning-icons.js';

@action({ UUID: 'com.smok3y97.ytmusicweb.playpause' })
export class PlayPauseAction extends SingletonAction<PlayPauseSettings> {
  private activeActions: Set<WillAppearEvent<PlayPauseSettings>['action']> = new Set();

  constructor() {
    super();

    const stateManager = StateManager.getInstance();
    stateManager.on('stateChanged', (state: YTMPlaybackState) => {
      this.updateAllInstances(state);
    });
  }

  override async onWillAppear(ev: WillAppearEvent<PlayPauseSettings>): Promise<void> {
    this.activeActions.add(ev.action);
    const state = StateManager.getInstance().getState();
    await this.updateInstance(ev.action, state, ev.payload.settings);
    WebSocketService.getInstance().sendCommand('requestState');
  }

  override async onWillDisappear(ev: WillDisappearEvent<PlayPauseSettings>): Promise<void> {
    for (const a of this.activeActions) {
      if (a.id === ev.action.id) {
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
    WebSocketService.getInstance().sendCommand('playPause');
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<PlayPauseSettings>): Promise<void> {
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
      if (state.isVersionMismatch) {
        await actionInstance.setTitle('');
        await actionInstance.setImage(getActionWarningSvgDataUrl('playpause'));
        await actionInstance.setState(0);
        return;
      }

      await actionInstance.setTitle('');
      const targetState = state.paused ? 0 : 1;
      await actionInstance.setState(targetState);

      // Render live album cover if enabled
      if (settings.showCoverAsBackground && (state.coverBase64 || state.coverUrl)) {
        const coverBase64 = state.coverBase64 || await ImageRenderer.getInstance().getCoverAsBase64(state.coverUrl);
        if (coverBase64) {
          await actionInstance.setImage(coverBase64);
          return;
        }
      }

      // Reset custom image to use default manifest state icons
      await actionInstance.setImage(undefined);
    } catch { }
  }
}
