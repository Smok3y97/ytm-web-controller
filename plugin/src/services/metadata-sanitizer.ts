/**
 * Metadata Sanitizer Service
 *
 * Sanitizes YouTube Music DOM text fragments to filter out non-album metadata
 * (view counts, upload timestamps, release years, like counts) across all YouTube-supported languages.
 */

const REGEX_WHITESPACE = /[\s\u00A0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/g;
const REGEX_YEAR = /^\d{4}$/;
const REGEX_EXPLICIT = /^(e|\[e\])$/i;
const REGEX_TIME_DURATION = /^\d+:\d+(?::\d+)?$/;
const REGEX_TRACK_COUNT = /^\d+\s*(?:tracks?|titel|songs?|morceaux|canciones|brani|трек\w*|піс\w*)$/i;
const REGEX_VIEW_KEYWORD =
	/(?:aufruf|view|vue|visualiza|visualizz|просмотр|перегляд|wyświetle|görüntüleme|weergaven|visning|katselukert|zhlédnut|zhliadnut|megtekintés|vizionar|προβολ|pregled|צפי|مشاهد|ditonton|lượt\s*xem|回視聴|次观看|次觀看|조회|ครั้ง)/i;
const REGEX_TIME_KEYWORD =
	/(?:^vor\s|\bago$|^il y a\b|^hace\s|^há\s|\bfa$|назад$|тому$|önce$|temu$|előtt$|sedan$|siden$|sitten$|yang lalu$|^před\s|^pred\s|^acum\s|^πριν\s|^pre\s|לפني|قبل|trước$|ที่แล้ว$|年前|前$|전$)/i;
const REGEX_DATE_UNIT =
	/(?:year|jahr|ans?|año|anno|год|лет|рок|month|monat|mois|mes|mese|месяц|місяц|week|woche|semaine|semana|settiman|недел|тижд|day|tag|jour|día|giorno|день|дней|днів|hour|stunde|heure|hora|ora|час|minute|минут|хвилин)/i;
const REGEX_RELATIVE_PAST =
	/(?:vor|ago|hace|há|fa|назад|тому|önce|temu|előtt|sedan|siden|sitten|yang lalu|před|pred|acum|πριν|pre|לפني|قبل|trước|ที่แล้ว)/i;
const REGEX_LIKE_KEYWORD =
	/(?:like|gefällt|gusta|j'aime|mi piace|лайк|좋아요|讚|赞|subscribers?|abonnenten?|abonnés?|suscriptores?|iscritti)/i;
const REGEX_BULLET_SPLIT = /\s*[\u2022\u00B7·•|]\s*/;
const REGEX_TRAILING_YEAR = /(?:[\s\u2022\u00B7·•\\-|]|\s+)\b(19|20)\d{2}\b$/;
const REGEX_LEADING_EXPLICIT = /^(E|\[E\])\s+/i;
const REGEX_TRAILING_PUNCTUATION = /[\u2022\u00B7\u2023\u25E6\u2043\u2219·•\-,|\s]+$/;

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
