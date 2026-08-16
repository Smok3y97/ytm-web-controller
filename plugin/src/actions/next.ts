/**
 * Next Track Action
 * 
 * UUID: com.smok3y97.ytmusicweb.next
 */

import { action } from '@elgato/streamdeck';
import { BaseStateAction } from './base-state-action.js';
import { YTMPlaybackState } from '../types/index.js';

@action({ UUID: 'com.smok3y97.ytmusicweb.next' })
export class NextAction extends BaseStateAction {
  protected readonly command = 'next';

  protected calculateState(_state: YTMPlaybackState): number {
    return 0;
  }
}
