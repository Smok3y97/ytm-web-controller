/**
 * Property Inspector for Stream Deck + Track Dial Action
 */
const titleTemplateInput = document.getElementById("titleTemplate");
const timeTemplateInput = document.getElementById("timeTemplate");
const showCoverCheckbox = document.getElementById("showCover");

StreamDeckClient.onLocalSettings((settings) => {
	if (titleTemplateInput) titleTemplateInput.value = settings.titleTemplate || "{artist} - {title}";
	if (timeTemplateInput) timeTemplateInput.value = settings.timeTemplate || "{both}";
	if (showCoverCheckbox) showCoverCheckbox.checked = settings.showCover !== false;
});

function saveSettings() {
	StreamDeckClient.saveLocalSettings({
		titleTemplate: titleTemplateInput ? titleTemplateInput.value : "{artist} - {title}",
		timeTemplate: timeTemplateInput ? timeTemplateInput.value : "{both}",
		showCover: showCoverCheckbox ? showCoverCheckbox.checked : true,
	});
}

StreamDeckClient.bindAutoSave([titleTemplateInput, timeTemplateInput, showCoverCheckbox], saveSettings);
