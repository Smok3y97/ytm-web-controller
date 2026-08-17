/**
 * YouTube Music Web Controller - Streamer Dashboard Client Logic
 * Single-Page Application (SPA) Controller with Tabbed Navigation
 */

(() => {
  'use strict';

  // 1. Port & Environment
  const currentPort = parseInt(window.location.port || '39865', 10);
  const host = window.location.hostname || '127.0.0.1';

  // DOM Elements - Connection & Header
  const portDisplay = document.getElementById('portDisplay');
  const connectionStatus = document.getElementById('connectionStatus');
  const statusText = connectionStatus?.querySelector('.status-text');
  const navBlacklistCount = document.getElementById('navBlacklistCount');

  // DOM Elements - Live Player Bar
  const playerCover = document.getElementById('playerCover');
  const playerCoverFallback = document.getElementById('playerCoverFallback');
  const playerStateBadge = document.getElementById('playerStateBadge');
  const playerLikeBadge = document.getElementById('playerLikeBadge');
  const playerTitle = document.getElementById('playerTitle');
  const playerArtist = document.getElementById('playerArtist');
  const playerProgressFill = document.getElementById('playerProgressFill');
  const playerTimeCurrent = document.getElementById('playerTimeCurrent');
  const playerTimeDuration = document.getElementById('playerTimeDuration');
  const playerTrackLink = document.getElementById('playerTrackLink');
  const btnBlacklistCurrent = document.getElementById('btnBlacklistCurrent');

  // DOM Elements - Overlay Configurator
  const cfgTheme = document.getElementById('cfgTheme');
  const cfgAccentColor = document.getElementById('cfgAccentColor');
  const cfgAccentText = document.getElementById('cfgAccentText');
  const cfgBgColor = document.getElementById('cfgBgColor');
  const cfgBgText = document.getElementById('cfgBgText');
  const cfgBgOpacity = document.getElementById('cfgBgOpacity');
  const cfgBgOpacityVal = document.getElementById('cfgBgOpacityVal');
  const cfgTextColor = document.getElementById('cfgTextColor');
  const cfgTextHex = document.getElementById('cfgTextHex');
  const cfgSubColor = document.getElementById('cfgSubColor');
  const cfgSubHex = document.getElementById('cfgSubHex');
  const cfgTimeMode = document.getElementById('cfgTimeMode');
  const cfgWidth = document.getElementById('cfgWidth');
  const cfgRadius = document.getElementById('cfgRadius');
  const cfgShowCover = document.getElementById('cfgShowCover');
  const cfgShowProgress = document.getElementById('cfgShowProgress');
  const cfgMarquee = document.getElementById('cfgMarquee');
  const cfgHideOnPause = document.getElementById('cfgHideOnPause');

  const overlayPreviewIframe = document.getElementById('overlayPreviewIframe');
  const generatedOverlayUrl = document.getElementById('generatedOverlayUrl');
  const btnCopyOverlayUrl = document.getElementById('btnCopyOverlayUrl');

  // DOM Elements - Blacklist Manager
  const formAddBlacklist = document.getElementById('formAddBlacklist');
  const inputBlacklistUrl = document.getElementById('inputBlacklistUrl');
  const inputBlacklistTitle = document.getElementById('inputBlacklistTitle');
  const inputBlacklistArtist = document.getElementById('inputBlacklistArtist');
  const searchBlacklist = document.getElementById('searchBlacklist');
  const blacklistTableBody = document.getElementById('blacklistTableBody');

  // DOM Elements - Chatbot Commands
  const cmdSong = document.getElementById('cmdSong');
  const cmdPlaynext = document.getElementById('cmdPlaynext');
  const cmdBlacklist = document.getElementById('cmdBlacklist');

  // Toast
  const toast = document.getElementById('toast');

  let ws = null;
  let currentPlaybackState = null;
  let blacklistEntries = [];
  let updatePreviewDebounceTimer = null;

  // Initialize SPA
  if (portDisplay) portDisplay.textContent = currentPort.toString();
  initTabs();
  initChatbotCommands();
  initWebSocket();
  initOverlayConfigurator();
  initBlacklistManager();
  initSettingsManager();

  // ----------------------------------------------------
  // Tab Navigation
  // ----------------------------------------------------
  function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetTabId = btn.getAttribute('data-tab');
        if (!targetTabId) return;

        tabButtons.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const targetPane = document.getElementById(targetTabId);
        if (targetPane) targetPane.classList.add('active');
      });
    });
  }

  // ----------------------------------------------------
  // Toast Notifications
  // ----------------------------------------------------
  function showToast(message, duration = 2500) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, duration);
  }

  // ----------------------------------------------------
  // WebSocket Connection & Live Sync
  // ----------------------------------------------------
  function initWebSocket() {
    const wsUrl = `ws://${host}:${currentPort}`;

    function setStatus(type, text) {
      if (!connectionStatus || !statusText) return;
      connectionStatus.className = `status-badge ${type}`;
      statusText.textContent = text;
    }

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setStatus('connected', 'Live Sync Active');
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'STATE_UPDATE' || payload.title !== undefined) {
            const state = payload.data || payload;
            updateLivePlayer(state);
          }
        } catch { }
      };

      ws.onclose = () => {
        setStatus('disconnected', 'Disconnected');
        setTimeout(initWebSocket, 2500);
      };

      ws.onerror = () => {
        setStatus('disconnected', 'Connection Error');
      };
    } catch {
      setStatus('disconnected', 'Connection Error');
      setTimeout(initWebSocket, 3000);
    }
  }

  function formatTime(seconds) {
    if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  function updateLivePlayer(state) {
    if (!state) return;
    currentPlaybackState = state;

    const title = (state.title || '').trim();
    const artist = (state.artist || '').trim();
    const coverUrl = state.coverBase64 || state.coverUrl || '';
    const trackUrl = state.trackUrl || '';

    // Title & Artist
    if (playerTitle) playerTitle.textContent = title || 'No Track Playing';
    if (playerArtist) playerArtist.textContent = artist || 'Connect YouTube Music in browser';

    // Cover Art
    if (playerCover && playerCoverFallback) {
      if (coverUrl) {
        playerCover.src = coverUrl;
        playerCover.classList.remove('hidden');
        playerCoverFallback.classList.add('hidden');
      } else {
        playerCover.classList.add('hidden');
        playerCoverFallback.classList.remove('hidden');
      }
    }

    // Play/Pause State Badge
    if (playerStateBadge) {
      if (state.paused) {
        playerStateBadge.textContent = 'PAUSED';
        playerStateBadge.className = 'badge badge-paused';
      } else {
        playerStateBadge.textContent = 'PLAYING';
        playerStateBadge.className = 'badge badge-playing';
      }
    }

    // Like Badge
    if (playerLikeBadge) {
      if (state.isLiked) {
        playerLikeBadge.textContent = 'LIKED ❤️';
        playerLikeBadge.classList.remove('hidden');
      } else if (state.isDisliked) {
        playerLikeBadge.textContent = 'DISLIKED 👎';
        playerLikeBadge.classList.remove('hidden');
      } else {
        playerLikeBadge.classList.add('hidden');
      }
    }

    // Progress Bar
    const duration = state.duration || 0;
    let current = state.currentTime;
    if (typeof current !== 'number' || isNaN(current) || current < 0) {
      current = 0;
    }

    const pct = duration > 0 ? Math.min(100, Math.max(0, (current / duration) * 100)) : 0;

    if (playerProgressFill) {
      playerProgressFill.style.width = `${pct}%`;
    }
    if (playerTimeCurrent) playerTimeCurrent.textContent = formatTime(current);
    if (playerTimeDuration) playerTimeDuration.textContent = formatTime(duration);

    // Track Link
    if (playerTrackLink) {
      if (trackUrl && trackUrl.startsWith('http')) {
        playerTrackLink.href = trackUrl;
        playerTrackLink.classList.remove('hidden');
      } else {
        playerTrackLink.href = '#';
      }
    }
  }

  // ----------------------------------------------------
  // OBS Overlay Live Configurator
  // ----------------------------------------------------
  function initOverlayConfigurator() {
    function bindColorSync(picker, hexInput) {
      if (!picker || !hexInput) return;
      picker.addEventListener('input', () => {
        hexInput.value = picker.value.toUpperCase();
        triggerOverlayUpdate();
      });
      hexInput.addEventListener('input', () => {
        let val = hexInput.value.trim();
        if (!val.startsWith('#') && val.length === 6) val = '#' + val;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          picker.value = val;
          triggerOverlayUpdate();
        }
      });
    }

    bindColorSync(cfgAccentColor, cfgAccentText);
    bindColorSync(cfgBgColor, cfgBgText);
    bindColorSync(cfgTextColor, cfgTextHex);
    bindColorSync(cfgSubColor, cfgSubHex);

    // Preset Swatches
    document.querySelectorAll('.swatch-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const color = btn.getAttribute('data-color');
        if (color && cfgAccentColor && cfgAccentText) {
          cfgAccentColor.value = color;
          cfgAccentText.value = color;
          triggerOverlayUpdate();
        }
      });
    });

    // Opacity Slider
    if (cfgBgOpacity && cfgBgOpacityVal) {
      cfgBgOpacity.addEventListener('input', () => {
        cfgBgOpacityVal.textContent = `${Math.round(parseFloat(cfgBgOpacity.value) * 100)}%`;
        triggerOverlayUpdate();
      });
    }

    // Generic change listeners
    [
      cfgTheme,
      cfgTimeMode,
      cfgWidth,
      cfgRadius,
      cfgShowCover,
      cfgShowProgress,
      cfgMarquee,
      cfgHideOnPause
    ].forEach((elem) => {
      if (elem) {
        elem.addEventListener('input', triggerOverlayUpdate);
        elem.addEventListener('change', triggerOverlayUpdate);
      }
    });

    // Copy URL button
    if (btnCopyOverlayUrl && generatedOverlayUrl) {
      btnCopyOverlayUrl.addEventListener('click', () => {
        navigator.clipboard.writeText(generatedOverlayUrl.value).then(() => {
          btnCopyOverlayUrl.classList.add('copied');
          btnCopyOverlayUrl.querySelector('.btn-text').textContent = '✅ Copied!';
          showToast('📋 OBS Browser Source URL copied to clipboard!');
          setTimeout(() => {
            btnCopyOverlayUrl.classList.remove('copied');
            btnCopyOverlayUrl.querySelector('.btn-text').textContent = '📋 Copy URL';
          }, 2000);
        });
      });
    }

    triggerOverlayUpdate();
  }

  function triggerOverlayUpdate() {
    if (updatePreviewDebounceTimer) clearTimeout(updatePreviewDebounceTimer);
    updatePreviewDebounceTimer = setTimeout(buildOverlayUrl, 100);
  }

  function buildOverlayUrl() {
    const params = new URLSearchParams();

    const theme = cfgTheme ? cfgTheme.value : 'card';
    if (theme !== 'card') params.set('theme', theme);

    const accent = (cfgAccentText ? cfgAccentText.value : '#FF0033').replace('#', '').trim();
    if (accent && accent.toLowerCase() !== 'ff0033') params.set('accent', accent);

    const bg = (cfgBgText ? cfgBgText.value : '#000000').replace('#', '').trim();
    if (bg && bg.toLowerCase() !== '000000') params.set('bg', bg);

    const opacity = cfgBgOpacity ? parseFloat(cfgBgOpacity.value) : 0.85;
    if (opacity !== 0.85) params.set('bgOpacity', opacity.toString());

    const textColor = (cfgTextHex ? cfgTextHex.value : '#FFFFFF').replace('#', '').trim();
    if (textColor && textColor.toLowerCase() !== 'ffffff') params.set('text', textColor);

    const subColor = (cfgSubHex ? cfgSubHex.value : '#A0A0A0').replace('#', '').trim();
    if (subColor && subColor.toLowerCase() !== 'a0a0a0') params.set('subColor', subColor);

    const timeMode = cfgTimeMode ? cfgTimeMode.value : 'remaining';
    if (timeMode !== 'remaining') params.set('timeMode', timeMode);

    if (cfgWidth && cfgWidth.value) params.set('width', cfgWidth.value + 'px');
    if (cfgRadius && cfgRadius.value) params.set('radius', cfgRadius.value + 'px');

    if (cfgShowCover && !cfgShowCover.checked) params.set('showCover', 'false');
    if (cfgShowProgress && !cfgShowProgress.checked) params.set('showProgress', 'false');
    if (cfgMarquee && !cfgMarquee.checked) params.set('marquee', 'false');
    if (cfgHideOnPause && cfgHideOnPause.checked) params.set('hideOnPause', 'true');

    const queryString = params.toString();
    const fullUrl = `http://localhost:${currentPort}/overlay${queryString ? '?' + queryString : ''}`;

    if (generatedOverlayUrl) generatedOverlayUrl.value = fullUrl;
    if (overlayPreviewIframe) {
      overlayPreviewIframe.src = `/overlay${queryString ? '?' + queryString : ''}`;
    }
  }

  // ----------------------------------------------------
  // Blacklist Manager
  // ----------------------------------------------------
  function initBlacklistManager() {
    loadBlacklistData();

    if (formAddBlacklist) {
      formAddBlacklist.addEventListener('submit', async (e) => {
        e.preventDefault();
        const urlOrId = inputBlacklistUrl?.value.trim();
        const title = inputBlacklistTitle?.value.trim();
        const artist = inputBlacklistArtist?.value.trim();

        if (!urlOrId) return;

        try {
          const res = await fetch('/api/blacklist', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              url: urlOrId,
              title,
              artist
            })
          });

          const data = await res.json();
          if (data.success) {
            showToast(`✅ Added track to blacklist (${data.id})`);
            if (inputBlacklistUrl) inputBlacklistUrl.value = '';
            if (inputBlacklistTitle) inputBlacklistTitle.value = '';
            if (inputBlacklistArtist) inputBlacklistArtist.value = '';
            await loadBlacklistData();
          } else {
            showToast(`❌ Failed to blacklist: ${data.error || 'Unknown error'}`);
          }
        } catch (err) {
          showToast(`❌ Error connecting to server: ${err.message}`);
        }
      });
    }

    if (btnBlacklistCurrent) {
      btnBlacklistCurrent.addEventListener('click', async () => {
        if (!currentPlaybackState || !currentPlaybackState.trackUrl) {
          showToast('⚠️ No active track playing to blacklist');
          return;
        }

        try {
          const res = await fetch('/api/blacklist', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              url: currentPlaybackState.trackUrl,
              title: currentPlaybackState.title,
              artist: currentPlaybackState.artist
            })
          });

          const data = await res.json();
          if (data.success) {
            showToast(`⛔ Blacklisted current track and skipped!`);
            await loadBlacklistData();
          } else {
            showToast(`❌ Failed: ${data.error || 'Unknown error'}`);
          }
        } catch (err) {
          showToast(`❌ Error: ${err.message}`);
        }
      });
    }

    if (searchBlacklist) {
      searchBlacklist.addEventListener('input', () => {
        renderBlacklistTable(searchBlacklist.value);
      });
    }
  }

  async function loadBlacklistData() {
    try {
      const res = await fetch('/api/blacklist?format=json', {
        headers: { 'Accept': 'application/json' }
      });
      const data = await res.json();

      if (data.success && Array.isArray(data.entries)) {
        blacklistEntries = data.entries;
        if (navBlacklistCount) navBlacklistCount.textContent = `${blacklistEntries.length} blocked`;
        renderBlacklistTable(searchBlacklist?.value || '');
      }
    } catch (err) {
      console.warn('Could not load blacklist data:', err);
      if (blacklistTableBody) {
        blacklistTableBody.innerHTML = '<tr><td colspan="5" class="table-empty">Could not load blacklist.txt</td></tr>';
      }
    }
  }

  function renderBlacklistTable(filterQuery = '') {
    if (!blacklistTableBody) return;

    const q = filterQuery.toLowerCase().trim();
    const filtered = blacklistEntries.filter((item) => {
      if (!q) return true;
      return (
        item.id.toLowerCase().includes(q) ||
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.artist && item.artist.toLowerCase().includes(q))
      );
    });

    if (filtered.length === 0) {
      blacklistTableBody.innerHTML = `<tr><td colspan="5" class="table-empty">${blacklistEntries.length === 0 ? 'No tracks currently blacklisted in blacklist.txt' : 'No matching tracks found for filter'}</td></tr>`;
      return;
    }

    blacklistTableBody.innerHTML = filtered.map((item) => `
      <tr>
        <td><span class="video-id-badge">${escapeHtml(item.id)}</span></td>
        <td>${escapeHtml(item.artist || '—')}</td>
        <td><strong>${escapeHtml(item.title || 'Manual Blacklist')}</strong></td>
        <td><a href="${item.url}" target="_blank" rel="noopener noreferrer" class="table-link">Watch ↗</a></td>
        <td style="text-align: right;">
          <button type="button" class="btn btn-danger btn-sm btn-delete-blacklist" data-id="${escapeHtml(item.id)}">
            🗑️ Remove
          </button>
        </td>
      </tr>
    `).join('');

    blacklistTableBody.querySelectorAll('.btn-delete-blacklist').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!id) return;

        try {
          const res = await fetch(`/api/blacklist/${id}`, {
            method: 'DELETE',
            headers: { 'Accept': 'application/json' }
          });
          const result = await res.json();
          if (result.success) {
            showToast(`🗑️ Removed ${id} from blacklist`);
            await loadBlacklistData();
          } else {
            showToast(`❌ Failed to remove: ${result.reason || 'Error'}`);
          }
        } catch (err) {
          showToast(`❌ Error: ${err.message}`);
        }
      });
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ----------------------------------------------------
  // Chatbot Command Generator
  // ----------------------------------------------------
  function initChatbotCommands() {
    if (cmdSong) cmdSong.value = `!addcom !song $(urlfetch http://localhost:${currentPort}/api/current)`;
    if (cmdPlaynext) cmdPlaynext.value = `!addcom !playnext $(urlfetch http://localhost:${currentPort}/api/playnext?url=$(querystring))`;
    if (cmdBlacklist) cmdBlacklist.value = `!addcom -ul=mod !blacklist $(urlfetch http://localhost:${currentPort}/api/blacklist?url=$(querystring))`;

    document.querySelectorAll('.btn-copy[data-target]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const inputElem = document.getElementById(targetId);
        if (inputElem) {
          navigator.clipboard.writeText(inputElem.value).then(() => {
            const orig = btn.textContent;
            btn.textContent = 'Copied!';
            showToast(`📋 Copied command to clipboard!`);
            setTimeout(() => {
              btn.textContent = orig;
            }, 1800);
          });
        }
      });
    });
  }

  // ----------------------------------------------------
  // Streamer Settings Manager (Two-Way Sync with Plugin)
  // ----------------------------------------------------
  function initSettingsManager() {
    const setEnableSongRequests = document.getElementById('setEnableSongRequests');
    const setSongRequestMode = document.getElementById('setSongRequestMode');
    const setSongRequestSuccessTemplate = document.getElementById('setSongRequestSuccessTemplate');
    const setSongRequestDisabledTemplate = document.getElementById('setSongRequestDisabledTemplate');
    const setSongRequestErrorTemplate = document.getElementById('setSongRequestErrorTemplate');
    const setSongRequestBlockedTemplate = document.getElementById('setSongRequestBlockedTemplate');

    const setEnableSongBlacklist = document.getElementById('setEnableSongBlacklist');
    const setBlacklistFilePath = document.getElementById('setBlacklistFilePath');
    const setSongBlacklistSuccessTemplate = document.getElementById('setSongBlacklistSuccessTemplate');
    const setSongBlacklistErrorTemplate = document.getElementById('setSongBlacklistErrorTemplate');

    const setEnableObsExport = document.getElementById('setEnableObsExport');
    const setObsFilePath = document.getElementById('setObsFilePath');
    const setObsFormatTemplate = document.getElementById('setObsFormatTemplate');
    const setObsClearOnPause = document.getElementById('setObsClearOnPause');

    const btnSaveAllSettings = document.getElementById('btnSaveAllSettings');
    const formStreamerSettings = document.getElementById('formStreamerSettings');

    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (data.success && data.settings) {
          const s = data.settings;
          if (setEnableSongRequests) setEnableSongRequests.checked = s.enableSongRequests === true;
          if (setSongRequestMode) setSongRequestMode.value = s.songRequestMode || 'playNext';
          if (setSongRequestSuccessTemplate) setSongRequestSuccessTemplate.value = s.songRequestSuccessTemplate || 'Added to queue: {url} 🎶';
          if (setSongRequestDisabledTemplate) setSongRequestDisabledTemplate.value = s.songRequestDisabledTemplate || 'Song requests are currently paused by the streamer.';
          if (setSongRequestErrorTemplate) setSongRequestErrorTemplate.value = s.songRequestErrorTemplate || 'Invalid YouTube link or video ID.';
          if (setSongRequestBlockedTemplate) setSongRequestBlockedTemplate.value = s.songRequestBlockedTemplate || 'This song is blocked from requests 🚫';

          if (setEnableSongBlacklist) setEnableSongBlacklist.checked = s.enableSongBlacklist === true;
          if (setBlacklistFilePath) setBlacklistFilePath.value = s.blacklistFilePath || '';
          if (setSongBlacklistSuccessTemplate) setSongBlacklistSuccessTemplate.value = s.songBlacklistSuccessTemplate || 'Blacklisted: {artist} - {title} ⛔';
          if (setSongBlacklistErrorTemplate) setSongBlacklistErrorTemplate.value = s.songBlacklistErrorTemplate || 'Invalid YouTube link or video ID to blacklist.';

          if (setEnableObsExport) setEnableObsExport.checked = !!s.enableObsExport;
          if (setObsFilePath) setObsFilePath.value = s.obsFilePath || '';
          if (setObsFormatTemplate) setObsFormatTemplate.value = s.obsFormatTemplate || 'Currently Playing: {artist} - {title}';
          if (setObsClearOnPause) setObsClearOnPause.checked = s.obsClearOnPause !== false;
        }
      } catch (err) {
        console.warn('Could not load settings from server:', err);
      }
    }

    async function saveSettings() {
      const payload = {
        enableSongRequests: setEnableSongRequests ? setEnableSongRequests.checked : false,
        songRequestMode: setSongRequestMode ? setSongRequestMode.value : 'playNext',
        songRequestSuccessTemplate: setSongRequestSuccessTemplate ? setSongRequestSuccessTemplate.value : 'Added to queue: {url} 🎶',
        songRequestDisabledTemplate: setSongRequestDisabledTemplate ? setSongRequestDisabledTemplate.value : 'Song requests are currently paused by the streamer.',
        songRequestErrorTemplate: setSongRequestErrorTemplate ? setSongRequestErrorTemplate.value : 'Invalid YouTube link or video ID.',
        songRequestBlockedTemplate: setSongRequestBlockedTemplate ? setSongRequestBlockedTemplate.value : 'This song is blocked from requests 🚫',
        enableSongBlacklist: setEnableSongBlacklist ? setEnableSongBlacklist.checked : false,
        blacklistFilePath: setBlacklistFilePath ? setBlacklistFilePath.value.trim() : '',
        songBlacklistSuccessTemplate: setSongBlacklistSuccessTemplate ? setSongBlacklistSuccessTemplate.value : 'Blacklisted: {artist} - {title} ⛔',
        songBlacklistErrorTemplate: setSongBlacklistErrorTemplate ? setSongBlacklistErrorTemplate.value : 'Invalid YouTube link or video ID to blacklist.',
        enableObsExport: setEnableObsExport ? setEnableObsExport.checked : false,
        obsFilePath: setObsFilePath ? setObsFilePath.value.trim() : '',
        obsFormatTemplate: setObsFormatTemplate ? setObsFormatTemplate.value : 'Currently Playing: {artist} - {title}',
        obsClearOnPause: setObsClearOnPause ? setObsClearOnPause.checked : true
      };

      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          showToast('💾 Streamer settings saved & synced with Stream Deck!');
        } else {
          showToast(`❌ Error saving settings: ${data.error || 'Server error'}`);
        }
      } catch (err) {
        showToast(`❌ Connection error: ${err.message}`);
      }
    }

    if (btnSaveAllSettings) {
      btnSaveAllSettings.addEventListener('click', (e) => {
        e.preventDefault();
        saveSettings();
      });
    }

    if (formStreamerSettings) {
      formStreamerSettings.addEventListener('submit', (e) => {
        e.preventDefault();
        saveSettings();
      });
    }

    loadSettings();
  }
})();
