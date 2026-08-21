/**
 * Rewind Keypad Action
 *
 * UUID: com.smok3y97.ytmusicweb.seekbackward
 * Features:
 * - Seeks backward by configured seconds (5s - 120s, default: 10s)
 * - Displays live step (-10s) on key title for instant visual feedback
 */
import { action } from "@elgato/streamdeck";

import { BaseSeekAction } from "./base-seek-action.js";

@action({ UUID: "com.smok3y97.ytmusicweb.seekbackward" })
export class SeekBackwardAction extends BaseSeekAction {
	protected readonly direction = "backward" as const;
	protected readonly actionKey = "seekbackward" as const;
}
