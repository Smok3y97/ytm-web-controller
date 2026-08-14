/**
 * Discord Rich Presence (RPC) Service
 * 
 * Opt-In Discord RPC client for live YouTube Music presence.
 */

import DiscordRPC from 'discord-rpc';
import streamDeck from '@elgato/streamdeck';
import { YTMPlaybackState } from '../types/index.js';

const DEFAULT_CLIENT_ID = '1010998246325981244'; // YouTube Music Discord Client ID

export class DiscordRpcService {
  private static instance: DiscordRpcService;
  private client: DiscordRPC.Client | null = null;
  private isEnabled: boolean = false;
  private isConnected: boolean = false;
  private clientId: string = DEFAULT_CLIENT_ID;
  private lastState: YTMPlaybackState | null = null;
  private connectTimeout: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): DiscordRpcService {
    if (!DiscordRpcService.instance) {
      DiscordRpcService.instance = new DiscordRpcService();
    }
    return DiscordRpcService.instance;
  }

  /**
   * Configure Discord RPC status & Client ID
   */
  public async setEnabled(enabled: boolean, customClientId?: string): Promise<void> {
    const newClientId = customClientId?.trim() || DEFAULT_CLIENT_ID;
    const clientChanged = this.clientId !== newClientId;
    this.clientId = newClientId;

    if (enabled === this.isEnabled && !clientChanged) {
      return;
    }

    this.isEnabled = enabled;

    if (this.isEnabled) {
      streamDeck.logger.info('[Discord RPC] Enabling Discord Rich Presence...');
      await this.connect();
      if (this.lastState) {
        this.updatePresence(this.lastState);
      }
    } else {
      streamDeck.logger.info('[Discord RPC] Disabling Discord Rich Presence...');
      await this.disconnect();
    }
  }

  /**
   * Connect to local Discord IPC socket
   */
  private async connect(): Promise<void> {
    if (this.client || this.isConnected) {
      await this.disconnect();
    }

    try {
      this.client = new DiscordRPC.Client({ transport: 'ipc' });

      this.client.on('ready', () => {
        this.isConnected = true;
        streamDeck.logger.info(`[Discord RPC] Connected to Discord as application ${this.clientId}`);
        if (this.lastState) {
          this.updatePresence(this.lastState);
        }
      });

      this.client.on('error', (err) => {
        streamDeck.logger.warn(`[Discord RPC] Connection error: ${err.message}`);
        this.isConnected = false;
      });

      await this.client.login({ clientId: this.clientId }).catch((err) => {
        streamDeck.logger.warn(`[Discord RPC] Failed to login to Discord: ${err.message}`);
        this.isConnected = false;
      });
    } catch (err) {
      streamDeck.logger.warn(`[Discord RPC] Error during client initialization: ${err}`);
      this.isConnected = false;
    }
  }

  /**
   * Disconnect from Discord cleanly
   */
  public async disconnect(): Promise<void> {
    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }

    if (this.client) {
      try {
        await this.client.clearActivity();
      } catch {}
      try {
        await this.client.destroy();
      } catch {}
      this.client = null;
    }
    this.isConnected = false;
  }

  /**
   * Update Discord Activity based on current YTM playback state
   */
  public updatePresence(state: YTMPlaybackState): void {
    this.lastState = state;

    if (!this.isEnabled || !this.client || !this.isConnected) {
      return;
    }

    // If no media is loaded or title is empty
    if (!state.title) {
      try {
        this.client.clearActivity();
      } catch {}
      return;
    }

    try {
      const now = Date.now();
      const activity: DiscordRPC.Presence = {
        details: state.title.substring(0, 128),
        state: (state.artist || 'Unknown Artist').substring(0, 128),
        largeImageKey: (state.coverUrl && state.coverUrl.startsWith('http')) ? state.coverUrl : 'ytm_logo',
        largeImageText: (state.album || state.title || 'YouTube Music').substring(0, 128),
        smallImageKey: state.paused ? 'pause' : 'play',
        smallImageText: state.paused ? 'Paused' : 'Playing',
        instance: false
      };

      // Only set timestamps when actively playing to render dynamic progress bar in Discord
      if (!state.paused && state.duration > 0) {
        const startTimestamp = Math.floor(now - (state.currentTime * 1000));
        const endTimestamp = Math.floor(startTimestamp + (state.duration * 1000));
        activity.startTimestamp = startTimestamp;
        activity.endTimestamp = endTimestamp;
      }

      this.client.setActivity(activity).catch((err) => {
        streamDeck.logger.warn(`[Discord RPC] Failed to set activity: ${err.message}`);
      });
    } catch (err) {
      streamDeck.logger.warn(`[Discord RPC] Error setting presence: ${err}`);
    }
  }
}
