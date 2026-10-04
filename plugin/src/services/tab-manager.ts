/**
 * Tab Manager Service
 *
 * Manages connected browser tabs, multi-tab arbitration, version mismatch tracking,
 * and active tab prioritization.
 */
import { WebSocket } from "ws";

import { ClientTabInfo } from "../types/index.js";

export class TabManager {
	private clientTabs: Map<WebSocket, ClientTabInfo> = new Map();

	/**
	 * Register or update a connected client tab
	 */
	public addTab(ws: WebSocket, info: ClientTabInfo): void {
		this.clientTabs.set(ws, info);
	}

	/**
	 * Retrieve metadata for a specific WebSocket tab
	 */
	public getTab(ws: WebSocket): ClientTabInfo | undefined {
		return this.clientTabs.get(ws);
	}

	/**
	 * Update metadata fields for a specific client tab
	 */
	public updateTab(ws: WebSocket, updates: Partial<ClientTabInfo>): void {
		const info = this.clientTabs.get(ws);
		if (info) {
			Object.assign(info, updates);
		}
	}

	/**
	 * Remove a client tab and return its playback status
	 */
	public removeTab(ws: WebSocket): { wasPlaying: boolean; remainingTabsCount: number } {
		const tabInfo = this.clientTabs.get(ws);
		const wasPlaying = tabInfo?.isPlaying === true;
		this.clientTabs.delete(ws);
		return {
			wasPlaying,
			remainingTabsCount: this.clientTabs.size,
		};
	}

	/**
	 * Check if a specific WebSocket client is tracked
	 */
	public hasTab(ws: WebSocket): boolean {
		return this.clientTabs.has(ws);
	}

	/**
	 * Total tracked tabs count
	 */
	public get size(): number {
		return this.clientTabs.size;
	}

	/**
	 * Clear all tracked tabs
	 */
	public clear(): void {
		this.clientTabs.clear();
	}

	/**
	 * Multi-tab arbitration check:
	 * Returns true if an incoming paused update should be ignored because another tab is actively playing
	 */
	public shouldIgnorePausedUpdate(currentWs: WebSocket): boolean {
		for (const [otherWs, otherInfo] of this.clientTabs.entries()) {
			if (
				otherWs !== currentWs &&
				otherWs.readyState === WebSocket.OPEN &&
				!otherInfo.isOverlay &&
				otherInfo.isPlaying
			) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Evaluates version mismatch status across all non-overlay tabs
	 */
	public evaluateMismatchState(): { hasMismatch: boolean; targetVersion: string } {
		const nonOverlayTabs = Array.from(this.clientTabs.values()).filter((t) => !t.isOverlay);
		const hasMismatch = nonOverlayTabs.some((t) => t.isMismatch === true);
		const mismatchTab = nonOverlayTabs.find((t) => t.isMismatch === true);
		const targetVersion =
			mismatchTab?.version || (nonOverlayTabs.length > 0 ? nonOverlayTabs[0].version : undefined) || "0.0.0.0";

		return { hasMismatch, targetVersion };
	}

	/**
	 * Check if there is at least one active non-overlay tab connected
	 */
	public hasConnectedClients(): boolean {
		for (const [ws, info] of this.clientTabs.entries()) {
			if (ws.readyState === WebSocket.OPEN && !info.isOverlay) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Get the currently active YouTube Music tab socket
	 * Prioritizes actively playing tabs, then paused tabs with track loaded, then most recently active tabs
	 */
	public getActiveTabSocket(clients?: Iterable<WebSocket>): WebSocket | null {
		// 1. Preference: Tab that is actively playing (isPlaying === true) and OPEN
		for (const [ws, info] of this.clientTabs.entries()) {
			if (ws.readyState === WebSocket.OPEN && !info.isOverlay && info.isPlaying) {
				return ws;
			}
		}

		// 2. Preference: Paused non-overlay tab that has a track loaded, ordered by most recently active
		let latestLoadedWs: WebSocket | null = null;
		let latestLoadedTime = 0;
		for (const [ws, info] of this.clientTabs.entries()) {
			if (ws.readyState === WebSocket.OPEN && !info.isOverlay && info.hasTrackLoaded) {
				if (info.lastActive > latestLoadedTime) {
					latestLoadedTime = info.lastActive;
					latestLoadedWs = ws;
				}
			}
		}
		if (latestLoadedWs) return latestLoadedWs;

		// 3. Preference: Most recently active non-overlay tab that is OPEN
		let latestWs: WebSocket | null = null;
		let latestTime = 0;
		for (const [ws, info] of this.clientTabs.entries()) {
			if (ws.readyState === WebSocket.OPEN && !info.isOverlay) {
				if (info.lastActive > latestTime) {
					latestTime = info.lastActive;
					latestWs = ws;
				}
			}
		}
		if (latestWs) return latestWs;

		// 4. Fallback: Any OPEN client that is not explicitly an overlay
		if (clients) {
			for (const ws of clients) {
				const info = this.clientTabs.get(ws);
				if (ws.readyState === WebSocket.OPEN && (!info || !info.isOverlay)) {
					return ws;
				}
			}
		}

		return null;
	}
}
