/**
 * Next Track Action
 * 
 * UUID: com.smok3y97.ytmusicweb.next
 */

import { action, KeyDownEvent, SingletonAction } from '@elgato/streamdeck';
import { WebSocketService } from '../services/websocket-server.js';

@action({ UUID: 'com.smok3y97.ytmusicweb.next' })
export class NextAction extends SingletonAction {
  override async onKeyDown(_ev: KeyDownEvent): Promise<void> {
    WebSocketService.getInstance().sendCommand('next');
  }
}
