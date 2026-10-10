/**
 * Metadata Sanitizer Service
 *
 * Sanitizes YouTube Music DOM text fragments to filter out non-album metadata
 * (view counts, upload timestamps, release years, like counts) across all YouTube-supported languages.
 */
import {
	REGEX_BULLET_SPLIT,
	REGEX_DATE_UNIT,
	REGEX_EXPLICIT,
	REGEX_LEADING_EXPLICIT,
	REGEX_LIKE_KEYWORD,
	REGEX_RELATIVE_PAST,
	REGEX_TIME_DURATION,
	REGEX_TIME_KEYWORD,
	REGEX_TRACK_COUNT,
	REGEX_TRAILING_PUNCTUATION,
	REGEX_TRAILING_YEAR,
	REGEX_VIEW_KEYWORD,
	REGEX_WHITESPACE,
	REGEX_YEAR,
} from "./metadata-patterns.js";

export class MetadataSanitizer {
	private static lastRawArtist: string | null = null;
	private static lastRawAlbum: string | null = null;
	private static lastResult: { artist: string; extractedAlbum?: string } = { artist: "" };
	private static albumRegexCache: Map<string, RegExp> = new Map();
	private static readonly MAX_ALBUM_REGEX_ENTRIES = 10;

	private static getAlbumStripRegex(escapedAlbum: string): RegExp {
		let re = MetadataSanitizer.albumRegexCache.get(escapedAlbum);
		if (!re) {
			if (MetadataSanitizer.albumRegexCache.size >= MetadataSanitizer.MAX_ALBUM_REGEX_ENTRIES) {
				const oldest = MetadataSanitizer.albumRegexCache.keys().next().value;
				if (oldest) MetadataSanitizer.albumRegexCache.delete(oldest);
			}
			re = new RegExp(
				`(^|\\s*[\\u2022\\u00B7·•\\-|]\\s*|\\s+)${escapedAlbum}(\\s*[\\u2022\\u00B7·•\\-|]\\s*|\\s+|$)`,
				"gi",
			);
			MetadataSanitizer.albumRegexCache.set(escapedAlbum, re);
		}
		return re;
	}

	/**
	 * Clean up whitespace and special non-breaking spaces
	 */
	public static cleanWhitespace(str: string): string {
		return (str || "").replace(REGEX_WHITESPACE, " ").trim();
	}

	/**
	 * Clean up raw album string: returns trimmed album title or empty string if text is non-album metadata
	 */
	public static sanitizeAlbum(album?: string | null): string {
		if (!album || typeof album !== "string") return "";
		const trimmed = MetadataSanitizer.cleanWhitespace(album);
		return !MetadataSanitizer.isNonAlbumText(trimmed) ? trimmed : "";
	}

	/**
	 * Clean up raw artist string: separates combined bullet fragments, strips trailing release years,
	 * explicit badges, and embedded album titles.
	 */
	public static sanitizeArtist(
		rawArtist?: string | null,
		album?: string | null,
	): { artist: string; extractedAlbum?: string } {
		if (!rawArtist || typeof rawArtist !== "string") {
			return { artist: "" };
		}

		if (rawArtist === MetadataSanitizer.lastRawArtist && album === MetadataSanitizer.lastRawAlbum) {
			return MetadataSanitizer.lastResult;
		}

		let cleanArtist = MetadataSanitizer.cleanWhitespace(rawArtist);
		let cleanAlbum = MetadataSanitizer.sanitizeAlbum(album);
		let extractedAlbum: string | undefined = undefined;

		// Check if artist contains bullet separator (e.g. "Artist • Album" or "Artist • Views")
		const bulletSplit = cleanArtist.split(REGEX_BULLET_SPLIT);
		if (bulletSplit.length > 1) {
			cleanArtist = bulletSplit[0].trim();
			if (!cleanAlbum && bulletSplit[1] && !MetadataSanitizer.isNonAlbumText(bulletSplit[1])) {
				cleanAlbum = bulletSplit[1].trim();
				extractedAlbum = cleanAlbum;
			}
		}

		// If album name is present as a standalone segment or whole word inside artist, strip it safely
		if (cleanAlbum && cleanAlbum.length >= 3 && cleanArtist.length > cleanAlbum.length) {
			const escapedAlbum = cleanAlbum.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			cleanArtist = cleanArtist.replace(MetadataSanitizer.getAlbumStripRegex(escapedAlbum), "$1").trim();
		}

		// Strip trailing 4-digit release years at the very end of string
		cleanArtist = cleanArtist.replace(REGEX_TRAILING_YEAR, "").trim();
		cleanArtist = cleanArtist.replace(REGEX_LEADING_EXPLICIT, "").trim();
		cleanArtist = cleanArtist.replace(REGEX_TRAILING_PUNCTUATION, "").trim();

		const result = {
			artist: cleanArtist || rawArtist.trim(),
			extractedAlbum: extractedAlbum || (cleanAlbum ? cleanAlbum : undefined),
		};

		MetadataSanitizer.lastRawArtist = rawArtist;
		MetadataSanitizer.lastRawAlbum = album ?? null;
		MetadataSanitizer.lastResult = result;

		return result;
	}

	/**
	 * Determine if a text fragment represents non-album metadata (view count, upload date, year, likes, etc.)
	 */
	public static isNonAlbumText(text: string): boolean {
		if (!text || typeof text !== "string") return true;
		const s = text.trim();
		if (!s) return true;

		// 1. Year only (e.g. "2024", "1998")
		if (REGEX_YEAR.test(s)) return true;

		// 2. Explicit / parental badge
		if (REGEX_EXPLICIT.test(s)) return true;

		// 3. Time duration format (e.g. "3:45", "01:23:45")
		if (REGEX_TIME_DURATION.test(s)) return true;

		// 4. Track count format (e.g. "12 tracks", "10 Titel", "8 morceaux", "15 canciones")
		if (REGEX_TRACK_COUNT.test(s)) return true;

		const hasDigits = /\d/.test(s);

		// 5. View count patterns across all YouTube languages
		if (hasDigits && REGEX_VIEW_KEYWORD.test(s)) return true;

		// 6. Relative upload times across languages
		if (REGEX_TIME_KEYWORD.test(s)) return true;

		// 7. Date units with digits (e.g. "3 Jahre", "5 months", "2 days", etc.)
		if (hasDigits && REGEX_DATE_UNIT.test(s) && REGEX_RELATIVE_PAST.test(s)) {
			return true;
		}

		// 8. Like / reaction / subscriber counts (e.g. "500k likes", "12 Tsd. Gefällt mir", "1.2M subscribers")
		if (hasDigits && REGEX_LIKE_KEYWORD.test(s)) return true;

		return false;
	}
}
