/**
 * Stream Deck Property Inspector WebSocket Client Bridge
 *
 * Provides a clean, event-driven API for Stream Deck Property Inspector communication.
 */

const StreamDeckClient = (function () {
	let websocket = null;
	let uuid = null;
	let actionInfo = {};
	let localSettings = {};
	let globalSettings = {};

	let appInfo = {};
	let language = "en";

	const localSettingsCallbacks = new Set();
	const globalSettingsCallbacks = new Set();

	function connect(inPort, inPropertyInspectorUUID, inRegisterEvent, inInfo, inActionInfo) {
		uuid = inPropertyInspectorUUID;
		try {
			appInfo = JSON.parse(inInfo);
			language = appInfo.application?.language || "en";
		} catch {
			appInfo = {};
			language = "en";
		}
		if (typeof I18n !== "undefined" && I18n.setLanguage) {
			I18n.setLanguage(language);
		}
		try {
			actionInfo = JSON.parse(inActionInfo);
		} catch {
			actionInfo = {};
		}
		localSettings = actionInfo.payload?.settings || {};

		websocket = new WebSocket(`ws://127.0.0.1:${inPort}`);

		websocket.onopen = () => {
			// Register Property Inspector with Stream Deck
			websocket.send(
				JSON.stringify({
					event: inRegisterEvent,
					uuid: inPropertyInspectorUUID,
				}),
			);

			// Request Global Settings (plugin-wide)
			websocket.send(
				JSON.stringify({
					event: "getGlobalSettings",
					context: uuid,
				}),
			);

			// Request Local Settings (action-instance)
			websocket.send(
				JSON.stringify({
					event: "getSettings",
					context: uuid,
				}),
			);

			// Notify any listeners registered prior to websocket open
			notifyLocalSettings(localSettings);
		};

		websocket.onmessage = (evt) => {
			let jsonObj;
			try {
				jsonObj = JSON.parse(evt.data);
			} catch {
				return;
			}

			const event = jsonObj.event;
			const payload = jsonObj.payload;

			if (event === "didReceiveSettings") {
				localSettings = payload.settings || {};
				notifyLocalSettings(localSettings);
			} else if (event === "didReceiveGlobalSettings") {
				globalSettings = payload.settings || {};
				if (typeof I18n !== "undefined" && I18n.setLanguage) {
					if (globalSettings.language && globalSettings.language !== "auto") {
						I18n.setLanguage(globalSettings.language);
					} else {
						I18n.setLanguage(language);
					}
				}
				notifyGlobalSettings(globalSettings);
			}
		};
	}

	function notifyLocalSettings(settings) {
		localSettingsCallbacks.forEach((cb) => {
			try {
				cb(settings);
			} catch (e) {
				console.error("Local settings callback error:", e);
			}
		});
	}

	function notifyGlobalSettings(settings) {
		globalSettingsCallbacks.forEach((cb) => {
			try {
				cb(settings);
			} catch (e) {
				console.error("Global settings callback error:", e);
			}
		});
	}

	function onLocalSettings(callback) {
		if (typeof callback === "function") {
			localSettingsCallbacks.add(callback);
			if (Object.keys(localSettings).length > 0) {
				callback(localSettings);
			}
		}
	}

	function onGlobalSettings(callback) {
		if (typeof callback === "function") {
			globalSettingsCallbacks.add(callback);
			if (Object.keys(globalSettings).length > 0) {
				callback(globalSettings);
			}
		}
	}

	function saveLocalSettings(newSettings) {
		if (!websocket || websocket.readyState !== WebSocket.OPEN) return;
		localSettings = Object.assign(localSettings, newSettings);

		websocket.send(
			JSON.stringify({
				event: "setSettings",
				context: uuid,
				payload: localSettings,
			}),
		);
	}

	function saveGlobalSettings(newGlobalSettings) {
		if (!websocket || websocket.readyState !== WebSocket.OPEN) return;
		globalSettings = Object.assign(globalSettings, newGlobalSettings);

		websocket.send(
			JSON.stringify({
				event: "setGlobalSettings",
				context: uuid,
				payload: globalSettings,
			}),
		);
	}

	function sendToPlugin(payload) {
		if (!websocket || websocket.readyState !== WebSocket.OPEN) return;
		websocket.send(
			JSON.stringify({
				event: "sendToPlugin",
				context: uuid,
				action: actionInfo.action,
				payload: payload,
			}),
		);
	}

	function bindAutoSave(elements, saveCallback) {
		if (!elements || typeof saveCallback !== "function") return;
		const list = Array.isArray(elements) ? elements : [elements];
		list.forEach((elem) => {
			if (!elem) return;
			if (elem.type === "checkbox" || elem.type === "radio" || elem.tagName === "SELECT") {
				elem.addEventListener("change", saveCallback);
			} else {
				elem.addEventListener("input", saveCallback);
				elem.addEventListener("change", saveCallback);
			}
		});
	}

	return {
		connect,
		onLocalSettings,
		onGlobalSettings,
		saveLocalSettings,
		saveGlobalSettings,
		sendToPlugin,
		bindAutoSave,
		getLocalSettings: () => localSettings,
		getGlobalSettings: () => globalSettings,
		getLanguage: () => language,
		getAppInfo: () => appInfo,
		getUUID: () => uuid,
		getActionInfo: () => actionInfo,
	};
})();

/**
 * Standard global hook called by Elgato Stream Deck software on Property Inspector load.
 */
function connectElgatoStreamDeckSocket(inPort, inPropertyInspectorUUID, inRegisterEvent, inInfo, inActionInfo) {
	StreamDeckClient.connect(inPort, inPropertyInspectorUUID, inRegisterEvent, inInfo, inActionInfo);
}
