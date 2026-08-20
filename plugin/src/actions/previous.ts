/**
 * Previous Track Action
 *
 * UUID: com.smok3y97.ytmusicweb.prev
 */
import { action } from "@elgato/streamdeck";

import { YTMPlaybackState } from "../types/index.js";
import { BaseStateAction } from "./base-state-action.js";

@action({ UUID: "com.smok3y97.ytmusicweb.prev" })
export class PreviousAction extends BaseStateAction {
	protected readonly command = "previous";
	protected override actionKey = "prev";

	protected calculateState(_state: YTMPlaybackState): number {
		return 0;
	}
}
