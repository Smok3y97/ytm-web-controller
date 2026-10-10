/**
 * Template Engine Service
 *
 * Formats string templates for Stream Deck keys, dials, and Property Inspector displays.
 * Supports localized placeholders, multiline formatting, and cleanup of separators and brackets.
 */
import { YTMPlaybackState } from "../types/index.js";

export class TemplateEngine {
	/**
	 * Format seconds to standard mm:ss or hh:mm:ss string
	 */
	public static formatTime(totalSeconds: number): string {
		if (isNaN(totalSeconds) || totalSeconds < 0 || !isFinite(totalSeconds)) totalSeconds = 0;
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = Math.floor(totalSeconds % 60);

		const pad = (n: number) => n.toString().padStart(2, "0");

		if (hours > 0) {
			return `${hours}:${pad(minutes)}:${pad(seconds)}`;
		}
		return `${minutes}:${pad(seconds)}`;
	}

	/**
	 * Format remaining track time as string (e.g. "-2:45")
	 */
	private static formatRemainingTime(currentTime: number, duration: number, fallbackCurrentStr?: string): string {
		if (duration > 0) {
			const effectiveCurrent = Math.min(duration, Math.max(0, currentTime));
			const remainingSeconds = Math.max(0, duration - effectiveCurrent);
			return "-" + TemplateEngine.formatTime(remainingSeconds);
		}
		if (currentTime > 0) {
			return fallbackCurrentStr || TemplateEngine.formatTime(currentTime);
		}
		return "-0:00";
	}

	/**
	 * Strip empty brackets, collapse whitespace, and trim dangling leading/trailing separators
	 */
	private static cleanDanglingSeparators(text: string): string {
		return text
			.replace(/\(\s*\)/g, "")
			.replace(/\[\s*\]/g, "")
			.replace(/^[\s\-–—•|:]+/, "")
			.replace(/[\s\-–—•|:]+$/, "")
			.trim();
	}

	/**
	 * Render custom title template with placeholders: {artist}, {title}, {album}
	 */
	public static formatTitleTemplate(
		template: string = "{artist} - {title}",
		title?: string,
		artist?: string,
		album?: string,
	): string {
		if (!title && !artist) {
			return "No Media";
		}

		const titleStr = (title || "Unknown Title").trim();
		const artistStr = (artist || "Unknown Artist").trim();
		const albumStr = (album || "").trim();

		let output = (template || "{artist} - {title}")
			.replace(/{(title|titel|song|track)}/gi, titleStr)
			.replace(/{(artist|kuenstler|künstler|interpret|author|channel)}/gi, artistStr)
			.replace(/{(album)}/gi, albumStr);

		// Collapse multiple spaces
		output = output.replace(/\s+/g, " ");

		return TemplateEngine.cleanDanglingSeparators(output) || "No Media";
	}

	/**
	 * Render custom time template with placeholders: {current}, {duration}, {remaining}, {both}
	 */
	public static formatTimeTemplate(
		template: string = "{both}",
		currentTime: number = 0,
		duration: number = 0,
		title?: string,
		artist?: string,
	): string {
		if (!title && !artist && duration <= 0) {
			return "";
		}

		const currentStr = TemplateEngine.formatTime(currentTime);
		const durationStr = TemplateEngine.formatTime(duration);
		const bothStr = `${currentStr} / ${durationStr}`;
		const remainingStr = TemplateEngine.formatRemainingTime(currentTime, duration, currentStr);

		return (template || "{remaining}")
			.replace(/{(both|current_duration|current_and_duration|beides)}/gi, bothStr)
			.replace(/{(current|currentTime|current_time|aktuell|zeit|elapsed|time)}/gi, currentStr)
			.replace(/{(duration|total|totalTime|total_time|dauer|gesamt|length)}/gi, durationStr)
			.replace(/{(remaining|remainingTime|remaining_time|rest|restzeit|left)}/gi, remainingStr);
	}

	/**
	 * Render custom track text with placeholders: {url}, {title}, {artist}, {album}, {duration}, {currentTime}, {remaining}, {both}
	 */
	public static formatTrackText(template?: string, state?: YTMPlaybackState, currentTime: number = 0): string {
		if (!state || (!state.title && !state.artist && !state.trackUrl)) {
			return "";
		}

		const rawTemplate = template !== undefined && template !== null ? template : "{url}";
		if (!rawTemplate.trim()) {
			return "";
		}

		const titleStr = (state.title || "Unknown Title").trim();
		const artistStr = (state.artist || "Unknown Artist").trim();
		const albumStr = (state.album || "").trim();
		const trackUrlStr = (state.trackUrl || "").trim();
		const durationStr = TemplateEngine.formatTime(state.duration);
		const currentStr = TemplateEngine.formatTime(currentTime);
		const bothStr = `${currentStr} / ${durationStr}`;
		const remainingStr = TemplateEngine.formatRemainingTime(currentTime, state.duration, currentStr);

		let output = rawTemplate
			.replace(/\\n/g, "\n")
			.replace(/{(both|current_duration|current_and_duration|beides)}/gi, bothStr)
			.replace(/{(title|titel|song|track)}/gi, titleStr)
			.replace(/{(artist|kuenstler|künstler|interpret|author|channel)}/gi, artistStr)
			.replace(/{(album)}/gi, albumStr)
			.replace(/{(url|link|trackUrl|songUrl)}/gi, trackUrlStr)
			.replace(/{(duration|total|totalTime|total_time|dauer|gesamt|length)}/gi, durationStr)
			.replace(/{(currentTime|current|current_time|aktuell|zeit|elapsed|time)}/gi, currentStr)
			.replace(/{(remaining|remainingTime|remaining_time|rest|restzeit|left)}/gi, remainingStr);

		output = output
			.split("\n")
			.map((line) => line.replace(/[^\S\r\n]+/g, " ").trim())
			.join("\n");

		return TemplateEngine.cleanDanglingSeparators(output);
	}

	/**
	 * Render custom volume template with placeholders: {volume}
	 */
	public static formatVolumeTemplate(
		template: string = "{volume}%",
		volume: number = 100,
		muted: boolean = false,
	): string {
		if (muted) {
			if (template.includes("{volume}") || template.includes("{vol}")) {
				return template.replace(/\{(volume|vol|lautstaerke|lautstärke)\}/gi, "MUTE");
			}
			return "MUTE";
		}

		return (template || "{volume}%").replace(/\{(volume|vol|lautstaerke|lautstärke)\}/gi, String(volume));
	}

	/**
	 * Render custom seek button template with placeholders: {step}, {seconds}, {sign}
	 */
	public static formatSeekButtonTemplate(template?: string, step: number = 10, isForward: boolean = true): string {
		const sign = isForward ? "+" : "-";
		const defaultTpl = isForward ? "+{step}s" : "-{step}s";
		const tpl = template && template.trim() ? template : defaultTpl;

		return tpl.replace(/\{(step|seconds|sekunden|sec|s)\}/gi, String(step)).replace(/\{(sign|vorzeichen)\}/gi, sign);
	}
}
