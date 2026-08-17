/**
 * Blacklist & Skip Track Action Property Inspector Script
 */

/* global StreamDeckClient */

(() => {
  'use strict';

  const enableSongBlacklistInput = document.getElementById('enableSongBlacklist');
  const blacklistFilePathInput = document.getElementById('blacklistFilePath');
  const openBlacklistBtn = document.getElementById('openBlacklistBtn');
  const blacklistCmdHelper = document.getElementById('blacklistCmdHelper');
  const copyBlacklistCmdBtn = document.getElementById('copyBlacklistCmdBtn');
  const songBlacklistSuccessInput = document.getElementById('songBlacklistSuccessTemplate');
  const songBlacklistErrorInput = document.getElementById('songBlacklistErrorTemplate');

  function updateHelper(port) {
    if (blacklistCmdHelper) {
      blacklistCmdHelper.value = `!addcom -ul=mod !blacklist $(urlfetch http://localhost:${port}/api/blacklist?url=$(querystring))`;
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
    if (enableSongBlacklistInput) {
      enableSongBlacklistInput.addEventListener('change', save);
    }

    if (openBlacklistBtn) {
      openBlacklistBtn.addEventListener('click', (e) => {
        e.preventDefault();
        StreamDeckClient.sendToPlugin({ event: 'openBlacklistFile' });
      });
    }

    if (copyBlacklistCmdBtn && blacklistCmdHelper) {
      copyBlacklistCmdBtn.addEventListener('click', () => copyText(blacklistCmdHelper.value, copyBlacklistCmdBtn));
    }

    if (blacklistFilePathInput) {
      blacklistFilePathInput.addEventListener('change', save);
      blacklistFilePathInput.addEventListener('input', save);
    }
    if (songBlacklistSuccessInput) {
      songBlacklistSuccessInput.addEventListener('change', save);
      songBlacklistSuccessInput.addEventListener('input', save);
    }
    if (songBlacklistErrorInput) {
      songBlacklistErrorInput.addEventListener('change', save);
      songBlacklistErrorInput.addEventListener('input', save);
    }

    StreamDeckClient.onGlobalSettings((gs) => {
      populate(gs);
    });
  }

  function populate(gs) {
    if (!gs) return;
    if (enableSongBlacklistInput) enableSongBlacklistInput.checked = !!gs.enableSongBlacklist;
    if (blacklistFilePathInput) blacklistFilePathInput.value = gs.blacklistFilePath || '';
    if (songBlacklistSuccessInput) songBlacklistSuccessInput.value = gs.songBlacklistSuccessTemplate || 'Blacklisted: {artist} - {title} ⛔';
    if (songBlacklistErrorInput) songBlacklistErrorInput.value = gs.songBlacklistErrorTemplate || 'Invalid YouTube link or video ID to blacklist.';

    const port = gs.wsPort || 39865;
    updateHelper(port);
  }

  function save() {
    StreamDeckClient.saveGlobalSettings({
      enableSongBlacklist: enableSongBlacklistInput ? enableSongBlacklistInput.checked : false,
      blacklistFilePath: blacklistFilePathInput ? blacklistFilePathInput.value.trim() : '',
      songBlacklistSuccessTemplate: songBlacklistSuccessInput ? (songBlacklistSuccessInput.value || 'Blacklisted: {artist} - {title} ⛔') : 'Blacklisted: {artist} - {title} ⛔',
      songBlacklistErrorTemplate: songBlacklistErrorInput ? (songBlacklistErrorInput.value || 'Invalid YouTube link or video ID to blacklist.') : 'Invalid YouTube link or video ID to blacklist.'
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }
})();
