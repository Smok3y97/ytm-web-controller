/**
 * Song Blacklist Service
 * 
 * Manages persistent song blacklisting stored in a local text file (`blacklist.txt`).
 * Provides high-speed O(1) in-memory lookups for Chatbot song requests and allows
 * instant blacklisting & skipping from Stream Deck hardware actions.
 */

import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { exec, execFile } from 'node:child_process';
import { fileURLToPath } from 'url';
import streamDeck from '@elgato/streamdeck';
import { GlobalSettings, YTMPlaybackState } from '../types/index.js';

export const DEFAULT_BLACKLIST_HEADER = `# YouTube Music Web Controller - Song Blacklist
# Format: <VIDEO_ID> | <Artist> - <Title>
`;

export class BlacklistService {
  private static instance: BlacklistService;

  private filePath: string = '';
  private blacklistedIds: Set<string> = new Set();
  private fileWatcher: fs.FSWatcher | null = null;
  private watchDebounceTimer: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;

  private constructor() {
    this.filePath = this.resolveDefaultPath();
  }

  public static getInstance(): BlacklistService {
    if (!BlacklistService.instance) {
      BlacklistService.instance = new BlacklistService();
    }
    return BlacklistService.instance;
  }

  /**
   * Resolve default blacklist.txt storage path
   */
  private resolveDefaultPath(): string {
    try {
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      const candidateFromBin = path.resolve(currentDir, '..', 'blacklist.txt');
      if (fs.existsSync(candidateFromBin)) {
        return candidateFromBin;
      }
    } catch { }

    const fromCwd = path.resolve(process.cwd(), 'blacklist.txt');
    if (fs.existsSync(fromCwd)) {
      return fromCwd;
    }

    const fromPluginDir = path.resolve(process.cwd(), 'plugin', 'blacklist.txt');
    if (fs.existsSync(fromPluginDir)) {
      return fromPluginDir;
    }

    // Default to root cwd / plugin path
    return path.resolve(process.cwd(), 'blacklist.txt');
  }

  /**
   * Initialize service: load blacklist and start file watcher
   */
  public async init(customPath?: string): Promise<void> {
    if (customPath && customPath.trim()) {
      this.filePath = path.resolve(customPath.trim());
    } else {
      this.filePath = this.resolveDefaultPath();
    }

    await this.loadBlacklist();
    this.startWatcher();
    this.isInitialized = true;
  }

  /**
   * Update configuration from GlobalSettings
   */
  public async updateSettings(settings: Partial<GlobalSettings>): Promise<void> {
    const configuredPath = (settings.blacklistFilePath || '').trim();
    const targetPath = configuredPath ? path.resolve(configuredPath) : this.resolveDefaultPath();

    if (targetPath !== this.filePath || !this.isInitialized) {
      streamDeck.logger.info(`[BlacklistService] Updating blacklist path: ${targetPath}`);
      this.stopWatcher();
      this.filePath = targetPath;
      await this.loadBlacklist();
      this.startWatcher();
    }
  }

  /**
   * Returns current active blacklist.txt absolute path
   */
  public getFilePath(): string {
    return this.filePath;
  }

  /**
   * Reads blacklist.txt from disk and populates the in-memory Set
   */
  public async loadBlacklist(): Promise<void> {
    try {
      const dirPath = path.dirname(this.filePath);
      if (!fs.existsSync(dirPath)) {
        await fsPromises.mkdir(dirPath, { recursive: true });
      }

      if (!fs.existsSync(this.filePath)) {
        // Create initial file with standard comment header
        await fsPromises.writeFile(this.filePath, DEFAULT_BLACKLIST_HEADER, { encoding: 'utf8' });
        this.blacklistedIds.clear();
        streamDeck.logger.info(`[BlacklistService] Created initial blacklist file at "${this.filePath}"`);
        return;
      }

      const content = await fsPromises.readFile(this.filePath, 'utf8');
      const lines = content.split(/\r?\n/);
      const newSet = new Set<string>();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        let rawIdOrUrl = trimmed;
        if (trimmed.includes('|')) {
          const parts = trimmed.split('|');
          rawIdOrUrl = (parts[0] || '').trim();
        }

        const videoId = this.extractVideoId(rawIdOrUrl);
        if (videoId) {
          newSet.add(videoId);
        } else if (rawIdOrUrl && /^[a-zA-Z0-9_-]{11}$/.test(rawIdOrUrl)) {
          newSet.add(rawIdOrUrl);
        }
      }

      this.blacklistedIds = newSet;
      streamDeck.logger.info(`[BlacklistService] Loaded ${this.blacklistedIds.size} blacklisted track(s) from "${this.filePath}"`);
    } catch (err: any) {
      streamDeck.logger.error(`[BlacklistService] Failed to load blacklist file "${this.filePath}": ${err?.message || err}`);
    }
  }

  /**
   * Returns all structured entries from blacklist.txt for Dashboard API
   */
  public async getEntries(): Promise<Array<{ id: string; title: string; artist: string; raw: string; url: string }>> {
    try {
      if (!fs.existsSync(this.filePath)) {
        return [];
      }

      const content = await fsPromises.readFile(this.filePath, 'utf8');
      const lines = content.split(/\r?\n/);
      const entries: Array<{ id: string; title: string; artist: string; raw: string; url: string }> = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        let rawIdOrUrl = trimmed;
        let displayName = '';

        if (trimmed.includes('|')) {
          const parts = trimmed.split('|');
          rawIdOrUrl = (parts[0] || '').trim();
          displayName = (parts.slice(1).join('|') || '').trim();
        }

        const videoId = this.extractVideoId(rawIdOrUrl) || (
          /^[a-zA-Z0-9_-]{11}$/.test(rawIdOrUrl) ? rawIdOrUrl : ''
        );

        if (!videoId) continue;

        let artist = '';
        let title = displayName || 'Manual Blacklist';

        if (displayName.includes(' - ')) {
          const nameParts = displayName.split(' - ');
          artist = (nameParts[0] || '').trim();
          title = (nameParts.slice(1).join(' - ') || '').trim();
        }

        entries.push({
          id: videoId,
          title,
          artist,
          raw: trimmed,
          url: `https://music.youtube.com/watch?v=${videoId}`
        });
      }

      return entries;
    } catch (err: any) {
      streamDeck.logger.error(`[BlacklistService] Error reading entries from "${this.filePath}": ${err?.message || err}`);
      return [];
    }
  }

  /**
   * Remove a track by video ID from blacklist.txt and in-memory cache
   */
  public async removeTrack(videoId: string): Promise<{ success: boolean; reason?: string }> {
    const cleanId = this.extractVideoId(videoId) || videoId.trim();
    if (!cleanId) {
      return { success: false, reason: 'Invalid YouTube video ID' };
    }

    try {
      if (!fs.existsSync(this.filePath)) {
        return { success: true };
      }

      const content = await fsPromises.readFile(this.filePath, 'utf8');
      const lines = content.split(/\r?\n/);
      const remainingLines: string[] = [];
      let removedCount = 0;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          remainingLines.push(line);
          continue;
        }

        let rawId = trimmed;
        if (trimmed.includes('|')) {
          rawId = (trimmed.split('|')[0] || '').trim();
        }

        const parsedId = this.extractVideoId(rawId) || rawId;
        if (parsedId === cleanId) {
          removedCount++;
        } else {
          remainingLines.push(line);
        }
      }

      await fsPromises.writeFile(this.filePath, remainingLines.join('\n'), { encoding: 'utf8' });
      this.blacklistedIds.delete(cleanId);
      streamDeck.logger.info(`[BlacklistService] Removed "${cleanId}" from blacklist (${removedCount} line(s) removed)`);
      return { success: true };
    } catch (err: any) {
      streamDeck.logger.error(`[BlacklistService] Error removing track "${cleanId}": ${err?.message || err}`);
      return { success: false, reason: err?.message || 'File write error' };
    }
  }

  /**
   * Check if a given video ID or YouTube URL is in the blacklist
   */
  public isBlacklisted(videoIdOrUrl: string): boolean {
    if (!videoIdOrUrl) return false;
    const cleanId = this.extractVideoId(videoIdOrUrl) || videoIdOrUrl.trim();
    return this.blacklistedIds.has(cleanId);
  }

  /**
   * Add a specific track or video ID to blacklist.txt and in-memory cache
   */
  public async addTrack(videoId: string, title?: string, artist?: string): Promise<{ success: boolean; reason?: string }> {
    const cleanId = this.extractVideoId(videoId) || videoId.trim();
    if (!cleanId || !/^[a-zA-Z0-9_-]{11}$/.test(cleanId)) {
      return { success: false, reason: 'Invalid YouTube video ID' };
    }

    const titleStr = (title || 'Manual Blacklist').trim();
    const artistStr = (artist || '').trim();
    const displayName = artistStr ? `${artistStr} - ${titleStr}` : titleStr;

    // If already blacklisted, skip writing to disk
    if (this.blacklistedIds.has(cleanId)) {
      streamDeck.logger.info(`[BlacklistService] Track "${displayName}" (${cleanId}) is already blacklisted`);
      return { success: true, reason: 'already_blacklisted' };
    }

    try {
      const dirPath = path.dirname(this.filePath);
      if (!fs.existsSync(dirPath)) {
        await fsPromises.mkdir(dirPath, { recursive: true });
      }

      if (!fs.existsSync(this.filePath)) {
        await fsPromises.writeFile(this.filePath, DEFAULT_BLACKLIST_HEADER, { encoding: 'utf8' });
      }

      const newLine = `${cleanId} | ${displayName}\n`;
      await fsPromises.appendFile(this.filePath, newLine, { encoding: 'utf8' });

      this.blacklistedIds.add(cleanId);
      streamDeck.logger.info(`[BlacklistService] Blacklisted and saved: "${displayName}" (${cleanId})`);
      return { success: true };
    } catch (err: any) {
      streamDeck.logger.error(`[BlacklistService] Failed to append track to "${this.filePath}": ${err?.message || err}`);
      return { success: false, reason: err?.message || 'File write error' };
    }
  }

  /**
   * Add currently playing track to blacklist.txt and in-memory cache
   */
  public async addCurrentTrack(state: YTMPlaybackState): Promise<{ success: boolean; reason?: string }> {
    if (!state) {
      return { success: false, reason: 'No active playback state' };
    }

    const videoId = this.extractVideoId(state.trackUrl || '');
    if (!videoId) {
      return { success: false, reason: 'No valid YouTube video ID found in track URL' };
    }

    const title = (state.title || 'Unknown Title').trim();
    const artist = (state.artist || 'Unknown Artist').trim();

    return this.addTrack(videoId, title, artist);
  }

  /**
   * Open blacklist.txt in the system's default text editor or file manager
   */
  public async openInEditor(): Promise<void> {
    try {
      const dirPath = path.dirname(this.filePath);
      if (!fs.existsSync(dirPath)) {
        await fsPromises.mkdir(dirPath, { recursive: true });
      }

      if (!fs.existsSync(this.filePath)) {
        await fsPromises.writeFile(this.filePath, DEFAULT_BLACKLIST_HEADER, { encoding: 'utf8' });
      }

      const resolved = path.resolve(this.filePath);

      if (process.platform === 'win32') {
        exec(`cmd /c start "" "${resolved}"`, (err) => {
          if (err) {
            // Fallback to notepad
            execFile('notepad.exe', [resolved], () => { });
          }
        });
      } else if (process.platform === 'darwin') {
        execFile('open', [resolved], () => { });
      } else {
        execFile('xdg-open', [resolved], () => { });
      }
    } catch (err: any) {
      streamDeck.logger.error(`[BlacklistService] Error opening blacklist in editor: ${err?.message || err}`);
    }
  }

  /**
   * Start file watcher on blacklist.txt to detect external modifications
   */
  private startWatcher(): void {
    this.stopWatcher();

    try {
      if (fs.existsSync(this.filePath)) {
        this.fileWatcher = fs.watch(this.filePath, (eventType) => {
          if (eventType === 'change' || eventType === 'rename') {
            if (this.watchDebounceTimer) {
              clearTimeout(this.watchDebounceTimer);
            }
            this.watchDebounceTimer = setTimeout(() => {
              this.watchDebounceTimer = null;
              streamDeck.logger.info(`[BlacklistService] Detected external edit in "${this.filePath}". Reloading...`);
              this.loadBlacklist();
            }, 300);
          }
        });
      }
    } catch (err) {
      streamDeck.logger.warn(`[BlacklistService] Could not establish file watcher on "${this.filePath}": ${err}`);
    }
  }

  /**
   * Stop active file watcher
   */
  private stopWatcher(): void {
    if (this.watchDebounceTimer) {
      clearTimeout(this.watchDebounceTimer);
      this.watchDebounceTimer = null;
    }
    if (this.fileWatcher) {
      try {
        this.fileWatcher.close();
      } catch { }
      this.fileWatcher = null;
    }
  }

  /**
   * Helper to parse YouTube Video IDs from full URLs or raw IDs
   */
  public extractVideoId(input: string): string | null {
    if (!input) return null;
    const clean = input.trim();

    // 1. Direct 11-character video ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) {
      return clean;
    }

    // 2. Full URL matching patterns
    try {
      const match = clean.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/)|music\.youtube\.com\/watch\?v=|music\.youtube\.com\/watch\?.+&v=)([a-zA-Z0-9_-]{11})/i);
      if (match && match[1]) {
        return match[1];
      }

      // Standard URL search param parsing
      const parsed = new URL(clean.startsWith('http') ? clean : `https://${clean}`);
      const v = parsed.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
        return v;
      }
    } catch { }

    return null;
  }
}
