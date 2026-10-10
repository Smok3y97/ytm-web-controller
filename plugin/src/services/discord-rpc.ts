/**
 * Discord Rich Presence (RPC) Service
 *
 * Connects to the local Discord desktop client via IPC to display current playback status.
 */
import streamDeck from "@elgato/streamdeck";
import { Client, type SetActivity, StatusDisplayType } from "@xhayper/discord-rpc";
import { ActivityType } from "discord-api-types/v10";

import { YTMPlaybackState } from "../types/index.js";
import { MetadataSanitizer } from "./metadata-sanitizer.js";

export const DEFAULT_DISCORD_CLIENT_ID = "1537908230209019954"; // YouTube Music Discord Client ID

interface CachedActivity {
	title: string;
	artist: string;
	album: string;
	coverUrl: string;
	trackUrl: string;
	artistUrl: string;
	albumUrl?: string;
	paused: boolean;
	startTimestamp?: number;
	endTimestamp?: number;
	lastSentTime: number;
}

export class DiscordRpcService {
	private static instance: DiscordRpcService;
	private client: Client | null = null;
	private isEnabled: boolean = false;
	private isConnected: boolean = false;
	private isConnecting: boolean = false;
	private clientId: string = DEFAULT_DISCORD_CLIENT_ID;
	private lastState: YTMPlaybackState | null = null;
	private lastCachedActivity: CachedActivity | null = null;
	private reconnectInterval: NodeJS.Timeout | null = null;
	private debounceTimeout: NodeJS.Timeout | null = null;

	private constructor() {}

	public static getInstance(): DiscordRpcService {
		if (!DiscordRpcService.instance) {
			DiscordRpcService.instance = new DiscordRpcService();
		}
		return DiscordRpcService.instance;
	}

	/**
	 * Configure Discord RPC status & Client ID
	 */
	public async setEnabled(enabled: boolean, customClientId?: string): Promise<void> {
		const newClientId = customClientId?.trim() || DEFAULT_DISCORD_CLIENT_ID;
		const clientChanged = this.clientId !== newClientId;
		this.clientId = newClientId;

		if (enabled === this.isEnabled && !clientChanged) {
			return;
		}

		this.isEnabled = enabled;

		if (this.isEnabled) {
			streamDeck.logger.info(`[Discord RPC] Enabling Discord Rich Presence (Client ID: ${this.clientId})...`);
			this.startReconnectLoop();
			await this.connect();
			if (this.lastState) {
				this.updatePresence(this.lastState, true);
			}
		} else {
			streamDeck.logger.info("[Discord RPC] Disabling Discord Rich Presence...");
			this.stopReconnectLoop();
			await this.disconnect();
		}
	}

	/**
	 * Start periodic reconnect timer if disconnected
	 */
	private startReconnectLoop(): void {
		this.stopReconnectLoop();
		this.reconnectInterval = setInterval(() => {
			if (this.isEnabled && !this.isConnected && !this.isConnecting) {
				this.connect().catch(() => {});
			}
		}, 12000);
	}

	/**
	 * Stop periodic reconnect timer
	 */
	private stopReconnectLoop(): void {
		if (this.reconnectInterval) {
			clearInterval(this.reconnectInterval);
			this.reconnectInterval = null;
		}
	}

	/**
	 * Connect to local Discord IPC socket
	 */
	private async connect(): Promise<void> {
		if (this.isConnecting) return;
		if (this.client || this.isConnected) {
			await this.disconnect();
		}

		this.isConnecting = true;

		try {
			const client = new Client({
				clientId: this.clientId,
				transport: { type: "ipc" },
			});

			client.on("ready", () => {
				this.isConnected = true;
				this.isConnecting = false;
				this.client = client;
				this.stopReconnectLoop();
				streamDeck.logger.info(`[Discord RPC] Connected to Discord as application ${this.clientId}`);
				if (this.lastState) {
					this.updatePresence(this.lastState, true);
				}
			});

			client.on("disconnected", () => {
				streamDeck.logger.info("[Discord RPC] IPC socket disconnected.");
				this.handleDisconnect();
			});

			await client.login().catch((err) => {
				streamDeck.logger.warn(`[Discord RPC] Failed to login to Discord: ${err?.message || err}`);
				this.handleDisconnect();
			});
		} catch (err: unknown) {
			const errMsg = err instanceof Error ? err.message : String(err);
			streamDeck.logger.warn(`[Discord RPC] Error during client initialization: ${errMsg}`);
			this.handleDisconnect();
		}
	}

	private handleDisconnect(): void {
		this.isConnected = false;
		this.isConnecting = false;
		if (this.client) {
			try {
				this.client.destroy();
			} catch {}
			this.client = null;
		}
		this.lastCachedActivity = null;

		if (this.isEnabled) {
			this.startReconnectLoop();
		}
	}

	/**
	 * Disconnect from Discord cleanly
	 */
	public async disconnect(): Promise<void> {
		this.isConnected = false;
		this.isConnecting = false;
		this.lastCachedActivity = null;

		if (this.debounceTimeout) {
			clearTimeout(this.debounceTimeout);
			this.debounceTimeout = null;
		}

		if (this.client) {
			try {
				await this.client.user?.clearActivity(process.pid);
			} catch {}
			try {
				await this.client.destroy();
			} catch {}
			this.client = null;
		}
	}

	/**
	 * Update Discord Activity based on current YTM playback state (debounced)
	 */
	public updatePresence(state: YTMPlaybackState, force = false): void {
		this.lastState = state;

		if (!this.isEnabled || !this.client || !this.isConnected) {
			return;
		}

		if (this.debounceTimeout) {
			clearTimeout(this.debounceTimeout);
			this.debounceTimeout = null;
		}

		if (force) {
			this.sendActivity(state, true);
		} else {
			this.debounceTimeout = setTimeout(() => {
				this.debounceTimeout = null;
				this.sendActivity(state, false);
			}, 800);
		}
	}

	/**
	 * Send Activity payload to Discord
	 */
	private sendActivity(state: YTMPlaybackState, force = false): void {
		if (!this.isEnabled || !this.client || !this.isConnected) {
			return;
		}

		// Clear Discord activity immediately when playback is paused or track info is missing
		if (state.paused || !state.title || state.title.trim() === "") {
			if (this.lastCachedActivity !== null) {
				this.lastCachedActivity = null;
				try {
					this.client.user?.clearActivity(process.pid).catch(() => {});
				} catch {}
			}
			return;
		}

		try {
			const now = Date.now();
			const trackTitle = state.title.trim();
			const rawArtist = state.artist?.trim() || "Unknown Artist";
			const rawAlbum = state.album?.trim() || "";
			const coverUrl = state.coverUrl && state.coverUrl.startsWith("http") ? state.coverUrl : "";
			const trackUrl = state.trackUrl && state.trackUrl.startsWith("http") ? state.trackUrl : "";
			const artistUrl = state.artistUrl && state.artistUrl.startsWith("http") ? state.artistUrl : "";
			const albumUrl = state.albumUrl && state.albumUrl.startsWith("http") ? state.albumUrl : "";

			let startTimestamp: number | undefined;
			let endTimestamp: number | undefined;

			// Live playback timeline calculation
			if (!state.paused) {
				startTimestamp = Math.floor(now - Math.max(0, state.currentTime) * 1000);
				if (state.duration > 0) {
					endTimestamp = Math.floor(startTimestamp + state.duration * 1000);
				}
			}

			// Helper to pad/limit string length to Discord constraints (min 2, max limit)
			const stringLimit = (str: string, limit: number = 128, minimum: number = 2): string => {
				if (!str) str = "";
				if (str.length > limit) {
					return str.substring(0, limit - 3).trim() + "...";
				}
				if (str.length < minimum) {
					return str.padEnd(minimum, "\u200B"); // Zero-width space
				}
				return str;
			};

			// Clean artist and album strings via centralized MetadataSanitizer
			const { artist: cleanArtist, extractedAlbum } = MetadataSanitizer.sanitizeArtist(rawArtist, rawAlbum);
			const albumDisplayText =
				extractedAlbum || (rawAlbum && !MetadataSanitizer.isNonAlbumText(rawAlbum) ? rawAlbum.trim() : "");
			const albumUrlToUse = albumDisplayText ? albumUrl || "" : "";

			// Check if update is redundant (to prevent Discord RPC rate-limiting)
			if (!force && this.lastCachedActivity) {
				const prev = this.lastCachedActivity;
				const metadataSame =
					prev.title === trackTitle &&
					prev.artist === rawArtist &&
					prev.album === rawAlbum &&
					prev.coverUrl === coverUrl &&
					prev.trackUrl === trackUrl &&
					prev.artistUrl === artistUrl &&
					prev.albumUrl === albumUrl &&
					prev.paused === state.paused;

				if (metadataSame) {
					if (state.paused) {
						return;
					}

					// Force update if end timestamp is newly available or drifted significantly
					const hadNoEnd =
						(!prev.endTimestamp && !!endTimestamp) || Math.abs((prev.endTimestamp || 0) - (endTimestamp || 0)) > 2000;

					if (!hadNoEnd) {
						const timeDrift =
							prev.startTimestamp && startTimestamp ? Math.abs(startTimestamp - prev.startTimestamp) : 0;

						if (timeDrift < 3000 && now - prev.lastSentTime < 55000) {
							return; // Progress is naturally animating in Discord; no update needed
						}
					}
				}
			}

			// Construct activity object
			const activity: SetActivity = {
				type: ActivityType.Listening,
				statusDisplayType: StatusDisplayType.STATE,
				details: stringLimit(trackTitle, 128, 2),
				detailsUrl: trackUrl || undefined,
				state: stringLimit(cleanArtist, 128, 2),
				stateUrl: artistUrl || undefined,
				largeImageKey: coverUrl || "ytm_logo",
				largeImageText: albumDisplayText ? stringLimit(albumDisplayText, 128, 2) : undefined,
				instance: false,
			};

			if (!state.paused && startTimestamp && endTimestamp) {
				activity.startTimestamp = startTimestamp;
				activity.endTimestamp = endTimestamp;
			}

			// Interactive buttons (max 2)
			const buttons: Array<{ label: string; url: string }> = [];
			if (trackUrl) {
				buttons.push({
					label: "Listen on YouTube Music",
					url: trackUrl.substring(0, 512),
				});
			}
			if (artistUrl && buttons.length < 2) {
				buttons.push({
					label: "Artist Profile",
					url: artistUrl.substring(0, 512),
				});
			} else if (albumUrlToUse && buttons.length < 2) {
				buttons.push({
					label: "View Album",
					url: albumUrlToUse.substring(0, 512),
				});
			}
			if (buttons.length > 0) {
				activity.buttons = buttons;
			}

			this.lastCachedActivity = {
				title: trackTitle,
				artist: rawArtist,
				album: rawAlbum,
				coverUrl,
				trackUrl,
				artistUrl,
				albumUrl,
				paused: state.paused,
				startTimestamp,
				endTimestamp,
				lastSentTime: now,
			};

			this.client.user?.setActivity(activity, process.pid).catch((err: unknown) => {
				const errMsg = err instanceof Error ? err.message : String(err);
				streamDeck.logger.warn(`[Discord RPC] Failed to set activity: ${errMsg}`);
			});
		} catch (err: unknown) {
			const errMsg = err instanceof Error ? err.message : String(err);
			streamDeck.logger.warn(`[Discord RPC] Error setting presence: ${errMsg}`);
		}
	}
}
