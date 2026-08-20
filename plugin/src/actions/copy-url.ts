/**
 * Copy Song URL & Track Info Action
 *
 * UUID: com.smok3y97.ytmusicweb.copyurl
 */
import streamDeck, { action, KeyDownEvent, WillDisappearEvent } from "@elgato/streamdeck";

import { copyToClipboard } from "../services/clipboard.js";
import { StateManager } from "../services/state-manager.js";
import { CopyUrlSettings, YTMPlaybackState } from "../types/index.js";
import { BaseStateAction } from "./base-state-action.js";

@action({ UUID: "com.smok3y97.ytmusicweb.copyurl" })
export class CopyUrlAction extends BaseStateAction {
	protected readonly command = "";
	protected override actionKey = "copyurl";
	private feedbackTimers: Map<string, NodeJS.Timeout> = new Map();

	override async onWillDisappear(ev: WillDisappearEvent): Promise<void> {
		const timer = this.feedbackTimers.get(ev.action.id);
		if (timer) {
			clearTimeout(timer);
			this.feedbackTimers.delete(ev.action.id);
		}
		await super.onWillDisappear(ev);
	}

	protected calculateState(_state: YTMPlaybackState): number {
		return 0;
	}

	override async onKeyDown(ev: KeyDownEvent<CopyUrlSettings>): Promise<void> {
		if (StateManager.getInstance().isVersionMismatch()) {
			if (ev.action.isKey()) {
				await ev.action.showAlert();
			}
			return;
		}

		const stateManager = StateManager.getInstance();
		const state = stateManager.getState();

		const template = ev.payload.settings?.copyFormatTemplate || "{url}";
		const textToCopy = stateManager.formatTrackText(template, state);

		if (!textToCopy) {
			streamDeck.logger.warn("[CopyUrlAction] No active track metadata/URL available to copy");
			if (ev.action.isKey()) {
				await ev.action.showAlert();
			}
			return;
		}

		try {
			await copyToClipboard(textToCopy);
			streamDeck.logger.info(`[CopyUrlAction] Successfully copied text to clipboard: ${textToCopy}`);

			if (ev.action.isKey()) {
				const actionId = ev.action.id;
				const existingTimer = this.feedbackTimers.get(actionId);
				if (existingTimer) {
					clearTimeout(existingTimer);
					this.feedbackTimers.delete(actionId);
				}

				// Show green checkmark feedback icon
				await ev.action.setImage("assets/actions/copyurl/copied.svg");

				// Reset back to default icon after snappy 750ms
				const timer = setTimeout(async () => {
					this.feedbackTimers.delete(actionId);
					try {
						if (ev.action.isKey()) {
							await ev.action.setImage(undefined);
						}
					} catch {}
				}, 750);

				this.feedbackTimers.set(actionId, timer);
			}
		} catch (err) {
			streamDeck.logger.error(`[CopyUrlAction] Failed to copy text to clipboard: ${err}`);
			if (ev.action.isKey()) {
				await ev.action.showAlert();
			}
		}
	}
}
