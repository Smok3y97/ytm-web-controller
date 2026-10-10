/**
 * OBS Studio Text Exporter Service
 *
 * Writes current YouTube Music track metadata to a local text file for OBS overlays.
 */
import streamDeck from "@elgato/streamdeck";
import { promises as fs } from "fs";
import path from "path";

import { GlobalSettings, YTMPlaybackState } from "../types/index.js";
import { StateManager } from "./state-manager.js";

export const DEFAULT_OBS_TEMPLATE = "Currently Playing: {artist} - {title}";

export class ObsExporterService {
	private static instance: ObsExporterService;

	private isEnabled: boolean = false;
	private filePath: string = "";
	private formatTemplate: string = DEFAULT_OBS_TEMPLATE;
	private clearOnPause: boolean = true;

	private lastState: YTMPlaybackState | null = null;
	private lastWrittenContent: string | null = null;
	private debounceTimer: NodeJS.Timeout | null = null;
	private isWriting: boolean = false;
	private pendingWriteContent: string | null = null;
	private verifiedDirPath: string = "";

	private constructor() {
		this.filePath = "";
	}

	public static getInstance(): ObsExporterService {
		if (!ObsExporterService.instance) {
			ObsExporterService.instance = new ObsExporterService();
		}
		return ObsExporterService.instance;
	}

	/**
	 * Returns current active export file path
	 */
	public getFilePath(): string {
		return this.filePath;
	}

	/**
	 * Update exporter configuration from GlobalSettings / ActionSettings
	 */
	public async updateSettings(settings: Partial<GlobalSettings>): Promise<void> {
		const prevEnabled = this.isEnabled;
		const prevPath = this.filePath;
		const prevTemplate = this.formatTemplate;
		const prevClear = this.clearOnPause;

		const configuredPath = (settings.obsFilePath || "").trim();
		this.filePath = configuredPath ? path.resolve(configuredPath) : "";
		this.isEnabled = !!settings.enableObsExport && this.filePath.length > 0;
		this.formatTemplate =
			settings.obsFormatTemplate && settings.obsFormatTemplate.trim()
				? settings.obsFormatTemplate.trim()
				: DEFAULT_OBS_TEMPLATE;
		this.clearOnPause = settings.obsClearOnPause !== false; // Default true

		if (settings.enableObsExport && !this.filePath) {
			streamDeck.logger.warn("[OBS Exporter] Text export enabled but no file path configured (file is required)");
		}

		const changed =
			prevEnabled !== this.isEnabled ||
			prevPath !== this.filePath ||
			prevTemplate !== this.formatTemplate ||
			prevClear !== this.clearOnPause;

		if (changed) {
			if (prevPath !== this.filePath) {
				this.verifiedDirPath = "";
			}
			streamDeck.logger.info(
				`[OBS Exporter] Settings updated: enabled=${this.isEnabled}, path="${this.filePath}", clearOnPause=${this.clearOnPause}`,
			);

			// If export was disabled or path changed, clear old output
			if (prevEnabled && !this.isEnabled) {
				await this.queueWrite("");
			} else if (this.isEnabled && this.filePath) {
				if (this.lastState) {
					this.updateExport(this.lastState, true);
				} else {
					await this.queueWrite("");
				}
			}
		}
	}

	/**
	 * Trigger text export update when playback state changes
	 */
	public updateExport(state: YTMPlaybackState, force = false): void {
		this.lastState = state;

		if (!this.isEnabled || !this.filePath) {
			return;
		}

		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}

		const textToWrite = this.formatText(state);

		if (force || state.paused) {
			// Immediate write on pause/stop or forced update
			this.queueWrite(textToWrite);
		} else {
			// Debounce rapid track skips by 300ms
			this.debounceTimer = setTimeout(() => {
				this.debounceTimer = null;
				this.queueWrite(textToWrite);
			}, 300);
		}
	}

	/**
	 * Format the track string based on template and metadata
	 */
	public formatText(state: YTMPlaybackState): string {
		if (!state || !state.title || state.title.trim() === "") {
			return "";
		}

		if (state.paused && this.clearOnPause) {
			return "";
		}

		const formatted = StateManager.getInstance().formatTitleTemplate(this.formatTemplate);
		return formatted === "No Media" ? "" : formatted;
	}

	/**
	 * Safe queued file writer using fs.promises
	 */
	private async queueWrite(content: string): Promise<void> {
		if (!this.filePath) {
			return;
		}

		// Skip redundant writes to disk
		if (this.lastWrittenContent === content) {
			return;
		}

		this.pendingWriteContent = content;

		if (this.isWriting) {
			return;
		}

		this.isWriting = true;

		while (this.pendingWriteContent !== null) {
			const currentContent = this.pendingWriteContent;
			this.pendingWriteContent = null;

			try {
				const resolvedPath = path.resolve(this.filePath);
				const dirPath = path.dirname(resolvedPath);

				// Create target directory structure only if not yet verified
				if (this.verifiedDirPath !== dirPath) {
					await fs.mkdir(dirPath, { recursive: true });
					this.verifiedDirPath = dirPath;
				}

				// Write current song metadata with UTF-8 encoding for OBS text source consumption
				await fs.writeFile(resolvedPath, currentContent, { encoding: "utf8" });
				this.lastWrittenContent = currentContent;
			} catch (err: unknown) {
				const nodeErr = err as NodeJS.ErrnoException;
				if (nodeErr?.code === "ENOENT") {
					this.verifiedDirPath = "";
				}
				const errMsg = err instanceof Error ? err.message : String(err);
				streamDeck.logger.warn(`[OBS Exporter] Failed to write file "${this.filePath}": ${errMsg}`);
			}
		}

		this.isWriting = false;
	}
}
