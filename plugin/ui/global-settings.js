/**
 * Shared Global Settings Component for Property Inspector
 * 
 * Manages WebSocket port, Discord Rich Presence, OBS text export (.txt),
 * Chatbot endpoints, Song Requests (!playnext), and Song Blacklist in a responsive accordion layout.
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

      <!-- Streamer Settings -->
      <details class="sdpi-group">
        <summary class="sdpi-group-summary">
          <span class="sdpi-group-title">Streamer Settings</span>
        </summary>
        <div class="sdpi-group-content">
          <!-- OBS Browser Overlay Helper -->
          <div class="sdpi-item">
            <div class="sdpi-item-label">OBS Overlay URL</div>
            <div class="sdpi-item-value">
              <div class="sdpi-input-group">
                <input type="text" id="obsOverlayUrl" readonly value="http://localhost:39865/overlay">
                <button type="button" id="copyOverlayBtn" class="sdpi-btn">Copy</button>
              </div>
            </div>
          </div>
          <div class="sdpi-hint">
            Add as <strong>Browser Source</strong> in OBS Studio. Supports <code>?theme=card|compact|pill</code>, <code>?accent=ff0033</code>, <code>?bg=transparent</code> & <code>?template=...</code>
          </div>

          <!-- Chatbot Current Track URL Helper -->
          <div class="sdpi-item">
            <div class="sdpi-item-label">Chatbot Track URL</div>
            <div class="sdpi-item-value">
              <div class="sdpi-input-group">
                <input type="text" id="chatbotApiUrl" readonly value="http://localhost:39865/api/current">
                <button type="button" id="copyChatbotBtn" class="sdpi-btn">Copy</button>
              </div>
            </div>
          </div>
          <div class="sdpi-hint">
            Plaintext API for Nightbot / Streamer.bot (e.g. <code>!addcom !song $(urlfetch http://localhost:39865/api/current)</code>).
          </div>

          <div style="border-top: 1px solid var(--border); margin: 6px 0;"></div>

          <!-- Song Requests (!playnext) Section -->
          <div class="sdpi-item">
            <label class="sdpi-checkbox-wrap">
              <input type="checkbox" id="enableSongRequests">
              <span>Enable Chatbot Song Requests (!playnext)</span>
            </label>
          </div>
          <div class="sdpi-hint">
            Allows viewers to queue YouTube Music tracks via chat command or channel points. Can also be toggled on-the-fly via the <strong>Toggle Song Requests</strong> key action.
          </div>

          <div class="sdpi-item">
            <div class="sdpi-item-label">Chatbot Command</div>
            <div class="sdpi-item-value">
              <div class="sdpi-input-group">
                <input type="text" id="playnextCmdHelper" readonly value="!addcom !playnext $(urlfetch http://localhost:39865/api/playnext?url=$(querystring))">
                <button type="button" id="copyPlaynextBtn" class="sdpi-btn">Copy</button>
              </div>
            </div>
          </div>
          <div class="sdpi-hint">
            Ready-to-use command for Nightbot (or fetch <code>/api/playnext?url=...</code> in Streamer.bot).
          </div>

          <div class="sdpi-item">
            <div class="sdpi-item-label">Queue Placement</div>
            <div class="sdpi-item-value">
              <select id="songRequestMode" class="sdpi-item-value">
                <option value="playNext">Play Next (After current song)</option>
                <option value="addToQueue">Add to End of Queue</option>
              </select>
            </div>
          </div>

          <div class="sdpi-item">
            <div class="sdpi-item-label">Success Message</div>
            <div class="sdpi-item-value">
              <input type="text" id="songRequestSuccessTemplate" placeholder="Added to queue: {url} 🎶" value="Added to queue: {url} 🎶">
            </div>
          </div>
          <div class="sdpi-hint">
            Placeholders: <code>{url}</code>, <code>{videoId}</code>, <code>{mode}</code>
          </div>

          <div class="sdpi-item">
            <div class="sdpi-item-label">Paused Message</div>
            <div class="sdpi-item-value">
              <input type="text" id="songRequestDisabledTemplate" placeholder="Song requests are currently paused." value="Song requests are currently paused by the streamer.">
            </div>
          </div>

          <div class="sdpi-item">
            <div class="sdpi-item-label">Error Message</div>
            <div class="sdpi-item-value">
              <input type="text" id="songRequestErrorTemplate" placeholder="Invalid YouTube link or video ID." value="Invalid YouTube link or video ID.">
            </div>
          </div>

          <div class="sdpi-item">
            <div class="sdpi-item-label">Blocked Message</div>
            <div class="sdpi-item-value">
              <input type="text" id="songRequestBlockedTemplate" placeholder="This song is blocked from requests 🚫" value="This song is blocked from requests 🚫">
            </div>
          </div>

          <div class="sdpi-item">
            <div class="sdpi-item-label">Song Blacklist</div>
            <div class="sdpi-item-value">
              <input type="text" id="songRequestBlacklist" placeholder="dQw4w9WgXcQ, https://youtu.be/...">
            </div>
          </div>
          <div class="sdpi-hint">
            Comma-separated list of banned YouTube video IDs or links (e.g. <code>dQw4w9WgXcQ</code> for Rick Astley).
          </div>

          <div style="border-top: 1px solid var(--border); margin: 6px 0;"></div>

          <!-- OBS Text File Export (.txt) -->
          <div class="sdpi-item">
            <label class="sdpi-checkbox-wrap">
              <input type="checkbox" id="enableObsExport">
              <span>Enable OBS text export (.txt)</span>
            </label>
          </div>
          <div class="sdpi-hint">
            Writes live track information to a text file for OBS Studio ("Text (GDI+)" ➔ "Read from file").
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
            Placeholders: <code>{artist}</code>, <code>{title}</code>, <code>{album}</code>
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
              <input type="number" id="wsPort" min="1024" max="65535" value="39865">
            </div>
          </div>
          <div class="sdpi-hint">
            Port for local WebSocket & HTTP communication with the browser extension and OBS overlay.
          </div>

          <!-- Discord RPC -->
          <div class="sdpi-item">
            <label class="sdpi-checkbox-wrap">
              <input type="checkbox" id="enableDiscordRPC">
              <span>Enable Discord Rich Presence</span>
            </label>
          </div>
          <div class="sdpi-hint">
            Broadcast current song title, artist, album art, and elapsed time to Discord.
          </div>

          <div class="sdpi-item">
            <div class="sdpi-item-label">Discord Client ID</div>
            <div class="sdpi-item-value">
              <input type="text" id="discordClientId" placeholder="1472533816654823485">
            </div>
          </div>
          <div class="sdpi-hint">
            Leave blank to use the official built-in YouTube Music application badge.
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

  function updateHelperUrls(port) {
    const obsInput = document.getElementById('obsOverlayUrl');
    const chatInput = document.getElementById('chatbotApiUrl');
    const playnextInput = document.getElementById('playnextCmdHelper');

    if (obsInput) {
      obsInput.value = `http://localhost:${port}/overlay`;
    }
    if (chatInput) {
      chatInput.value = `http://localhost:${port}/api/current`;
    }
    if (playnextInput) {
      playnextInput.value = `!addcom !playnext $(urlfetch http://localhost:${port}/api/playnext?url=$(querystring))`;
    }
  }

  function copyText(text, buttonElem) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      if (buttonElem) {
        const origText = buttonElem.textContent;
        buttonElem.textContent = 'Copied!';
        buttonElem.classList.add('copied');
        setTimeout(() => {
          buttonElem.textContent = origText;
          buttonElem.classList.remove('copied');
        }, 1800);
      }
    }).catch(err => {
      console.warn('Clipboard write failed:', err);
    });
  }

  function bindEvents() {
    const enableObsCheckbox = document.getElementById('enableObsExport');
    const obsFilePathInput = document.getElementById('obsFilePath');
    const obsFormatTemplateInput = document.getElementById('obsFormatTemplate');
    const obsClearOnPauseCheckbox = document.getElementById('obsClearOnPause');
    const enableDiscordCheckbox = document.getElementById('enableDiscordRPC');
    const discordClientIdInput = document.getElementById('discordClientId');
    const wsPortInput = document.getElementById('wsPort');

    const enableSongRequestsCheckbox = document.getElementById('enableSongRequests');
    const songRequestModeSelect = document.getElementById('songRequestMode');
    const songRequestSuccessInput = document.getElementById('songRequestSuccessTemplate');
    const songRequestDisabledInput = document.getElementById('songRequestDisabledTemplate');
    const songRequestErrorInput = document.getElementById('songRequestErrorTemplate');
    const songRequestBlockedInput = document.getElementById('songRequestBlockedTemplate');
    const songRequestBlacklistInput = document.getElementById('songRequestBlacklist');

    const copyOverlayBtn = document.getElementById('copyOverlayBtn');
    const copyChatbotBtn = document.getElementById('copyChatbotBtn');
    const copyPlaynextBtn = document.getElementById('copyPlaynextBtn');
    const obsOverlayUrl = document.getElementById('obsOverlayUrl');
    const chatbotApiUrl = document.getElementById('chatbotApiUrl');
    const playnextCmdHelper = document.getElementById('playnextCmdHelper');

    if (copyOverlayBtn && obsOverlayUrl) {
      copyOverlayBtn.addEventListener('click', () => copyText(obsOverlayUrl.value, copyOverlayBtn));
    }
    if (copyChatbotBtn && chatbotApiUrl) {
      copyChatbotBtn.addEventListener('click', () => copyText(chatbotApiUrl.value, copyChatbotBtn));
    }
    if (copyPlaynextBtn && playnextCmdHelper) {
      copyPlaynextBtn.addEventListener('click', () => copyText(playnextCmdHelper.value, copyPlaynextBtn));
    }

    if (enableSongRequestsCheckbox) enableSongRequestsCheckbox.addEventListener('change', save);
    if (songRequestModeSelect) songRequestModeSelect.addEventListener('change', save);
    if (songRequestSuccessInput) {
      songRequestSuccessInput.addEventListener('change', save);
      songRequestSuccessInput.addEventListener('input', save);
    }
    if (songRequestDisabledInput) {
      songRequestDisabledInput.addEventListener('change', save);
      songRequestDisabledInput.addEventListener('input', save);
    }
    if (songRequestErrorInput) {
      songRequestErrorInput.addEventListener('change', save);
      songRequestErrorInput.addEventListener('input', save);
    }
    if (songRequestBlockedInput) {
      songRequestBlockedInput.addEventListener('change', save);
      songRequestBlockedInput.addEventListener('input', save);
    }
    if (songRequestBlacklistInput) {
      songRequestBlacklistInput.addEventListener('change', save);
      songRequestBlacklistInput.addEventListener('input', save);
    }

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
      wsPortInput.addEventListener('change', () => {
        const port = parseInt(wsPortInput.value, 10);
        if (port >= 1024 && port <= 65535) {
          updateHelperUrls(port);
          save();
        }
      });
      wsPortInput.addEventListener('input', () => {
        const port = parseInt(wsPortInput.value, 10);
        if (port >= 1024 && port <= 65535) {
          updateHelperUrls(port);
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

    const enableSongRequestsCheckbox = document.getElementById('enableSongRequests');
    const songRequestModeSelect = document.getElementById('songRequestMode');
    const songRequestSuccessInput = document.getElementById('songRequestSuccessTemplate');
    const songRequestDisabledInput = document.getElementById('songRequestDisabledTemplate');
    const songRequestErrorInput = document.getElementById('songRequestErrorTemplate');
    const songRequestBlockedInput = document.getElementById('songRequestBlockedTemplate');
    const songRequestBlacklistInput = document.getElementById('songRequestBlacklist');

    const enableObsCheckbox = document.getElementById('enableObsExport');
    const obsFilePathInput = document.getElementById('obsFilePath');
    const obsFormatTemplateInput = document.getElementById('obsFormatTemplate');
    const obsClearOnPauseCheckbox = document.getElementById('obsClearOnPause');
    const enableDiscordCheckbox = document.getElementById('enableDiscordRPC');
    const discordClientIdInput = document.getElementById('discordClientId');
    const wsPortInput = document.getElementById('wsPort');

    if (enableSongRequestsCheckbox) enableSongRequestsCheckbox.checked = gs.enableSongRequests === true;
    if (songRequestModeSelect) songRequestModeSelect.value = gs.songRequestMode || 'playNext';
    if (songRequestSuccessInput) songRequestSuccessInput.value = gs.songRequestSuccessTemplate || 'Added to queue: {url} 🎶';
    if (songRequestDisabledInput) songRequestDisabledInput.value = gs.songRequestDisabledTemplate || 'Song requests are currently paused by the streamer.';
    if (songRequestErrorInput) songRequestErrorInput.value = gs.songRequestErrorTemplate || 'Invalid YouTube link or video ID.';
    if (songRequestBlockedInput) songRequestBlockedInput.value = gs.songRequestBlockedTemplate || 'This song is blocked from requests 🚫';
    if (songRequestBlacklistInput) songRequestBlacklistInput.value = gs.songRequestBlacklist || '';

    if (enableObsCheckbox) enableObsCheckbox.checked = !!gs.enableObsExport;
    if (obsFilePathInput) obsFilePathInput.value = gs.obsFilePath || '';
    if (obsFormatTemplateInput) obsFormatTemplateInput.value = gs.obsFormatTemplate || 'Currently Playing: {artist} - {title}';
    if (obsClearOnPauseCheckbox) obsClearOnPauseCheckbox.checked = gs.obsClearOnPause !== false;
    if (enableDiscordCheckbox) enableDiscordCheckbox.checked = !!gs.enableDiscordRPC;
    if (discordClientIdInput) discordClientIdInput.value = gs.discordClientId || '';
    if (wsPortInput) {
      const port = gs.wsPort || 39865;
      wsPortInput.value = port;
      updateHelperUrls(port);
    }
  }

  function save() {
    const enableSongRequestsCheckbox = document.getElementById('enableSongRequests');
    const songRequestModeSelect = document.getElementById('songRequestMode');
    const songRequestSuccessInput = document.getElementById('songRequestSuccessTemplate');
    const songRequestDisabledInput = document.getElementById('songRequestDisabledTemplate');
    const songRequestErrorInput = document.getElementById('songRequestErrorTemplate');
    const songRequestBlockedInput = document.getElementById('songRequestBlockedTemplate');
    const songRequestBlacklistInput = document.getElementById('songRequestBlacklist');

    const enableObsCheckbox = document.getElementById('enableObsExport');
    const obsFilePathInput = document.getElementById('obsFilePath');
    const obsFormatTemplateInput = document.getElementById('obsFormatTemplate');
    const obsClearOnPauseCheckbox = document.getElementById('obsClearOnPause');
    const enableDiscordCheckbox = document.getElementById('enableDiscordRPC');
    const discordClientIdInput = document.getElementById('discordClientId');
    const wsPortInput = document.getElementById('wsPort');

    const port = wsPortInput ? (parseInt(wsPortInput.value, 10) || 39865) : 39865;
    updateHelperUrls(port);

    StreamDeckClient.saveGlobalSettings({
      enableSongRequests: enableSongRequestsCheckbox ? enableSongRequestsCheckbox.checked : false,
      songRequestMode: songRequestModeSelect ? songRequestModeSelect.value : 'playNext',
      songRequestSuccessTemplate: songRequestSuccessInput ? (songRequestSuccessInput.value || 'Added to queue: {url} 🎶') : 'Added to queue: {url} 🎶',
      songRequestDisabledTemplate: songRequestDisabledInput ? (songRequestDisabledInput.value || 'Song requests are currently paused by the streamer.') : 'Song requests are currently paused by the streamer.',
      songRequestErrorTemplate: songRequestErrorInput ? (songRequestErrorInput.value || 'Invalid YouTube link or video ID.') : 'Invalid YouTube link or video ID.',
      songRequestBlockedTemplate: songRequestBlockedInput ? (songRequestBlockedInput.value || 'This song is blocked from requests 🚫') : 'This song is blocked from requests 🚫',
      songRequestBlacklist: songRequestBlacklistInput ? songRequestBlacklistInput.value.trim() : '',
      enableObsExport: enableObsCheckbox ? enableObsCheckbox.checked : false,
      obsFilePath: obsFilePathInput ? obsFilePathInput.value.trim() : '',
      obsFormatTemplate: obsFormatTemplateInput ? (obsFormatTemplateInput.value || 'Currently Playing: {artist} - {title}') : 'Currently Playing: {artist} - {title}',
      obsClearOnPause: obsClearOnPauseCheckbox ? obsClearOnPauseCheckbox.checked : true,
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
