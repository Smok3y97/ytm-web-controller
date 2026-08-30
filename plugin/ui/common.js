/**
 * Property Inspector for Generic/Common Action Keys
 * Dynamically renders action-specific descriptions based on the current Action UUID.
 */
(() => {
	function updateActionInfo() {
		const actionInfo = StreamDeckClient.getActionInfo();
		const actionUuid = actionInfo?.action;
		if (!actionUuid) return;

		const titleElem = document.getElementById("actionTitle");
		const descElem = document.getElementById("actionDescription");
		if (!titleElem || !descElem) return;

		const titleKey = `action.${actionUuid}.title`;
		const descKey = `action.${actionUuid}.description`;

		if (typeof I18n !== "undefined") {
			titleElem.textContent = I18n.t(titleKey, titleElem.textContent || "");
			descElem.textContent = I18n.t(descKey, descElem.textContent || "");
		}
	}

	// Register with StreamDeckClient
	StreamDeckClient.onLocalSettings(() => {
		updateActionInfo();
	});

	if (typeof I18n !== "undefined" && I18n.onLanguageChange) {
		I18n.onLanguageChange(() => {
			updateActionInfo();
		});
	}

	// Initial update
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", updateActionInfo);
	} else {
		updateActionInfo();
	}
})();
