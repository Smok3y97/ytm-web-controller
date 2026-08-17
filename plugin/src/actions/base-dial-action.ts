/**
 * Base Class for Stream Deck + Dial & LCD Touchstrip Actions
 * 
 * Centralizes lifecycle management, feedback layout registration, marquee subscriptions,
 * push-jitter lock mechanism, and unified state rendering.
 */

import {
  DialDownEvent,
  DialUpEvent,
  KeyDownEvent,
  SingletonAction,
  TouchTapEvent,
  WillAppearEvent,
  WillDisappearEvent,
  DidReceiveSettingsEvent
} from '@elgato/streamdeck';
import type { JsonObject } from '@elgato/utils';
import { WebSocketService } from '../services/websocket-server.js';
import { StateManager } from '../services/state-manager.js';
import { MarqueeService } from '../services/marquee-service.js';
import { ImageRenderer } from '../services/image-renderer.js';
import { VersionControlService } from '../services/version-control.js';
import { YTMPlaybackState } from '../types/index.js';

export abstract class BaseDialAction<TSettings extends JsonObject = JsonObject> extends SingletonAction<TSettings> {
  protected activeDials: Set<WillAppearEvent<TSettings>['action']> = new Set();
  protected lastDialPressTime: number = 0;
  protected rotationTimer: NodeJS.Timeout | null = null;
  protected pendingTicks: number = 0;

  constructor() {
    super();

    const stateManager = StateManager.getInstance();
    stateManager.on('stateChanged', (state: YTMPlaybackState) => {
      this.updateAllDials(state);
    });

    const marqueeService = MarqueeService.getInstance();
    marqueeService.on('tick', () => {
      this.updateMarqueeTitles();
    });
  }

  override async onWillAppear(ev: WillAppearEvent<TSettings>): Promise<void> {
    this.activeDials.add(ev.action);
    MarqueeService.getInstance().registerConsumer();

    if (ev.action.isDial()) {
      try {
        await ev.action.setFeedbackLayout('layouts/dial_layout.json');
      } catch { }
    }
    const state = StateManager.getInstance().getState();
    await this.updateDialDisplay(ev.action, state, ev.payload.settings);

    // Request instantaneous state sync from browser
    WebSocketService.getInstance().sendCommand('requestState');
  }

  override async onWillDisappear(ev: WillDisappearEvent<TSettings>): Promise<void> {
    this.removeActiveDial(ev.action.id);
    MarqueeService.getInstance().unregisterConsumer();
  }

  protected removeActiveDial(actionId: string): void {
    for (const dial of this.activeDials) {
      if (dial.id === actionId) {
        this.activeDials.delete(dial);
        break;
      }
    }
  }

  override async onDialDown(ev: DialDownEvent<TSettings>): Promise<void> {
    this.lastDialPressTime = Date.now();
    this.pendingTicks = 0;
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
      this.rotationTimer = null;
    }

    if (StateManager.getInstance().isVersionMismatch()) {
      await ev.action.showAlert();
      return;
    }

    await this.handleDialPress(ev);
  }

  override async onDialUp(_ev: DialUpEvent<TSettings>): Promise<void> {
    this.lastDialPressTime = Date.now();
    this.pendingTicks = 0;
  }

  override async onTouchTap(ev: TouchTapEvent<TSettings>): Promise<void> {
    if (StateManager.getInstance().isVersionMismatch()) {
      await ev.action.showAlert();
      return;
    }
    await this.handleDialPress(ev);
  }

  override async onKeyDown(ev: KeyDownEvent<TSettings>): Promise<void> {
    if (StateManager.getInstance().isVersionMismatch()) {
      await ev.action.showAlert();
      return;
    }
    await this.handleDialPress(ev);
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<TSettings>): Promise<void> {
    const state = StateManager.getInstance().getState();
    await this.updateDialDisplay(ev.action, state, ev.payload.settings);
  }

  /**
   * Push-jitter suppression: returns true if dial was pressed within last 250ms
   */
  protected isPushJitterActive(): boolean {
    return Date.now() - this.lastDialPressTime < 250;
  }

  /**
   * Resolves the title template for marquee LCD display (can be overridden)
   */
  protected getTitleTemplate(settings: TSettings, _actionId?: string): string {
    return (settings as Record<string, unknown>).titleTemplate as string || '{artist} - {title}';
  }

  /**
   * Gets the formatted, marquee-scrolled display title for LCD touchstrips
   */
  protected getFormattedMarqueeTitle(settings: TSettings, actionId?: string): string {
    const rawTitle = this.getTitleTemplate(settings, actionId);
    const fullTitle = StateManager.getInstance().formatTitleTemplate(rawTitle);
    return MarqueeService.getInstance().getDisplayText(fullTitle);
  }

  /**
   * Renders version mismatch feedback if mismatch is active. Returns true if handled.
   */
  protected async renderMismatchFeedback(
    dialAction: WillAppearEvent<TSettings>['action'],
    state: YTMPlaybackState,
    iconPath: string
  ): Promise<boolean> {
    if (!state.isVersionMismatch) return false;
    if (dialAction.isDial()) {
      const warningTitle = VersionControlService.getInstance().getDialWarningTitle(state.extensionVersion);
      await dialAction.setFeedback({
        title: warningTitle,
        value: 'Mismatch',
        icon: iconPath,
        indicator: 0
      });
    }
    return true;
  }

  /**
   * Renders in-RAM album cover with playback overlay for keypads (used when dial action is placed on standard key)
   */
  protected async updateKeyCoverImage(
    dialAction: WillAppearEvent<TSettings>['action'],
    state: YTMPlaybackState,
    showCover: boolean = true
  ): Promise<void> {
    if (!dialAction.isKey()) return;
    if (showCover !== false && state.coverBase64 && !state.isVersionMismatch) {
      const keyImage = ImageRenderer.getInstance().getCoverWithPlaybackOverlay(state.coverBase64, state.paused);
      await dialAction.setImage(keyImage);
    } else {
      await dialAction.setImage(undefined);
    }
  }

  /**
   * Action to perform on dial push, touch tap, or key down
   */
  protected abstract handleDialPress(ev: DialDownEvent<TSettings> | TouchTapEvent<TSettings> | KeyDownEvent<TSettings>): Promise<void> | void;

  /**
   * Updates dial LCD touchstrip feedback and key image
   */
  protected abstract updateDialDisplay(
    dialAction: WillAppearEvent<TSettings>['action'],
    state: YTMPlaybackState,
    settings: TSettings
  ): Promise<void>;

  protected async updateMarqueeTitles(): Promise<void> {
    if (StateManager.getInstance().isVersionMismatch()) {
      return;
    }

    for (const dialAction of this.activeDials) {
      try {
        if (dialAction.isDial()) {
          const settings = await dialAction.getSettings();
          const rawTitle = this.getTitleTemplate(settings, dialAction.id);
          const fullTitle = StateManager.getInstance().formatTitleTemplate(rawTitle);
          const currentText = MarqueeService.getInstance().getDisplayText(fullTitle);
          await dialAction.setFeedback({ title: currentText });
        }
      } catch { }
    }
  }

  protected async updateAllDials(state: YTMPlaybackState): Promise<void> {
    for (const dialAction of this.activeDials) {
      try {
        const settings = await dialAction.getSettings();
        await this.updateDialDisplay(dialAction, state, settings);
      } catch { }
    }
  }
}
