/**
 * Metadata Sanitizer Service
 *
 * Sanitizes YouTube Music DOM text fragments to filter out non-album metadata
 * (view counts, upload timestamps, release years, like counts) across all YouTube-supported languages.
 */

export class MetadataSanitizer {
	/**
	 * Clean up raw album string: returns trimmed album title or empty string if text is non-album metadata
	 */
	public static sanitizeAlbum(album?: string | null): string {
		if (!album || typeof album !== "string") return "";
		return !MetadataSanitizer.isNonAlbumText(album) ? album.trim() : "";
	}

	/**
	 * Determine if a text fragment represents non-album metadata (view count, upload date, year, likes, etc.)
	 */
	public static isNonAlbumText(text: string): boolean {
		if (!text || typeof text !== "string") return true;
		const s = text.trim();
		if (!s) return true;

		// 1. Year only (e.g. "2024", "1998")
		if (/^\d{4}$/.test(s)) return true;

		// 2. Explicit / parental badge
		if (/^(e|\[e\])$/i.test(s)) return true;

		// 3. Time duration format (e.g. "3:45", "01:23:45")
		if (/^\d+:\d+(?::\d+)?$/.test(s)) return true;

		// 4. Track count format (e.g. "12 tracks", "10 Titel", "8 morceaux", "15 canciones")
		if (/^\d+\s*(?:tracks?|titel|songs?|morceaux|canciones|brani|трек\w*|піс\w*)$/i.test(s)) return true;

		const hasDigits = /\d/.test(s);

		// 5. View count patterns across all YouTube languages
		// e.g. "20 Mio. Aufrufe", "20M views", "1.2M views", "500 Aufrufe", "1 Aufruf", "20 M de vues", "10 млн просмотров", "500 次观看", "100万回視聴", "1.2만회 조회"
		const hasViewKeyword =
			/(?:aufruf|view|vue|visualiza|visualizz|просмотр|перегляд|wyświetle|görüntüleme|weergaven|visning|katselukert|zhlédnut|zhliadnut|megtekintés|vizionar|προβολ|pregled|צפי|مشاهد|ditonton|lượt\s*xem|回視聴|次观看|次觀看|조회|ครั้ง)/i.test(
				s,
			);
		if (hasDigits && hasViewKeyword) return true;

		// 6. Relative upload times across languages
		// e.g. "vor 3 Jahren", "3 years ago", "il y a 2 ans", "hace 5 meses", "2 anni fa", "3 года назад", "1年前", "3년 전", "há 3 anos"
		const hasTimeKeyword =
			/(?:^vor\s|\bago$|^il y a\b|^hace\s|^há\s|\bfa$|назад$|тому$|önce$|temu$|előtt$|sedan$|siden$|sitten$|yang lalu$|^před\s|^pred\s|^acum\s|^πριν\s|^pre\s|לפني|قبل|trước$|ที่แล้ว$|年前|前$|전$)/i.test(
				s,
			);
		if (hasTimeKeyword) return true;

		// 7. Date units with digits (e.g. "3 Jahre", "5 months", "2 days", etc.)
		const hasDateUnit =
			/(?:year|jahr|ans?|año|anno|год|лет|рок|month|monat|mois|mes|mese|месяц|місяц|week|woche|semaine|semana|settiman|недел|тижд|day|tag|jour|día|giorno|день|дней|днів|hour|stunde|heure|hora|ora|час|minute|минут|хвилин)/i.test(
				s,
			);
		if (
			hasDigits &&
			hasDateUnit &&
			/(?:vor|ago|hace|há|fa|назад|тому|önce|temu|előtt|sedan|siden|sitten|yang lalu|před|pred|acum|πριν|pre|לפني|قبل|trước|ที่แล้ว)/i.test(
				s,
			)
		) {
			return true;
		}

		// 8. Like / reaction / subscriber counts (e.g. "500k likes", "12 Tsd. Gefällt mir", "1.2M subscribers")
		const hasLikeKeyword =
			/(?:like|gefällt|gusta|j'aime|mi piace|лайк|좋아요|讚|赞|subscribers?|abonnenten?|abonnés?|suscriptores?|iscritti)/i.test(
				s,
			);
		if (hasDigits && hasLikeKeyword) return true;

		return false;
	}
}
