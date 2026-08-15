/**
 * State Manager Service
 * 
 * Central in-memory state hub for YouTube Music playback data and formatting.
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
    repeatMode: 'OFF'
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
    const prevState = { ...this.currentState };
    this.currentState = { ...state };
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
   * Render custom title template with placeholders: {title}, {artist}, {album}
   */
  public formatTitleTemplate(template: string = '{artist} - {title}'): string {
    const state = this.currentState;
    if (!state.title && !state.artist) {
      return 'No Media';
    }

    const titleStr = state.title || 'Unknown Title';
    const artistStr = state.artist || 'Unknown Artist';
    const albumStr = state.album || 'Unknown Album';

    return (template || '{artist} - {title}')
      .replace(/{(title|song|track)}/gi, titleStr)
      .replace(/{(artist|author|channel)}/gi, artistStr)
      .replace(/{(album)}/gi, albumStr);
  }

  /**
   * Render custom time template with placeholders: {current}, {remaining}, {duration}
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
      .replace(/{(current|currentTime|current_time|elapsed|time)}/gi, currentStr)
      .replace(/{(duration|total|totalTime|total_time|length)}/gi, durationStr)
      .replace(/{(remaining|remainingTime|remaining_time|left)}/gi, remainingStr);
  }

  /**
   * Render custom volume template with placeholders: {volume}, {step}
   */
  public formatVolumeTemplate(template: string = '{volume}%', volume?: number, muted?: boolean): string {
    const state = this.currentState;
    const vol = typeof volume === 'number' ? volume : (state.volume ?? 100);
    const isMuted = typeof muted === 'boolean' ? muted : state.muted;

    if (isMuted) {
      if (template.includes('{volume}')) {
        return template.replace(/\{volume\}/gi, 'MUTE');
      }
      return 'MUTE';
    }

    return (template || '{volume}%').replace(/\{volume\}/gi, String(vol));
  }
}
