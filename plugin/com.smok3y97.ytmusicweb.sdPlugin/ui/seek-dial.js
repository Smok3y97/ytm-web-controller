/**
 * Property Inspector for Stream Deck + Seek Dial Action
 */
const seekStepInput = document.getElementById("seekStep");
const seekStepVal = document.getElementById("seekStepVal");
const titleTemplateGroup = document.getElementById("titleTemplateGroup");
const titleTemplateInput = document.getElementById("titleTemplate");
const timeTemplateInput = document.getElementById("timeTemplate");
const touchstripLayoutSelect = document.getElementById("touchstripLayout");

function updateStepLabel() {
	if (seekStepVal && seekStepInput) {
		seekStepVal.textContent = `${seekStepInput.value}s`;
	}
}

function updateLayoutVisibility() {
	if (titleTemplateGroup && touchstripLayoutSelect) {
		const isHeader = touchstripLayoutSelect.value === "header_collapsed";
		titleTemplateGroup.style.display = isHeader ? "" : "none";
	}
}

StreamDeckClient.onLocalSettings((settings) => {
	if (seekStepInput) seekStepInput.value = settings.seekStep || 10;
	updateStepLabel();
	if (titleTemplateInput) titleTemplateInput.value = settings.titleTemplate || "{artist} - {title}";
	if (timeTemplateInput) timeTemplateInput.value = settings.timeTemplate || "{both}";
	if (touchstripLayoutSelect) touchstripLayoutSelect.value = settings.touchstripLayout || "compact";
	updateLayoutVisibility();
});

if (touchstripLayoutSelect) {
	touchstripLayoutSelect.addEventListener("change", updateLayoutVisibility);
}

if (seekStepInput) {
	seekStepInput.addEventListener("input", updateStepLabel);
}

function saveSettings() {
	let stepVal = parseInt(seekStepInput.value, 10);
	if (isNaN(stepVal) || stepVal < 1) stepVal = 1;
	if (stepVal > 120) stepVal = 120;

	StreamDeckClient.saveLocalSettings({
		seekStep: stepVal,
		titleTemplate: titleTemplateInput ? titleTemplateInput.value : "{artist} - {title}",
		timeTemplate: timeTemplateInput ? timeTemplateInput.value : "{both}",
		touchstripLayout: touchstripLayoutSelect ? touchstripLayoutSelect.value : "compact",
	});
}

StreamDeckClient.bindAutoSave(
	[seekStepInput, titleTemplateInput, timeTemplateInput, touchstripLayoutSelect],
	saveSettings,
);
