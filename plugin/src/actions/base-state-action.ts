/**
 * Base class for dual-state / multi-state Keypad actions
 */

import {
  JsonObject,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent
} from '@elgato/streamdeck';
import { WebSocketService } from '../services/websocket-server.js';
import { StateManager } from '../services/state-manager.js';
import { YTMPlaybackState } from '../types/index.js';

export abstract class BaseStateAction<T extends JsonObject = JsonObject> extends SingletonAction<T> {
  protected activeActions: Set<WillAppearEvent<T>['action']> = new Set();
  protected abstract readonly command: string;
  protected abstract calculateState(state: YTMPlaybackState): number;

  constructor() {
    super();

    StateManager.getInstance().on('stateChanged', (state: YTMPlaybackState) => {
      this.updateAllInstances(state);
    });
  }

  override async onWillAppear(ev: WillAppearEvent<T>): Promise<void> {
    this.activeActions.add(ev.action);
    const state = StateManager.getInstance().getState();
    await this.updateInstance(ev.action, state);
  }

  override async onWillDisappear(ev: WillDisappearEvent<T>): Promise<void> {
    for (const a of this.activeActions) {
      if (a.id === ev.action.id) {
        this.activeActions.delete(a);
        break;
      }
    }
  }

  override async onKeyDown(_ev: KeyDownEvent<T>): Promise<void> {
    WebSocketService.getInstance().sendCommand(this.command);
  }

  protected async updateAllInstances(state: YTMPlaybackState): Promise<void> {
    for (const actionInstance of this.activeActions) {
      try {
        await this.updateInstance(actionInstance, state);
      } catch {
        this.activeActions.delete(actionInstance);
      }
    }
  }

  protected async updateInstance(actionInstance: WillAppearEvent<T>['action'], state: YTMPlaybackState): Promise<void> {
    if (!actionInstance.isKey()) return;

    try {
      const targetState = this.calculateState(state);
      await actionInstance.setState(targetState);
    } catch { }
  }
}
