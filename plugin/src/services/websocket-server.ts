/**
 * WebSocket Server Service
 * 
 * Manages the local WebSocket bridge to the YouTube Music Browser Extension.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import streamDeck from '@elgato/streamdeck';
import { YTMPlaybackState, WSMessage } from '../types/index.js';

export class WebSocketService extends EventEmitter {
  private static instance: WebSocketService;
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private currentPort: number = 39865;

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
   * Start or restart the WebSocket server on specified port
   */
  public async start(port: number = 39865): Promise<void> {
    if (this.wss && this.currentPort === port) {
      return;
    }

    await this.stop();
    this.currentPort = port;

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
            streamDeck.logger.info(`[WebSocket] Client disconnected. Remaining clients: ${this.clients.size}`);
            this.emit('clientDisconnected', ws);
          });

          ws.on('error', (err) => {
            streamDeck.logger.error(`[WebSocket] Client socket error: ${err}`);
            this.clients.delete(ws);
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

      this.wss?.close(() => {
        streamDeck.logger.info('[WebSocket] Server stopped.');
        this.wss = null;
        resolve();
      });
    });
  }

  /**
   * Send a command to all connected YTM tabs
   */
  public sendCommand(command: string, payload?: Record<string, unknown>): void {
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
}
