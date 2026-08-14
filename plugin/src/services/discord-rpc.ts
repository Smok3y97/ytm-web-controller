/**
 * Discord Rich Presence (RPC) Service
 * 
 * High-performance, resilient Discord RPC client for YouTube Music Web.
 */

import DiscordRPC from 'discord-rpc';
import streamDeck from '@elgato/streamdeck';
import { YTMPlaybackState } from '../types/index.js';

export const DEFAULT_DISCORD_CLIENT_ID = '1537908230209019954'; // YouTube Music Discord Client ID

interface CachedActivity {
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  trackUrl: string;
  artistUrl: string;
  albumUrl?: string;
  paused: boolean;
  startTimestamp?: number;
  endTimestamp?: number;
  lastSentTime: number;
}

export class DiscordRpcService {
  private static instance: DiscordRpcService;
  private client: DiscordRPC.Client | null = null;
  private isEnabled: boolean = false;
  private isConnected: boolean = false;
  private isConnecting: boolean = false;
  private clientId: string = DEFAULT_DISCORD_CLIENT_ID;
  private lastState: YTMPlaybackState | null = null;
  private lastCachedActivity: CachedActivity | null = null;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private pauseTimeout: NodeJS.Timeout | null = null;
  private debounceTimeout: NodeJS.Timeout | null = null;

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
    const newClientId = customClientId?.trim() || DEFAULT_DISCORD_CLIENT_ID;
    const clientChanged = this.clientId !== newClientId;
    this.clientId = newClientId;

    if (enabled === this.isEnabled && !clientChanged) {
      return;
    }

    this.isEnabled = enabled;

    if (this.isEnabled) {
      streamDeck.logger.info(`[Discord RPC] Enabling Discord Rich Presence (Client ID: ${this.clientId})...`);
      this.startReconnectLoop();
      await this.connect();
      if (this.lastState) {
        this.updatePresence(this.lastState, true);
      }
    } else {
      streamDeck.logger.info('[Discord RPC] Disabling Discord Rich Presence...');
      this.stopReconnectLoop();
      await this.disconnect();
    }
  }

  /**
   * Start periodic reconnect timer if disconnected
   */
  private startReconnectLoop(): void {
    this.stopReconnectLoop();
    this.reconnectInterval = setInterval(() => {
      if (this.isEnabled && !this.isConnected && !this.isConnecting) {
        this.connect().catch(() => {});
      }
    }, 12000);
  }

  /**
   * Stop periodic reconnect timer
   */
  private stopReconnectLoop(): void {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }

  /**
   * Connect to local Discord IPC socket
   */
  private async connect(): Promise<void> {
    if (this.isConnecting) return;
    if (this.client || this.isConnected) {
      await this.disconnect();
    }

    this.isConnecting = true;

    try {
      const client = new DiscordRPC.Client({ transport: 'ipc' });

      client.on('ready', () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.client = client;
        streamDeck.logger.info(`[Discord RPC] Connected to Discord as application ${this.clientId}`);
        if (this.lastState) {
          this.updatePresence(this.lastState, true);
        }
      });

      client.on('error', (err: any) => {
        streamDeck.logger.warn(`[Discord RPC] Connection error: ${err?.message || err}`);
        this.handleDisconnect();
      });

      // Transport-level close handling
      if ((client as any).transport) {
        (client as any).transport.on('close', () => {
          streamDeck.logger.info('[Discord RPC] IPC Transport closed.');
          this.handleDisconnect();
        });
      }

      await client.login({ clientId: this.clientId }).catch((err) => {
        streamDeck.logger.warn(`[Discord RPC] Failed to login to Discord: ${err?.message || err}`);
        this.handleDisconnect();
      });
    } catch (err: any) {
      streamDeck.logger.warn(`[Discord RPC] Error during client initialization: ${err?.message || err}`);
      this.handleDisconnect();
    }
  }

  private handleDisconnect(): void {
    this.isConnected = false;
    this.isConnecting = false;
    this.client = null;
    this.lastCachedActivity = null;
  }

  /**
   * Disconnect from Discord cleanly
   */
  public async disconnect(): Promise<void> {
    this.isConnected = false;
    this.isConnecting = false;
    this.lastCachedActivity = null;

    if (this.client) {
      try {
        await (this.client as any).request('SET_ACTIVITY', {
          pid: process.pid
        });
      } catch {}
      try {
        await this.client.destroy();
      } catch {}
      this.client = null;
    }
  }

  /**
   * Update Discord Activity based on current YTM playback state (debounced)
   */
  public updatePresence(state: YTMPlaybackState, force = false): void {
    this.lastState = state;

    if (!this.isEnabled || !this.client || !this.isConnected) {
      return;
    }

    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }

    if (force) {
      this.sendActivity(state, true);
    } else {
      this.debounceTimeout = setTimeout(() => {
        this.debounceTimeout = null;
        this.sendActivity(state, false);
      }, 350);
    }
  }

  /**
   * Send SET_ACTIVITY payload to Discord
   */
  private sendActivity(state: YTMPlaybackState, force = false): void {
    if (!this.isEnabled || !this.client || !this.isConnected) {
      return;
    }

    // If music is paused, no media is active, or title is missing:
    // Immediately clear Discord activity (same as Spotify integration)
    if (state.paused || !state.title || state.title.trim() === '') {
      if (this.lastCachedActivity !== null) {
        this.lastCachedActivity = null;
        try {
          (this.client as any).request('SET_ACTIVITY', {
            pid: process.pid
          }).catch(() => {});
        } catch {}
      }
      return;
    }

    try {
      const now = Date.now();
      const trackTitle = state.title.trim();
      const artistName = state.artist?.trim() || 'Unknown Artist';
      const albumName = state.album?.trim() || '';
      const coverUrl = (state.coverUrl && state.coverUrl.startsWith('http')) ? state.coverUrl : '';
      const trackUrl = (state.trackUrl && state.trackUrl.startsWith('http')) ? state.trackUrl : '';
      const artistUrl = (state.artistUrl && state.artistUrl.startsWith('http')) ? state.artistUrl : '';
      const albumUrl = (state.albumUrl && state.albumUrl.startsWith('http')) ? state.albumUrl : '';

      let startTimestamp: number | undefined;
      let endTimestamp: number | undefined;

      // Live playback timeline calculation:
      if (!state.paused) {
        startTimestamp = Math.floor(now - (Math.max(0, state.currentTime) * 1000));
        if (state.duration > 0) {
          endTimestamp = Math.floor(startTimestamp + (state.duration * 1000));
        }
      }

      // Helper to pad/limit string length to Discord constraints (min 2, max limit)
      const stringLimit = (str: string, limit: number = 128, minimum: number = 2): string => {
        if (!str) str = '';
        if (str.length > limit) {
          return str.substring(0, limit - 3).trim() + '...';
        }
        if (str.length < minimum) {
          return str.padEnd(minimum, '\u200B'); // Zero-width space
        }
        return str;
      };

      // Clean artist and album strings
      let cleanArtist = artistName.replace(/[\s\u00A0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/g, ' ').trim();
      let cleanAlbum = albumName.replace(/[\s\u00A0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/g, ' ').trim();

      // If album is inside artist, strip it completely!
      if (cleanAlbum) {
        const escapedAlbum = cleanAlbum.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        cleanArtist = cleanArtist.replace(new RegExp(`\\s*${escapedAlbum}`, 'gi'), '').trim();
      }

      // Strip 4-digit years, explicit badges, and trailing separators
      cleanArtist = cleanArtist.replace(/\b\d{4}\b/g, '').trim();
      cleanArtist = cleanArtist.replace(/^(E|\[E\])\s+/i, '').trim();
      cleanArtist = cleanArtist.replace(/[\u2022\u00B7\u2023\u25E6\u2043\u2219·•\-,|\s]+$/, '').trim();
      if (!cleanArtist) cleanArtist = artistName;

      const albumDisplayText = cleanAlbum || '';
      const albumUrlToUse = albumUrl || '';

      // Format stateText (Line 2: Artist, Line 3: Album)
      const stateText = albumDisplayText ? `${cleanArtist}\n${albumDisplayText}` : cleanArtist;

      // Check if update is redundant (to prevent Discord RPC rate-limiting)
      if (!force && this.lastCachedActivity) {
        const prev = this.lastCachedActivity;
        const metadataSame = (
          prev.title === trackTitle &&
          prev.artist === artistName &&
          prev.album === albumName &&
          prev.coverUrl === coverUrl &&
          prev.trackUrl === trackUrl &&
          prev.artistUrl === artistUrl &&
          prev.albumUrl === albumUrl &&
          prev.paused === state.paused
        );

        if (metadataSame) {
          if (state.paused) {
            return;
          }

          // If previous update had no endTimestamp (song duration was not yet loaded), do not skip this update!
          const hadNoEnd = (!prev.endTimestamp && !!endTimestamp) || (Math.abs((prev.endTimestamp || 0) - (endTimestamp || 0)) > 2000);

          if (!hadNoEnd) {
            const timeDrift = prev.startTimestamp && startTimestamp
              ? Math.abs(startTimestamp - prev.startTimestamp)
              : 0;

            if (timeDrift < 3000 && (now - prev.lastSentTime) < 55000) {
              return; // Progress is naturally animating in Discord; no update needed
            }
          }
        }
      }

      // Construct activity object
      const activity: any = {
        type: 2, // 2 = LISTENING ("Listening to YouTube Music")
        status_display_type: 1,
        details: stringLimit(trackTitle, 128, 2),
        details_url: trackUrl || undefined,
        state: stringLimit(cleanArtist, 128, 2),
        state_url: artistUrl || undefined,
        assets: {
          large_image: coverUrl || 'ytm_logo',
          large_text: albumDisplayText ? stringLimit(albumDisplayText, 128, 2) : undefined,
          large_url: albumUrlToUse || undefined,
          small_image: state.paused ? 'pause' : 'play',
          small_text: state.paused ? 'Pausiert' : 'Wiedergabe'
        },
        instance: false
      };

      if (!state.paused && startTimestamp && endTimestamp) {
        activity.timestamps = {
          start: startTimestamp,
          end: endTimestamp
        };
      }

      // Interactive buttons (max 2)
      const buttons: Array<{ label: string; url: string }> = [];
      if (trackUrl) {
        buttons.push({
          label: 'Song auf YouTube Music',
          url: trackUrl.substring(0, 512)
        });
      }
      if (artistUrl && buttons.length < 2) {
        buttons.push({
          label: 'Künstlerprofil',
          url: artistUrl.substring(0, 512)
        });
      } else if (albumUrlToUse && buttons.length < 2) {
        buttons.push({
          label: 'Album ansehen',
          url: albumUrlToUse.substring(0, 512)
        });
      }
      if (buttons.length > 0) {
        activity.buttons = buttons;
      }

      this.lastCachedActivity = {
        title: trackTitle,
        artist: artistName,
        album: albumName,
        coverUrl,
        trackUrl,
        artistUrl,
        albumUrl,
        paused: state.paused,
        startTimestamp,
        endTimestamp,
        lastSentTime: now
      };

      (this.client as any).request('SET_ACTIVITY', {
        pid: process.pid,
        activity
      }).catch((err: any) => {
        streamDeck.logger.warn(`[Discord RPC] Failed to set activity: ${err?.message || err}`);
      });
    } catch (err: any) {
      streamDeck.logger.warn(`[Discord RPC] Error setting presence: ${err?.message || err}`);
    }
  }
}
