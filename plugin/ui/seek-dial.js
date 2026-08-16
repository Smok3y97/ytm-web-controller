/**
 * Property Inspector for Stream Deck + Seek Dial Action
 */
const seekStepInput = document.getElementById('seekStep');
const titleTemplateInput = document.getElementById('titleTemplate');
const timeTemplateInput = document.getElementById('timeTemplate');
const showCoverCheckbox = document.getElementById('showCover');

StreamDeckClient.onLocalSettings((settings) => {
  if (seekStepInput) seekStepInput.value = settings.seekStep || 10;
  if (titleTemplateInput) titleTemplateInput.value = settings.titleTemplate || '{artist} - {title}';
  if (timeTemplateInput) timeTemplateInput.value = settings.timeTemplate || '{current} / {duration}';
  if (showCoverCheckbox) showCoverCheckbox.checked = settings.showCover !== false;
});

function saveSettings() {
  let stepVal = parseInt(seekStepInput.value, 10);
  if (isNaN(stepVal) || stepVal < 1) stepVal = 1;
  if (stepVal > 60) stepVal = 60;

  StreamDeckClient.saveLocalSettings({
    seekStep: stepVal,
    titleTemplate: titleTemplateInput ? titleTemplateInput.value : '{artist} - {title}',
    timeTemplate: timeTemplateInput ? timeTemplateInput.value : '{current} / {duration}',
    showCover: showCoverCheckbox ? showCoverCheckbox.checked : true
  });
}

if (seekStepInput) {
  seekStepInput.addEventListener('change', saveSettings);
  seekStepInput.addEventListener('input', () => {
    const val = parseInt(seekStepInput.value, 10);
    if (val >= 1 && val <= 60) saveSettings();
  });
}
if (titleTemplateInput) {
  titleTemplateInput.addEventListener('input', saveSettings);
  titleTemplateInput.addEventListener('change', saveSettings);
}
if (timeTemplateInput) {
  timeTemplateInput.addEventListener('input', saveSettings);
  timeTemplateInput.addEventListener('change', saveSettings);
}
if (showCoverCheckbox) {
  showCoverCheckbox.addEventListener('change', saveSettings);
}
