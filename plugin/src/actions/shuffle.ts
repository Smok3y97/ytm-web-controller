/**
 * Shuffle Action
 *
 * UUID: com.smok3y97.ytmusicweb.shuffle
 * Dual-state: 0 = Inactive, 1 = Active
 */
import { action } from "@elgato/streamdeck";

import { YTMPlaybackState } from "../types/index.js";
import { BaseStateAction } from "./base-state-action.js";

@action({ UUID: "com.smok3y97.ytmusicweb.shuffle" })
export class ShuffleAction extends BaseStateAction {
	protected readonly command = "shuffle";

	protected calculateState(state: YTMPlaybackState): number {
		return state.shuffleActive ? 1 : 0;
	}
}
