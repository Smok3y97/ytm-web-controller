/**
 * Version Control Service
 *
 * Centralized, decoupled version negotiation and compatibility management.
 * Dynamically reads the plugin version from manifest.json at build time.
 */
import manifest from "../../manifest.json" with { type: "json" };
import { HandshakeAckPayload, VersionMismatchPayload } from "../types/index.js";

export class VersionControlService {
	private static instance: VersionControlService;

	public readonly currentPluginVersion: string = manifest && manifest.Version ? manifest.Version : "1.8.0.0";
	public readonly minRequiredExtensionVersion: string = manifest && manifest.Version ? manifest.Version : "1.8.0.0";

	private constructor() {}

	public static getInstance(): VersionControlService {
		if (!VersionControlService.instance) {
			VersionControlService.instance = new VersionControlService();
		}
		return VersionControlService.instance;
	}

	/**
	 * Numeric 4-part version comparison
	 * @returns 1 if v1 > v2, -1 if v1 < v2, 0 if v1 === v2
	 */
	public compareVersions(v1: string, v2: string): number {
		const parts1 = (v1 || "").split(".").map((p) => parseInt(p, 10) || 0);
		const parts2 = (v2 || "").split(".").map((p) => parseInt(p, 10) || 0);
		const maxLen = Math.max(parts1.length, parts2.length, 4);

		for (let i = 0; i < maxLen; i++) {
			const n1 = parts1[i] || 0;
			const n2 = parts2[i] || 0;
			if (n1 > n2) return 1;
			if (n1 < n2) return -1;
		}
		return 0;
	}

	/**
	 * Check if a given extension version is fully compatible
	 * Both components must match across versions.
	 */
	public isExtensionCompatible(extVersion: string): boolean {
		if (!extVersion) return false;
		return this.compareVersions(extVersion, this.currentPluginVersion) === 0;
	}

	/**
	 * Format 3-part version for short UI displays (e.g. 1.5.0.0 -> 1.5.0)
	 */
	public formatShortVersion(v: string): string {
		const parts = (v || "").split(".");
		return parts.length >= 3 ? `${parts[0]}.${parts[1]}.${parts[2]}` : v;
	}

	/**
	 * Format dynamic warning text for Stream Deck + LCD Dials (max ~24 chars)
	 */
	public getDialWarningTitle(extVersion?: string): string {
		if (extVersion && this.compareVersions(extVersion, this.currentPluginVersion) > 0) {
			const shortVer = this.formatShortVersion(extVersion);
			return `⚠️ Update Plugin (v${shortVer}+)`;
		}
		const shortVer = this.formatShortVersion(this.currentPluginVersion);
		return `⚠️ Update Ext. (v${shortVer}+)`;
	}

	/**
	 * Format dynamic warning banner for Property Inspector
	 */
	public getWarningMessage(extVersion?: string): string {
		if (extVersion) {
			const comp = this.compareVersions(extVersion, this.currentPluginVersion);
			if (comp > 0) {
				return `⚠️ Stream Deck Plugin (v${this.currentPluginVersion}) is outdated! Please update to v${this.formatShortVersion(extVersion)}+ via GitHub Releases.`;
			}
			return `⚠️ Browser Extension (v${extVersion}) is outdated! Please update to v${this.formatShortVersion(this.currentPluginVersion)}+ via GitHub Releases.`;
		}
		return `⚠️ Version mismatch detected! Please ensure Plugin and Extension versions match.`;
	}

	/**
	 * Generate handshake ACK payload
	 */
	public getHandshakeAckPayload(): HandshakeAckPayload {
		return {
			type: "handshake_ack",
			version: this.currentPluginVersion,
			compatible: true,
		};
	}

	/**
	 * Generate version mismatch payload
	 */
	public getVersionMismatchPayload(extVersion: string): VersionMismatchPayload {
		const comp = this.compareVersions(extVersion, this.currentPluginVersion);
		const requiredVersion = comp > 0 ? extVersion : this.currentPluginVersion;

		return {
			type: "version_mismatch",
			requiredPluginVersion: requiredVersion,
			currentPluginVersion: this.currentPluginVersion,
			extensionVersion: extVersion || "unknown",
			message: this.getWarningMessage(extVersion),
		};
	}

	/**
	 * Validate incoming handshake version and return corresponding response payload
	 */
	public validateHandshake(extVersion: string): {
		isCompatible: boolean;
		payload: HandshakeAckPayload | VersionMismatchPayload;
	} {
		const isCompatible = this.isExtensionCompatible(extVersion);
		return {
			isCompatible,
			payload: isCompatible ? this.getHandshakeAckPayload() : this.getVersionMismatchPayload(extVersion),
		};
	}
}
