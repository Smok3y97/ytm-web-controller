/**
 * Property Inspector for Play/Pause Action
 */
const showCoverCheckbox = document.getElementById("showCoverAsBackground");
const showTitleCheckbox = document.getElementById("showTitle");
const titleTemplateRow = document.getElementById("titleTemplateRow");
const titleTemplateInput = document.getElementById("titleTemplate");

function updateVisibility() {
	if (titleTemplateRow && showTitleCheckbox) {
		titleTemplateRow.style.display = showTitleCheckbox.checked ? "flex" : "none";
	}
}

const DEFAULT_TEMPLATE = "{artist}\n\n{song}\n\n{both}";

StreamDeckClient.onLocalSettings((settings) => {
	if (showCoverCheckbox) {
		showCoverCheckbox.checked = settings.showCoverAsBackground !== false;
	}
	if (showTitleCheckbox) {
		showTitleCheckbox.checked = !!settings.showTitle;
	}
	if (titleTemplateInput) {
		titleTemplateInput.value = settings.titleTemplate !== undefined ? settings.titleTemplate : DEFAULT_TEMPLATE;
	}
	updateVisibility();
});

function saveSettings() {
	StreamDeckClient.saveLocalSettings({
		showCoverAsBackground: showCoverCheckbox ? showCoverCheckbox.checked : true,
		showTitle: showTitleCheckbox ? showTitleCheckbox.checked : false,
		titleTemplate: titleTemplateInput ? titleTemplateInput.value : DEFAULT_TEMPLATE,
	});
}

StreamDeckClient.bindAutoSave([titleTemplateInput], saveSettings);

if (showCoverCheckbox) {
	showCoverCheckbox.addEventListener("change", saveSettings);
}
if (showTitleCheckbox) {
	showTitleCheckbox.addEventListener("change", () => {
		updateVisibility();
		saveSettings();
	});
}
