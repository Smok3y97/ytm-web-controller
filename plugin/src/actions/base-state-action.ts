/**
 * Base Class for Stateful Keypad Actions
 */

import { KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from '@elgato/streamdeck';
import type { JsonObject } from '@elgato/utils';
import { WebSocketService } from '../services/websocket-server.js';
import { StateManager } from '../services/state-manager.js';
import { YTMPlaybackState } from '../types/index.js';
import { getActionWarningSvgDataUrl } from '../services/warning-icons.js';

export abstract class BaseStateAction<T extends JsonObject = JsonObject> extends SingletonAction<T> {
  protected abstract readonly command: string;
  protected actionKey: string = '';
  protected activeActions: Set<WillAppearEvent<T>['action']> = new Set();
  private lastRenderedState: Map<string, number> = new Map();
  private lastRenderedMismatch: Map<string, boolean> = new Map();

  constructor() {
    super();

    const stateManager = StateManager.getInstance();
    stateManager.on('stateChanged', (state: YTMPlaybackState) => {
      this.updateAllInstances(state);
    });
  }

  override async onWillAppear(ev: WillAppearEvent<T>): Promise<void> {
    this.activeActions.add(ev.action);
    this.lastRenderedState.delete(ev.action.id);
    this.lastRenderedMismatch.delete(ev.action.id);
    const state = StateManager.getInstance().getState();
    await this.updateInstance(ev.action, state);
  }

  override async onWillDisappear(ev: WillDisappearEvent<T>): Promise<void> {
    this.lastRenderedState.delete(ev.action.id);
    this.lastRenderedMismatch.delete(ev.action.id);
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
      const isMismatch = !!state.isVersionMismatch;
      const prevMismatch = this.lastRenderedMismatch.get(actionInstance.id);

      if (isMismatch) {
        if (prevMismatch !== true) {
          await actionInstance.setTitle('');
          const key = this.actionKey || this.command;
          await actionInstance.setImage(getActionWarningSvgDataUrl(key));
          this.lastRenderedMismatch.set(actionInstance.id, true);
        }
        return;
      }

      const targetState = this.calculateState(state);
      const prevState = this.lastRenderedState.get(actionInstance.id);

      if (prevState !== targetState || prevMismatch === true) {
        if (prevMismatch === true) {
          await actionInstance.setImage(undefined);
          await actionInstance.setTitle('');
        }
        await actionInstance.setState(targetState);
        this.lastRenderedState.set(actionInstance.id, targetState);
        this.lastRenderedMismatch.set(actionInstance.id, false);
      }
    } catch { }
  }
}
