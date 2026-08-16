/**
 * Discord Rich Presence (RPC) Service
 * 
 * High-performance, resilient Discord RPC client for YouTube Music Web
 * powered by modern @xhayper/discord-rpc.
 */

import { Client, StatusDisplayType, type SetActivity } from '@xhayper/discord-rpc';
import { ActivityType } from 'discord-api-types/v10';
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
  private client: Client | null = null;
  private isEnabled: boolean = false;
  private isConnected: boolean = false;
  private isConnecting: boolean = false;
  private clientId: string = DEFAULT_DISCORD_CLIENT_ID;
  private lastState: YTMPlaybackState | null = null;
  private lastCachedActivity: CachedActivity | null = null;
  private reconnectInterval: NodeJS.Timeout | null = null;
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
      const client = new Client({
        clientId: this.clientId,
        transport: { type: 'ipc' }
      });

      client.on('ready', () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.client = client;
        streamDeck.logger.info(`[Discord RPC] Connected to Discord as application ${this.clientId}`);
        if (this.lastState) {
          this.updatePresence(this.lastState, true);
        }
      });

      client.on('disconnected', () => {
        streamDeck.logger.info('[Discord RPC] IPC socket disconnected.');
        this.handleDisconnect();
      });

      await client.login().catch((err) => {
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

    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }

    if (this.client) {
      try {
        await this.client.user?.clearActivity(process.pid);
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
      }, 800);
    }
  }

  /**
   * Send Activity payload to Discord
   */
  private sendActivity(state: YTMPlaybackState, force = false): void {
    if (!this.isEnabled || !this.client || !this.isConnected) {
      return;
    }

    // If music is paused, no media is active, or title is missing:
    // Immediately clear Discord activity (standard media player behavior)
    if (state.paused || !state.title || state.title.trim() === '') {
      if (this.lastCachedActivity !== null) {
        this.lastCachedActivity = null;
        try {
          this.client.user?.clearActivity(process.pid).catch(() => {});
        } catch {}
      }
      return;
    }

    try {
      const now = Date.now();
      const trackTitle = state.title.trim();
      const rawArtist = state.artist?.trim() || 'Unknown Artist';
      const rawAlbum = state.album?.trim() || '';
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
      let cleanArtist = rawArtist.replace(/[\s\u00A0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/g, ' ').trim();
      let cleanAlbum = rawAlbum.replace(/[\s\u00A0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/g, ' ').trim();

      // Guard against view counts, upload dates, and non-album text strings in album field
      if (cleanAlbum && this.isNonAlbumText(cleanAlbum)) {
        cleanAlbum = '';
      }

      // Check if artist contains bullet separator (e.g. "Artist • Album" or "Artist • Views")
      const bulletSplit = cleanArtist.split(/\s*[\u2022\u00B7·•|]\s*/);
      if (bulletSplit.length > 1) {
        cleanArtist = bulletSplit[0].trim();
        if (!cleanAlbum && bulletSplit[1] && !this.isNonAlbumText(bulletSplit[1])) {
          cleanAlbum = bulletSplit[1].trim();
        }
      }

      // If album name is present as a standalone segment or whole word inside artist, strip it safely!
      if (cleanAlbum && cleanAlbum.length >= 3 && cleanArtist.length > cleanAlbum.length) {
        const escapedAlbum = cleanAlbum.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        cleanArtist = cleanArtist.replace(new RegExp(`(^|\\s*[\\u2022\\u00B7·•\\-|]\\s*|\\s+)${escapedAlbum}(\\s*[\\u2022\\u00B7·•\\-|]\\s*|\\s+|$)`, 'gi'), '$1').trim();
      }

      // Strip trailing 4-digit release years at the very end of string
      cleanArtist = cleanArtist.replace(/(?:[\s\u2022\u00B7·•\\-|]|\s+)\b(19|20)\d{2}\b$/g, '').trim();
      cleanArtist = cleanArtist.replace(/^(E|\[E\])\s+/i, '').trim();
      cleanArtist = cleanArtist.replace(/[\u2022\u00B7\u2023\u25E6\u2043\u2219·•\-,|\s]+$/, '').trim();
      if (!cleanArtist) cleanArtist = rawArtist;

      const albumDisplayText = cleanAlbum || '';
      const albumUrlToUse = cleanAlbum ? (albumUrl || '') : '';

      // Check if update is redundant (to prevent Discord RPC rate-limiting)
      if (!force && this.lastCachedActivity) {
        const prev = this.lastCachedActivity;
        const metadataSame = (
          prev.title === trackTitle &&
          prev.artist === rawArtist &&
          prev.album === rawAlbum &&
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
      const activity: SetActivity = {
        type: ActivityType.Listening,
        statusDisplayType: StatusDisplayType.STATE,
        details: stringLimit(trackTitle, 128, 2),
        detailsUrl: trackUrl || undefined,
        state: stringLimit(cleanArtist, 128, 2),
        stateUrl: artistUrl || undefined,
        largeImageKey: coverUrl || 'ytm_logo',
        largeImageText: albumDisplayText ? stringLimit(albumDisplayText, 128, 2) : undefined,
        instance: false
      };

      if (!state.paused && startTimestamp && endTimestamp) {
        activity.startTimestamp = startTimestamp;
        activity.endTimestamp = endTimestamp;
      }

      // Interactive buttons (max 2)
      const buttons: Array<{ label: string; url: string }> = [];
      if (trackUrl) {
        buttons.push({
          label: 'Listen on YouTube Music',
          url: trackUrl.substring(0, 512)
        });
      }
      if (artistUrl && buttons.length < 2) {
        buttons.push({
          label: 'Artist Profile',
          url: artistUrl.substring(0, 512)
        });
      } else if (albumUrlToUse && buttons.length < 2) {
        buttons.push({
          label: 'View Album',
          url: albumUrlToUse.substring(0, 512)
        });
      }
      if (buttons.length > 0) {
        activity.buttons = buttons;
      }

      this.lastCachedActivity = {
        title: trackTitle,
        artist: rawArtist,
        album: rawAlbum,
        coverUrl,
        trackUrl,
        artistUrl,
        albumUrl,
        paused: state.paused,
        startTimestamp,
        endTimestamp,
        lastSentTime: now
      };

      this.client.user?.setActivity(activity, process.pid).catch((err: any) => {
        streamDeck.logger.warn(`[Discord RPC] Failed to set activity: ${err?.message || err}`);
      });
    } catch (err: any) {
      streamDeck.logger.warn(`[Discord RPC] Error setting presence: ${err?.message || err}`);
    }
  }

  /**
   * Determine if a text fragment represents non-album metadata (view count, upload date, year, likes, etc.)
   */
  private isNonAlbumText(text: string): boolean {
    if (!text || typeof text !== 'string') return true;
    const s = text.trim();
    if (!s) return true;

    // 1. Year only (e.g. "2024", "1998")
    if (/^\d{4}$/.test(s)) return true;

    // 2. Explicit / parental badge
    if (/^(e|\[e\])$/i.test(s)) return true;

    // 3. Time duration format (e.g. "3:45", "01:23:45")
    if (/^\d+:\d+(?::\d+)?$/.test(s)) return true;

    // 4. Track count format (e.g. "12 tracks", "10 Titel", "8 morceaux", "15 canciones")
    if (/^\d+\s*(?:tracks?|titel|songs?|morceaux|canciones|brani|трек\w*|піс\w*)$/i.test(s)) return true;

    const hasDigits = /\d/.test(s);

    // 5. View count patterns across all YouTube languages:
    const hasViewKeyword = /(?:aufruf|view|vue|visualiza|visualizz|просмотр|перегляд|wyświetle|görüntüleme|weergaven|visning|katselukert|zhlédnut|zhliadnut|megtekintés|vizionar|προβολ|pregled|צפי|مشاهد|ditonton|lượt\s*xem|回視聴|次观看|次觀看|조회|ครั้ง)/i.test(s);
    if (hasDigits && hasViewKeyword) return true;

    // 6. Relative upload times across languages:
    const hasTimeKeyword = /(?:^vor\s|\bago$|^il y a\b|^hace\s|^há\s|\bfa$|назад$|тому$|önce$|temu$|előtt$|sedan$|siden$|sitten$|yang lalu$|^před\s|^pred\s|^acum\s|^πριν\s|^pre\s|לפني|قبل|trước$|ที่แล้ว$|年前|前$|전$)/i.test(s);
    if (hasTimeKeyword) return true;

    // 7. Date units with digits (e.g. "3 Jahre", "5 months", "2 days", etc.)
    const hasDateUnit = /(?:year|jahr|ans?|año|anno|год|лет|рок|month|monat|mois|mes|mese|месяц|місяц|week|woche|semaine|semana|settiman|недел|тижд|day|tag|jour|día|giorno|день|дней|днів|hour|stunde|heure|hora|ora|час|minute|минут|хвилин)/i.test(s);
    if (hasDigits && hasDateUnit && /(?:vor|ago|hace|há|fa|назад|тому|önce|temu|előtt|sedan|siden|sitten|yang lalu|před|pred|acum|πριν|pre|לפني|قبل|trước|ที่แล้ว)/i.test(s)) {
      return true;
    }

    // 8. Like / reaction / subscriber counts
    const hasLikeKeyword = /(?:like|gefällt|gusta|j'aime|mi piace|лайк|좋아요|讚|赞|subscribers?|abonnenten?|abonnés?|suscriptores?|iscritti)/i.test(s);
    if (hasDigits && hasLikeKeyword) return true;

    return false;
  }
}
