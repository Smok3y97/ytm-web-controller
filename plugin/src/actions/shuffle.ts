/**
 * Shuffle Action
 * 
 * UUID: com.smok3y97.ytmusicweb.shuffle
 * Dual-state: 0 = Inactive, 1 = Active
 */

import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from '@elgato/streamdeck';
import { WebSocketService } from '../services/websocket-server.js';
import { StateManager } from '../services/state-manager.js';
import { YTMPlaybackState } from '../types/index.js';

@action({ UUID: 'com.smok3y97.ytmusicweb.shuffle' })
export class ShuffleAction extends SingletonAction {
  private activeActions: Set<WillAppearEvent['action']> = new Set();

  constructor() {
    super();

    StateManager.getInstance().on('stateChanged', (state: YTMPlaybackState) => {
      this.updateAllInstances(state);
    });
  }

  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    this.activeActions.add(ev.action);
    const state = StateManager.getInstance().getState();
    await this.updateInstance(ev.action, state);
  }

  override async onWillDisappear(ev: WillDisappearEvent): Promise<void> {
    for (const a of this.activeActions) {
      if (a.id === ev.action.id) {
        this.activeActions.delete(a);
        break;
      }
    }
  }

  override async onKeyDown(_ev: KeyDownEvent): Promise<void> {
    WebSocketService.getInstance().sendCommand('shuffle');
  }

  private async updateAllInstances(state: YTMPlaybackState): Promise<void> {
    for (const actionInstance of this.activeActions) {
      try {
        await this.updateInstance(actionInstance, state);
      } catch {
        this.activeActions.delete(actionInstance);
      }
    }
  }

  private async updateInstance(actionInstance: WillAppearEvent['action'], state: YTMPlaybackState): Promise<void> {
    if (!actionInstance.isKey()) return;

    try {
      await actionInstance.setState(state.shuffleActive ? 1 : 0);
    } catch { }
  }
}
