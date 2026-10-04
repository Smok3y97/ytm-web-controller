/**
 * Image Renderer Service
 *
 * Fetches remote album artwork and encodes it as Base64 data URLs in RAM
 * for Stream Deck keys and LCD touchstrips.
 */
import streamDeck from "@elgato/streamdeck";

export class ImageRenderer {
	private static instance: ImageRenderer;
	private coverCache: Map<string, string> = new Map();
	private overlayCache: Map<string, string> = new Map();
	private inFlightRequests: Map<string, Promise<string | null>> = new Map();
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

		if (this.inFlightRequests.has(url)) {
			return this.inFlightRequests.get(url)!;
		}

		const fetchPromise = (async () => {
			try {
				const response = await fetch(url);
				if (!response.ok) return null;

				const contentType = response.headers.get("content-type") || "image/jpeg";
				const arrayBuffer = await response.arrayBuffer();
				const buffer = Buffer.from(arrayBuffer);
				const base64 = `data:${contentType};base64,${buffer.toString("base64")}`;

				// Evict oldest cached cover in RAM to maintain memory bounds
				if (this.coverCache.size >= this.maxCacheSize) {
					const firstKey = this.coverCache.keys().next().value;
					if (firstKey) this.coverCache.delete(firstKey);
				}

				this.coverCache.set(url, base64);
				return base64;
			} catch (err) {
				streamDeck.logger.warn(`[ImageRenderer] Failed to fetch cover art in RAM: ${err}`);
				return null;
			} finally {
				this.inFlightRequests.delete(url);
			}
		})();

		this.inFlightRequests.set(url, fetchPromise);
		return fetchPromise;
	}

	/**
	 * Produce a button image from album artwork with dynamic Pause overlay when paused
	 */
	public getCoverWithPlaybackOverlay(coverBase64: string, paused: boolean): string {
		if (!coverBase64) return "";
		if (!paused) {
			// During active playback, display full clean album artwork
			return coverBase64;
		}

		if (this.overlayCache.has(coverBase64)) {
			return this.overlayCache.get(coverBase64)!;
		}

		// Security guard: Validate coverBase64 format to prevent SVG/XML template injection
		if (
			!coverBase64.startsWith("data:image/") ||
			coverBase64.includes('"') ||
			coverBase64.includes("<") ||
			coverBase64.includes(">")
		) {
			return "";
		}

		// When paused, render dimmed overlay with centered white Pause icon (indicates active pause status over cover art)
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 144 144" width="144" height="144">
  <image href="${coverBase64}" xlink:href="${coverBase64}" x="0" y="0" width="144" height="144" preserveAspectRatio="xMidYMid slice"/>
  <rect x="0" y="0" width="144" height="144" fill="#000000" fill-opacity="0.45"/>
  <circle cx="72" cy="72" r="30" fill="#000000" fill-opacity="0.5" stroke="#ffffff" stroke-width="2.5"/>
  <rect x="63" y="58" width="6" height="28" fill="#ffffff" rx="1.5"/>
  <rect x="75" y="58" width="6" height="28" fill="#ffffff" rx="1.5"/>
</svg>`;

		const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

		// Evict oldest cached overlay in RAM to maintain memory bounds
		if (this.overlayCache.size >= this.maxCacheSize) {
			const firstKey = this.overlayCache.keys().next().value;
			if (firstKey) this.overlayCache.delete(firstKey);
		}

		this.overlayCache.set(coverBase64, dataUrl);
		return dataUrl;
	}
}
