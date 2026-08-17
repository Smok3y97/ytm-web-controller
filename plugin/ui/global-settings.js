/**
 * Shared Global Settings Component for Property Inspector
 * 
 * Provides a clean, minimalist UI for general settings:
 * 1. Streamer & Creator Tools (Master Toggle + Web Dashboard launcher)
 * 2. Advanced Settings (Unified Server Port, Discord Rich Presence)
 * 
 * Detailed action-specific settings are housed directly in their dedicated action PIs
 * (Toggle Requests, Blacklist & Skip) and the centralized Web Dashboard.
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
      <div id="versionMismatchBanner" class="sdpi-banner error hidden"></div>

      <!-- Streamer & Creator Tools -->
      <details class="sdpi-group" id="streamerGroupDetails">
        <summary class="sdpi-group-summary">
          <span class="sdpi-group-title">Streamer & Creator Tools</span>
        </summary>
        <div class="sdpi-group-content">
          <!-- Master Toggle -->
          <div class="sdpi-item">
            <label class="sdpi-checkbox-wrap">
              <input type="checkbox" id="streamerModeEnabled">
              <span><strong>Enable Streamer Tools & Web Server</strong></span>
            </label>
          </div>
          <div class="sdpi-hint">
            Enables local HTTP endpoints for OBS Browser Overlays, Web Dashboard, and Chatbot integrations. Leave disabled for zero background server overhead.
          </div>

          <!-- Active Streamer Tools Sub-Section -->
          <div id="streamerToolsSection" class="hidden" style="margin-top: 10px; border-top: 1px solid var(--border); padding-top: 10px;">
            <div class="sdpi-item" style="margin-bottom: 6px;">
              <button type="button" id="openDashboardBtn" class="sdpi-item-value" style="width: 100%; cursor: pointer; padding: 7px 12px; background: #FF0033; color: #fff; font-weight: 700; border-radius: 4px; border: none; font-size: 11px;">
                🌐 Open Streamer Dashboard
              </button>
            </div>
            <div class="sdpi-hint">
              Live OBS overlay generator, blacklist manager, chatbot commands, and templates are configured directly in the <strong>Web Dashboard</strong>.
            </div>
          </div>
        </div>
      </details>

      <!-- Advanced Connection & Integrations -->
      <details class="sdpi-group">
        <summary class="sdpi-group-summary">
          <span class="sdpi-group-title">Advanced Settings</span>
        </summary>
        <div class="sdpi-group-content">
          <!-- WebSocket Port -->
          <div class="sdpi-item">
            <div class="sdpi-item-label">Server Port</div>
            <div class="sdpi-item-value">
              <input type="number" id="wsPort" placeholder="39865" min="1024" max="65535" value="39865">
            </div>
          </div>
          <div class="sdpi-hint">
            Unified WebSocket & HTTP port. Default: <code>39865</code>.
          </div>

          <!-- Discord Rich Presence -->
          <div class="sdpi-item">
            <label class="sdpi-checkbox-wrap">
              <input type="checkbox" id="enableDiscordRPC">
              <span>Enable Discord Rich Presence</span>
            </label>
          </div>

          <div class="sdpi-item">
            <div class="sdpi-item-label">Discord Client ID</div>
            <div class="sdpi-item-value">
              <input type="text" id="discordClientId" placeholder="Default (Embedded App ID)">
            </div>
          </div>
        </div>
      </details>
    `;

    isRendered = true;
    bindEvents();
  }

  function ensureWarningBanner() {
    return document.getElementById('versionMismatchBanner');
  }

  function bindEvents() {
    const streamerModeCheckbox = document.getElementById('streamerModeEnabled');
    const streamerToolsSection = document.getElementById('streamerToolsSection');
    const openDashboardBtn = document.getElementById('openDashboardBtn');

    const enableDiscordCheckbox = document.getElementById('enableDiscordRPC');
    const discordClientIdInput = document.getElementById('discordClientId');
    const wsPortInput = document.getElementById('wsPort');

    if (streamerModeCheckbox) {
      streamerModeCheckbox.addEventListener('change', () => {
        if (streamerToolsSection) {
          if (streamerModeCheckbox.checked) {
            streamerToolsSection.classList.remove('hidden');
          } else {
            streamerToolsSection.classList.add('hidden');
          }
        }
        save();
      });
    }

    if (openDashboardBtn) {
      openDashboardBtn.addEventListener('click', (e) => {
        e.preventDefault();
        StreamDeckClient.sendToPlugin({ event: 'openDashboard' });
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
          save();
        }
      });
      wsPortInput.addEventListener('input', () => {
        const port = parseInt(wsPortInput.value, 10);
        if (port >= 1024 && port <= 65535) {
          save();
        }
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

    const streamerModeCheckbox = document.getElementById('streamerModeEnabled');
    const streamerToolsSection = document.getElementById('streamerToolsSection');

    if (streamerModeCheckbox) {
      streamerModeCheckbox.checked = gs.streamerModeEnabled === true;
      if (streamerToolsSection) {
        if (streamerModeCheckbox.checked) {
          streamerToolsSection.classList.remove('hidden');
        } else {
          streamerToolsSection.classList.add('hidden');
        }
      }
    }

    const enableDiscordCheckbox = document.getElementById('enableDiscordRPC');
    const discordClientIdInput = document.getElementById('discordClientId');
    const wsPortInput = document.getElementById('wsPort');

    if (enableDiscordCheckbox) enableDiscordCheckbox.checked = !!gs.enableDiscordRPC;
    if (discordClientIdInput) discordClientIdInput.value = gs.discordClientId || '';
    if (wsPortInput) {
      wsPortInput.value = gs.wsPort || 39865;
    }
  }

  function save() {
    const streamerModeCheckbox = document.getElementById('streamerModeEnabled');
    const enableDiscordCheckbox = document.getElementById('enableDiscordRPC');
    const discordClientIdInput = document.getElementById('discordClientId');
    const wsPortInput = document.getElementById('wsPort');

    const port = wsPortInput ? (parseInt(wsPortInput.value, 10) || 39865) : 39865;

    StreamDeckClient.saveGlobalSettings({
      streamerModeEnabled: streamerModeCheckbox ? streamerModeCheckbox.checked : false,
      enableDiscordRPC: enableDiscordCheckbox ? enableDiscordCheckbox.checked : false,
      discordClientId: discordClientIdInput ? (discordClientIdInput.value.trim() || undefined) : undefined,
      wsPort: port
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
