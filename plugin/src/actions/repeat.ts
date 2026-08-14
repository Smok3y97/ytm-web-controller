/**
 * Repeat Mode Action
 * 
 * UUID: com.smok3y97.ytmusicweb.repeat
 * Tri-state: 0 = OFF, 1 = ALL, 2 = ONE
 */

import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from '@elgato/streamdeck';
import { WebSocketService } from '../services/websocket-server.js';
import { StateManager } from '../services/state-manager.js';
import { YTMPlaybackState } from '../types/index.js';

@action({ UUID: 'com.smok3y97.ytmusicweb.repeat' })
export class RepeatAction extends SingletonAction {
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
    WebSocketService.getInstance().sendCommand('repeat');
  }

  private getRepeatIndex(mode: 'OFF' | 'ALL' | 'ONE'): number {
    switch (mode) {
      case 'ONE': return 2;
      case 'ALL': return 1;
      case 'OFF':
      default:
        return 0;
    }
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

    const targetState = this.getRepeatIndex(state.repeatMode);
    try {
      await actionInstance.setState(targetState);
    } catch { }
  }
}
