/**
 * Image Renderer Service
 *
 * Fetches remote album artwork and encodes it as Base64 data URLs in RAM
 * for Stream Deck keys and LCD touchstrips.
 */
import streamDeck from "@elgato/streamdeck";

const FULL_BLEED_ICON_SHAPES: Record<string, string> = {
	"assets/actions/trackdial/icon.svg":
		'<circle cx="12" cy="12" r="10" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-dasharray="45 10"/><polygon points="10,8.5 15.5,12 10,15.5" fill="#FFFFFF"/>',
	"assets/actions/volumedial/icon.svg":
		'<circle cx="12" cy="12" r="10" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-dasharray="45 10"/><path d="M7 9v6h3l4 4V5l-4 4H7zm7.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" fill="#FFFFFF"/>',
	"assets/actions/seekdial/icon.svg":
		'<circle cx="12" cy="12" r="10" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-dasharray="45 10"/><path d="M7 8.5v7l4.5-3.5zm5 0v7l4.5-3.5z" fill="#FFFFFF"/>',
	"assets/actions/mute/muted.svg":
		'<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" fill="#FF0033"/>',
	"assets/actions/playpause/play.svg": '<path d="M8 5v14l11-7z" fill="#FFFFFF"/>',
};

export class ImageRenderer {
	private static instance: ImageRenderer;
	private coverCache: Map<string, string> = new Map();
	private overlayCache: Map<number, string> = new Map();
	private fullBleedCache: Map<number, string> = new Map();
	private fullBleedIconCache: Map<string, string> = new Map();
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
	 * Compute compact 32-bit FNV-1a hash for large base64 strings
	 * Incorporates string length in initial seed and strides across the payload to prevent collisions without string allocations
	 */
	private static hashKey(str: string, seed = 2166136261): number {
		let hash = (seed ^ str.length) >>> 0;
		const len = str.length;
		const step = Math.max(1, Math.floor(len / 512));
		for (let i = 0; i < len; i += step) {
			hash ^= str.charCodeAt(i);
			hash = Math.imul(hash, 16777619);
		}
		return hash >>> 0;
	}

	/**
	 * Synchronously retrieve a cached Base64 cover from RAM if already fetched
	 */
	public getCachedCover(url: string): string | undefined {
		if (!url || !this.coverCache.has(url)) return undefined;
		const cached = this.coverCache.get(url)!;
		// Refresh key position to implement true LRU eviction
		this.coverCache.delete(url);
		this.coverCache.set(url, cached);
		return cached;
	}

	/**
	 * Fetch remote cover URL into a Base64 data URL purely in RAM
	 */
	public async getCoverAsBase64(url: string): Promise<string | null> {
		if (!url || !url.startsWith("http")) return null;

		const cached = this.getCachedCover(url);
		if (cached) {
			return cached;
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

		const cacheKey = ImageRenderer.hashKey(coverBase64, 2166136261);

		if (this.overlayCache.has(cacheKey)) {
			const cached = this.overlayCache.get(cacheKey)!;
			// Refresh key position to implement true LRU eviction
			this.overlayCache.delete(cacheKey);
			this.overlayCache.set(cacheKey, cached);
			return cached;
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

		const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

		// Evict oldest cached overlay in RAM to maintain memory bounds
		if (this.overlayCache.size >= this.maxCacheSize) {
			const firstKey = this.overlayCache.keys().next().value;
			if (firstKey !== undefined) this.overlayCache.delete(firstKey);
		}

		this.overlayCache.set(cacheKey, dataUrl);
		return dataUrl;
	}

	/**
	 * Produce a full 200x100 touchstrip background from album artwork
	 * with dark scrim for overlay text readability and pause indicator when paused
	 */
	public getFullBleedCover(coverBase64: string, paused: boolean): string {
		if (!coverBase64) return "";

		const cacheKey = ImageRenderer.hashKey(coverBase64, paused ? 2166136261 ^ 16777619 : 2166136261);

		if (this.fullBleedCache.has(cacheKey)) {
			const cached = this.fullBleedCache.get(cacheKey)!;
			// Refresh key position to implement true LRU eviction
			this.fullBleedCache.delete(cacheKey);
			this.fullBleedCache.set(cacheKey, cached);
			return cached;
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

		// 200x100 SVG with dark scrim (0.55 opacity) to guarantee crisp title/timestamp legibility
		const pauseBadge = paused
			? `  <circle cx="100" cy="50" r="22" fill="#000000" fill-opacity="0.5" stroke="#ffffff" stroke-width="2"/>
  <rect x="94" y="41" width="4.5" height="18" fill="#ffffff" rx="1.5"/>
  <rect x="101.5" y="41" width="4.5" height="18" fill="#ffffff" rx="1.5"/>`
			: "";

		const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 200 100" width="200" height="100">
  <image href="${coverBase64}" xlink:href="${coverBase64}" x="0" y="0" width="200" height="100" preserveAspectRatio="xMidYMid slice"/>
  <rect x="0" y="0" width="200" height="100" fill="#000000" fill-opacity="0.55"/>
${pauseBadge}
</svg>`;

		const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

		// Evict oldest cached overlay in RAM to maintain memory bounds
		if (this.fullBleedCache.size >= this.maxCacheSize) {
			const firstKey = this.fullBleedCache.keys().next().value;
			if (firstKey !== undefined) this.fullBleedCache.delete(firstKey);
		}

		this.fullBleedCache.set(cacheKey, dataUrl);
		return dataUrl;
	}

	/**
	 * Produce an aspect-ratio-preserving, dimmed 200x100 SVG watermark from a 24x24 action icon
	 * so Full Bleed touchstrip layouts do not stretch 1:1 icons to 2:1 or obscure foreground text
	 */
	public getFullBleedFallbackIcon(iconPath: string): string {
		if (!iconPath || iconPath.startsWith("data:")) {
			return iconPath;
		}
		const cached = this.fullBleedIconCache.get(iconPath);
		if (cached) {
			return cached;
		}

		const shape = FULL_BLEED_ICON_SHAPES[iconPath] || FULL_BLEED_ICON_SHAPES["assets/actions/trackdial/icon.svg"];
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200" height="100">
  <g transform="translate(64, 8) scale(3)" opacity="0.22">
    ${shape}
  </g>
</svg>`;

		const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
		this.fullBleedIconCache.set(iconPath, dataUrl);
		return dataUrl;
	}
}
