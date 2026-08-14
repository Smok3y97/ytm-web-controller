/**
 * Previous Track Action
 * 
 * UUID: com.smok3y97.ytmusicweb.prev
 */

import { action, KeyDownEvent, SingletonAction } from '@elgato/streamdeck';
import { WebSocketService } from '../services/websocket-server.js';

@action({ UUID: 'com.smok3y97.ytmusicweb.prev' })
export class PreviousAction extends SingletonAction {
  override async onKeyDown(_ev: KeyDownEvent): Promise<void> {
    WebSocketService.getInstance().sendCommand('previous');
  }
}
