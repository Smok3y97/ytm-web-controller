/**
 * Property Inspector for Stream Deck + Volume Dial Action
 */
const volumeStepInput = document.getElementById("volumeStep");
const volumeStepVal = document.getElementById("volumeStepVal");
const titleTemplateGroup = document.getElementById("titleTemplateGroup");
const titleTemplateInput = document.getElementById("titleTemplate");
const touchstripLayoutSelect = document.getElementById("touchstripLayout");

function updateStepLabel() {
	if (volumeStepVal && volumeStepInput) {
		volumeStepVal.textContent = `${volumeStepInput.value}%`;
	}
}

function updateLayoutVisibility() {
	if (titleTemplateGroup && touchstripLayoutSelect) {
		const isHeader = touchstripLayoutSelect.value === "header_collapsed";
		titleTemplateGroup.style.display = isHeader ? "" : "none";
	}
}

StreamDeckClient.onLocalSettings((settings) => {
	if (volumeStepInput) volumeStepInput.value = settings.step || 5;
	updateStepLabel();
	if (titleTemplateInput) titleTemplateInput.value = settings.titleTemplate || "YouTube Music Volume";
	if (touchstripLayoutSelect) touchstripLayoutSelect.value = settings.touchstripLayout || "compact";
	updateLayoutVisibility();
});

if (touchstripLayoutSelect) {
	touchstripLayoutSelect.addEventListener("change", updateLayoutVisibility);
}

if (volumeStepInput) {
	volumeStepInput.addEventListener("input", updateStepLabel);
}

function saveSettings() {
	let stepVal = parseInt(volumeStepInput.value, 10);
	if (isNaN(stepVal) || stepVal < 1) stepVal = 1;
	if (stepVal > 50) stepVal = 50;

	StreamDeckClient.saveLocalSettings({
		step: stepVal,
		titleTemplate: titleTemplateInput ? titleTemplateInput.value : "YouTube Music Volume",
		touchstripLayout: touchstripLayoutSelect ? touchstripLayoutSelect.value : "compact",
	});
}

StreamDeckClient.bindAutoSave([volumeStepInput, titleTemplateInput, touchstripLayoutSelect], saveSettings);
