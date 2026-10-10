/**
 * Metadata Patterns Service Constants
 *
 * AUTO-GENERATED FILE - DO NOT EDIT MANUALLY!
 * Source of Truth: shared/metadata-patterns.json
 * Generated via: npm run sync:patterns
 */

/** Matches whitespace and non-breaking Unicode space variants. */
export const REGEX_WHITESPACE = new RegExp(
	"[\\s\\u00A0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]+",
	"g",
);

/** Matches a standalone 4-digit release year. */
export const REGEX_YEAR = new RegExp("^\\d{4}$", "");

/** Matches explicit badge indicators (e or [e]). */
export const REGEX_EXPLICIT = new RegExp("^(e|\\[e\\])$", "i");

/** Matches mm:ss or hh:mm:ss track duration formats. */
export const REGEX_TIME_DURATION = new RegExp("^\\d+:\\d+(?::\\d+)?$", "");

/** Matches track counts across multi-lingual interfaces. */
export const REGEX_TRACK_COUNT = new RegExp(
	"^\\d+\\s*(?:tracks?|titel|songs?|morceaux|canciones|brani|трек\\w*|піс\\w*)$",
	"i",
);

/** Matches view count keywords across 25+ YouTube Music languages. */
export const REGEX_VIEW_KEYWORD = new RegExp(
	"(?:aufruf|view|vue|visualiza|visualizz|просмотр|перегляд|wyświetle|görüntüleme|weergaven|visning|katselukert|zhlédnut|zhliadnut|megtekintés|vizionar|προβολ|pregled|צפי|مشاهد|ditonton|lượt\\s*xem|回視聴|次观看|次觀看|조회|ครั้ง)",
	"i",
);

/** Matches relative upload time prefixes and suffixes across languages. */
export const REGEX_TIME_KEYWORD = new RegExp(
	"(?:^vor\\s|\\bago$|^il y a\\b|^hace\\s|^há\\s|\\bfa$|назад$|тому$|önce$|temu$|előtt$|sedan$|siden$|sitten$|yang lalu$|^před\\s|^pred\\s|^acum\\s|^πριν\\s|^pre\\s|לפני|قبل|trước$|ที่แล้ว$|年前|前$|전$)",
	"i",
);

/** Matches time/date units (year, month, week, day, hour, minute). */
export const REGEX_DATE_UNIT = new RegExp(
	"(?:year|jahr|ans?|año|anno|год|лет|рок|month|monat|mois|mes|mese|месяц|місяц|week|woche|semaine|semana|settiman|недел|тижд|day|tag|jour|día|giorno|день|дней|днів|hour|stunde|heure|hora|ora|час|minute|минут|хвилин)",
	"i",
);

/** Matches past relative words across languages. */
export const REGEX_RELATIVE_PAST = new RegExp(
	"(?:vor|ago|hace|há|fa|назад|тому|önce|temu|előtt|sedan|siden|sitten|yang lalu|před|pred|acum|πριν|pre|לפני|قبل|trước|ที่แล้ว)",
	"i",
);

/** Matches like, reaction, and subscriber count keywords across languages. */
export const REGEX_LIKE_KEYWORD = new RegExp(
	"(?:like|gefällt|gusta|j'aime|mi piace|лайк|좋아요|讚|赞|subscribers?|abonnenten?|abonnés?|suscriptores?|iscritti)",
	"i",
);

/** Matches bullet delimiters separating artist, album, and views. */
export const REGEX_BULLET_SPLIT = new RegExp("\\s*[\\u2022\\u00B7·•|]\\s*", "");

/** Matches trailing 4-digit release year at the end of string (state-free, no global flag). */
export const REGEX_TRAILING_YEAR = new RegExp("(?:[\\s\\u2022\\u00B7·•\\\\-|]|\\s+)\\b(19|20)\\d{2}\\b$", "");

/** Matches leading explicit badge at beginning of title/artist. */
export const REGEX_LEADING_EXPLICIT = new RegExp("^(E|\\[E\\])\\s+", "i");

/** Matches trailing punctuation, dashes, or bullets left over after string stripping. */
export const REGEX_TRAILING_PUNCTUATION = new RegExp("[\\u2022\\u00B7\\u2023\\u25E6\\u2043\\u2219·•\\-,|\\s]+$", "");
