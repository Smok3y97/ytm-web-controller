/**
 * Property Inspector for Stream Deck + Track Dial Action
 */
const titleTemplateGroup = document.getElementById("titleTemplateGroup");
const titleTemplateInput = document.getElementById("titleTemplate");
const timeTemplateInput = document.getElementById("timeTemplate");
const touchstripLayoutSelect = document.getElementById("touchstripLayout");

function updateLayoutVisibility() {
	if (titleTemplateGroup && touchstripLayoutSelect) {
		const isHeader = touchstripLayoutSelect.value === "header_collapsed";
		titleTemplateGroup.style.display = isHeader ? "" : "none";
	}
}

StreamDeckClient.onLocalSettings((settings) => {
	if (titleTemplateInput) titleTemplateInput.value = settings.titleTemplate || "{artist} - {title}";
	if (timeTemplateInput) timeTemplateInput.value = settings.timeTemplate || "{both}";
	if (touchstripLayoutSelect) touchstripLayoutSelect.value = settings.touchstripLayout || "compact";
	updateLayoutVisibility();
});

if (touchstripLayoutSelect) {
	touchstripLayoutSelect.addEventListener("change", updateLayoutVisibility);
}

function saveSettings() {
	StreamDeckClient.saveLocalSettings({
		titleTemplate: titleTemplateInput ? titleTemplateInput.value : "{artist} - {title}",
		timeTemplate: timeTemplateInput ? timeTemplateInput.value : "{both}",
		touchstripLayout: touchstripLayoutSelect ? touchstripLayoutSelect.value : "compact",
	});
}

StreamDeckClient.bindAutoSave([titleTemplateInput, timeTemplateInput, touchstripLayoutSelect], saveSettings);
