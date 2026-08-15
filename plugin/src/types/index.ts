/**
 * TypeScript Interfaces for YouTube Music Web Controller
 */

import type { JsonObject } from '@elgato/streamdeck';

export interface YTMPlaybackState {
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  coverBase64?: string;
  trackUrl?: string;
  artistUrl?: string;
  albumUrl?: string;
  currentTime: number;
  duration: number;
  volume: number;
  paused: boolean;
  muted: boolean;
  isLiked: boolean;
  isDisliked: boolean;
  shuffleActive: boolean;
  repeatMode: 'OFF' | 'ONE' | 'ALL';
}

export interface WSMessage<T = unknown> {
  type: string;
  timestamp?: number;
  data?: T;
  command?: string;
  payload?: Record<string, unknown>;
  client?: string;
  url?: string;
}

export interface GlobalSettings extends JsonObject {
  wsPort?: number;
  enableDiscordRPC?: boolean;
  discordClientId?: string;
  enableObsExport?: boolean;
  obsFilePath?: string;
  obsFormatTemplate?: string;
  obsClearOnPause?: boolean;
}

export interface PlayPauseSettings extends JsonObject {
  showCoverAsBackground?: boolean;
  enableObsExport?: boolean;
  obsFilePath?: string;
  obsFormatTemplate?: string;
  obsClearOnPause?: boolean;
}

export interface DialSettings extends JsonObject {
  mode?: 'volume' | 'track';
  volumeStep?: number;
  titleTemplate?: string;
  timeTemplate?: string;
  showCover?: boolean;
}

export interface VolumeSettings extends JsonObject {
  step?: number;
  showVolumeTitle?: boolean;
  titleTemplate?: string;
}

export interface VolumeDialSettings extends JsonObject {
  step?: number;
  titleTemplate?: string;
  showCover?: boolean;
}

export interface SeekDialSettings extends JsonObject {
  seekStep?: number;
  titleTemplate?: string;
  timeTemplate?: string;
  showCover?: boolean;
}

