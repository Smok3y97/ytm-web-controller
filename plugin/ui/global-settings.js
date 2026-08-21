/**
 * Shared Global Settings Component for Property Inspector
 *
 * Provides a clean, minimalist UI for general settings:
 * 1. General Settings (Direct Discord RPC Checkbox)
 * 2. OBS Overlay & Chatbot Endpoints + OBS Text Export (.txt)
 * 3. Advanced Settings (Discord Client ID & Server Port)
 */

const GlobalSettingsComponent = (() => {
	let isRendered = false;

	function render() {
		const container = document.getElementById("global-settings-container");
		if (!container || isRendered) return;

		container.innerHTML = `
      <!-- Warning Banner for Version Mismatch -->
      <div id="versionMismatchBanner" class="sdpi-warning-box hidden"></div>

      <!-- General Settings (Directly Accessible) -->
      <div class="sdpi-heading" data-i18n="general.heading">General Settings</div>
      <div class="sdpi-item">
        <label class="sdpi-checkbox-wrap">
          <input type="checkbox" id="enableDiscordRPC">
          <span data-i18n="discord.rpc.label">Enable Discord Rich Presence</span>
        </label>
      </div>
      <div class="sdpi-hint" data-i18n="discord.rpc.hint">
        Broadcasts active playback and album art to Discord Desktop in real-time.
      </div>

      <!-- Collapsible Accordion Groups -->
      <div class="sdpi-accordions-group">
        <!-- OBS Overlay & Chatbot Integrations -->
        <details class="sdpi-group">
          <summary class="sdpi-group-summary">
            <span class="sdpi-group-title" data-i18n="obs.group.title">OBS Overlay & Chatbot</span>
          </summary>
          <div class="sdpi-group-content">
            <!-- OBS Browser Overlay URL -->
            <div class="sdpi-item">
              <div class="sdpi-item-label" data-i18n="obs.overlay.label">OBS Overlay</div>
              <div class="sdpi-item-value" style="display: flex; gap: 4px;">
                <input type="text" id="obsOverlayUrl" readonly value="http://localhost:39865/overlay" style="cursor: pointer;">
                <button type="button" id="copyOverlayBtn" title="Copy Overlay URL" style="padding: 0 8px; cursor: pointer;">📋</button>
              </div>
            </div>
            <div class="sdpi-hint" data-i18n="obs.overlay.hint">
              Add as <strong>Browser Source</strong> in OBS. Parameters: <code>?theme=card|compact|pill</code>, <code>?accent=FF0033</code>, <code>?hideOnPause=true</code>.
            </div>

            <!-- Chatbot API URL -->
            <div class="sdpi-item">
              <div class="sdpi-item-label" data-i18n="chatbot.url.label">Chatbot URL</div>
              <div class="sdpi-item-value" style="display: flex; gap: 4px;">
                <input type="text" id="chatbotApiUrl" readonly value="http://localhost:39865/api/current" style="cursor: pointer;">
                <button type="button" id="copyChatbotBtn" title="Copy Chatbot URL" style="padding: 0 8px; cursor: pointer;">📋</button>
              </div>
            </div>
            <div class="sdpi-hint" data-i18n="chatbot.url.hint">
              Use in local bots (Streamer.bot, MixItUp): <code>http://localhost:39865/api/current</code> for <code>!song</code>.
            </div>

            <div class="sdpi-heading" style="margin-top: 6px; margin-bottom: 2px;" data-i18n="obs.export.heading">OBS Text Export (.txt)</div>

            <!-- Enable OBS Text Export (Opt-in) -->
            <div class="sdpi-item">
              <label class="sdpi-checkbox-wrap">
                <input type="checkbox" id="enableObsExport">
                <span data-i18n="obs.export.label">Enable OBS text export (.txt)</span>
              </label>
            </div>
            <div class="sdpi-hint" data-i18n="obs.export.hint">
              Writes track metadata to a local text file for OBS Text (GDI+) overlay sources.
            </div>

            <!-- File Path Selector -->
            <div class="sdpi-item" id="obsFilePathRow">
              <div class="sdpi-item-label"><span data-i18n="obs.file.label">Text File</span> <span style="color: #ff3333;">*</span></div>
              <div class="sdpi-item-value sdpi-file-wrap">
                <input type="text" id="obsFilePath" placeholder="No file selected..." data-i18n-placeholder="no_file_selected" readonly style="cursor: pointer;">
                <input type="file" id="obsFilePicker" accept=".txt,text/plain" style="display: none;">
                <button type="button" id="obsBrowseBtn" class="sdpi-file-btn" title="Choose .txt file" data-i18n="browse">Browse...</button>
                <button type="button" id="obsClearFileBtn" class="sdpi-file-btn sdpi-file-clear-btn" title="Clear selected file" style="display: none;">✕</button>
              </div>
            </div>
            <div id="obsFileRequiredError" class="sdpi-hint" style="color: #ff5555; display: none;" data-i18n="obs.file.required">
              ⚠️ File selection is required when OBS Text Export is enabled.
            </div>
            <div class="sdpi-hint" id="obsFilePathHint" data-i18n="obs.file.hint">
              Select an existing or newly created <code>.txt</code> file on your computer.
            </div>

            <!-- Format Template -->
            <div class="sdpi-item">
              <div class="sdpi-item-label" data-i18n="obs.format.label">Format</div>
              <div class="sdpi-item-value">
                <input type="text" id="obsFormatTemplate" placeholder="Currently Playing: {artist} - {title}" data-i18n-placeholder="obs.format.placeholder">
              </div>
            </div>
            <div class="sdpi-hint" data-i18n="obs.format.hint">
              Placeholders: <code>{artist}</code>, <code>{title}</code>, <code>{album}</code>.
            </div>

            <!-- Clear on Pause -->
            <div class="sdpi-item">
              <label class="sdpi-checkbox-wrap">
                <input type="checkbox" id="obsClearOnPause" checked>
                <span data-i18n="obs.clear_on_pause.label">Clear text file when paused</span>
              </label>
            </div>
          </div>
        </details>

        <!-- Advanced Connection Settings -->
        <details class="sdpi-group">
          <summary class="sdpi-group-summary">
            <span class="sdpi-group-title" data-i18n="advanced.group.title">Advanced Settings</span>
          </summary>
            <!-- Language Selection -->
            <div class="sdpi-item">
              <div class="sdpi-item-label" data-i18n="language.label">Language</div>
              <div class="sdpi-item-value">
                <select id="languageSelect">
                  <option value="auto" data-i18n="language.auto">Auto (System / Stream Deck)</option>
                  <option value="en" data-i18n="language.en">English</option>
                  <option value="de" data-i18n="language.de">Deutsch</option>
                </select>
              </div>
            </div>
            <div class="sdpi-hint" data-i18n="language.hint">
              Override the Property Inspector display language or use the Stream Deck system language.
            </div>

            <!-- Discord Client ID -->
            <div class="sdpi-item">
              <div class="sdpi-item-label" data-i18n="discord.client_id.label">Discord Client ID</div>
              <div class="sdpi-item-value">
                <input type="text" id="discordClientId" placeholder="Default (Embedded App ID)" data-i18n-placeholder="discord.client_id.placeholder">
              </div>
            </div>
            <div class="sdpi-hint" data-i18n="discord.client_id.hint">
              Custom Discord Application ID. Leave blank to use the official default.
            </div>

            <!-- WebSocket / Server Port -->
            <div class="sdpi-item">
              <div class="sdpi-item-label" data-i18n="server.port.label">Server Port</div>
              <div class="sdpi-item-value">
                <input type="number" id="wsPort" placeholder="39865" min="1024" max="65535" value="39865">
              </div>
            </div>
            <div class="sdpi-hint" data-i18n="server.port.hint">
              Unified WebSocket & HTTP port. Default: <code>39865</code>.
            </div>
          </div>
        </details>
      </div>
    `;

		isRendered = true;
		if (typeof I18n !== "undefined") {
			I18n.translateDOM(container);
		}
		bindEvents();
	}

	function ensureWarningBanner() {
		return document.getElementById("versionMismatchBanner");
	}

	function updateDynamicUrls(port) {
		const validPort = port || 39865;
		const overlayInput = document.getElementById("obsOverlayUrl");
		const chatbotInput = document.getElementById("chatbotApiUrl");
		if (overlayInput) overlayInput.value = `http://localhost:${validPort}/overlay`;
		if (chatbotInput) chatbotInput.value = `http://localhost:${validPort}/api/current`;
	}

	function bindEvents() {
		const copyOverlayBtn = document.getElementById("copyOverlayBtn");
		const copyChatbotBtn = document.getElementById("copyChatbotBtn");
		const obsOverlayUrl = document.getElementById("obsOverlayUrl");
		const chatbotApiUrl = document.getElementById("chatbotApiUrl");

		const enableDiscordCheckbox = document.getElementById("enableDiscordRPC");
		const discordClientIdInput = document.getElementById("discordClientId");
		const wsPortInput = document.getElementById("wsPort");

		const enableObsExportCheckbox = document.getElementById("enableObsExport");
		const obsFilePathInput = document.getElementById("obsFilePath");
		const obsFilePicker = document.getElementById("obsFilePicker");
		const obsBrowseBtn = document.getElementById("obsBrowseBtn");
		const obsClearFileBtn = document.getElementById("obsClearFileBtn");
		const obsFormatTemplateInput = document.getElementById("obsFormatTemplate");
		const obsClearOnPauseCheckbox = document.getElementById("obsClearOnPause");

		function updateFileUI() {
			const isEnabled = enableObsExportCheckbox ? enableObsExportCheckbox.checked : false;
			const pathVal = obsFilePathInput ? obsFilePathInput.value.trim() : "";
			const errorElem = document.getElementById("obsFileRequiredError");

			if (obsClearFileBtn) {
				obsClearFileBtn.style.display = pathVal ? "block" : "none";
			}

			if (isEnabled && !pathVal) {
				if (obsFilePathInput) obsFilePathInput.classList.add("invalid");
				if (errorElem) errorElem.style.display = "block";
			} else {
				if (obsFilePathInput) obsFilePathInput.classList.remove("invalid");
				if (errorElem) errorElem.style.display = "none";
			}
		}

		if (copyOverlayBtn && obsOverlayUrl) {
			copyOverlayBtn.addEventListener("click", () => {
				navigator.clipboard
					.writeText(obsOverlayUrl.value)
					.then(() => {
						copyOverlayBtn.textContent = "✓";
						setTimeout(() => {
							copyOverlayBtn.textContent = "📋";
						}, 2000);
					})
					.catch(() => {});
			});
		}

		if (copyChatbotBtn && chatbotApiUrl) {
			copyChatbotBtn.addEventListener("click", () => {
				navigator.clipboard
					.writeText(chatbotApiUrl.value)
					.then(() => {
						copyChatbotBtn.textContent = "✓";
						setTimeout(() => {
							copyChatbotBtn.textContent = "📋";
						}, 2000);
					})
					.catch(() => {});
			});
		}

		const languageSelect = document.getElementById("languageSelect");
		if (languageSelect) {
			languageSelect.addEventListener("change", () => {
				const selectedLang = languageSelect.value;
				if (typeof I18n !== "undefined" && I18n.setLanguage) {
					if (selectedLang && selectedLang !== "auto") {
						I18n.setLanguage(selectedLang);
					} else {
						I18n.setLanguage(StreamDeckClient.getLanguage() || "en");
					}
				}
				save();
			});
		}

		if (enableDiscordCheckbox) enableDiscordCheckbox.addEventListener("change", save);
		if (discordClientIdInput) {
			discordClientIdInput.addEventListener("change", save);
			discordClientIdInput.addEventListener("blur", save);
		}
		if (wsPortInput) {
			wsPortInput.addEventListener("change", () => {
				const port = parseInt(wsPortInput.value, 10);
				if (port >= 1024 && port <= 65535) {
					updateDynamicUrls(port);
					save();
				}
			});
			wsPortInput.addEventListener("input", () => {
				const port = parseInt(wsPortInput.value, 10);
				if (port >= 1024 && port <= 65535) {
					updateDynamicUrls(port);
					save();
				}
			});
		}

		if (obsBrowseBtn && obsFilePicker) {
			obsBrowseBtn.addEventListener("click", () => {
				obsFilePicker.click();
			});
		}

		if (obsFilePathInput && obsFilePicker) {
			obsFilePathInput.addEventListener("click", () => {
				obsFilePicker.click();
			});
		}

		if (obsFilePicker) {
			obsFilePicker.addEventListener("change", (e) => {
				const file = e.target.files && e.target.files[0];
				if (file) {
					const path = file.path || file.name;
					if (obsFilePathInput) {
						obsFilePathInput.value = path;
					}
					updateFileUI();
					save();
				}
			});
		}

		if (obsClearFileBtn) {
			obsClearFileBtn.addEventListener("click", () => {
				if (obsFilePathInput) {
					obsFilePathInput.value = "";
				}
				if (obsFilePicker) {
					obsFilePicker.value = "";
				}
				updateFileUI();
				save();
			});
		}

		if (enableObsExportCheckbox) {
			enableObsExportCheckbox.addEventListener("change", () => {
				updateFileUI();
				save();
			});
		}

		if (obsFilePathInput) {
			obsFilePathInput.addEventListener("input", () => {
				updateFileUI();
				save();
			});
			obsFilePathInput.addEventListener("change", () => {
				updateFileUI();
				save();
			});
		}
		if (obsFormatTemplateInput) {
			obsFormatTemplateInput.addEventListener("change", save);
			obsFormatTemplateInput.addEventListener("blur", save);
		}
		if (obsClearOnPauseCheckbox) obsClearOnPauseCheckbox.addEventListener("change", save);

		// Register with StreamDeckClient for updates
		StreamDeckClient.onGlobalSettings((gs) => {
			populate(gs);
		});
	}

	function populate(gs) {
		render();

		const warningBanner = ensureWarningBanner();
		if (warningBanner) {
			if (gs && gs.isVersionMismatch) {
				const rawMsg =
					gs.warningMessage ||
					(typeof I18n !== "undefined"
						? I18n.t("warning.outdated_extension")
						: "⚠️ Browser Extension outdated! Please update to the latest version via GitHub Releases.");
				const releaseText = typeof I18n !== "undefined" ? I18n.t("releases") : "Releases";
				warningBanner.innerHTML = `<span>${rawMsg}</span> <a href="https://github.com/Smok3y97/ytm-web-controller/releases" target="_blank">${releaseText}</a>`;
				warningBanner.classList.remove("hidden");
			} else {
				warningBanner.classList.add("hidden");
			}
		}

		const languageSelect = document.getElementById("languageSelect");
		if (languageSelect) {
			languageSelect.value = gs?.language || "auto";
		}

		const enableDiscordCheckbox = document.getElementById("enableDiscordRPC");
		const discordClientIdInput = document.getElementById("discordClientId");
		const wsPortInput = document.getElementById("wsPort");

		const enableObsExportCheckbox = document.getElementById("enableObsExport");
		const obsFilePathInput = document.getElementById("obsFilePath");
		const obsFormatTemplateInput = document.getElementById("obsFormatTemplate");
		const obsClearOnPauseCheckbox = document.getElementById("obsClearOnPause");
		const obsClearFileBtn = document.getElementById("obsClearFileBtn");
		const errorElem = document.getElementById("obsFileRequiredError");

		const port = gs?.wsPort || 39865;
		if (wsPortInput) wsPortInput.value = port;
		updateDynamicUrls(port);

		if (enableDiscordCheckbox) enableDiscordCheckbox.checked = !!gs?.enableDiscordRPC;
		if (discordClientIdInput) discordClientIdInput.value = gs?.discordClientId || "";

		const isObsExport = !!gs?.enableObsExport;
		const pathVal = gs?.obsFilePath || "";

		if (enableObsExportCheckbox) enableObsExportCheckbox.checked = isObsExport;
		if (obsFilePathInput) obsFilePathInput.value = pathVal;
		if (obsFormatTemplateInput) obsFormatTemplateInput.value = gs?.obsFormatTemplate || "";
		if (obsClearOnPauseCheckbox) obsClearOnPauseCheckbox.checked = gs?.obsClearOnPause !== false;

		if (obsClearFileBtn) obsClearFileBtn.style.display = pathVal ? "block" : "none";
		if (isObsExport && !pathVal) {
			if (obsFilePathInput) obsFilePathInput.classList.add("invalid");
			if (errorElem) errorElem.style.display = "block";
		} else {
			if (obsFilePathInput) obsFilePathInput.classList.remove("invalid");
			if (errorElem) errorElem.style.display = "none";
		}
	}

	function save() {
		const languageSelect = document.getElementById("languageSelect");
		const enableDiscordCheckbox = document.getElementById("enableDiscordRPC");
		const discordClientIdInput = document.getElementById("discordClientId");
		const wsPortInput = document.getElementById("wsPort");

		const enableObsExportCheckbox = document.getElementById("enableObsExport");
		const obsFilePathInput = document.getElementById("obsFilePath");
		const obsFormatTemplateInput = document.getElementById("obsFormatTemplate");
		const obsClearOnPauseCheckbox = document.getElementById("obsClearOnPause");

		const port = wsPortInput ? parseInt(wsPortInput.value, 10) || 39865 : 39865;

		StreamDeckClient.saveGlobalSettings({
			language: languageSelect ? languageSelect.value : "auto",
			enableDiscordRPC: enableDiscordCheckbox ? enableDiscordCheckbox.checked : false,
			discordClientId: discordClientIdInput ? discordClientIdInput.value.trim() || undefined : undefined,
			wsPort: port,
			enableObsExport: enableObsExportCheckbox ? enableObsExportCheckbox.checked : false,
			obsFilePath: obsFilePathInput ? obsFilePathInput.value.trim() || undefined : undefined,
			obsFormatTemplate: obsFormatTemplateInput ? obsFormatTemplateInput.value.trim() || undefined : undefined,
			obsClearOnPause: obsClearOnPauseCheckbox ? obsClearOnPauseCheckbox.checked : true,
		});
	}

	// Auto-render when DOM is ready
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", render);
	} else {
		render();
	}

	if (typeof I18n !== "undefined" && I18n.onLanguageChange) {
		I18n.onLanguageChange(() => {
			if (isRendered) {
				const container = document.getElementById("global-settings-container");
				if (container) {
					I18n.translateDOM(container);
				}
			}
		});
	}

	return {
		render,
		populate,
		save,
	};
})();
