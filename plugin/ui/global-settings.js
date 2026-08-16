/**
 * Global Settings Component for Stream Deck Property Inspector
 * 
 * Renders and manages Discord RPC, Streamer Settings (OBS Export), Connection settings,
 * and Version Mismatch notification banners dynamically without hardcoding.
 */

const GlobalSettingsComponent = (function () {
  const TEMPLATE = `
    <div class="sdpi-heading">Plugin Integrations & Global Settings</div>

    <!-- Discord Rich Presence (Direct Checkbox at top) -->
    <div class="sdpi-item">
      <label class="sdpi-checkbox-wrap">
        <input type="checkbox" id="enableDiscordRPC">
        <span>Enable Discord Rich Presence (RPC)</span>
      </label>
    </div>
    <div class="sdpi-hint">
      Displays current track live in your Discord profile with animated progress and clickable links (Default: Off).
    </div>

    <div class="sdpi-accordions-group">
      <!-- Streamer Settings (Collapsible Accordion) -->
      <details class="sdpi-group">
        <summary class="sdpi-group-summary">
          <span class="sdpi-group-title">Streamer Settings</span>
        </summary>
        <div class="sdpi-group-content">
          <div class="sdpi-item">
            <label class="sdpi-checkbox-wrap">
              <input type="checkbox" id="enableObsExport">
              <span>Enable OBS text export (.txt)</span>
            </label>
          </div>
          <div class="sdpi-hint">
            Writes live track information to a text file for OBS Studio overlays ("Text (GDI+)" ➔ "Read from file").
          </div>

          <div class="sdpi-item">
            <div class="sdpi-item-label">File Path (.txt)</div>
            <div class="sdpi-item-value">
              <input type="text" id="obsFilePath" placeholder="C:\\Users\\...\\ytm_current_track.txt">
            </div>
          </div>
          <div class="sdpi-hint">
            Absolute path to destination file (directory created automatically).
          </div>

          <div class="sdpi-item">
            <div class="sdpi-item-label">Format Template</div>
            <div class="sdpi-item-value">
              <input type="text" id="obsFormatTemplate" placeholder="Currently Playing: {artist} - {title}" value="Currently Playing: {artist} - {title}">
            </div>
          </div>
          <div class="sdpi-hint">
            Placeholders: {artist}, {title}, {album}
          </div>

          <div class="sdpi-item">
            <label class="sdpi-checkbox-wrap">
              <input type="checkbox" id="obsClearOnPause" checked>
              <span>Clear file on pause/stop</span>
            </label>
          </div>
          <div class="sdpi-hint">
            When enabled, the text file is emptied whenever playback is paused or stopped.
          </div>
        </div>
      </details>

      <!-- Advanced / Connection Settings -->
      <details class="sdpi-group">
        <summary class="sdpi-group-summary">
          <span class="sdpi-group-title">Advanced / Connection Settings</span>
        </summary>
        <div class="sdpi-group-content">
          <div class="sdpi-item">
            <div class="sdpi-item-label">WebSocket Port</div>
            <div class="sdpi-item-value">
              <input type="number" id="wsPort" min="1024" max="65535" value="39865" placeholder="39865">
            </div>
          </div>
          <div class="sdpi-hint">
            Local WebSocket server port (Default: 39865). Must match browser extension.
          </div>

          <div class="sdpi-item">
            <div class="sdpi-item-label">Discord Client ID</div>
            <div class="sdpi-item-value">
              <input type="text" id="discordClientId" placeholder="1537908230209019954">
            </div>
          </div>
          <div class="sdpi-hint">
            Optional: Custom Discord Application ID (Default: 1537908230209019954).
          </div>
        </div>
      </details>
    </div>
  `;

  let isRendered = false;

  function ensureWarningBanner() {
    let warningBanner = document.getElementById('version-warning-banner');
    const wrapper = document.querySelector('.sdpi-wrapper') || document.body;
    if (!warningBanner) {
      warningBanner = document.createElement('div');
      warningBanner.id = 'version-warning-banner';
      warningBanner.className = 'sdpi-warning-box hidden';
      wrapper.insertBefore(warningBanner, wrapper.firstChild);
    } else if (wrapper.firstChild !== warningBanner) {
      wrapper.insertBefore(warningBanner, wrapper.firstChild);
    }
    return warningBanner;
  }

  function render() {
    ensureWarningBanner();
    if (isRendered) return;
    const container = document.getElementById('global-settings-container');
    if (container) {
      container.innerHTML = TEMPLATE;
      isRendered = true;
      bindEvents();
    }
  }

  function bindEvents() {
    const enableObsCheckbox = document.getElementById('enableObsExport');
    const obsFilePathInput = document.getElementById('obsFilePath');
    const obsFormatTemplateInput = document.getElementById('obsFormatTemplate');
    const obsClearOnPauseCheckbox = document.getElementById('obsClearOnPause');
    const enableDiscordCheckbox = document.getElementById('enableDiscordRPC');
    const discordClientIdInput = document.getElementById('discordClientId');
    const wsPortInput = document.getElementById('wsPort');

    if (enableObsCheckbox) enableObsCheckbox.addEventListener('change', save);
    if (obsFilePathInput) {
      obsFilePathInput.addEventListener('change', save);
      obsFilePathInput.addEventListener('blur', save);
    }
    if (obsFormatTemplateInput) {
      obsFormatTemplateInput.addEventListener('change', save);
      obsFormatTemplateInput.addEventListener('input', save);
    }
    if (obsClearOnPauseCheckbox) obsClearOnPauseCheckbox.addEventListener('change', save);
    if (enableDiscordCheckbox) enableDiscordCheckbox.addEventListener('change', save);
    if (discordClientIdInput) {
      discordClientIdInput.addEventListener('change', save);
      discordClientIdInput.addEventListener('blur', save);
    }
    if (wsPortInput) {
      wsPortInput.addEventListener('change', save);
      wsPortInput.addEventListener('input', () => {
        const port = parseInt(wsPortInput.value, 10);
        if (port >= 1024 && port <= 65535) save();
      });
    }

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

    const enableObsCheckbox = document.getElementById('enableObsExport');
    const obsFilePathInput = document.getElementById('obsFilePath');
    const obsFormatTemplateInput = document.getElementById('obsFormatTemplate');
    const obsClearOnPauseCheckbox = document.getElementById('obsClearOnPause');
    const enableDiscordCheckbox = document.getElementById('enableDiscordRPC');
    const discordClientIdInput = document.getElementById('discordClientId');
    const wsPortInput = document.getElementById('wsPort');

    if (enableObsCheckbox) enableObsCheckbox.checked = !!gs.enableObsExport;
    if (obsFilePathInput) obsFilePathInput.value = gs.obsFilePath || '';
    if (obsFormatTemplateInput) obsFormatTemplateInput.value = gs.obsFormatTemplate || 'Currently Playing: {artist} - {title}';
    if (obsClearOnPauseCheckbox) obsClearOnPauseCheckbox.checked = gs.obsClearOnPause !== false;
    if (enableDiscordCheckbox) enableDiscordCheckbox.checked = !!gs.enableDiscordRPC;
    if (discordClientIdInput) discordClientIdInput.value = gs.discordClientId || '';
    if (wsPortInput) wsPortInput.value = gs.wsPort || 39865;
  }

  function save() {
    const enableObsCheckbox = document.getElementById('enableObsExport');
    const obsFilePathInput = document.getElementById('obsFilePath');
    const obsFormatTemplateInput = document.getElementById('obsFormatTemplate');
    const obsClearOnPauseCheckbox = document.getElementById('obsClearOnPause');
    const enableDiscordCheckbox = document.getElementById('enableDiscordRPC');
    const discordClientIdInput = document.getElementById('discordClientId');
    const wsPortInput = document.getElementById('wsPort');

    StreamDeckClient.saveGlobalSettings({
      enableObsExport: enableObsCheckbox ? enableObsCheckbox.checked : false,
      obsFilePath: obsFilePathInput ? obsFilePathInput.value.trim() : '',
      obsFormatTemplate: obsFormatTemplateInput ? (obsFormatTemplateInput.value || 'Currently Playing: {artist} - {title}') : 'Currently Playing: {artist} - {title}',
      obsClearOnPause: obsClearOnPauseCheckbox ? obsClearOnPauseCheckbox.checked : true,
      enableDiscordRPC: enableDiscordCheckbox ? enableDiscordCheckbox.checked : false,
      discordClientId: discordClientIdInput ? (discordClientIdInput.value.trim() || undefined) : undefined,
      wsPort: wsPortInput ? (parseInt(wsPortInput.value, 10) || 39865) : 39865
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
