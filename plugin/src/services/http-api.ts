/**
 * HTTP API & Web Dashboard Service
 * 
 * Lightweight, zero-dependency HTTP server layer attached directly to the existing
 * WebSocket server instance (Port 39865).
 * 
 * Serves:
 * 1. Streamer Web Dashboard (/dashboard, /admin)
 * 2. OBS Studio Browser Source Overlay (/overlay)
 * 3. Chatbot Metadata & Viewer Requests (/api/current, /api/playnext, /api/queue)
 * 4. Blacklist Manager REST API (/api/blacklist)
 * 
 * All HTTP routes are guarded by `streamerModeEnabled` to ensure zero background overhead
 * for standard Stream Deck media controller users.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
import streamDeck from '@elgato/streamdeck';
import { StateManager } from './state-manager.js';
import { BlacklistService } from './blacklist-service.js';
import { GlobalSettings } from '../types/index.js';

export class HttpApiService extends EventEmitter {
  private static instance: HttpApiService;
  private overlayDir: string;
  private dashboardDir: string;
  private streamerModeEnabled: boolean = false;

  private constructor() {
    super();
    this.overlayDir = this.resolveOverlayDir();
    this.dashboardDir = this.resolveDashboardDir();
  }

  public static getInstance(): HttpApiService {
    if (!HttpApiService.instance) {
      HttpApiService.instance = new HttpApiService();
    }
    return HttpApiService.instance;
  }

  /**
   * Update configuration from GlobalSettings
   */
  public updateSettings(settings: Partial<GlobalSettings>): void {
    this.streamerModeEnabled = !!settings.streamerModeEnabled;
    streamDeck.logger.info(`[HTTP API] Streamer Mode is ${this.streamerModeEnabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Resolve directory where overlay static assets are stored.
   */
  private resolveOverlayDir(): string {
    try {
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      const relativeFromBin = path.resolve(currentDir, '..', 'assets', 'overlay');
      if (fs.existsSync(relativeFromBin)) {
        return relativeFromBin;
      }
    } catch { }

    const fromCwd = path.resolve(process.cwd(), 'assets', 'overlay');
    if (fs.existsSync(fromCwd)) {
      return fromCwd;
    }

    const fromPluginDir = path.resolve(process.cwd(), 'plugin', 'assets', 'overlay');
    if (fs.existsSync(fromPluginDir)) {
      return fromPluginDir;
    }

    return path.resolve(process.cwd(), 'assets', 'overlay');
  }

  /**
   * Resolve directory where web dashboard static assets are stored.
   */
  private resolveDashboardDir(): string {
    try {
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      const relativeFromBin = path.resolve(currentDir, '..', 'assets', 'dashboard');
      if (fs.existsSync(relativeFromBin)) {
        return relativeFromBin;
      }
    } catch { }

    const fromCwd = path.resolve(process.cwd(), 'assets', 'dashboard');
    if (fs.existsSync(fromCwd)) {
      return fromCwd;
    }

    const fromPluginDir = path.resolve(process.cwd(), 'plugin', 'assets', 'dashboard');
    if (fs.existsSync(fromPluginDir)) {
      return fromPluginDir;
    }

    return path.resolve(process.cwd(), 'assets', 'dashboard');
  }

  /**
   * Main HTTP request router attached to http.Server
   */
  public handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Set permissive CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Streamer Mode Guard: Disable all HTTP endpoints when streamer mode is inactive
    if (!this.streamerModeEnabled) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Streamer tools are disabled in Stream Deck settings');
      return;
    }

    if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'DELETE') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Method Not Allowed');
      return;
    }

    const host = req.headers.host || '127.0.0.1';
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(req.url || '/', `http://${host}`);
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bad Request');
      return;
    }

    const pathname = parsedUrl.pathname;

    // Route 1: Web Dashboard - Redirect /dashboard and /admin to /dashboard/
    if (pathname === '/dashboard' || pathname === '/admin') {
      res.writeHead(302, {
        'Location': `/dashboard/${parsedUrl.search}`
      });
      res.end();
      return;
    }

    // Route 1.5: Web Dashboard Static Assets
    if (pathname === '/dashboard/' || pathname.startsWith('/dashboard/')) {
      this.handleDashboardAssets(pathname, res);
      return;
    }

    // Route 2: Settings API - Read and Write Global Settings from Web Dashboard
    if (pathname === '/api/settings') {
      this.handleSettingsApi(req, res);
      return;
    }

    // Route 2.5: Chatbot API - Current Track Metadata
    if (pathname === '/api/current') {
      this.handleCurrentTrackApi(parsedUrl, res);
      return;
    }

    // Route 3: Chatbot API - Song Request / Queue / Play Next (GET & POST)
    if (pathname === '/api/playnext' || pathname === '/api/queue' || pathname === '/api/request' || pathname === '/api/songrequest') {
      this.handleSongRequestApi(pathname, parsedUrl, req, res);
      return;
    }

    // Route 4: Blacklist API & Mod Command (/api/blacklist, /api/blacklist/:id, /api/ban, /api/block)
    if (pathname === '/api/blacklist' || pathname.startsWith('/api/blacklist/') || pathname === '/api/ban' || pathname === '/api/block') {
      this.handleBlacklistApi(pathname, parsedUrl, req, res);
      return;
    }

    // Route 5: Redirect /overlay to /overlay/ with query parameters preserved
    if (pathname === '/overlay') {
      res.writeHead(302, {
        'Location': `/overlay/${parsedUrl.search}`
      });
      res.end();
      return;
    }

    // Route 6: OBS Browser Overlay & Static Assets
    if (pathname === '/overlay/' || pathname.startsWith('/overlay/') || pathname === '/style.css' || pathname === '/overlay.js') {
      this.handleOverlayAssets(pathname, res);
      return;
    }

    // Fallback 404
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  }

  /**
   * Endpoint: GET /api/current
   */
  private handleCurrentTrackApi(url: URL, res: http.ServerResponse): void {
    const state = StateManager.getInstance().getState();

    if (!state.title && !state.artist) {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('No music playing');
      return;
    }

    const rawFormat = url.searchParams.get('format') || '{artist} - {title}';
    const stateManager = StateManager.getInstance();

    const titleStr = (state.title || 'Unknown Title').trim();
    const artistStr = (state.artist || 'Unknown Artist').trim();
    const albumStr = (state.album || '').trim();
    const trackUrlStr = (state.trackUrl || '').trim();
    const durationStr = stateManager.formatTime(state.duration);
    const currentTimeStr = stateManager.formatTime(state.currentTime);

    let output = rawFormat
      .replace(/{(title|titel|song|track)}/gi, titleStr)
      .replace(/{(artist|kuenstler|künstler|interpret|author|channel)}/gi, artistStr)
      .replace(/{(album)}/gi, albumStr)
      .replace(/{(url|link|trackUrl|songUrl)}/gi, trackUrlStr)
      .replace(/{(duration|total|totalTime|length)}/gi, durationStr)
      .replace(/{(currentTime|current_time|current|time|elapsed)}/gi, currentTimeStr);

    output = output.replace(/\(\s*\)/g, '').replace(/\[\s*\]/g, '');
    output = output.replace(/\s+/g, ' ').trim();
    output = output
      .replace(/^[\s\-\–\—\•\|\:]+/, '')
      .replace(/[\s\-\–\—\•\|\:]+$/, '')
      .trim();

    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(output || 'No music playing');
  }

  /**
   * Endpoint: GET & POST /api/playnext & /api/queue
   */
  private async handleSongRequestApi(
    pathname: string,
    url: URL,
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    try {
      const globalSettings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
      const isEnabled = globalSettings.enableSongRequests === true;

      // 1. Check if streamer has disabled song requests
      if (!isEnabled) {
        const disabledMsg = globalSettings.songRequestDisabledTemplate ||
          'Song requests are currently paused by the streamer.';
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(disabledMsg);
        return;
      }

      // 2. Extract song query or link from query params or POST body
      let inputQuery = url.searchParams.get('url') ||
        url.searchParams.get('link') ||
        url.searchParams.get('v') ||
        url.searchParams.get('q') ||
        url.searchParams.get('query') ||
        url.searchParams.get('song') ||
        '';

      if (!inputQuery && req.method === 'POST') {
        const body = await this.readRequestBody(req);
        try {
          const json = JSON.parse(body);
          inputQuery = json.url || json.link || json.v || json.query || json.song || body;
        } catch {
          inputQuery = body.trim();
        }
      }

      inputQuery = decodeURIComponent(inputQuery).trim();
      const videoId = this.extractVideoId(inputQuery);

      // 3. Validate video ID
      if (!videoId) {
        const errorMsg = globalSettings.songRequestErrorTemplate ||
          'Invalid YouTube link or video ID.';
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(errorMsg);
        return;
      }

      // 4. Check if video ID is blacklisted
      const blacklistService = BlacklistService.getInstance();
      const isBlocked = blacklistService.isBlacklisted(videoId) || (
        globalSettings.songRequestBlacklist ?
          globalSettings.songRequestBlacklist
            .split(/[\r\n,;\s]+/)
            .map(item => this.extractVideoId(item) || item.trim())
            .filter(Boolean)
            .includes(videoId)
          : false
      );

      if (isBlocked) {
        const blockedMsg = globalSettings.songRequestBlockedTemplate ||
          'This song is blocked from requests 🚫';
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(blockedMsg);
        return;
      }

      // 5. Determine queue mode (playNext vs addToQueue)
      const mode = (pathname === '/api/playnext')
        ? 'playNext'
        : (globalSettings.songRequestMode || 'playNext');

      const canonicalUrl = `https://music.youtube.com/watch?v=${videoId}`;

      // Dispatch command to YouTube Music companion extension via WebSocket
      this.emit('queueTrack', {
        videoId,
        mode,
        url: canonicalUrl
      });

      // 6. Format customizable success feedback message
      const customFormat = url.searchParams.get('format') ||
        url.searchParams.get('successFormat') ||
        globalSettings.songRequestSuccessTemplate ||
        'Added to queue: {url} 🎶';

      const responseMessage = customFormat
        .replace(/{(url|link|songUrl|trackUrl)}/gi, canonicalUrl)
        .replace(/{(id|videoId|video_id)}/gi, videoId)
        .replace(/{(mode)}/gi, mode === 'playNext' ? 'Play Next' : 'End of Queue')
        .trim();

      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(responseMessage);
    } catch (err) {
      streamDeck.logger.error(`[HTTP API] Error processing song request: ${err}`);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal server error processing song request.');
    }
  }

  /**
   * Endpoint: GET, POST, DELETE /api/blacklist
   * - GET with no params -> Returns JSON array of all blacklisted songs
   * - GET with query -> Mod blacklist command with chatbot response
   * - POST -> Add song to blacklist (JSON or chatbot)
   * - DELETE -> Remove song from blacklist by ID
   */
  private async handleBlacklistApi(
    pathname: string,
    url: URL,
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const blacklistService = BlacklistService.getInstance();
    const stateManager = StateManager.getInstance();
    const currentState = stateManager.getState();
    const globalSettings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();

    // 1. Handle DELETE Request: Remove song from blacklist
    if (req.method === 'DELETE') {
      let targetId = pathname.replace(/^\/api\/blacklist\/?/, '').trim();
      if (!targetId || targetId === 'undefined') {
        targetId = url.searchParams.get('id') || url.searchParams.get('v') || url.searchParams.get('url') || '';
      }

      if (!targetId && req.headers['content-length']) {
        const body = await this.readRequestBody(req);
        try {
          const json = JSON.parse(body);
          targetId = json.id || json.videoId || json.url || '';
        } catch {
          targetId = body.trim();
        }
      }

      const cleanId = this.extractVideoId(targetId) || targetId.trim();

      if (!cleanId) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: 'Missing or invalid video ID' }));
        return;
      }

      const result = await blacklistService.removeTrack(cleanId);
      res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    // 2. Handle GET Request
    if (req.method === 'GET') {
      const hasQueryParam = url.searchParams.has('url') ||
        url.searchParams.has('link') ||
        url.searchParams.has('v') ||
        url.searchParams.has('id') ||
        url.searchParams.has('song') ||
        url.searchParams.has('query');

      const wantsJson = (req.headers.accept && req.headers.accept.includes('application/json')) ||
        url.searchParams.get('format') === 'json' ||
        url.searchParams.get('json') === 'true';

      // If no query parameters or explicit JSON requested, return full blacklist data array
      if (!hasQueryParam && (wantsJson || !url.search)) {
        const entries = await blacklistService.getEntries();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          count: entries.length,
          filePath: blacklistService.getFilePath(),
          entries
        }));
        return;
      }
    }

    // 3. Handle Add / Mod Blacklist Command (GET with query or POST)
    try {
      let inputQuery = url.searchParams.get('url') ||
        url.searchParams.get('link') ||
        url.searchParams.get('v') ||
        url.searchParams.get('id') ||
        url.searchParams.get('q') ||
        url.searchParams.get('query') ||
        url.searchParams.get('song') ||
        '';

      let inputTitle = url.searchParams.get('title') || '';
      let inputArtist = url.searchParams.get('artist') || '';

      if (!inputQuery && req.method === 'POST') {
        const body = await this.readRequestBody(req);
        try {
          const json = JSON.parse(body);
          inputQuery = json.url || json.link || json.v || json.id || json.query || json.song || body;
          inputTitle = json.title || inputTitle;
          inputArtist = json.artist || inputArtist;
        } catch {
          inputQuery = body.trim();
        }
      }

      inputQuery = decodeURIComponent(inputQuery).trim();

      let targetVideoId: string | null = null;
      let targetTitle = inputTitle;
      let targetArtist = inputArtist;
      let isCurrentTrack = false;

      // If no query or "current", blacklist the currently playing song
      if (!inputQuery || inputQuery.toLowerCase() === 'current' || inputQuery.toLowerCase() === 'now') {
        if (!currentState.trackUrl && !currentState.title && !currentState.artist) {
          res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('No song currently playing to blacklist.');
          return;
        }

        targetVideoId = this.extractVideoId(currentState.trackUrl || '');
        if (!targetVideoId) {
          res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Could not determine YouTube video ID of currently playing song.');
          return;
        }

        targetTitle = (currentState.title || 'Unknown Title').trim();
        targetArtist = (currentState.artist || 'Unknown Artist').trim();
        isCurrentTrack = true;
      } else {
        targetVideoId = this.extractVideoId(inputQuery);
        if (!targetVideoId) {
          const errorMsg = globalSettings.songBlacklistErrorTemplate ||
            'Invalid YouTube link or video ID to blacklist.';
          res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(errorMsg);
          return;
        }

        const currentVideoId = this.extractVideoId(currentState.trackUrl || '');
        if (currentVideoId === targetVideoId) {
          targetTitle = (currentState.title || 'Unknown Title').trim();
          targetArtist = (currentState.artist || 'Unknown Artist').trim();
          isCurrentTrack = true;
        } else {
          targetTitle = targetTitle || 'Manual Blacklist';
          targetArtist = targetArtist || '';
        }
      }

      const result = await blacklistService.addTrack(targetVideoId, targetTitle, targetArtist);
      if (!result.success) {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Failed to blacklist song: ${result.reason || 'File error'}`);
        return;
      }

      // If blacklisting current track (or skip=true requested), skip immediately
      const shouldSkip = url.searchParams.get('skip') !== 'false' && (isCurrentTrack || url.searchParams.get('skip') === 'true');
      if (shouldSkip) {
        this.emit('skipTrack');
      }

      // If caller requested JSON (e.g. Dashboard POST)
      const wantsJson = (req.headers.accept && req.headers.accept.includes('application/json')) ||
        url.searchParams.get('format') === 'json';

      if (wantsJson && req.method === 'POST') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          id: targetVideoId,
          title: targetTitle,
          artist: targetArtist,
          skipped: shouldSkip
        }));
        return;
      }

      // Plaintext Chatbot Response
      const canonicalUrl = `https://music.youtube.com/watch?v=${targetVideoId}`;
      const defaultTemplate = targetArtist
        ? 'Blacklisted: {artist} - {title} ⛔'
        : 'Blacklisted track: {url} ⛔';

      const customFormat = url.searchParams.get('format') ||
        url.searchParams.get('successFormat') ||
        globalSettings.songBlacklistSuccessTemplate ||
        defaultTemplate;

      const responseMessage = customFormat
        .replace(/{(url|link|songUrl|trackUrl)}/gi, canonicalUrl)
        .replace(/{(id|videoId|video_id)}/gi, targetVideoId)
        .replace(/{(title|song|track)}/gi, targetTitle || 'Unknown Title')
        .replace(/{(artist|channel|author)}/gi, targetArtist || 'Unknown Artist')
        .trim();

      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(responseMessage);
    } catch (err) {
      streamDeck.logger.error(`[HTTP API] Error blacklisting song: ${err}`);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal server error blacklisting song.');
    }
  }

  /**
   * Helper to parse YouTube Video IDs from full URLs or raw IDs
   */
  public extractVideoId(input: string): string | null {
    if (!input) return null;
    const clean = input.trim();

    if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) {
      return clean;
    }

    try {
      const match = clean.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/)|music\.youtube\.com\/watch\?v=|music\.youtube\.com\/watch\?.+&v=)([a-zA-Z0-9_-]{11})/i);
      if (match && match[1]) {
        return match[1];
      }

      const parsed = new URL(clean.startsWith('http') ? clean : `https://${clean}`);
      const v = parsed.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
        return v;
      }
    } catch { }

    return null;
  }

  /**
   * Helper to read HTTP POST/DELETE body
   */
  private readRequestBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 1e6) {
          req.destroy();
          resolve('');
        }
      });
      req.on('end', () => resolve(body));
      req.on('error', () => resolve(''));
    });
  }

  /**
   * Endpoint: GET & POST /api/settings
   * Synchronizes global settings between Stream Deck and the Web Dashboard
   */
  private async handleSettingsApi(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      if (req.method === 'GET') {
        const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, settings }));
        return;
      }

      if (req.method === 'POST') {
        const body = await this.readRequestBody(req);
        let parsed: Partial<GlobalSettings> = {};
        try {
          parsed = JSON.parse(body);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON body' }));
          return;
        }

        const currentSettings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
        const merged: GlobalSettings = { ...currentSettings, ...parsed };

        await streamDeck.settings.setGlobalSettings<GlobalSettings>(merged);
        this.updateSettings(merged);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, settings: merged }));
        return;
      }

      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Method Not Allowed');
    } catch (err: any) {
      streamDeck.logger.error(`[HTTP API] Error in /api/settings: ${err?.message || err}`);
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: err?.message || 'Server error' }));
    }
  }

  /**
   * Endpoint: GET /dashboard & static dashboard assets
   */
  private handleDashboardAssets(pathname: string, res: http.ServerResponse): void {
    let relativeFile = pathname.replace(/^\/dashboard\/?/, '').replace(/^\//, '').trim();
    if (!relativeFile || relativeFile === 'index.html') {
      relativeFile = 'index.html';
    }

    const safeDashboardDir = path.resolve(this.resolveDashboardDir());
    const targetFilePath = path.resolve(safeDashboardDir, relativeFile);

    if (!targetFilePath.startsWith(safeDashboardDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    fs.readFile(targetFilePath, (err, data) => {
      if (err) {
        streamDeck.logger.warn(`[HTTP API] Dashboard asset not found: ${targetFilePath}`);
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }

      const mimeType = this.getMimeType(targetFilePath);
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Cache-Control': 'no-cache'
      });
      res.end(data);
    });
  }

  /**
   * Endpoint: GET /overlay & static overlay assets
   */
  private handleOverlayAssets(pathname: string, res: http.ServerResponse): void {
    let relativeFile = pathname.replace(/^\/overlay\/?/, '').replace(/^\//, '').trim();
    if (!relativeFile || relativeFile === 'index.html') {
      relativeFile = 'index.html';
    }

    const safeOverlayDir = path.resolve(this.resolveOverlayDir());
    const targetFilePath = path.resolve(safeOverlayDir, relativeFile);

    if (!targetFilePath.startsWith(safeOverlayDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    fs.readFile(targetFilePath, (err, data) => {
      if (err) {
        streamDeck.logger.warn(`[HTTP API] Overlay asset not found: ${targetFilePath}`);
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }

      const mimeType = this.getMimeType(targetFilePath);
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Cache-Control': 'no-cache'
      });
      res.end(data);
    });
  }

  /**
   * Determine MIME Content-Type based on file extension
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.html':
      case '.htm':
        return 'text/html; charset=utf-8';
      case '.css':
        return 'text/css; charset=utf-8';
      case '.js':
      case '.mjs':
        return 'text/javascript; charset=utf-8';
      case '.json':
        return 'application/json; charset=utf-8';
      case '.svg':
        return 'image/svg+xml';
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.webp':
        return 'image/webp';
      case '.ico':
        return 'image/x-icon';
      default:
        return 'application/octet-stream';
    }
  }
}
