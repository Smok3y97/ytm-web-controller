/**
 * Property Inspector for Stream Deck + Volume Dial Action
 */
const volumeStepInput = document.getElementById("volumeStep");
const volumeStepVal = document.getElementById("volumeStepVal");
const titleTemplateInput = document.getElementById("titleTemplate");
const showCoverCheckbox = document.getElementById("showCover");

function updateStepLabel() {
	if (volumeStepVal && volumeStepInput) {
		volumeStepVal.textContent = `${volumeStepInput.value}%`;
	}
}

StreamDeckClient.onLocalSettings((settings) => {
	if (volumeStepInput) volumeStepInput.value = settings.step || 5;
	updateStepLabel();
	if (titleTemplateInput) titleTemplateInput.value = settings.titleTemplate || "YouTube Music Volume";
	if (showCoverCheckbox) showCoverCheckbox.checked = settings.showCover !== false;
});

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
		showCover: showCoverCheckbox ? showCoverCheckbox.checked : true,
	});
}

StreamDeckClient.bindAutoSave([volumeStepInput, titleTemplateInput, showCoverCheckbox], saveSettings);
