/**
 * Property Inspector for Copy Song URL Action
 */
const copyFormatInput = document.getElementById('copyFormatTemplate');

StreamDeckClient.onLocalSettings((settings) => {
  if (copyFormatInput) {
    copyFormatInput.value = settings.copyFormatTemplate || '{url}';
  }
});

function saveLocal() {
  if (copyFormatInput) {
    StreamDeckClient.saveLocalSettings({
      copyFormatTemplate: copyFormatInput.value.trim() || '{url}'
    });
  }
}

if (copyFormatInput) {
  copyFormatInput.addEventListener('input', saveLocal);
  copyFormatInput.addEventListener('change', saveLocal);
}
