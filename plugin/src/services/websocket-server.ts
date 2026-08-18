/**
 * WebSocket Server Service
 * 
 * Manages the local WebSocket bridge to the YouTube Music Browser Extension.
 * Handles client lifecycle, bidirectional command dispatch, and version handshake validation.
 */

import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import streamDeck from '@elgato/streamdeck';
import { YTMPlaybackState, WSMessage } from '../types/index.js';
import { VersionControlService } from './version-control.js';
import { HttpApiService } from './http-api.js';
import { StateManager } from './state-manager.js';

export class WebSocketService extends EventEmitter {
  private static instance: WebSocketService;
  private httpServer: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private currentPort: number = 39865;
  private isMismatchActive: boolean = false;

  private constructor() {
    super();
  }

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * Start or restart the unified HTTP + WebSocket server on specified port
   */
  public async start(port: number = 39865): Promise<void> {
    if (this.httpServer && this.wss && this.currentPort === port) {
      return;
    }

    await this.stop();
    this.currentPort = port;
    this.isMismatchActive = false;

    return new Promise((resolve) => {
      try {
        const httpApi = HttpApiService.getInstance();

        // 1. Create underlying native HTTP Server
        this.httpServer = http.createServer((req, res) => {
          httpApi.handleRequest(req, res);
        });

        // 2. Attach WebSocket Server to share the exact same HTTP instance & port
        this.wss = new WebSocketServer({ server: this.httpServer });

        this.httpServer.on('error', (err: Error & { code?: string }) => {
          if (err.code === 'EADDRINUSE') {
            streamDeck.logger.error(`[WebSocket/HTTP] Port ${this.currentPort} is already in use!`);
          } else {
            streamDeck.logger.error(`[WebSocket/HTTP] Server error: ${err.message}`);
          }
          this.emit('error', err);
          resolve();
        });

        this.wss.on('connection', (ws: WebSocket, req) => {
          const clientIp = req.socket.remoteAddress;
          streamDeck.logger.info(`[WebSocket] Client connected from ${clientIp}. Total clients: ${this.clients.size + 1}`);
          this.clients.add(ws);
          this.emit('clientConnected', ws);

          // Immediately send current playback state to newly connected client
          try {
            const currentState = StateManager.getInstance().getState();
            if (currentState && (currentState.title || currentState.artist)) {
              this.sendToClient(ws, { type: 'STATE_UPDATE', data: currentState });
            }
          } catch { }

          // Request fresh state from browser extension
          this.sendToClient(ws, { command: 'requestState' });

          ws.on('message', (message: Buffer | string) => {
            try {
              const text = message.toString();
              const payload = JSON.parse(text) as WSMessage<YTMPlaybackState> & { command?: string };

              // Client state request
              if (payload.command === 'requestState' || payload.type === 'requestState') {
                const currentState = StateManager.getInstance().getState();
                this.sendToClient(ws, { type: 'STATE_UPDATE', data: currentState });
                return;
              }

              // Intercept Handshake packet
              if (payload.type === 'handshake') {
                const extVersion = payload.version || '0.0.0.0';
                const versionService = VersionControlService.getInstance();
                const validation = versionService.validateHandshake(extVersion);

                this.isMismatchActive = !validation.isCompatible;

                if (validation.isCompatible) {
                  streamDeck.logger.info(
                    `[WebSocket] Handshake SUCCESS from extension v${extVersion} (min required: ${versionService.minRequiredExtensionVersion})`
                  );
                  // Request immediate full state upon successful handshake
                  this.sendToClient(ws, { command: 'requestState' });
                } else {
                  streamDeck.logger.warn(
                    `[WebSocket] Handshake MISMATCH from extension v${extVersion} (min required: ${versionService.minRequiredExtensionVersion})`
                  );
                }

                this.sendToClient(ws, validation.payload as unknown as Record<string, unknown>);
                this.emit('handshake', { isMismatch: !validation.isCompatible, version: extVersion });
                return;
              }

              // Discard state updates if connected extension is incompatible
              if (this.isMismatchActive) {
                return;
              }

              const incomingState = payload.data || (payload as { state?: YTMPlaybackState }).state;
              if (payload.type === 'STATE_UPDATE' && incomingState) {
                this.emit('stateUpdate', incomingState);
              } else if (payload.type === 'REGISTER_CLIENT') {
                streamDeck.logger.info(`[WebSocket] Registered client: ${payload.client} (${payload.url || ''})`);
                const currentState = StateManager.getInstance().getState();
                this.sendToClient(ws, { type: 'STATE_UPDATE', data: currentState });
              }
            } catch (err) {
              streamDeck.logger.warn(`[WebSocket] Failed to parse message: ${err}`);
            }
          });

          ws.on('close', () => {
            this.clients.delete(ws);
            if (this.clients.size === 0) {
              this.isMismatchActive = false;
            }
            streamDeck.logger.info(`[WebSocket] Client disconnected. Remaining clients: ${this.clients.size}`);
            this.emit('clientDisconnected', ws);
          });

          ws.on('error', (err) => {
            streamDeck.logger.error(`[WebSocket] Client socket error: ${err}`);
            this.clients.delete(ws);
            if (this.clients.size === 0) {
              this.isMismatchActive = false;
            }
            this.emit('clientDisconnected', ws);
          });
        });

        // 3. Listen on 127.0.0.1 on specified port
        this.httpServer.listen(this.currentPort, '127.0.0.1', () => {
          streamDeck.logger.info(`[WebSocket/HTTP] Server listening on http://127.0.0.1:${this.currentPort}`);
          this.emit('listening', this.currentPort);
          resolve();
        });
      } catch (err) {
        streamDeck.logger.error(`[WebSocket/HTTP] Failed to start server: ${err}`);
        resolve();
      }
    });
  }

  /**
   * Stop the unified HTTP and WebSocket server and disconnect all clients
   */
  public async stop(): Promise<void> {
    if (!this.httpServer && !this.wss) return;

    return new Promise((resolve) => {
      for (const client of this.clients) {
        try {
          client.close();
        } catch { }
      }
      this.clients.clear();
      this.isMismatchActive = false;

      if (this.wss) {
        try {
          this.wss.close();
        } catch { }
        this.wss = null;
      }

      if (this.httpServer) {
        this.httpServer.close(() => {
          streamDeck.logger.info('[WebSocket/HTTP] Server stopped.');
          this.httpServer = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Broadcast playback state to connected WebSocket clients (e.g. OBS Overlay)
   */
  public broadcastState(state: YTMPlaybackState, excludeWs?: WebSocket): void {
    const message = JSON.stringify({ type: 'STATE_UPDATE', data: state });
    for (const client of this.clients) {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (err) {
          streamDeck.logger.warn(`[WebSocket] Error broadcasting state: ${err}`);
        }
      }
    }
  }

  /**
   * Send a command to all connected YTM tabs (blocked during version mismatch)
   */
  public sendCommand(command: string, payload?: Record<string, unknown>): void {
    if (this.isMismatchActive) {
      streamDeck.logger.warn(`[WebSocket] Blocked command '${command}' due to active version mismatch.`);
      return;
    }

    const message = JSON.stringify({ command, payload: payload || {} });
    streamDeck.logger.info(`[WebSocket] Dispatching '${command}' to ${this.clients.size} client(s)`);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (err) {
          streamDeck.logger.warn(`[WebSocket] Error sending command: ${err}`);
        }
      }
    }
  }

  /**
   * Send a message to a single specific client
   */
  private sendToClient(ws: WebSocket, message: Record<string, unknown>): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (err) {
        streamDeck.logger.warn(`[WebSocket] Error sending to client: ${err}`);
      }
    }
  }

  public hasConnectedClients(): boolean {
    return this.clients.size > 0;
  }

  public getPort(): number {
    return this.currentPort;
  }

  public isMismatch(): boolean {
    return this.isMismatchActive;
  }
}
