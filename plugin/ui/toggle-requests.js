/**
 * Toggle Song Requests Action Property Inspector Script
 */

/* global StreamDeckClient */

(() => {
  'use strict';

  const enableSongRequestsCheckbox = document.getElementById('enableSongRequests');
  const songRequestModeSelect = document.getElementById('songRequestMode');
  const songRequestSuccessInput = document.getElementById('songRequestSuccessTemplate');
  const songRequestDisabledInput = document.getElementById('songRequestDisabledTemplate');
  const songRequestErrorInput = document.getElementById('songRequestErrorTemplate');
  const songRequestBlockedInput = document.getElementById('songRequestBlockedTemplate');
  const playnextCmdHelper = document.getElementById('playnextCmdHelper');
  const copyPlaynextBtn = document.getElementById('copyPlaynextBtn');

  function updateHelper(port) {
    if (playnextCmdHelper) {
      playnextCmdHelper.value = `!addcom !playnext $(urlfetch http://localhost:${port}/api/playnext?url=$(querystring))`;
    }
  }

  function copyText(text, btn) {
    if (!text || !btn) return;
    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = orig;
        btn.classList.remove('copied');
      }, 1800);
    });
  }

  function bindEvents() {
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

    StreamDeckClient.onGlobalSettings((gs) => {
      populate(gs);
    });
  }

  function populate(gs) {
    if (!gs) return;
    if (enableSongRequestsCheckbox) enableSongRequestsCheckbox.checked = gs.enableSongRequests === true;
    if (songRequestModeSelect) songRequestModeSelect.value = gs.songRequestMode || 'playNext';
    if (songRequestSuccessInput) songRequestSuccessInput.value = gs.songRequestSuccessTemplate || 'Added to queue: {url} 🎶';
    if (songRequestDisabledInput) songRequestDisabledInput.value = gs.songRequestDisabledTemplate || 'Song requests are currently paused by the streamer.';
    if (songRequestErrorInput) songRequestErrorInput.value = gs.songRequestErrorTemplate || 'Invalid YouTube link or video ID.';
    if (songRequestBlockedInput) songRequestBlockedInput.value = gs.songRequestBlockedTemplate || 'This song is blocked from requests 🚫';

    const port = gs.wsPort || 39865;
    updateHelper(port);
  }

  function save() {
    StreamDeckClient.saveGlobalSettings({
      enableSongRequests: enableSongRequestsCheckbox ? enableSongRequestsCheckbox.checked : false,
      songRequestMode: songRequestModeSelect ? songRequestModeSelect.value : 'playNext',
      songRequestSuccessTemplate: songRequestSuccessInput ? (songRequestSuccessInput.value || 'Added to queue: {url} 🎶') : 'Added to queue: {url} 🎶',
      songRequestDisabledTemplate: songRequestDisabledInput ? (songRequestDisabledInput.value || 'Song requests are currently paused by the streamer.') : 'Song requests are currently paused by the streamer.',
      songRequestErrorTemplate: songRequestErrorInput ? (songRequestErrorInput.value || 'Invalid YouTube link or video ID.') : 'Invalid YouTube link or video ID.',
      songRequestBlockedTemplate: songRequestBlockedInput ? (songRequestBlockedInput.value || 'This song is blocked from requests 🚫') : 'This song is blocked from requests 🚫'
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }
})();
