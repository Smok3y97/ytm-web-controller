/**
 * WebSocket Server Service
 * 
 * Manages the local WebSocket bridge to the YouTube Music Browser Extension.
 * Handles client lifecycle, bidirectional command dispatch, and version handshake validation.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import streamDeck from '@elgato/streamdeck';
import { YTMPlaybackState, WSMessage } from '../types/index.js';
import { VersionControlService } from './version-control.js';

export class WebSocketService extends EventEmitter {
  private static instance: WebSocketService;
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private currentPort: number = 39865;
  private isMismatchActive: boolean = false;

  private constructor() {
    super();
  }

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      VersionControlService.getInstance();
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * Start or restart the WebSocket server on specified port
   */
  public async start(port: number = 39865): Promise<void> {
    if (this.wss && this.currentPort === port) {
      return;
    }

    await this.stop();
    this.currentPort = port;
    this.isMismatchActive = false;

    return new Promise((resolve) => {
      try {
        this.wss = new WebSocketServer({ port: this.currentPort, host: '127.0.0.1' });

        this.wss.on('listening', () => {
          streamDeck.logger.info(`[WebSocket] Server listening on ws://127.0.0.1:${this.currentPort}`);
          this.emit('listening', this.currentPort);
          resolve();
        });

        this.wss.on('connection', (ws: WebSocket, req) => {
          const clientIp = req.socket.remoteAddress;
          streamDeck.logger.info(`[WebSocket] Client connected from ${clientIp}. Total clients: ${this.clients.size + 1}`);
          this.clients.add(ws);
          this.emit('clientConnected', ws);

          // Request immediate state from newly connected client
          this.sendToClient(ws, { command: 'requestState' });

          ws.on('message', (message: Buffer | string) => {
            try {
              const text = message.toString();
              const payload = JSON.parse(text) as WSMessage<YTMPlaybackState>;

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

              if (payload.type === 'STATE_UPDATE' && payload.data) {
                this.emit('stateUpdate', payload.data);
              } else if (payload.type === 'REGISTER_CLIENT') {
                streamDeck.logger.info(`[WebSocket] Registered client: ${payload.client} (${payload.url || ''})`);
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

        this.wss.on('error', (err: Error & { code?: string }) => {
          if (err.code === 'EADDRINUSE') {
            streamDeck.logger.error(`[WebSocket] Port ${this.currentPort} is already in use!`);
          } else {
            streamDeck.logger.error(`[WebSocket] Server error: ${err.message}`);
          }
          this.emit('error', err);
          resolve();
        });
      } catch (err) {
        streamDeck.logger.error(`[WebSocket] Failed to start server: ${err}`);
        resolve();
      }
    });
  }

  /**
   * Stop the WebSocket server and disconnect all clients
   */
  public async stop(): Promise<void> {
    if (!this.wss) return;

    return new Promise((resolve) => {
      for (const client of this.clients) {
        try {
          client.close();
        } catch { }
      }
      this.clients.clear();
      this.isMismatchActive = false;

      this.wss?.close(() => {
        streamDeck.logger.info('[WebSocket] Server stopped.');
        this.wss = null;
        resolve();
      });
    });
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
