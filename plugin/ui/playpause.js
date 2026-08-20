/**
 * Property Inspector for Play/Pause Action
 */
const showCoverCheckbox = document.getElementById("showCoverAsBackground");

StreamDeckClient.onLocalSettings((settings) => {
	if (showCoverCheckbox) {
		showCoverCheckbox.checked = settings.showCoverAsBackground !== false;
	}
});

if (showCoverCheckbox) {
	showCoverCheckbox.addEventListener("change", () => {
		StreamDeckClient.saveLocalSettings({
			showCoverAsBackground: showCoverCheckbox.checked,
		});
	});
}
