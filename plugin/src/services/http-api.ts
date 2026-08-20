/**
 * Read-Only HTTP API Service for OBS Overlay & Chatbots
 *
 * Lightweight, zero-dependency HTTP server layer attached directly to the local
 * WebSocket server instance (Port 39865).
 *
 * Serves strictly two read-only endpoints:
 * 1. GET /overlay - OBS Studio Browser Source live overlay widget
 * 2. GET /api/current - Plaintext current track metadata for Twitch / YouTube chatbots
 */
import streamDeck from "@elgato/streamdeck";
import { EventEmitter } from "events";
import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

import { StateManager } from "./state-manager.js";

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
	 */
	private resolveOverlayDir(): string {
		try {
			const currentDir = path.dirname(fileURLToPath(import.meta.url));
			const relativeFromBin = path.resolve(currentDir, "..", "assets", "overlay");
			if (fs.existsSync(relativeFromBin)) {
				return relativeFromBin;
			}
		} catch {}

		const fromCwd = path.resolve(process.cwd(), "assets", "overlay");
		if (fs.existsSync(fromCwd)) {
			return fromCwd;
		}

		const fromPluginDir = path.resolve(process.cwd(), "plugin", "assets", "overlay");
		if (fs.existsSync(fromPluginDir)) {
			return fromPluginDir;
		}

		return path.resolve(process.cwd(), "assets", "overlay");
	}

	/**
	 * Main HTTP request router attached to http.Server
	 */
	public handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
		// Set permissive CORS headers for overlay browser sources & external fetchers
		res.setHeader("Access-Control-Allow-Origin", "*");
		res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
		res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

		if (req.method === "OPTIONS") {
			res.writeHead(204);
			res.end();
			return;
		}

		if (req.method !== "GET") {
			res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
			res.end("Method Not Allowed");
			return;
		}

		const host = req.headers.host || "127.0.0.1";
		let parsedUrl: URL;
		try {
			parsedUrl = new URL(req.url || "/", `http://${host}`);
		} catch {
			res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
			res.end("Bad Request");
			return;
		}

		const pathname = parsedUrl.pathname;

		// Endpoint 1: Chatbot API - Plaintext Current Track Metadata
		if (pathname === "/api/current") {
			this.handleCurrentTrackApi(parsedUrl, res);
			return;
		}

		// Endpoint 2: Redirect /overlay to /overlay/ preserving query params
		if (pathname === "/overlay") {
			res.writeHead(302, {
				Location: `/overlay/${parsedUrl.search}`,
			});
			res.end();
			return;
		}

		// Endpoint 2.5: OBS Browser Overlay Static Assets
		if (
			pathname === "/overlay/" ||
			pathname.startsWith("/overlay/") ||
			pathname === "/style.css" ||
			pathname === "/overlay.js"
		) {
			this.handleOverlayAssets(pathname, res);
			return;
		}

		// Fallback 404
		res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
		res.end("Not Found");
	}

	/**
	 * Endpoint: GET /api/current
	 * Returns currently playing song formatted for chat commands (Nightbot, Streamer.bot, etc.)
	 */
	private handleCurrentTrackApi(url: URL, res: http.ServerResponse): void {
		const state = StateManager.getInstance().getState();

		if (!state.title && !state.artist) {
			res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
			res.end("No music playing");
			return;
		}

		const rawFormat = url.searchParams.get("format") || "{artist} - {title}";
		const output = StateManager.getInstance().formatTrackText(rawFormat, state);

		res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
		res.end(output || "No music playing");
	}

	/**
	 * Serve static files for OBS Browser Overlay (/overlay)
	 */
	private handleOverlayAssets(pathname: string, res: http.ServerResponse): void {
		let relativeFile = pathname.replace(/^\/overlay\/?/, "");
		if (!relativeFile || relativeFile === "") {
			relativeFile = "index.html";
		}

		relativeFile = relativeFile.replace(/^\/+/, "");
		const safePath = path.normalize(relativeFile).replace(/^(\.\.[/\\])+/, "");
		const filePath = path.join(this.overlayDir, safePath);

		if (!filePath.startsWith(this.overlayDir) || !fs.existsSync(filePath)) {
			res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
			res.end("Overlay asset not found");
			return;
		}

		try {
			const ext = path.extname(filePath).toLowerCase();
			let contentType = "text/plain; charset=utf-8";
			if (ext === ".html") contentType = "text/html; charset=utf-8";
			else if (ext === ".css") contentType = "text/css; charset=utf-8";
			else if (ext === ".js") contentType = "application/javascript; charset=utf-8";
			else if (ext === ".svg") contentType = "image/svg+xml";
			else if (ext === ".png") contentType = "image/png";
			else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
			else if (ext === ".ico") contentType = "image/x-icon";

			const fileContent = fs.readFileSync(filePath);
			res.writeHead(200, {
				"Content-Type": contentType,
				"Cache-Control": "no-cache, no-store, must-revalidate",
				Pragma: "no-cache",
				Expires: "0",
			});
			res.end(fileContent);
		} catch (err) {
			streamDeck.logger.error(`[HTTP API] Error reading overlay file ${filePath}: ${err}`);
			res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
			res.end("Internal Server Error");
		}
	}
}
