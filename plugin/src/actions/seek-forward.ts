/**
 * Fast Forward Keypad Action
 *
 * UUID: com.smok3y97.ytmusicweb.seekforward
 * Features:
 * - Seeks forward by configured seconds (5s - 120s, default: 10s)
 * - Displays live step (+10s) on key title for instant visual feedback
 */
import { action } from "@elgato/streamdeck";

import { BaseSeekAction } from "./base-seek-action.js";

@action({ UUID: "com.smok3y97.ytmusicweb.seekforward" })
export class SeekForwardAction extends BaseSeekAction {
	protected readonly direction = "forward" as const;
	protected readonly actionKey = "seekforward" as const;
}
