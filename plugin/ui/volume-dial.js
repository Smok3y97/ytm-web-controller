/**
 * Property Inspector for Stream Deck + Volume Dial Action
 */
const volumeStepInput = document.getElementById('volumeStep');
const titleTemplateInput = document.getElementById('titleTemplate');
const showCoverCheckbox = document.getElementById('showCover');

StreamDeckClient.onLocalSettings((settings) => {
  if (volumeStepInput) volumeStepInput.value = settings.step || 5;
  if (titleTemplateInput) titleTemplateInput.value = settings.titleTemplate || 'YouTube Music Volume';
  if (showCoverCheckbox) showCoverCheckbox.checked = settings.showCover !== false;
});

function saveSettings() {
  let stepVal = parseInt(volumeStepInput.value, 10);
  if (isNaN(stepVal) || stepVal < 1) stepVal = 1;
  if (stepVal > 25) stepVal = 25;

  StreamDeckClient.saveLocalSettings({
    step: stepVal,
    titleTemplate: titleTemplateInput ? titleTemplateInput.value : 'YouTube Music Volume',
    showCover: showCoverCheckbox ? showCoverCheckbox.checked : true
  });
}

if (volumeStepInput) {
  volumeStepInput.addEventListener('change', saveSettings);
  volumeStepInput.addEventListener('input', () => {
    const val = parseInt(volumeStepInput.value, 10);
    if (val >= 1 && val <= 25) saveSettings();
  });
}
if (titleTemplateInput) {
  titleTemplateInput.addEventListener('input', saveSettings);
  titleTemplateInput.addEventListener('change', saveSettings);
}
if (showCoverCheckbox) {
  showCoverCheckbox.addEventListener('change', saveSettings);
}
