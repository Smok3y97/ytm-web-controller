/**
 * Blacklist & Skip Track Action
 * 
 * UUID: com.smok3y97.ytmusicweb.blacklist-and-skip
 */

import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from '@elgato/streamdeck';
import type { JsonObject } from '@elgato/utils';
import streamDeck from '@elgato/streamdeck';
import { StateManager } from '../services/state-manager.js';
import { BlacklistService } from '../services/blacklist-service.js';
import { WebSocketService } from '../services/websocket-server.js';
import { YTMPlaybackState } from '../types/index.js';
import { getActionWarningSvgDataUrl } from '../services/warning-icons.js';

@action({ UUID: 'com.smok3y97.ytmusicweb.blacklist-and-skip' })
export class BlacklistAndSkipAction extends SingletonAction<JsonObject> {
  private activeActions: Set<WillAppearEvent<JsonObject>['action']> = new Set();
  private lastRenderedMismatch: Map<string, boolean> = new Map();

  constructor() {
    super();

    const stateManager = StateManager.getInstance();
    stateManager.on('stateChanged', (state: YTMPlaybackState) => {
      this.handleStateChange(state);
    });
  }

  override async onWillAppear(ev: WillAppearEvent<JsonObject>): Promise<void> {
    this.activeActions.add(ev.action);
    this.lastRenderedMismatch.delete(ev.action.id);

    const state = StateManager.getInstance().getState();
    if (state.isVersionMismatch) {
      if (ev.action.isKey()) {
        await ev.action.setImage(getActionWarningSvgDataUrl('blacklist'));
        this.lastRenderedMismatch.set(ev.action.id, true);
      }
    }
  }

  override async onWillDisappear(ev: WillDisappearEvent<JsonObject>): Promise<void> {
    this.lastRenderedMismatch.delete(ev.action.id);
    for (const a of this.activeActions) {
      if (a.id === ev.action.id) {
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

    const stateManager = StateManager.getInstance();
    const state = stateManager.getState();
    const blacklistService = BlacklistService.getInstance();
    const wsService = WebSocketService.getInstance();

    const videoId = blacklistService.extractVideoId(state.trackUrl || '');

    if (!videoId || (!state.title && !state.artist)) {
      streamDeck.logger.warn('[BlacklistAndSkipAction] No active track playing or invalid video ID');
      if (ev.action.isKey()) {
        await ev.action.showAlert();
      }
      return;
    }

    try {
      // 1. Add track to blacklist.txt and in-memory cache
      const result = await blacklistService.addCurrentTrack(state);

      if (!result.success) {
        streamDeck.logger.error(`[BlacklistAndSkipAction] Failed to blacklist track: ${result.reason}`);
        if (ev.action.isKey()) {
          await ev.action.showAlert();
        }
        return;
      }

      // 2. Immediately skip to the next track
      wsService.sendCommand('next');
      streamDeck.logger.info(`[BlacklistAndSkipAction] Blacklisted "${state.artist} - ${state.title}" (${videoId}) and skipped to next track`);

      // 3. Show OK confirmation feedback on Stream Deck key
      if (ev.action.isKey()) {
        await ev.action.showOk();
      }
    } catch (err) {
      streamDeck.logger.error(`[BlacklistAndSkipAction] Error during execution: ${err}`);
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
          await actionInstance.setImage(getActionWarningSvgDataUrl('blacklist'));
          this.lastRenderedMismatch.set(actionInstance.id, true);
        }
      } else if (prevMismatch === true) {
        await actionInstance.setImage(undefined);
        this.lastRenderedMismatch.set(actionInstance.id, false);
      }
    }
  }
}
