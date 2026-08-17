/**
 * TypeScript Interfaces for YouTube Music Web Controller
 */

import type { JsonObject, JsonValue } from '@elgato/utils';

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
  isVersionMismatch?: boolean;
  extensionVersion?: string;
}

export interface HandshakePayload {
  type: 'handshake';
  version: string;
  platform?: string;
}

export interface HandshakeAckPayload {
  type: 'handshake_ack';
  version: string;
  compatible: true;
}

export interface VersionMismatchPayload {
  type: 'version_mismatch';
  requiredPluginVersion: string;
  currentPluginVersion: string;
  extensionVersion: string;
  message: string;
}

export interface WSMessage<T = unknown> {
  type: string;
  timestamp?: number;
  data?: T;
  command?: string;
  payload?: Record<string, unknown>;
  client?: string;
  url?: string;
  version?: string;
  platform?: string;
}

export interface GlobalSettings extends JsonObject {
  [key: string]: JsonValue | undefined;
  wsPort?: number;
  enableDiscordRPC?: boolean;
  discordClientId?: string;
  enableObsExport?: boolean;
  obsFilePath?: string;
  obsFormatTemplate?: string;
  obsClearOnPause?: boolean;
  enableSongRequests?: boolean;
  songRequestMode?: 'playNext' | 'addToQueue';
  songRequestSuccessTemplate?: string;
  songRequestDisabledTemplate?: string;
  songRequestErrorTemplate?: string;
  songRequestBlockedTemplate?: string;
  songRequestBlacklist?: string;
  isVersionMismatch?: boolean;
  extensionVersion?: string;
  requiredPluginVersion?: string;
  warningMessage?: string;
}

export interface PlayPauseSettings extends JsonObject {
  [key: string]: JsonValue | undefined;
  showCoverAsBackground?: boolean;
  enableObsExport?: boolean;
  obsFilePath?: string;
  obsFormatTemplate?: string;
  obsClearOnPause?: boolean;
}

export interface TrackDialSettings extends JsonObject {
  [key: string]: JsonValue | undefined;
  mode?: 'volume' | 'track';
  volumeStep?: number;
  titleTemplate?: string;
  timeTemplate?: string;
  showCover?: boolean;
}

export type DialSettings = TrackDialSettings;

export interface VolumeSettings extends JsonObject {
  [key: string]: JsonValue | undefined;
  step?: number;
  showVolumeTitle?: boolean;
  titleTemplate?: string;
}

export interface VolumeDialSettings extends JsonObject {
  [key: string]: JsonValue | undefined;
  step?: number;
  titleTemplate?: string;
  showCover?: boolean;
}

export interface SeekDialSettings extends JsonObject {
  [key: string]: JsonValue | undefined;
  seekStep?: number;
  titleTemplate?: string;
  timeTemplate?: string;
  showCover?: boolean;
}
