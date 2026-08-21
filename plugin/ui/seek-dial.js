/**
 * Property Inspector for Stream Deck + Seek Dial Action
 */
const seekStepInput = document.getElementById("seekStep");
const seekStepVal = document.getElementById("seekStepVal");
const titleTemplateInput = document.getElementById("titleTemplate");
const timeTemplateInput = document.getElementById("timeTemplate");
const showCoverCheckbox = document.getElementById("showCover");

function updateStepLabel() {
	if (seekStepVal && seekStepInput) {
		seekStepVal.textContent = `${seekStepInput.value}s`;
	}
}

StreamDeckClient.onLocalSettings((settings) => {
	if (seekStepInput) seekStepInput.value = settings.seekStep || 10;
	updateStepLabel();
	if (titleTemplateInput) titleTemplateInput.value = settings.titleTemplate || "{artist} - {title}";
	if (timeTemplateInput) timeTemplateInput.value = settings.timeTemplate || "{both}";
	if (showCoverCheckbox) showCoverCheckbox.checked = settings.showCover !== false;
});

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
		showCover: showCoverCheckbox ? showCoverCheckbox.checked : true,
	});
}

StreamDeckClient.bindAutoSave([seekStepInput, titleTemplateInput, timeTemplateInput, showCoverCheckbox], saveSettings);
