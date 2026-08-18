/**
 * Shared Global Settings Component for Property Inspector
 * 
 * Provides a clean, minimalist UI for general settings:
 * 1. General Settings (Direct Discord RPC Checkbox)
 * 2. OBS Overlay & Chatbot Endpoints + OBS Text Export (.txt)
 * 3. Advanced Settings (Discord Client ID & Server Port)
 */

/* global StreamDeckClient */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const GlobalSettingsComponent = (() => {
  let isRendered = false;

  function render() {
    const container = document.getElementById('global-settings-container');
    if (!container || isRendered) return;

    container.innerHTML = `
      <!-- Warning Banner for Version Mismatch -->
      <div id="versionMismatchBanner" class="sdpi-warning-box hidden"></div>

      <!-- General Settings (Directly Accessible) -->
      <div class="sdpi-heading">General Settings</div>
      <div class="sdpi-item">
        <label class="sdpi-checkbox-wrap">
          <input type="checkbox" id="enableDiscordRPC">
          <span>Enable Discord Rich Presence</span>
        </label>
      </div>
      <div class="sdpi-hint">
        Broadcasts active playback and album art to Discord Desktop in real-time.
      </div>

      <!-- Collapsible Accordion Groups -->
      <div class="sdpi-accordions-group">
        <!-- OBS Overlay & Chatbot Integrations -->
        <details class="sdpi-group">
          <summary class="sdpi-group-summary">
            <span class="sdpi-group-title">OBS Overlay & Chatbot</span>
          </summary>
          <div class="sdpi-group-content">
            <!-- OBS Browser Overlay URL -->
            <div class="sdpi-item">
              <div class="sdpi-item-label">OBS Overlay</div>
              <div class="sdpi-item-value" style="display: flex; gap: 4px;">
                <input type="text" id="obsOverlayUrl" readonly value="http://localhost:39865/overlay" style="cursor: pointer;">
                <button type="button" id="copyOverlayBtn" title="Copy Overlay URL" style="padding: 0 8px; cursor: pointer;">📋</button>
              </div>
            </div>
            <div class="sdpi-hint">
              Add as <strong>Browser Source</strong> in OBS. Parameters: <code>?theme=card|compact|pill</code>, <code>?accent=FF0033</code>, <code>?hideOnPause=true</code>.
            </div>

            <!-- Chatbot API URL -->
            <div class="sdpi-item">
              <div class="sdpi-item-label">Chatbot URL</div>
              <div class="sdpi-item-value" style="display: flex; gap: 4px;">
                <input type="text" id="chatbotApiUrl" readonly value="http://localhost:39865/api/current" style="cursor: pointer;">
                <button type="button" id="copyChatbotBtn" title="Copy Chatbot URL" style="padding: 0 8px; cursor: pointer;">📋</button>
              </div>
            </div>
            <div class="sdpi-hint">
              Use in local bots (Streamer.bot, MixItUp): <code>http://localhost:39865/api/current</code> for <code>!song</code>.
            </div>

            <div class="sdpi-heading" style="margin-top: 6px; margin-bottom: 2px;">OBS Text Export (.txt)</div>

            <!-- Enable OBS Text Export (Opt-in) -->
            <div class="sdpi-item">
              <label class="sdpi-checkbox-wrap">
                <input type="checkbox" id="enableObsExport">
                <span>Enable OBS text export (.txt)</span>
              </label>
            </div>
            <div class="sdpi-hint">
              Writes track metadata to a local file for OBS Text (GDI+) overlay sources (strictly opt-in).
            </div>

            <!-- File Path -->
            <div class="sdpi-item">
              <div class="sdpi-item-label">File Path</div>
              <div class="sdpi-item-value">
                <input type="text" id="obsFilePath" placeholder="Default (ytm_current_track.txt)">
              </div>
            </div>
            <div class="sdpi-hint">
              Custom file path (e.g. <code>C:\\Stream\\now_playing.txt</code>). Leave blank for default plugin path.
            </div>

            <!-- Format Template -->
            <div class="sdpi-item">
              <div class="sdpi-item-label">Format</div>
              <div class="sdpi-item-value">
                <input type="text" id="obsFormatTemplate" placeholder="Currently Playing: {artist} - {title}">
              </div>
            </div>
            <div class="sdpi-hint">
              Placeholders: <code>{artist}</code>, <code>{title}</code>, <code>{album}</code>.
            </div>

            <!-- Clear on Pause -->
            <div class="sdpi-item">
              <label class="sdpi-checkbox-wrap">
                <input type="checkbox" id="obsClearOnPause" checked>
                <span>Clear text file when paused</span>
              </label>
            </div>
          </div>
        </details>

        <!-- Advanced Connection Settings -->
        <details class="sdpi-group">
          <summary class="sdpi-group-summary">
            <span class="sdpi-group-title">Advanced Settings</span>
          </summary>
          <div class="sdpi-group-content">
            <!-- Discord Client ID -->
            <div class="sdpi-item">
              <div class="sdpi-item-label">Discord Client ID</div>
              <div class="sdpi-item-value">
                <input type="text" id="discordClientId" placeholder="Default (Embedded App ID)">
              </div>
            </div>
            <div class="sdpi-hint">
              Custom Discord Application ID. Leave blank to use the official default.
            </div>

            <!-- WebSocket / Server Port -->
            <div class="sdpi-item">
              <div class="sdpi-item-label">Server Port</div>
              <div class="sdpi-item-value">
                <input type="number" id="wsPort" placeholder="39865" min="1024" max="65535" value="39865">
              </div>
            </div>
            <div class="sdpi-hint">
              Unified WebSocket & HTTP port. Default: <code>39865</code>.
            </div>
          </div>
        </details>
      </div>
    `;

    isRendered = true;
    bindEvents();
  }

  function ensureWarningBanner() {
    return document.getElementById('versionMismatchBanner');
  }

  function updateDynamicUrls(port) {
    const validPort = port || 39865;
    const overlayInput = document.getElementById('obsOverlayUrl');
    const chatbotInput = document.getElementById('chatbotApiUrl');
    if (overlayInput) overlayInput.value = `http://localhost:${validPort}/overlay`;
    if (chatbotInput) chatbotInput.value = `http://localhost:${validPort}/api/current`;
  }

  function bindEvents() {
    const copyOverlayBtn = document.getElementById('copyOverlayBtn');
    const copyChatbotBtn = document.getElementById('copyChatbotBtn');
    const obsOverlayUrl = document.getElementById('obsOverlayUrl');
    const chatbotApiUrl = document.getElementById('chatbotApiUrl');

    const enableDiscordCheckbox = document.getElementById('enableDiscordRPC');
    const discordClientIdInput = document.getElementById('discordClientId');
    const wsPortInput = document.getElementById('wsPort');

    const enableObsExportCheckbox = document.getElementById('enableObsExport');
    const obsFilePathInput = document.getElementById('obsFilePath');
    const obsFormatTemplateInput = document.getElementById('obsFormatTemplate');
    const obsClearOnPauseCheckbox = document.getElementById('obsClearOnPause');

    if (copyOverlayBtn && obsOverlayUrl) {
      copyOverlayBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(obsOverlayUrl.value).then(() => {
          copyOverlayBtn.textContent = '✓';
          setTimeout(() => { copyOverlayBtn.textContent = '📋'; }, 2000);
        }).catch(() => { });
      });
    }

    if (copyChatbotBtn && chatbotApiUrl) {
      copyChatbotBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(chatbotApiUrl.value).then(() => {
          copyChatbotBtn.textContent = '✓';
          setTimeout(() => { copyChatbotBtn.textContent = '📋'; }, 2000);
        }).catch(() => { });
      });
    }

    if (enableDiscordCheckbox) enableDiscordCheckbox.addEventListener('change', save);
    if (discordClientIdInput) {
      discordClientIdInput.addEventListener('change', save);
      discordClientIdInput.addEventListener('blur', save);
    }
    if (wsPortInput) {
      wsPortInput.addEventListener('change', () => {
        const port = parseInt(wsPortInput.value, 10);
        if (port >= 1024 && port <= 65535) {
          updateDynamicUrls(port);
          save();
        }
      });
      wsPortInput.addEventListener('input', () => {
        const port = parseInt(wsPortInput.value, 10);
        if (port >= 1024 && port <= 65535) {
          updateDynamicUrls(port);
          save();
        }
      });
    }

    if (enableObsExportCheckbox) enableObsExportCheckbox.addEventListener('change', save);
    if (obsFilePathInput) {
      obsFilePathInput.addEventListener('change', save);
      obsFilePathInput.addEventListener('blur', save);
    }
    if (obsFormatTemplateInput) {
      obsFormatTemplateInput.addEventListener('change', save);
      obsFormatTemplateInput.addEventListener('blur', save);
    }
    if (obsClearOnPauseCheckbox) obsClearOnPauseCheckbox.addEventListener('change', save);

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
        const rawMsg = gs.warningMessage || '⚠️ Browser Extension outdated! Please update to the latest version via GitHub Releases.';
        warningBanner.innerHTML = `<span>${rawMsg}</span> <a href="https://github.com/Smok3y97/ytm-web-controller/releases" target="_blank">Releases</a>`;
        warningBanner.classList.remove('hidden');
      } else {
        warningBanner.classList.add('hidden');
      }
    }

    const enableDiscordCheckbox = document.getElementById('enableDiscordRPC');
    const discordClientIdInput = document.getElementById('discordClientId');
    const wsPortInput = document.getElementById('wsPort');

    const enableObsExportCheckbox = document.getElementById('enableObsExport');
    const obsFilePathInput = document.getElementById('obsFilePath');
    const obsFormatTemplateInput = document.getElementById('obsFormatTemplate');
    const obsClearOnPauseCheckbox = document.getElementById('obsClearOnPause');

    const port = gs?.wsPort || 39865;
    if (wsPortInput) wsPortInput.value = port;
    updateDynamicUrls(port);

    if (enableDiscordCheckbox) enableDiscordCheckbox.checked = !!gs?.enableDiscordRPC;
    if (discordClientIdInput) discordClientIdInput.value = gs?.discordClientId || '';

    if (enableObsExportCheckbox) enableObsExportCheckbox.checked = !!gs?.enableObsExport;
    if (obsFilePathInput) obsFilePathInput.value = gs?.obsFilePath || '';
    if (obsFormatTemplateInput) obsFormatTemplateInput.value = gs?.obsFormatTemplate || '';
    if (obsClearOnPauseCheckbox) obsClearOnPauseCheckbox.checked = gs?.obsClearOnPause !== false;
  }

  function save() {
    const enableDiscordCheckbox = document.getElementById('enableDiscordRPC');
    const discordClientIdInput = document.getElementById('discordClientId');
    const wsPortInput = document.getElementById('wsPort');

    const enableObsExportCheckbox = document.getElementById('enableObsExport');
    const obsFilePathInput = document.getElementById('obsFilePath');
    const obsFormatTemplateInput = document.getElementById('obsFormatTemplate');
    const obsClearOnPauseCheckbox = document.getElementById('obsClearOnPause');

    const port = wsPortInput ? (parseInt(wsPortInput.value, 10) || 39865) : 39865;

    StreamDeckClient.saveGlobalSettings({
      enableDiscordRPC: enableDiscordCheckbox ? enableDiscordCheckbox.checked : false,
      discordClientId: discordClientIdInput ? (discordClientIdInput.value.trim() || undefined) : undefined,
      wsPort: port,
      enableObsExport: enableObsExportCheckbox ? enableObsExportCheckbox.checked : false,
      obsFilePath: obsFilePathInput ? (obsFilePathInput.value.trim() || undefined) : undefined,
      obsFormatTemplate: obsFormatTemplateInput ? (obsFormatTemplateInput.value.trim() || undefined) : undefined,
      obsClearOnPause: obsClearOnPauseCheckbox ? obsClearOnPauseCheckbox.checked : true
    });
  }

  // Auto-render when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }

  return {
    render,
    populate,
    save
  };
})();
