/**
 * Property Inspector for Seek Key Actions (Fast Forward / Rewind)
 */
const seekStepInput = document.getElementById("seekStep");
const seekStepVal = document.getElementById("seekStepVal");
const showSeekTitleCheckbox = document.getElementById("showSeekTitle");
const titleTemplateRow = document.getElementById("titleTemplateRow");
const titleTemplateInput = document.getElementById("titleTemplate");

function updateVisibility() {
	if (titleTemplateRow && showSeekTitleCheckbox) {
		titleTemplateRow.style.display = showSeekTitleCheckbox.checked ? "flex" : "none";
	}
}

function updateStepLabel() {
	if (seekStepVal && seekStepInput) {
		seekStepVal.textContent = `${seekStepInput.value}s`;
	}
}

StreamDeckClient.onLocalSettings((settings) => {
	if (seekStepInput) seekStepInput.value = settings.step || 10;
	updateStepLabel();
	if (showSeekTitleCheckbox) showSeekTitleCheckbox.checked = settings.showSeekTitle !== false;
	if (titleTemplateInput) titleTemplateInput.value = settings.titleTemplate || "";
	updateVisibility();
});

if (seekStepInput) {
	seekStepInput.addEventListener("input", updateStepLabel);
}

function saveSettings() {
	let stepVal = parseInt(seekStepInput.value, 10);
	if (isNaN(stepVal) || stepVal < 1) stepVal = 1;
	if (stepVal > 120) stepVal = 120;

	StreamDeckClient.saveLocalSettings({
		step: stepVal,
		showSeekTitle: showSeekTitleCheckbox ? showSeekTitleCheckbox.checked : true,
		titleTemplate: titleTemplateInput ? titleTemplateInput.value : "",
	});
}

StreamDeckClient.bindAutoSave([seekStepInput, titleTemplateInput], saveSettings);
if (showSeekTitleCheckbox) {
	showSeekTitleCheckbox.addEventListener("change", () => {
		updateVisibility();
		saveSettings();
	});
}
