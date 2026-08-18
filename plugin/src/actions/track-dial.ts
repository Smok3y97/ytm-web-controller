/**
 * Track Controller Dial Action for Stream Deck +
 * 
 * UUID: com.smok3y97.ytmusicweb.trackdial
 * Features:
 * - Encoder rotation: Skip Next Track (clockwise) / Previous Track (counter-clockwise)
 * - Dial push & touch tap: Play / Pause toggle
 * - Push-Jitter Lock: eliminates accidental track skipping during dial push
 * - Dynamic LCD Touchstrip feedback: Album Cover (with pause overlay), Song Title (Full-Width Marquee), Remaining Time, Progress Bar
 */

import {
  action,
  DialDownEvent,
  DialRotateEvent,
  KeyDownEvent,
  TouchTapEvent,
  WillAppearEvent
} from '@elgato/streamdeck';
import { BaseDialAction } from './base-dial-action.js';
import { WebSocketService } from '../services/websocket-server.js';
import { StateManager } from '../services/state-manager.js';
import { ImageRenderer } from '../services/image-renderer.js';
import { TrackDialSettings, YTMPlaybackState } from '../types/index.js';

@action({ UUID: 'com.smok3y97.ytmusicweb.trackdial' })
export class TrackDialAction extends BaseDialAction<TrackDialSettings> {
  private lastTrackSkipTime: number = 0;

  protected handleDialPress(_ev: DialDownEvent<TrackDialSettings> | TouchTapEvent<TrackDialSettings> | KeyDownEvent<TrackDialSettings>): void {
    WebSocketService.getInstance().sendCommand('playPause');
  }

  override async onDialRotate(ev: DialRotateEvent<TrackDialSettings>): Promise<void> {
    if (this.isPushJitterActive()) return;

    if (StateManager.getInstance().isVersionMismatch()) {
      await ev.action.showAlert();
      return;
    }

    this.pendingTicks += ev.payload.ticks;

    if (!this.rotationTimer) {
      this.rotationTimer = setTimeout(() => {
        this.flushRotation();
      }, 50);
    }
  }

  private flushRotation(): void {
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
      this.rotationTimer = null;
    }

    if (this.isPushJitterActive()) {
      this.pendingTicks = 0;
      return;
    }

    const ticks = this.pendingTicks;
    this.pendingTicks = 0;

    if (ticks === 0) return;

    // Debounce track skipping
    const now = Date.now();
    if (now - this.lastTrackSkipTime < 200) {
      return;
    }
    this.lastTrackSkipTime = now;

    const ws = WebSocketService.getInstance();
    if (ticks > 0) {
      ws.sendCommand('next');
    } else {
      ws.sendCommand('previous');
    }
  }

  protected async updateDialDisplay(
    dialAction: WillAppearEvent<TrackDialSettings>['action'],
    state: YTMPlaybackState,
    settings: TrackDialSettings
  ): Promise<void> {
    try {
      if (dialAction.isDial()) {
        if (await this.renderMismatchFeedback(dialAction, state, 'assets/actions/trackdial/icon.svg')) {
          return;
        }

        const progressPercent = (state.duration > 0 && state.currentTime >= 0)
          ? Math.min(100, Math.max(0, Math.round((Math.min(state.currentTime, state.duration) / state.duration) * 100)))
          : 0;
        const titleText = this.getFormattedMarqueeTitle(settings, dialAction.id);
        const timeText = StateManager.getInstance().formatTimeTemplate(settings.timeTemplate || '{remaining}');

        const coverImage = (settings.showCover !== false && state.coverBase64)
          ? ImageRenderer.getInstance().getCoverWithPlaybackOverlay(state.coverBase64, state.paused)
          : 'assets/actions/trackdial/icon.svg';

        await dialAction.setFeedback({
          title: titleText,
          value: timeText,
          icon: coverImage,
          indicator: progressPercent
        });
      } else if (dialAction.isKey()) {
        await this.updateKeyCoverImage(dialAction, state, settings.showCover);
      }
    } catch { }
  }
}
