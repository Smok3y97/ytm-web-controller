/**
 * Mute / Unmute Action
 * 
 * UUID: com.smok3y97.ytmusicweb.mute
 * Dual-state: 0 = Unmuted, 1 = Muted
 */

import { action, KeyDownEvent } from '@elgato/streamdeck';
import { BaseStateAction } from './base-state-action.js';
import { StateManager } from '../services/state-manager.js';
import { YTMPlaybackState } from '../types/index.js';

@action({ UUID: 'com.smok3y97.ytmusicweb.mute' })
export class MuteAction extends BaseStateAction {
  protected readonly command = 'toggleMute';
  protected override actionKey = 'mute';

  protected calculateState(state: YTMPlaybackState): number {
    return state.muted ? 1 : 0;
  }
}
