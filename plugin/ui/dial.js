/**
 * Property Inspector for Stream Deck + Dial Action
 */
const titleTemplateInput = document.getElementById('titleTemplate');
const timeTemplateInput = document.getElementById('timeTemplate');
const showCoverCheckbox = document.getElementById('showCover');

StreamDeckClient.onLocalSettings((settings) => {
  if (titleTemplateInput) titleTemplateInput.value = settings.titleTemplate || '{artist} - {title}';
  if (timeTemplateInput) timeTemplateInput.value = settings.timeTemplate || '{remaining}';
  if (showCoverCheckbox) showCoverCheckbox.checked = settings.showCover !== false;
});

function saveSettings() {
  StreamDeckClient.saveLocalSettings({
    titleTemplate: titleTemplateInput ? titleTemplateInput.value : '{artist} - {title}',
    timeTemplate: timeTemplateInput ? timeTemplateInput.value : '{remaining}',
    showCover: showCoverCheckbox ? showCoverCheckbox.checked : true
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
