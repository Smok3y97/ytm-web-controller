/**
 * Base Class for Stateful Keypad Actions
 */

import { JsonObject, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from '@elgato/streamdeck';
import { WebSocketService } from '../services/websocket-server.js';
import { StateManager } from '../services/state-manager.js';
import { YTMPlaybackState } from '../types/index.js';
import { getActionWarningSvgDataUrl } from '../services/warning-icons.js';

export abstract class BaseStateAction<T extends JsonObject = JsonObject> extends SingletonAction<T> {
  protected abstract readonly command: string;
  protected actionKey: string = '';
  protected activeActions: Set<WillAppearEvent<T>['action']> = new Set();

  constructor() {
    super();

    const stateManager = StateManager.getInstance();
    stateManager.on('stateChanged', (state: YTMPlaybackState) => {
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

  override async onKeyDown(ev: KeyDownEvent<T>): Promise<void> {
    if (StateManager.getInstance().isVersionMismatch()) {
      if (ev.action.isKey()) {
        await ev.action.showAlert();
      }
      return;
    }

    if (this.command) {
      WebSocketService.getInstance().sendCommand(this.command);
    }
  }

  protected abstract calculateState(state: YTMPlaybackState): number;

  protected async updateAllInstances(state: YTMPlaybackState): Promise<void> {
    for (const actionInstance of this.activeActions) {
      try {
        await this.updateInstance(actionInstance, state);
      } catch { }
    }
  }

  protected async updateInstance(actionInstance: WillAppearEvent<T>['action'], state: YTMPlaybackState): Promise<void> {
    if (!actionInstance.isKey()) return;

    try {
      if (state.isVersionMismatch) {
        await actionInstance.setTitle('');
        const key = this.actionKey || this.command;
        await actionInstance.setImage(getActionWarningSvgDataUrl(key));
        return;
      }

      await actionInstance.setTitle('');
      await actionInstance.setImage(undefined);
      const targetState = this.calculateState(state);
      await actionInstance.setState(targetState);
    } catch { }
  }
}
