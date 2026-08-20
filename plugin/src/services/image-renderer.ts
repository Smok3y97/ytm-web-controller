/**
 * Image Renderer Service
 *
 * 100% In-Memory Graphics Generator (Zero Disk Footprint).
 * Generates SVG/Base64 Data-URLs for Stream Deck keys and Stream Deck + LCD Touchstrips.
 */
import streamDeck from "@elgato/streamdeck";

export class ImageRenderer {
	private static instance: ImageRenderer;
	private coverCache: Map<string, string> = new Map();
	private maxCacheSize = 20;

	private constructor() {}

	public static getInstance(): ImageRenderer {
		if (!ImageRenderer.instance) {
			ImageRenderer.instance = new ImageRenderer();
		}
		return ImageRenderer.instance;
	}

	/**
	 * Fetch remote cover URL into a Base64 data URL purely in RAM
	 */
	public async getCoverAsBase64(url: string): Promise<string | null> {
		if (!url || !url.startsWith("http")) return null;

		if (this.coverCache.has(url)) {
			return this.coverCache.get(url)!;
		}

		try {
			const response = await fetch(url);
			if (!response.ok) return null;

			const contentType = response.headers.get("content-type") || "image/jpeg";
			const arrayBuffer = await response.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);
			const base64 = `data:${contentType};base64,${buffer.toString("base64")}`;

			// Manage cache size
			if (this.coverCache.size >= this.maxCacheSize) {
				const firstKey = this.coverCache.keys().next().value;
				if (firstKey) this.coverCache.delete(firstKey);
			}

			this.coverCache.set(url, base64);
			return base64;
		} catch (err) {
			streamDeck.logger.warn(`[ImageRenderer] Failed to fetch cover art in RAM: ${err}`);
			return null;
		}
	}

	/**
	 * Produce a button image from album artwork with dynamic Play overlay when paused
	 */
	public getCoverWithPlaybackOverlay(coverBase64: string, paused: boolean): string {
		if (!coverBase64) return "";
		if (!paused) {
			// During active playback, display full clean album artwork
			return coverBase64;
		}

		// When paused, render dimmed overlay with centered white Pause icon (SVG 1.1 compatible for Stream Deck Qt renderer)
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 144 144" width="144" height="144">
  <image href="${coverBase64}" xlink:href="${coverBase64}" x="0" y="0" width="144" height="144" preserveAspectRatio="xMidYMid slice"/>
  <rect x="0" y="0" width="144" height="144" fill="#000000" fill-opacity="0.45"/>
  <circle cx="72" cy="72" r="30" fill="#000000" fill-opacity="0.5" stroke="#ffffff" stroke-width="2.5"/>
  <rect x="60" y="58" width="7" height="28" rx="2" fill="#ffffff"/>
  <rect x="77" y="58" width="7" height="28" rx="2" fill="#ffffff"/>
</svg>`;

		return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
	}
}
