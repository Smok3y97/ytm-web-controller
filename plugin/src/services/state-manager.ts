/**
 * State Manager Service
 * 
 * Central in-memory state hub for YouTube Music playback data, version status, and formatting.
 */

import { EventEmitter } from 'events';
import { YTMPlaybackState } from '../types/index.js';

export class StateManager extends EventEmitter {
  private static instance: StateManager;
  private currentState: YTMPlaybackState = {
    title: '',
    artist: '',
    album: '',
    coverUrl: '',
    trackUrl: '',
    artistUrl: '',
    albumUrl: '',
    currentTime: 0,
    duration: 0,
    volume: 1,
    paused: true,
    muted: false,
    isLiked: false,
    isDisliked: false,
    shuffleActive: false,
    repeatMode: 'OFF',
    isVersionMismatch: false,
    extensionVersion: undefined
  };

  private constructor() {
    super();
  }

  public static getInstance(): StateManager {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager();
    }
    return StateManager.instance;
  }

  public updateState(state: YTMPlaybackState): void {
    if (this.currentState.isVersionMismatch) {
      return;
    }

    const prevState = { ...this.currentState };
    const isMismatch = state.isVersionMismatch !== undefined ? state.isVersionMismatch : this.currentState.isVersionMismatch;
    const extVer = state.extensionVersion !== undefined ? state.extensionVersion : this.currentState.extensionVersion;

    const sanitizedAlbum = (state.album && !this.isNonAlbumText(state.album)) ? state.album.trim() : '';

    this.currentState = {
      ...state,
      album: sanitizedAlbum,
      isVersionMismatch: isMismatch,
      extensionVersion: extVer
    };

    this.emit('stateChanged', this.currentState, prevState);
  }

  public setVersionMismatch(isMismatch: boolean, extensionVersion?: string): void {
    if (this.currentState.isVersionMismatch === isMismatch && this.currentState.extensionVersion === extensionVersion) {
      return;
    }

    const prevState = { ...this.currentState };
    this.currentState.isVersionMismatch = isMismatch;
    this.currentState.extensionVersion = extensionVersion;

    if (isMismatch) {
      this.currentState.title = '';
      this.currentState.artist = '';
      this.currentState.album = '';
      this.currentState.coverBase64 = undefined;
      this.currentState.coverUrl = '';
      this.currentState.paused = true;
      this.currentState.currentTime = 0;
      this.currentState.duration = 0;
    }

    this.emit('stateChanged', this.currentState, prevState);
  }

  public isVersionMismatch(): boolean {
    return !!this.currentState.isVersionMismatch;
  }

  public resetVersionStatus(): void {
    if (this.currentState.isVersionMismatch || this.currentState.extensionVersion) {
      const prevState = { ...this.currentState };
      this.currentState.isVersionMismatch = false;
      this.currentState.extensionVersion = undefined;
      this.emit('stateChanged', this.currentState, prevState);
    }
  }

  /**
   * Called when all browser clients disconnect to reset active playback state
   */
  public handleClientsDisconnected(): void {
    const prevState = { ...this.currentState };
    this.currentState.paused = true;
    this.currentState.isVersionMismatch = false;
    this.currentState.extensionVersion = undefined;
    this.emit('stateChanged', this.currentState, prevState);
  }

  public getState(): YTMPlaybackState {
    return { ...this.currentState };
  }

  /**
   * Format seconds to standard mm:ss or hh:mm:ss string
   */
  public formatTime(totalSeconds: number): string {
    if (isNaN(totalSeconds) || totalSeconds < 0 || !isFinite(totalSeconds)) totalSeconds = 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const pad = (n: number) => n.toString().padStart(2, '0');

    if (hours > 0) {
      return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${minutes}:${pad(seconds)}`;
  }

  /**
   * Render custom title template with placeholders: {artist}, {title}, {album}
   */
  public formatTitleTemplate(template: string = '{artist} - {title}'): string {
    const state = this.currentState;
    if (!state.title && !state.artist) {
      return 'No Media';
    }

    const titleStr = (state.title || 'Unknown Title').trim();
    const artistStr = (state.artist || 'Unknown Artist').trim();
    const albumStr = (state.album || '').trim();

    let output = (template || '{artist} - {title}')
      .replace(/{(title|titel|song|track)}/gi, titleStr)
      .replace(/{(artist|kuenstler|künstler|interpret|author|channel)}/gi, artistStr)
      .replace(/{(album)}/gi, albumStr);

    // Clean up empty parentheses/brackets if album or variable was empty: e.g. " ()", " []"
    output = output.replace(/\(\s*\)/g, '').replace(/\[\s*\]/g, '');

    // Collapse multiple spaces
    output = output.replace(/\s+/g, ' ').trim();

    // Clean up dangling leading or trailing dashes / separators
    output = output
      .replace(/^[\s\-\–\—\•\|\:]+/, '')
      .replace(/[\s\-\–\—\•\|\:]+$/, '')
      .trim();

    return output || 'No Media';
  }

  /**
   * Render custom time template with placeholders: {current}, {duration}, {remaining}
   */
  public formatTimeTemplate(template: string = '{remaining}', currentTime?: number, duration?: number): string {
    const state = this.currentState;
    const cur = typeof currentTime === 'number' ? currentTime : state.currentTime;
    const dur = typeof duration === 'number' ? duration : state.duration;

    const currentStr = this.formatTime(cur);
    const durationStr = this.formatTime(dur);

    let remainingStr = '-0:00';
    if (dur > 0) {
      const effectiveCurrent = Math.min(dur, Math.max(0, cur));
      const remainingSeconds = Math.max(0, dur - effectiveCurrent);
      remainingStr = '-' + this.formatTime(remainingSeconds);
    } else if (cur > 0) {
      remainingStr = currentStr;
    }

    return (template || '{remaining}')
      .replace(/{(current|currentTime|current_time|aktuell|zeit|elapsed|time)}/gi, currentStr)
      .replace(/{(duration|total|totalTime|total_time|dauer|gesamt|length)}/gi, durationStr)
      .replace(/{(remaining|remainingTime|remaining_time|rest|restzeit|left)}/gi, remainingStr);
  }

  /**
   * Render custom volume template with placeholders: {volume}
   */
  public formatVolumeTemplate(template: string = '{volume}%', volume?: number, muted?: boolean): string {
    const state = this.currentState;
    const vol = typeof volume === 'number' ? volume : (state.volume ?? 100);
    const isMuted = typeof muted === 'boolean' ? muted : state.muted;

    if (isMuted) {
      if (template.includes('{volume}') || template.includes('{vol}')) {
        return template.replace(/\{(volume|vol|lautstaerke|lautstärke)\}/gi, 'MUTE');
      }
      return 'MUTE';
    }

    return (template || '{volume}%').replace(/\{(volume|vol|lautstaerke|lautstärke)\}/gi, String(vol));
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
    // e.g. "20 Mio. Aufrufe", "20M views", "1.2M views", "500 Aufrufe", "1 Aufruf", "20 M de vues", "10 млн просмотров", "500 次观看", "100万回視聴", "1.2만회 조회"
    const hasViewKeyword = /(?:aufruf|view|vue|visualiza|visualizz|просмотр|перегляд|wyświetle|görüntüleme|weergaven|visning|katselukert|zhlédnut|zhliadnut|megtekintés|vizionar|προβολ|pregled|צפי|مشاهد|ditonton|lượt\s*xem|回視聴|次观看|次觀看|조회|ครั้ง)/i.test(s);
    if (hasDigits && hasViewKeyword) return true;

    // 6. Relative upload times across languages:
    // e.g. "vor 3 Jahren", "3 years ago", "il y a 2 ans", "hace 5 meses", "2 anni fa", "3 года назад", "1年前", "3년 전", "há 3 anos"
    const hasTimeKeyword = /(?:^vor\s|\bago$|^il y a\b|^hace\s|^há\s|\bfa$|назад$|тому$|önce$|temu$|előtt$|sedan$|siden$|sitten$|yang lalu$|^před\s|^pred\s|^acum\s|^πριν\s|^pre\s|לפني|قبل|trước$|ที่แล้ว$|年前|前$|전$)/i.test(s);
    if (hasTimeKeyword) return true;

    // 7. Date units with digits (e.g. "3 Jahre", "5 months", "2 days", etc.)
    const hasDateUnit = /(?:year|jahr|ans?|año|anno|год|лет|рок|month|monat|mois|mes|mese|месяц|місяц|week|woche|semaine|semana|settiman|недел|тижд|day|tag|jour|día|giorno|день|дней|днів|hour|stunde|heure|hora|ora|час|minute|минут|хвилин)/i.test(s);
    if (hasDigits && hasDateUnit && /(?:vor|ago|hace|há|fa|назад|тому|önce|temu|előtt|sedan|siden|sitten|yang lalu|před|pred|acum|πριν|pre|לפني|قبل|trước|ที่แล้ว)/i.test(s)) {
      return true;
    }

    // 8. Like / reaction / subscriber counts (e.g. "500k likes", "12 Tsd. Gefällt mir", "1.2M subscribers")
    const hasLikeKeyword = /(?:like|gefällt|gusta|j'aime|mi piace|лайк|좋아요|讚|赞|subscribers?|abonnenten?|abonnés?|suscriptores?|iscritti)/i.test(s);
    if (hasDigits && hasLikeKeyword) return true;

    return false;
  }
}
