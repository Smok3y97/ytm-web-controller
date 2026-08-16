/**
 * Property Inspector for Volume Key Actions
 */
const volumeStepInput = document.getElementById('volumeStep');
const showVolumeTitleCheckbox = document.getElementById('showVolumeTitle');
const titleTemplateRow = document.getElementById('titleTemplateRow');
const titleTemplateInput = document.getElementById('titleTemplate');

function updateVisibility() {
  if (titleTemplateRow && showVolumeTitleCheckbox) {
    titleTemplateRow.style.display = showVolumeTitleCheckbox.checked ? 'flex' : 'none';
  }
}

StreamDeckClient.onLocalSettings((settings) => {
  if (volumeStepInput) volumeStepInput.value = settings.step || 5;
  if (showVolumeTitleCheckbox) showVolumeTitleCheckbox.checked = settings.showVolumeTitle !== false;
  if (titleTemplateInput) titleTemplateInput.value = settings.titleTemplate || '{volume}%';
  updateVisibility();
});

function saveSettings() {
  let stepVal = parseInt(volumeStepInput.value, 10);
  if (isNaN(stepVal) || stepVal < 1) stepVal = 1;
  if (stepVal > 25) stepVal = 25;

  StreamDeckClient.saveLocalSettings({
    step: stepVal,
    showVolumeTitle: showVolumeTitleCheckbox ? showVolumeTitleCheckbox.checked : true,
    titleTemplate: titleTemplateInput ? titleTemplateInput.value : '{volume}%'
  });
}

if (volumeStepInput) {
  volumeStepInput.addEventListener('change', saveSettings);
  volumeStepInput.addEventListener('input', () => {
    const val = parseInt(volumeStepInput.value, 10);
    if (val >= 1 && val <= 25) saveSettings();
  });
}
if (showVolumeTitleCheckbox) {
  showVolumeTitleCheckbox.addEventListener('change', () => {
    updateVisibility();
    saveSettings();
  });
}
if (titleTemplateInput) {
  titleTemplateInput.addEventListener('input', saveSettings);
  titleTemplateInput.addEventListener('change', saveSettings);
}
