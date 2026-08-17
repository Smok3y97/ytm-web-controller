/**
 * HTTP API Service
 * 
 * Lightweight, zero-dependency HTTP server layer attached directly to the existing
 * WebSocket server instance. Provides REST/Plaintext endpoints for Chatbots (Nightbot,
 * Streamer.bot, etc.) including live track metadata queries and remote Song Queuing (!playnext),
 * plus serves the interactive OBS Studio Browser Source overlay.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
import streamDeck from '@elgato/streamdeck';
import { StateManager } from './state-manager.js';
import { GlobalSettings } from '../types/index.js';

export class HttpApiService extends EventEmitter {
  private static instance: HttpApiService;
  private overlayDir: string;

  private constructor() {
    super();
    this.overlayDir = this.resolveOverlayDir();
  }

  public static getInstance(): HttpApiService {
    if (!HttpApiService.instance) {
      HttpApiService.instance = new HttpApiService();
    }
    return HttpApiService.instance;
  }

  /**
   * Resolve directory where overlay static assets are stored.
   * Checks both package layout (relative to bin/plugin.js) and working directory.
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
   * Main HTTP request router attached to http.Server
   */
  public handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Set permissive CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
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

    // Route 1: Chatbot API - Current Track Metadata
    if (pathname === '/api/current') {
      this.handleCurrentTrackApi(parsedUrl, res);
      return;
    }

    // Route 2: Chatbot API - Song Request / Queue / Play Next (GET & POST)
    if (pathname === '/api/playnext' || pathname === '/api/queue' || pathname === '/api/request' || pathname === '/api/songrequest') {
      this.handleSongRequestApi(pathname, parsedUrl, req, res);
      return;
    }

    // Route 3: Redirect /overlay to /overlay/ with query parameters preserved
    if (pathname === '/overlay') {
      res.writeHead(302, {
        'Location': `/overlay/${parsedUrl.search}`
      });
      res.end();
      return;
    }

    // Route 4: OBS Browser Overlay & Static Assets
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
   * Query Param: format (default: "{artist} - {title}")
   * Placeholders: {artist}, {title}, {album}, {url}, {duration}, {currentTime}
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

    // Clean up empty parentheses/brackets if variable was empty: e.g. " ()", " []"
    output = output.replace(/\(\s*\)/g, '').replace(/\[\s*\]/g, '');

    // Collapse multiple spaces
    output = output.replace(/\s+/g, ' ').trim();

    // Clean up dangling leading or trailing dashes / separators
    output = output
      .replace(/^[\s\-\–\—\•\|\:]+/, '')
      .replace(/[\s\-\–\—\•\|\:]+$/, '')
      .trim();

    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(output || 'No music playing');
  }

  /**
   * Endpoint: GET /api/playnext & GET /api/queue (also supports POST)
   * Query Params: url, link, v, q, query, format, successFormat
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

      // 4. Check if video ID is blacklisted by the streamer
      if (globalSettings.songRequestBlacklist) {
        const blacklist = globalSettings.songRequestBlacklist
          .split(/[\r\n,;\s]+/)
          .map(item => this.extractVideoId(item) || item.trim())
          .filter(Boolean);

        if (blacklist.includes(videoId)) {
          const blockedMsg = globalSettings.songRequestBlockedTemplate ||
            'This song is blocked from requests 🚫';
          res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(blockedMsg);
          return;
        }
      }

      // 5. Determine queue mode (playNext vs addToQueue)
      const mode = (pathname === '/api/playnext')
        ? 'playNext'
        : (globalSettings.songRequestMode || 'playNext');

      const canonicalUrl = `https://music.youtube.com/watch?v=${videoId}`;

      // 5. Dispatch command to YouTube Music companion extension via WebSocket
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
   * Helper to parse YouTube Video IDs from full URLs or raw IDs
   */
  private extractVideoId(input: string): string | null {
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

      // Try standard URL search param parsing
      const parsed = new URL(clean.startsWith('http') ? clean : `https://${clean}`);
      const v = parsed.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
        return v;
      }
    } catch { }

    return null;
  }

  /**
   * Helper to read HTTP POST body
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
   * Endpoint: GET /overlay & static files (/overlay/style.css, /overlay/overlay.js, etc.)
   */
  private handleOverlayAssets(pathname: string, res: http.ServerResponse): void {
    let relativeFile = pathname.replace(/^\/overlay\/?/, '').replace(/^\//, '').trim();
    if (!relativeFile || relativeFile === 'index.html') {
      relativeFile = 'index.html';
    }

    // Refresh overlayDir in case process cwd or location changed
    const safeOverlayDir = path.resolve(this.resolveOverlayDir());
    const targetFilePath = path.resolve(safeOverlayDir, relativeFile);

    if (!targetFilePath.startsWith(safeOverlayDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    fs.readFile(targetFilePath, (err, data) => {
      if (err) {
        streamDeck.logger.warn(`[HTTP API] Asset not found: ${targetFilePath} (overlayDir: ${safeOverlayDir})`);
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
