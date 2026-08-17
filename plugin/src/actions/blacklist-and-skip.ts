/**
 * Blacklist & Skip Track Action
 * 
 * UUID: com.smok3y97.ytmusicweb.blacklist-and-skip
 */

import { action, KeyDownEvent, SingletonAction } from '@elgato/streamdeck';
import streamDeck from '@elgato/streamdeck';
import { StateManager } from '../services/state-manager.js';
import { BlacklistService } from '../services/blacklist-service.js';
import { WebSocketService } from '../services/websocket-server.js';

@action({ UUID: 'com.smok3y97.ytmusicweb.blacklist-and-skip' })
export class BlacklistAndSkipAction extends SingletonAction {
  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
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
}
