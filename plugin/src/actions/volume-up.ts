/**
 * Volume Up Action
 * 
 * UUID: com.smok3y97.ytmusicweb.volumeup
 * Features:
 * - Increases playback volume by configured step (1% - 25%)
 * - Displays live volume % on key title for instant visual feedback
 */

import { action } from '@elgato/streamdeck';
import { BaseVolumeAction } from './base-volume-action.js';

@action({ UUID: 'com.smok3y97.ytmusicweb.volumeup' })
export class VolumeUpAction extends BaseVolumeAction {
  protected readonly command = 'volumeUp';

  protected calculateOptimisticVolume(currentVolume: number, step: number): number {
    return Math.min(100, Math.max(0, currentVolume + step));
  }
}
