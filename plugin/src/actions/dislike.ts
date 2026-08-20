/**
 * Dislike Action
 *
 * UUID: com.smok3y97.ytmusicweb.dislike
 * Dual-state: 0 = Inactive, 1 = Disliked
 */
import { action } from "@elgato/streamdeck";

import { YTMPlaybackState } from "../types/index.js";
import { BaseStateAction } from "./base-state-action.js";

@action({ UUID: "com.smok3y97.ytmusicweb.dislike" })
export class DislikeAction extends BaseStateAction {
	protected readonly command = "dislike";

	protected calculateState(state: YTMPlaybackState): number {
		return state.isDisliked ? 1 : 0;
	}
}
