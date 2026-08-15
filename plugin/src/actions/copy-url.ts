/**
 * Copy Song URL Action
 * 
 * UUID: com.smok3y97.ytmusicweb.copyurl
 */

import { action, KeyDownEvent, SingletonAction } from '@elgato/streamdeck';
import streamDeck from '@elgato/streamdeck';
import { StateManager } from '../services/state-manager.js';
import { copyToClipboard } from '../services/clipboard.js';

@action({ UUID: 'com.smok3y97.ytmusicweb.copyurl' })
export class CopyUrlAction extends SingletonAction {
  private feedbackTimers: Map<string, NodeJS.Timeout> = new Map();

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    const state = StateManager.getInstance().getState();
    const trackUrl = (state.trackUrl && state.trackUrl.startsWith('http')) ? state.trackUrl : '';

    if (!trackUrl) {
      streamDeck.logger.warn('[CopyUrlAction] No active track URL available to copy');
      if (ev.action.isKey()) {
        await ev.action.showAlert();
      }
      return;
    }

    try {
      await copyToClipboard(trackUrl);
      streamDeck.logger.info(`[CopyUrlAction] Successfully copied track URL to clipboard: ${trackUrl}`);
      
      if (ev.action.isKey()) {
        const actionId = ev.action.id;
        const existingTimer = this.feedbackTimers.get(actionId);
        if (existingTimer) {
          clearTimeout(existingTimer);
          this.feedbackTimers.delete(actionId);
        }

        // Show green checkmark feedback icon
        await ev.action.setImage('assets/actions/copyurl/copied.svg');

        // Reset back to default icon after snappy 750ms
        const timer = setTimeout(async () => {
          this.feedbackTimers.delete(actionId);
          try {
            if (ev.action.isKey()) {
              await ev.action.setImage(undefined);
            }
          } catch { }
        }, 750);

        this.feedbackTimers.set(actionId, timer);
      }
    } catch (err) {
      streamDeck.logger.error(`[CopyUrlAction] Failed to copy track URL to clipboard: ${err}`);
      if (ev.action.isKey()) {
        await ev.action.showAlert();
      }
    }
  }
}
