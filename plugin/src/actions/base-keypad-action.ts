/**
 * Base Class for Template-Driven Keypad Actions
 *
 * Centralizes instance tracking, settings synchronization, version mismatch rendering,
 * and title formatting for keypad actions.
 */
import {
	DidReceiveSettingsEvent,
	KeyDownEvent,
	SingletonAction,
	WillAppearEvent,
	WillDisappearEvent,
} from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";

import { StateManager } from "../services/state-manager.js";
import { handleKeypadMismatch } from "../services/warning-icons.js";
import { WebSocketService } from "../services/websocket-server.js";
import { YTMPlaybackState } from "../types/index.js";

export abstract class BaseKeypadTemplateAction<
	TSettings extends JsonObject = JsonObject,
> extends SingletonAction<TSettings> {
	protected activeActions: Map<string, WillAppearEvent<TSettings>["action"]> = new Map();
	protected actionSettings: Map<string, TSettings> = new Map();
	protected abstract readonly actionKey: string;
	private lastRenderedTitle: Map<string, string> = new Map();
	private lastRenderedMismatch: Map<string, boolean> = new Map();

	constructor() {
		super();

		StateManager.getInstance().on("stateChanged", (state: YTMPlaybackState) => {
			this.updateAllInstances(state);
		});
	}

	override async onWillAppear(ev: WillAppearEvent<TSettings>): Promise<void> {
		this.activeActions.set(ev.action.id, ev.action);
		this.actionSettings.set(ev.action.id, ev.payload.settings);
		this.lastRenderedTitle.delete(ev.action.id);
		this.lastRenderedMismatch.delete(ev.action.id);
		const state = StateManager.getInstance().getState();
		await this.updateInstance(ev.action, state, ev.payload.settings);
		WebSocketService.getInstance().sendCommand("requestState");
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<TSettings>): Promise<void> {
		this.actionSettings.set(ev.action.id, ev.payload.settings);
		this.lastRenderedTitle.delete(ev.action.id);
		const state = StateManager.getInstance().getState();
		await this.updateInstance(ev.action, state, ev.payload.settings);
	}

	override async onWillDisappear(ev: WillDisappearEvent<TSettings>): Promise<void> {
		this.lastRenderedTitle.delete(ev.action.id);
		this.lastRenderedMismatch.delete(ev.action.id);
		this.actionSettings.delete(ev.action.id);
		this.activeActions.delete(ev.action.id);
	}

	override async onKeyDown(ev: KeyDownEvent<TSettings>): Promise<void> {
		if (StateManager.getInstance().isVersionMismatch()) {
			if (ev.action.isKey()) {
				await ev.action.showAlert();
			}
			return;
		}

		await this.handleActionKeyDown(ev);
	}

	/**
	 * Subclass hook to handle key down events
	 */
	protected abstract handleActionKeyDown(ev: KeyDownEvent<TSettings>): Promise<void> | void;

	/**
	 * Subclass hook to format the display title for a key
	 */
	protected abstract formatDisplayTitle(state: YTMPlaybackState, settings: TSettings): string;

	/**
	 * Helper for subclasses to set optimistic title feedback on key press
	 */
	protected async setOptimisticTitle(actionInstance: KeyDownEvent<TSettings>["action"], text: string): Promise<void> {
		if (actionInstance.isKey()) {
			await actionInstance.setTitle(text);
			this.lastRenderedTitle.set(actionInstance.id, text);
		}
	}

	protected async updateAllInstances(state: YTMPlaybackState): Promise<void> {
		for (const actionInstance of this.activeActions.values()) {
			try {
				const settings =
					this.actionSettings.get(actionInstance.id) ||
					(await actionInstance.getSettings().catch(() => ({}) as TSettings));
				await this.updateInstance(actionInstance, state, settings);
			} catch {}
		}
	}

	protected async updateInstance(
		actionInstance: WillAppearEvent<TSettings>["action"],
		state: YTMPlaybackState,
		settings: TSettings,
	): Promise<void> {
		if (!actionInstance.isKey()) return;

		try {
			const { isHandled, recoveredFromMismatch } = await handleKeypadMismatch(
				actionInstance,
				actionInstance.id,
				!!state.isVersionMismatch,
				this.actionKey,
				this.lastRenderedMismatch,
			);
			if (isHandled) return;

			const text = this.formatDisplayTitle(state, settings);
			const prevText = this.lastRenderedTitle.get(actionInstance.id);

			if (prevText !== text || recoveredFromMismatch) {
				if (recoveredFromMismatch) {
					await actionInstance.setImage(undefined);
				}
				await actionInstance.setTitle(text);
				this.lastRenderedTitle.set(actionInstance.id, text);
			}
		} catch {}
	}
}
