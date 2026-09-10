/**
 * WebSocket Server Service
 *
 * Manages the local WebSocket bridge to the YouTube Music Browser Extension.
 * Handles client lifecycle, bidirectional command dispatch, multi-tab orchestration,
 * and origin-based CSWSH security verification.
 */
import streamDeck from "@elgato/streamdeck";
import { EventEmitter } from "events";
import http from "http";
import { WebSocket, WebSocketServer } from "ws";

import { WSMessage, YTMPlaybackState } from "../types/index.js";
import { HttpApiService } from "./http-api.js";
import { StateManager } from "./state-manager.js";
import { VersionControlService } from "./version-control.js";

interface ClientTabInfo {
	tabId?: string;
	isPlaying: boolean;
	lastActive: number;
	isOverlay: boolean;
}

export class WebSocketService extends EventEmitter {
	private static instance: WebSocketService;
	private httpServer: http.Server | null = null;
	private wss: WebSocketServer | null = null;
	private clients: Set<WebSocket> = new Set();
	private clientTabs: Map<WebSocket, ClientTabInfo> = new Map();
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

				// 2. Attach WebSocket Server with strict origin validation (CSWSH protection)
				this.wss = new WebSocketServer({
					server: this.httpServer,
					verifyClient: (info, callback) => {
						const origin = info.origin || (info.req.headers.origin as string | undefined);

						// Allow non-browser clients (e.g. Stream Deck internal, local tools, or OBS local file sources)
						if (!origin || origin === "null") {
							callback(true);
							return;
						}

						try {
							const parsed = new URL(origin);
							const host = parsed.host;
							const protocol = parsed.protocol;

							// Browser companion extension popup / background scripts
							if (protocol === "chrome-extension:" || protocol === "moz-extension:") {
								callback(true);
								return;
							}

							// Official YouTube Music Web
							if (host === "music.youtube.com") {
								callback(true);
								return;
							}

							// OBS Browser Source / local overlay on current server port
							if (host === `127.0.0.1:${this.currentPort}` || host === `localhost:${this.currentPort}`) {
								callback(true);
								return;
							}

							streamDeck.logger.warn(`[WebSocket] Blocked unauthorized connection attempt from origin: ${origin}`);
							callback(false, 403, "Forbidden Origin");
						} catch {
							streamDeck.logger.warn(`[WebSocket] Malformed origin rejected: ${origin}`);
							callback(false, 403, "Forbidden Origin");
						}
					},
				});

				this.httpServer.on("error", (err: Error & { code?: string }) => {
					if (err.code === "EADDRINUSE") {
						streamDeck.logger.error(`[WebSocket/HTTP] Port ${this.currentPort} is already in use!`);
					} else {
						streamDeck.logger.error(`[WebSocket/HTTP] Server error: ${err.message}`);
					}
					this.emit("error", err);
					resolve();
				});

				this.wss.on("connection", (ws: WebSocket, req) => {
					const clientIp = req.socket.remoteAddress;
					streamDeck.logger.info(
						`[WebSocket] Client connected from ${clientIp}. Total clients: ${this.clients.size + 1}`,
					);
					this.clients.add(ws);
					this.clientTabs.set(ws, {
						isPlaying: false,
						lastActive: Date.now(),
						isOverlay: false,
					});
					this.emit("clientConnected", ws);

					// Immediately send current playback state to newly connected client
					try {
						const currentState = StateManager.getInstance().getState();
						if (currentState && (currentState.title || currentState.artist)) {
							this.sendToClient(ws, { type: "STATE_UPDATE", data: currentState });
						}
					} catch {}

					// Request fresh state from browser extension
					this.sendToClient(ws, { command: "requestState" });

					ws.on("message", (message: Buffer | string) => {
						try {
							const text = message.toString();
							const payload = JSON.parse(text) as WSMessage<YTMPlaybackState> & { command?: string };
							const tabInfo = this.clientTabs.get(ws);

							if (tabInfo) {
								tabInfo.lastActive = Date.now();
								if (payload.tabId) tabInfo.tabId = payload.tabId;
								if (typeof payload.isPlaying === "boolean") {
									tabInfo.isPlaying = payload.isPlaying;
								}
							}

							// Tab closed notification
							if (payload.type === "TAB_CLOSED") {
								streamDeck.logger.info(`[WebSocket] Tab closed notification (tabId: ${payload.tabId || "unknown"})`);
								if (tabInfo) {
									tabInfo.isPlaying = false;
								}
								return;
							}

							// Client state request
							if (payload.command === "requestState" || payload.type === "requestState") {
								const currentState = StateManager.getInstance().getState();
								this.sendToClient(ws, { type: "STATE_UPDATE", data: currentState });
								return;
							}

							// Intercept Handshake packet
							if (payload.type === "handshake") {
								if (tabInfo && payload.tabId) tabInfo.tabId = payload.tabId;
								const extVersion = payload.version || "0.0.0.0";
								const versionService = VersionControlService.getInstance();
								const validation = versionService.validateHandshake(extVersion);

								this.isMismatchActive = !validation.isCompatible;

								if (validation.isCompatible) {
									streamDeck.logger.info(
										`[WebSocket] Handshake SUCCESS from extension v${extVersion} (min required: ${versionService.minRequiredExtensionVersion})`,
									);
									// Request immediate full state upon successful handshake
									this.sendToClient(ws, { command: "requestState" });
								} else {
									streamDeck.logger.warn(
										`[WebSocket] Handshake MISMATCH from extension v${extVersion} (min required: ${versionService.minRequiredExtensionVersion})`,
									);
								}

								this.sendToClient(ws, validation.payload as unknown as Record<string, unknown>);
								this.emit("handshake", { isMismatch: !validation.isCompatible, version: extVersion });
								return;
							}

							// Discard state updates if connected extension is incompatible
							if (this.isMismatchActive) {
								return;
							}

							const incomingState = payload.data || (payload as { state?: YTMPlaybackState }).state;
							if (payload.type === "STATE_UPDATE" && incomingState) {
								if (tabInfo) {
									tabInfo.isPlaying = !incomingState.paused;
								}

								// Multi-tab arbitration: If this tab is paused, but another tab is currently playing, ignore paused update
								if (incomingState.paused) {
									const isAnotherTabPlaying = Array.from(this.clientTabs.entries()).some(
										([otherWs, otherInfo]) =>
											otherWs !== ws &&
											otherWs.readyState === WebSocket.OPEN &&
											!otherInfo.isOverlay &&
											otherInfo.isPlaying,
									);
									if (isAnotherTabPlaying) {
										streamDeck.logger.info(
											`[WebSocket] Ignored paused STATE_UPDATE from inactive tab (${tabInfo?.tabId || "unknown"}) because another tab is actively playing.`,
										);
										return;
									}
								}

								this.emit("stateUpdate", incomingState);
							} else if (payload.type === "REGISTER_CLIENT") {
								if (tabInfo) {
									if (payload.client === "ytm-overlay" || (payload.url && payload.url.includes("/overlay"))) {
										tabInfo.isOverlay = true;
									}
									if (payload.tabId) tabInfo.tabId = payload.tabId;
									if (typeof payload.isPlaying === "boolean") tabInfo.isPlaying = payload.isPlaying;
								}
								streamDeck.logger.info(`[WebSocket] Registered client: ${payload.client} (${payload.url || ""})`);
								const currentState = StateManager.getInstance().getState();
								this.sendToClient(ws, { type: "STATE_UPDATE", data: currentState });
							}
						} catch (err) {
							streamDeck.logger.warn(`[WebSocket] Failed to parse message: ${err}`);
						}
					});

					ws.on("close", () => {
						this.clients.delete(ws);
						this.clientTabs.delete(ws);
						if (this.clients.size === 0) {
							this.isMismatchActive = false;
						}
						streamDeck.logger.info(`[WebSocket] Client disconnected. Remaining clients: ${this.clients.size}`);
						this.emit("clientDisconnected", ws);
					});

					ws.on("error", (err) => {
						streamDeck.logger.error(`[WebSocket] Client socket error: ${err}`);
						this.clients.delete(ws);
						this.clientTabs.delete(ws);
						if (this.clients.size === 0) {
							this.isMismatchActive = false;
						}
						this.emit("clientDisconnected", ws);
					});
				});

				// 3. Listen on 127.0.0.1 on specified port
				this.httpServer.listen(this.currentPort, "127.0.0.1", () => {
					streamDeck.logger.info(`[WebSocket/HTTP] Server listening on http://127.0.0.1:${this.currentPort}`);
					this.emit("listening", this.currentPort);
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
				} catch {}
			}
			this.clients.clear();
			this.clientTabs.clear();
			this.isMismatchActive = false;

			if (this.wss) {
				try {
					this.wss.close();
				} catch {}
				this.wss = null;
			}

			if (this.httpServer) {
				this.httpServer.close(() => {
					streamDeck.logger.info("[WebSocket/HTTP] Server stopped.");
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
		const message = JSON.stringify({ type: "STATE_UPDATE", data: state });
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
	 * Get the currently active YouTube Music tab socket
	 * Prioritizes actively playing tabs, then most recently active tabs
	 */
	public getActiveTabSocket(): WebSocket | null {
		// 1. Preference: Tab that is actively playing (isPlaying === true) and OPEN
		for (const [ws, info] of this.clientTabs.entries()) {
			if (ws.readyState === WebSocket.OPEN && !info.isOverlay && info.isPlaying) {
				return ws;
			}
		}

		// 2. Preference: Most recently active non-overlay tab that is OPEN
		let latestWs: WebSocket | null = null;
		let latestTime = 0;
		for (const [ws, info] of this.clientTabs.entries()) {
			if (ws.readyState === WebSocket.OPEN && !info.isOverlay) {
				if (info.lastActive > latestTime) {
					latestTime = info.lastActive;
					latestWs = ws;
				}
			}
		}
		if (latestWs) return latestWs;

		// 3. Fallback: Any OPEN client that is not explicitly an overlay
		for (const ws of this.clients) {
			const info = this.clientTabs.get(ws);
			if (ws.readyState === WebSocket.OPEN && (!info || !info.isOverlay)) {
				return ws;
			}
		}

		return null;
	}

	/**
	 * Send a command to the active YTM tab (blocked during version mismatch)
	 */
	public sendCommand(command: string, payload?: Record<string, unknown>): void {
		if (this.isMismatchActive) {
			streamDeck.logger.warn(`[WebSocket] Blocked command '${command}' due to active version mismatch.`);
			return;
		}

		const target = this.getActiveTabSocket();
		if (target && target.readyState === WebSocket.OPEN) {
			const message = JSON.stringify({ command, payload: payload || {} });
			streamDeck.logger.info(`[WebSocket] Dispatching '${command}' to active tab`);
			try {
				target.send(message);
			} catch (err) {
				streamDeck.logger.warn(`[WebSocket] Error sending command: ${err}`);
			}
		} else {
			streamDeck.logger.warn(`[WebSocket] No active YouTube Music tab available to handle command '${command}'`);
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
