/**
 * Seek Dial Action for Stream Deck +
 * 
 * UUID: com.smok3y97.ytmusicweb.seekdial
 * Features:
 * - Encoder rotation: Quick Seeking / Scrubbing in Track (customizable 1s - 60s step, default 10s)
 * - Dial push & touch tap: Play / Pause toggle
 * - Push-Jitter Lock: eliminates accidental track seeking during dial push
 * - Dynamic LCD Touchstrip feedback: Album Cover, Song Title (Marquee), Live Time / Duration, Progress Bar
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
import { MarqueeService } from '../services/marquee-service.js';
import { ImageRenderer } from '../services/image-renderer.js';
import { VersionControlService } from '../services/version-control.js';
import { SeekDialSettings, YTMPlaybackState } from '../types/index.js';

@action({ UUID: 'com.smok3y97.ytmusicweb.seekdial' })
export class SeekDialAction extends BaseDialAction<SeekDialSettings> {
  protected handleDialPress(_ev: DialDownEvent<SeekDialSettings> | TouchTapEvent<SeekDialSettings> | KeyDownEvent<SeekDialSettings>): void {
    WebSocketService.getInstance().sendCommand('playPause');
  }

  override async onDialRotate(ev: DialRotateEvent<SeekDialSettings>): Promise<void> {
    if (this.isPushJitterActive()) return;

    if (StateManager.getInstance().isVersionMismatch()) {
      await ev.action.showAlert();
      return;
    }

    this.pendingTicks += ev.payload.ticks;

    // Instant optimistic LCD feedback
    if (ev.action.isDial()) {
      const step = Math.min(60, Math.max(1, ev.payload.settings.seekStep || 10));
      const currentState = StateManager.getInstance().getState();
      const optimisticSeconds = Math.min(
        currentState.duration || Infinity,
        Math.max(0, currentState.currentTime + this.pendingTicks * step)
      );

      const indicatorValue = currentState.duration > 0
        ? Math.min(100, Math.max(0, Math.round((optimisticSeconds / currentState.duration) * 100)))
        : 0;

      const timeTemplate = ev.payload.settings.timeTemplate || '{current} / {duration}';
      const valueText = StateManager.getInstance().formatTimeTemplate(
        timeTemplate,
        optimisticSeconds,
        currentState.duration
      );

      try {
        await ev.action.setFeedback({
          value: valueText,
          indicator: indicatorValue
        });
      } catch { }
    }

    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
    }

    this.rotationTimer = setTimeout(() => {
      this.flushRotation(ev.payload.settings);
    }, 85);
  }

  private flushRotation(settings: SeekDialSettings): void {
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

    const step = Math.min(60, Math.max(1, settings.seekStep || 10));
    const deltaSeconds = ticks * step;

    WebSocketService.getInstance().sendCommand('seekRelative', { seconds: deltaSeconds });
  }

  protected async updateDialDisplay(
    dialAction: WillAppearEvent<SeekDialSettings>['action'],
    state: YTMPlaybackState,
    settings: SeekDialSettings
  ): Promise<void> {
    try {
      if (dialAction.isDial()) {
        if (await this.renderMismatchFeedback(dialAction, state, 'assets/actions/seekdial/icon.svg')) {
          return;
        }

        const marqueeTitle = this.getFormattedMarqueeTitle(settings, dialAction.id);
        const timeTemplate = settings.timeTemplate || '{current} / {duration}';
        const timeText = StateManager.getInstance().formatTimeTemplate(
          timeTemplate,
          state.currentTime,
          state.duration
        );
        const indicatorValue = state.duration > 0
          ? Math.min(100, Math.max(0, Math.round((state.currentTime / state.duration) * 100)))
          : 0;

        const coverImage = (settings.showCover !== false && state.coverBase64)
          ? ImageRenderer.getInstance().getCoverWithPlaybackOverlay(state.coverBase64, state.paused)
          : (state.paused ? 'assets/actions/playpause/play.svg' : 'assets/actions/seekdial/icon.svg');

        await dialAction.setFeedback({
          title: marqueeTitle,
          value: timeText,
          icon: coverImage,
          indicator: indicatorValue
        });
      } else if (dialAction.isKey()) {
        await this.updateKeyCoverImage(dialAction, state, settings.showCover);
      }
    } catch { }
  }
}
