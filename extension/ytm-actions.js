/**
 * YouTube Music Web Controller - Player Actions
 * 
 * Direct player manipulation (play/pause, volume, mute, seek).
 */

'use strict';

window.YTM = window.YTM || {};

/**
 * Bulletproof Play / Pause Toggle
 */
function togglePlayPause() {
  const video = findVideoElement();
  if (video) {
    if (video.paused) {
      video.play().catch(() => {
        clickElement('#play-pause-button, ytmusic-player-bar #play-pause-button, tp-yt-paper-icon-button#play-pause-button, .play-pause-button');
      });
    } else {
      video.pause();
    }
  } else {
    clickElement('#play-pause-button, ytmusic-player-bar #play-pause-button, tp-yt-paper-icon-button#play-pause-button, .play-pause-button');
  }

  notifyState(true, [50, 150, 350]);
}

/**
 * Explicit Play
 */
function playVideo() {
  const video = findVideoElement();
  if (video && video.paused) {
    video.play().catch(() => {
      clickElement('#play-pause-button, ytmusic-player-bar #play-pause-button, tp-yt-paper-icon-button#play-pause-button, .play-pause-button');
    });
  } else if (!video) {
    clickElement('#play-pause-button, ytmusic-player-bar #play-pause-button, tp-yt-paper-icon-button#play-pause-button, .play-pause-button');
  }
  notifyState(true, [50, 150]);
}

/**
 * Explicit Pause
 */
function pauseVideo() {
  const video = findVideoElement();
  if (video && !video.paused) {
    if (!clickElement('#play-pause-button, ytmusic-player-bar #play-pause-button, tp-yt-paper-icon-button#play-pause-button, .play-pause-button')) {
      video.pause();
    }
  }
  notifyState(true, [50, 150]);
}

/**
 * Set player volume (0 - 100) and sync UI
 */
function setPlayerVolume(targetPercent) {
  const clamped = Math.min(100, Math.max(0, Math.round(targetPercent)));

  // 1. YouTube Music Player API
  const playerApi = getPlayerApi();
  if (playerApi) {
    try {
      if (typeof playerApi.setVolume === 'function') {
        playerApi.setVolume(clamped);
      }
      if (clamped > 0 && typeof playerApi.isMuted === 'function' && playerApi.isMuted() && typeof playerApi.unMute === 'function') {
        playerApi.unMute();
      }
    } catch (e) { }
  }

  // 2. Polymer playerBar
  const playerBar = $('ytmusic-player-bar');
  if (playerBar) {
    try {
      if (typeof playerBar.setVolume_ === 'function') playerBar.setVolume_(clamped);
      if (typeof playerBar.volume_ !== 'undefined') playerBar.volume_ = clamped;
      if (clamped > 0 && typeof playerBar.muted_ !== 'undefined') playerBar.muted_ = false;
    } catch (e) { }
  }

  // 3. Update DOM slider element
  try {
    const slider = $('ytmusic-player-bar #volume-slider') ||
      $('tp-yt-paper-slider#volume-slider') ||
      $('#volume-slider') ||
      $('.volume-slider');
    if (slider) {
      slider.value = clamped;
      slider.setAttribute('value', String(clamped));
      slider.setAttribute('aria-valuenow', String(clamped));
    }
  } catch (e) { }

  // 4. HTML5 video fallback
  const video = findVideoElement();
  if (video) {
    video.volume = clamped / 100;
    if (clamped > 0 && video.muted) {
      video.muted = false;
    }
  }

  notifyState(true, [50, 150]);
}

/**
 * Adjust volume by relative delta
 */
function adjustPlayerVolume(delta) {
  const current = typeof getPlayerVolume === 'function' ? getPlayerVolume() : 100;
  const target = Math.min(100, Math.max(0, Math.round(current + delta)));
  setPlayerVolume(target);
}

/**
 * Toggle mute / unmute
 */
function togglePlayerMute() {
  const muteBtnSelector = 'ytmusic-player-bar #volume-slider-volume-button, ytmusic-player-bar .volume, ytmusic-player-bar tp-yt-paper-icon-button.volume, #volume-slider-volume-button';
  if (!clickElement(muteBtnSelector)) {
    const playerApi = getPlayerApi();
    if (playerApi && typeof playerApi.isMuted === 'function') {
      try {
        if (playerApi.isMuted()) {
          if (typeof playerApi.unMute === 'function') playerApi.unMute();
        } else {
          if (typeof playerApi.mute === 'function') playerApi.mute();
        }
      } catch (e) { }
    } else {
      const video = findVideoElement();
      if (video) video.muted = !video.muted;
    }
  }

  notifyState(true, [60, 200]);
}

/**
 * Seek playback to absolute position in seconds
 */
function seekTo(targetSeconds) {
  const playerApi = getPlayerApi();
  if (playerApi && typeof playerApi.seekTo === 'function') {
    try {
      playerApi.seekTo(targetSeconds, true);
    } catch (e) { }
  }

  const video = findVideoElement();
  if (video) {
    try {
      video.currentTime = targetSeconds;
    } catch (e) { }
  }

  notifyState(true, [50, 150]);
}

/**
 * Seek playback by relative delta in seconds
 */
function seekRelative(deltaSeconds) {
  const video = findVideoElement();
  const timing = (typeof extractTrackTiming === 'function')
    ? extractTrackTiming(video)
    : { currentTime: video ? video.currentTime : 0, duration: video ? video.duration : 0 };
  const currentTime = timing.currentTime || 0;
  const duration = timing.duration || 0;

  const target = duration > 0
    ? Math.min(duration, Math.max(0, currentTime + deltaSeconds))
    : Math.max(0, currentTime + deltaSeconds);
  seekTo(target);
}

// Export actions to YTM namespace
window.YTM.actions = {
  togglePlayPause,
  playVideo,
  pauseVideo,
  setPlayerVolume,
  adjustPlayerVolume,
  togglePlayerMute,
  seekTo,
  seekRelative
};
