/**
 * Copy Song URL & Track Info Action
 *
 * UUID: com.smok3y97.ytmusicweb.copyurl
 */
import streamDeck, {
	action,
	KeyDownEvent,
	SingletonAction,
	WillAppearEvent,
	WillDisappearEvent,
} from "@elgato/streamdeck";

import { copyToClipboard } from "../services/clipboard.js";
import { StateManager } from "../services/state-manager.js";
import { handleKeypadMismatch } from "../services/warning-icons.js";
import { CopyUrlSettings, YTMPlaybackState } from "../types/index.js";

@action({ UUID: "com.smok3y97.ytmusicweb.copyurl" })
export class CopyUrlAction extends SingletonAction<CopyUrlSettings> {
	private activeActions: Map<string, WillAppearEvent<CopyUrlSettings>["action"]> = new Map();
	private feedbackTimers: Map<string, NodeJS.Timeout> = new Map();
	private lastRenderedMismatch: Map<string, boolean> = new Map();

	constructor() {
		super();

		StateManager.getInstance().on("stateChanged", (state: YTMPlaybackState) => {
			this.updateAllInstances(state);
		});
	}

	override async onWillAppear(ev: WillAppearEvent<CopyUrlSettings>): Promise<void> {
		this.activeActions.set(ev.action.id, ev.action);
		this.lastRenderedMismatch.delete(ev.action.id);
		const state = StateManager.getInstance().getState();
		await this.updateInstance(ev.action, state);
	}

	override async onWillDisappear(ev: WillDisappearEvent<CopyUrlSettings>): Promise<void> {
		const actionId = ev.action.id;
		this.lastRenderedMismatch.delete(actionId);
		this.activeActions.delete(actionId);
		const timer = this.feedbackTimers.get(actionId);
		if (timer) {
			clearTimeout(timer);
			this.feedbackTimers.delete(actionId);
		}
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

				// Reset back to default action icon after 750ms
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

	private async updateAllInstances(state: YTMPlaybackState): Promise<void> {
		for (const actionInstance of this.activeActions.values()) {
			try {
				await this.updateInstance(actionInstance, state);
			} catch {}
		}
	}

	private async updateInstance(
		actionInstance: WillAppearEvent<CopyUrlSettings>["action"],
		state: YTMPlaybackState,
	): Promise<void> {
		if (!actionInstance.isKey()) return;

		try {
			const { isHandled, recoveredFromMismatch } = await handleKeypadMismatch(
				actionInstance,
				actionInstance.id,
				!!state.isVersionMismatch,
				"copyurl",
				this.lastRenderedMismatch,
			);
			if (isHandled) return;

			if (recoveredFromMismatch) {
				await actionInstance.setImage(undefined);
				await actionInstance.setTitle("");
			}
		} catch {}
	}
}
