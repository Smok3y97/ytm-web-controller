/**
 * Like Action
 * 
 * UUID: com.smok3y97.ytmusicweb.like
 * Dual-state: 0 = Inactive, 1 = Liked
 */

import { action } from '@elgato/streamdeck';
import { BaseStateAction } from './base-state-action.js';
import { YTMPlaybackState } from '../types/index.js';

@action({ UUID: 'com.smok3y97.ytmusicweb.like' })
export class LikeAction extends BaseStateAction {
  protected readonly command = 'like';

  protected calculateState(state: YTMPlaybackState): number {
    return state.isLiked ? 1 : 0;
  }
}
