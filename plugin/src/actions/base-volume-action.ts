/**
 * Base class for Volume Up / Down Keypad Actions
 */

import {
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
  DidReceiveSettingsEvent
} from '@elgato/streamdeck';
import { WebSocketService } from '../services/websocket-server.js';
import { StateManager } from '../services/state-manager.js';
import { VolumeSettings, YTMPlaybackState } from '../types/index.js';
import { getActionWarningSvgDataUrl } from '../services/warning-icons.js';

export abstract class BaseVolumeAction extends SingletonAction<VolumeSettings> {
  protected activeActions: Set<WillAppearEvent<VolumeSettings>['action']> = new Set();
  protected abstract readonly command: 'volumeUp' | 'volumeDown';
  protected actionKey: string = '';
  protected abstract calculateOptimisticVolume(currentVolume: number, step: number): number;

  constructor() {
    super();

    StateManager.getInstance().on('stateChanged', (state: YTMPlaybackState) => {
      this.updateAllInstances(state);
    });
  }

  override async onWillAppear(ev: WillAppearEvent<VolumeSettings>): Promise<void> {
    this.activeActions.add(ev.action);
    const state = StateManager.getInstance().getState();
    await this.updateInstance(ev.action, state, ev.payload.settings);
    WebSocketService.getInstance().sendCommand('requestState');
  }

  override async onWillDisappear(ev: WillDisappearEvent<VolumeSettings>): Promise<void> {
    for (const a of this.activeActions) {
      if (a.id === ev.action.id) {
        this.activeActions.delete(a);
        break;
      }
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<VolumeSettings>): Promise<void> {
    const state = StateManager.getInstance().getState();
    await this.updateInstance(ev.action, state, ev.payload.settings);
  }

  override async onKeyDown(ev: KeyDownEvent<VolumeSettings>): Promise<void> {
    if (StateManager.getInstance().isVersionMismatch()) {
      if (ev.action.isKey()) {
        await ev.action.showAlert();
      }
      return;
    }

    const step = Math.min(25, Math.max(1, ev.payload.settings.step || 5));
    const currentState = StateManager.getInstance().getState();
    const optimisticVolume = this.calculateOptimisticVolume(currentState.volume, step);

    // Instant optimistic feedback on key
    if (ev.action.isKey() && ev.payload.settings.showVolumeTitle !== false) {
      const template = ev.payload.settings.titleTemplate || '{volume}%';
      const text = StateManager.getInstance().formatVolumeTemplate(template, optimisticVolume, false);
      await ev.action.setTitle(text);
    }

    WebSocketService.getInstance().sendCommand(this.command, { step });
  }

  protected async updateAllInstances(state: YTMPlaybackState): Promise<void> {
    for (const actionInstance of this.activeActions) {
      try {
        const settings = await actionInstance.getSettings();
        await this.updateInstance(actionInstance, state, settings);
      } catch { }
    }
  }

  protected async updateInstance(
    actionInstance: WillAppearEvent<VolumeSettings>['action'],
    state: YTMPlaybackState,
    settings: VolumeSettings
  ): Promise<void> {
    if (!actionInstance.isKey()) return;

    try {
      if (state.isVersionMismatch) {
        await actionInstance.setTitle('');
        const key = this.actionKey || (this.command === 'volumeUp' ? 'volumeup' : 'volumedown');
        await actionInstance.setImage(getActionWarningSvgDataUrl(key));
        return;
      }

      await actionInstance.setImage(undefined);
      if (settings.showVolumeTitle !== false) {
        const template = settings.titleTemplate || '{volume}%';
        const text = StateManager.getInstance().formatVolumeTemplate(template, state.volume, state.muted);
        await actionInstance.setTitle(text);
      } else {
        await actionInstance.setTitle('');
      }
    } catch { }
  }
}
