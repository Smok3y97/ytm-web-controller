/**
 * Dial Rotary Streamer Service
 *
 * Encapsulates encoder rotation buffering, push-jitter suppression,
 * 10-Hz optimistic LCD feedback rate-limiting, and trailing settle timers for Stream Deck + dials.
 */
import type { DialAction } from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";

import { StateManager } from "./state-manager.js";

export interface RotaryStreamHandlers {
	renderOptimistic: (accumulatedTicks: number) => Promise<void> | void;
	flush: (accumulatedTicks: number, alreadyRendered?: boolean) => Promise<void> | void;
	settle?: () => void;
}

export class DialRotaryStreamer {
	private lastDialPressTime: Map<string, number> = new Map();
	private rotationTimer: Map<string, NodeJS.Timeout> = new Map();
	private rotationStreamTimer: Map<string, NodeJS.Timeout> = new Map();
	private pendingTicks: Map<string, number> = new Map();
	private lastFeedbackTime: Map<string, number> = new Map();
	private lastCommandTime: Map<string, number> = new Map();

	/**
	 * Record dial press or release to suppress encoder jitter
	 */
	public recordPress(actionId: string): void {
		this.lastDialPressTime.set(actionId, Date.now());
		this.pendingTicks.set(actionId, 0);

		const existingTimer = this.rotationTimer.get(actionId);
		if (existingTimer) {
			clearTimeout(existingTimer);
			this.rotationTimer.delete(actionId);
		}
		const existingStreamTimer = this.rotationStreamTimer.get(actionId);
		if (existingStreamTimer) {
			clearInterval(existingStreamTimer);
			this.rotationStreamTimer.delete(actionId);
		}
	}

	/**
	 * Push-jitter suppression: returns true if dial was pressed within last 250ms
	 */
	public isPushJitterActive(actionId: string): boolean {
		const pressTime = this.lastDialPressTime.get(actionId) || 0;
		return Date.now() - pressTime < 250;
	}

	/**
	 * Returns true if an action is currently actively rotating or settling
	 */
	public isRotating(actionId: string): boolean {
		const pending = this.pendingTicks.get(actionId) || 0;
		return pending !== 0 || this.rotationTimer.has(actionId) || this.rotationStreamTimer.has(actionId);
	}

	/**
	 * Unified 10-Hz rotary streamer & settle controller for Stream Deck + dials
	 */
	public async handleRotaryStream<TSettings extends JsonObject>(
		dialAction: DialAction<TSettings>,
		ticksDelta: number,
		handlers: RotaryStreamHandlers,
	): Promise<void> {
		const actionId = dialAction.id;
		if (this.isPushJitterActive(actionId)) return;

		if (StateManager.getInstance().isVersionMismatch()) {
			await dialAction.showAlert();
			return;
		}

		const currentTicks = (this.pendingTicks.get(actionId) || 0) + ticksDelta;
		this.pendingTicks.set(actionId, currentTicks);

		const now = Date.now();
		const lastCmd = this.lastCommandTime.get(actionId) || 0;

		// 1. Optimistic LCD feedback (strictly rate-limited to <= 10 Hz)
		let feedbackRendered = false;
		const lastFeedback = this.lastFeedbackTime.get(actionId) || 0;
		if (now - lastFeedback >= 100) {
			this.lastFeedbackTime.set(actionId, now);
			await handlers.renderOptimistic(currentTicks);
			feedbackRendered = true;
		}

		// 2. Dispatch command: if >= 100ms since last dispatch, flush immediately
		const executeFlush = async (alreadyRendered: boolean = false, force: boolean = false) => {
			const pending = this.pendingTicks.get(actionId) || 0;
			if (pending === 0) return;
			const currentTime = Date.now();
			const lastCommand = this.lastCommandTime.get(actionId) || 0;
			if (!force && currentTime - lastCommand < 100) return;

			if (this.isPushJitterActive(actionId)) {
				this.pendingTicks.set(actionId, 0);
				return;
			}
			this.pendingTicks.set(actionId, 0);
			this.lastCommandTime.set(actionId, currentTime);
			await handlers.flush(pending, alreadyRendered);
		};

		if (now - lastCmd >= 100) {
			await executeFlush(feedbackRendered);
		} else if (!this.rotationStreamTimer.has(actionId)) {
			// Start active 10-Hz interval streamer during continuous rotation
			const streamTimer = setInterval(async () => {
				await executeFlush(false);
			}, 100);
			this.rotationStreamTimer.set(actionId, streamTimer);
		}

		// 3. Trailing settle timer (110ms after last rotation detent)
		const settleTimer = this.rotationTimer.get(actionId);
		if (settleTimer) {
			clearTimeout(settleTimer);
		}
		const newSettleTimer = setTimeout(async () => {
			const activeStreamTimer = this.rotationStreamTimer.get(actionId);
			if (activeStreamTimer) {
				clearInterval(activeStreamTimer);
				this.rotationStreamTimer.delete(actionId);
			}
			const activeSettleTimer = this.rotationTimer.get(actionId);
			if (activeSettleTimer) {
				clearTimeout(activeSettleTimer);
				this.rotationTimer.delete(actionId);
			}

			await executeFlush(false, true);
			if (handlers.settle) {
				handlers.settle();
			}
		}, 110);
		this.rotationTimer.set(actionId, newSettleTimer);
	}

	/**
	 * Cleans up all pending timers and cached state for an action
	 */
	public cleanup(actionId: string): void {
		this.lastDialPressTime.delete(actionId);
		this.lastFeedbackTime.delete(actionId);
		this.lastCommandTime.delete(actionId);
		this.pendingTicks.delete(actionId);

		const timer = this.rotationTimer.get(actionId);
		if (timer) {
			clearTimeout(timer);
			this.rotationTimer.delete(actionId);
		}
		const streamTimer = this.rotationStreamTimer.get(actionId);
		if (streamTimer) {
			clearInterval(streamTimer);
			this.rotationStreamTimer.delete(actionId);
		}
	}
}
