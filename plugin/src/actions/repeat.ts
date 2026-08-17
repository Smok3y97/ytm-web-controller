/**
 * Repeat Mode Action
 * 
 * UUID: com.smok3y97.ytmusicweb.repeat
 * Tri-state: 0 = OFF, 1 = ALL, 2 = ONE
 */

import { action } from '@elgato/streamdeck';
import { BaseStateAction } from './base-state-action.js';
import { YTMPlaybackState } from '../types/index.js';

@action({ UUID: 'com.smok3y97.ytmusicweb.repeat' })
export class RepeatAction extends BaseStateAction {
  protected readonly command = 'repeat';

  protected calculateState(state: YTMPlaybackState): number {
    switch (state.repeatMode) {
      case 'ONE': return 2;
      case 'ALL': return 1;
      case 'OFF':
      default:
        return 0;
    }
  }

  protected override calculateNextState(currentState: number): number {
    return (currentState + 1) % 3;
  }
}
