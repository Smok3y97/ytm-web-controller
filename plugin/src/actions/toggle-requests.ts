/**
 * Toggle Song Requests Action
 * 
 * UUID: com.smok3y97.ytmusicweb.toggle-requests
 * 
 * State 0 = Requests ON (Active / Green)
 * State 1 = Requests OFF (Paused / Red)
 */

import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from '@elgato/streamdeck';
import type { JsonObject } from '@elgato/utils';
import streamDeck from '@elgato/streamdeck';
import { GlobalSettings, YTMPlaybackState } from '../types/index.js';
import { StateManager } from '../services/state-manager.js';
import { getActionWarningSvgDataUrl } from '../services/warning-icons.js';

@action({ UUID: 'com.smok3y97.ytmusicweb.toggle-requests' })
export class ToggleRequestsAction extends SingletonAction<JsonObject> {
  private activeActions: Set<WillAppearEvent<JsonObject>['action']> = new Set();
  private lastRenderedState: Map<string, number> = new Map();
  private lastRenderedMismatch: Map<string, boolean> = new Map();

  constructor() {
    super();

    // Listen for StateManager events for Version Mismatch rendering
    const stateManager = StateManager.getInstance();
    stateManager.on('stateChanged', (state: YTMPlaybackState) => {
      this.handleStateChange(state);
    });

    // Listen for GlobalSettings updates from Property Inspector
    streamDeck.settings.onDidReceiveGlobalSettings(async (ev) => {
      const gs = ev.settings as GlobalSettings;
      const isEnabled = gs.enableSongRequests === true;
      const targetState = isEnabled ? 0 : 1;
      await this.updateAllInstances(targetState);
    });
  }

  override async onWillAppear(ev: WillAppearEvent<JsonObject>): Promise<void> {
    this.activeActions.add(ev.action);
    this.lastRenderedState.delete(ev.action.id);
    this.lastRenderedMismatch.delete(ev.action.id);

    const state = StateManager.getInstance().getState();
    if (state.isVersionMismatch) {
      if (ev.action.isKey()) {
        await ev.action.setImage(getActionWarningSvgDataUrl('togglerequests'));
        this.lastRenderedMismatch.set(ev.action.id, true);
      }
      return;
    }

    const globalSettings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
    const isEnabled = globalSettings.enableSongRequests === true;
    const targetState = isEnabled ? 0 : 1;
    if (ev.action.isKey()) {
      await ev.action.setState(targetState);
      this.lastRenderedState.set(ev.action.id, targetState);
    }
  }

  override async onWillDisappear(ev: WillDisappearEvent<JsonObject>): Promise<void> {
    this.lastRenderedState.delete(ev.action.id);
    this.lastRenderedMismatch.delete(ev.action.id);
    this.removeActiveAction(ev.action.id);
  }

  private removeActiveAction(actionId: string): void {
    for (const a of this.activeActions) {
      if (a.id === actionId) {
        this.activeActions.delete(a);
        break;
      }
    }
  }

  override async onKeyDown(ev: KeyDownEvent<JsonObject>): Promise<void> {
    if (StateManager.getInstance().isVersionMismatch()) {
      if (ev.action.isKey()) {
        await ev.action.showAlert();
      }
      return;
    }

    try {
      const globalSettings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
      const currentEnabled = globalSettings.enableSongRequests === true;
      const nextEnabled = !currentEnabled;
      const targetState = nextEnabled ? 0 : 1;

      // Stream Deck automatically cycles the pressed key's state on keypress.
      // Update our internal tracking for this action instance so we don't issue a conflicting setState() call.
      this.lastRenderedState.set(ev.action.id, targetState);

      // Update global settings (notifies Property Inspector and other listeners)
      await streamDeck.settings.setGlobalSettings<GlobalSettings>({
        ...globalSettings,
        enableSongRequests: nextEnabled
      });

      // Synchronize all other visible action instances cleanly (excluding the current one that Stream Deck already transitioned)
      await this.updateAllInstances(targetState, ev.action.id);

      streamDeck.logger.info(`[Toggle Requests Action] Song Requests toggled: ${nextEnabled ? 'ENABLED (State 0 / Green)' : 'PAUSED (State 1 / Red)'}`);
    } catch (err) {
      streamDeck.logger.error(`[Toggle Requests Action] Failed to toggle song requests: ${err}`);
      if (ev.action.isKey()) {
        await ev.action.showAlert();
      }
    }
  }

  private async handleStateChange(state: YTMPlaybackState): Promise<void> {
    const isMismatch = !!state.isVersionMismatch;

    for (const actionInstance of this.activeActions) {
      if (!actionInstance.isKey()) continue;
      const prevMismatch = this.lastRenderedMismatch.get(actionInstance.id);

      if (isMismatch) {
        if (prevMismatch !== true) {
          await actionInstance.setImage(getActionWarningSvgDataUrl('togglerequests'));
          this.lastRenderedMismatch.set(actionInstance.id, true);
        }
      } else if (prevMismatch === true) {
        await actionInstance.setImage(undefined);
        this.lastRenderedMismatch.set(actionInstance.id, false);

        const globalSettings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
        const isEnabled = globalSettings.enableSongRequests === true;
        const targetState = isEnabled ? 0 : 1;
        await actionInstance.setState(targetState);
        this.lastRenderedState.set(actionInstance.id, targetState);
      }
    }
  }

  private async updateAllInstances(targetState: number, excludeActionId?: string): Promise<void> {
    const isMismatch = StateManager.getInstance().isVersionMismatch();

    for (const actionInstance of this.activeActions) {
      if (excludeActionId && actionInstance.id === excludeActionId) {
        continue;
      }
      try {
        if (actionInstance.isKey() && !isMismatch) {
          const prevState = this.lastRenderedState.get(actionInstance.id);
          if (prevState !== targetState) {
            await actionInstance.setState(targetState);
            this.lastRenderedState.set(actionInstance.id, targetState);
          }
        }
      } catch { }
    }
  }
}
