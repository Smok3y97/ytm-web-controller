/**
 * YouTube Music Web Controller - Action Orchestrator
 * 
 * Dispatches control commands using a layered approach:
 * - Playback (Play, Pause, Next, Prev, Seek): MediaSession -> Player API fallback.
 * - Volume & Mute: Player API -> HTML5 <video> element fallback.
 * - UI Toggles (Like, Dislike, Shuffle, Repeat): DOM button clicks.
 */

'use strict';

window.YTM = window.YTM || {};

function triggerStateNotification(delays = [50, 150]) {
  const notify = (typeof notifyState === 'function')
    ? notifyState
    : window.YTM.utils?.notifyState;
  if (typeof notify === 'function') {
    notify(true, delays);
  }
}

/**
 * Toggle playback state (play / pause)
 */
function togglePlayPause() {
  const ms = window.YTM.mediaSession;
  const api = window.YTM.playerApi;

  if (!ms?.togglePlayPause()) {
    api?.togglePlayPause();
  }
  triggerStateNotification([50, 150, 350]);
}

/**
 * Start playback
 */
function playVideo() {
  const ms = window.YTM.mediaSession;
  const api = window.YTM.playerApi;

  if (!ms?.play()) {
    api?.playVideo();
  }
  triggerStateNotification([50, 150]);
}

/**
 * Pause playback
 */
function pauseVideo() {
  const ms = window.YTM.mediaSession;
  const api = window.YTM.playerApi;

  if (!ms?.pause()) {
    api?.pauseVideo();
  }
  triggerStateNotification([50, 150]);
}

/**
 * Skip to next track
 */
function nextTrack() {
  const ms = window.YTM.mediaSession;
  const api = window.YTM.playerApi;

  if (!ms?.nextTrack()) {
    api?.nextVideo();
  }
  triggerStateNotification([60, 200, 450]);
}

/**
 * Skip to previous track
 */
function previousTrack() {
  const ms = window.YTM.mediaSession;
  const api = window.YTM.playerApi;

  if (!ms?.previousTrack()) {
    api?.previousVideo();
  }
  triggerStateNotification([60, 200, 450]);
}

/**
 * Set player volume (0 - 100) and sync visual UI slider
 */
function setPlayerVolume(targetPercent) {
  const clamped = Math.min(100, Math.max(0, Math.round(targetPercent)));

  // 1. YouTube Music Player API (controls actual audio)
  const api = window.YTM.playerApi;
  const success = api?.setVolume(clamped);

  // 2. Synchronize YouTube Music's Polymer player-bar UI and paper-slider
  try {
    const playerBar = document.querySelector('ytmusic-player-bar');
    if (playerBar) {
      if (typeof playerBar.setVolume_ === 'function') playerBar.setVolume_(clamped);
      if (typeof playerBar.volume_ !== 'undefined') playerBar.volume_ = clamped;
      if (clamped > 0 && typeof playerBar.muted_ !== 'undefined') playerBar.muted_ = false;
    }

    const slider = document.querySelector('ytmusic-player-bar #volume-slider') ||
      document.querySelector('tp-yt-paper-slider#volume-slider') ||
      document.querySelector('#volume-slider') ||
      document.querySelector('.volume-slider');
    if (slider) {
      slider.value = clamped;
      slider.setAttribute('value', String(clamped));
      slider.setAttribute('aria-valuenow', String(clamped));
    }
  } catch (e) { }

  // 3. HTML5 video fallback if Player API is unavailable
  if (!success) {
    const fb = window.YTM.fallback;
    fb?.setPlayerVolume(clamped);
  }

  triggerStateNotification([50, 150]);
}

/**
 * Adjust volume by relative delta (-100 to +100)
 */
function adjustPlayerVolume(delta) {
  const api = window.YTM.playerApi;
  let current = api?.getVolume();

  if (typeof current !== 'number') {
    current = (typeof getPlayerVolume === 'function') ? getPlayerVolume() : 100;
  }

  const target = Math.min(100, Math.max(0, Math.round(current + delta)));
  setPlayerVolume(target);
}

/**
 * Toggle player mute state and sync UI
 */
function togglePlayerMute() {
  const muteBtnSelector = window.YTM.selectors?.player?.volumeMuteButton || 'ytmusic-player-bar #volume-slider-volume-button, ytmusic-player-bar .volume, ytmusic-player-bar tp-yt-paper-icon-button.volume, #volume-slider-volume-button';
  const clickFn = typeof clickElement === 'function' ? clickElement : window.YTM.utils?.clickElement;

  // 1. Click UI button to trigger YouTube Music's visual state & audio toggle
  let clicked = false;
  if (typeof clickFn === 'function') {
    clicked = clickFn(muteBtnSelector);
  } else {
    const btn = document.querySelector(muteBtnSelector);
    if (btn) {
      const b = btn.querySelector('button') || btn;
      b.click();
      clicked = true;
    }
  }

  // 2. Fallback to Player API and video element if button was not clickable
  if (!clicked) {
    const api = window.YTM.playerApi;
    const fb = window.YTM.fallback;
    if (!api?.toggleMute()) {
      fb?.togglePlayerMute();
    }
  }

  triggerStateNotification([60, 200]);
}

/**
 * Seek to absolute position in seconds
 */
function seekTo(targetSeconds) {
  const api = window.YTM.playerApi;
  const ms = window.YTM.mediaSession;

  if (!api?.seekTo(targetSeconds)) {
    ms?.seekTo(targetSeconds);
  }
  triggerStateNotification([50, 150]);
}

/**
 * Seek relative delta in seconds
 */
function seekRelative(deltaSeconds) {
  const api = window.YTM.playerApi;
  const current = api?.getCurrentTime();
  const duration = api?.getDuration();

  if (typeof current === 'number' && !isNaN(current) && isFinite(current)) {
    const target = (typeof duration === 'number' && duration > 0)
      ? Math.min(duration, Math.max(0, current + deltaSeconds))
      : Math.max(0, current + deltaSeconds);
    seekTo(target);
    return;
  }

  const ms = window.YTM.mediaSession;
  if (ms?.seekRelative(deltaSeconds)) {
    triggerStateNotification([50, 150]);
    return;
  }

  const video = window.YTM.selectors?.findVideo?.() || document.querySelector('video');
  if (video && typeof video.currentTime === 'number') {
    video.currentTime = Math.max(0, video.currentTime + deltaSeconds);
    triggerStateNotification([50, 150]);
  }
}

/**
 * Toggle Like
 */
function toggleLike() {
  const fb = window.YTM.fallback;
  fb?.toggleLike();
  triggerStateNotification([60, 200, 450]);
}

/**
 * Toggle Dislike
 */
function toggleDislike() {
  const fb = window.YTM.fallback;
  fb?.toggleDislike();
  triggerStateNotification([60, 200, 450]);
}

/**
 * Toggle Shuffle
 */
function toggleShuffle() {
  const fb = window.YTM.fallback;
  fb?.toggleShuffle();
  triggerStateNotification([60, 200, 450]);
}

/**
 * Toggle Repeat
 */
function toggleRepeat() {
  const fb = window.YTM.fallback;
  fb?.toggleRepeat();
  triggerStateNotification([60, 200, 450]);
}

// Export actions to YTM namespace
window.YTM.actions = {
  togglePlayPause,
  playVideo,
  pauseVideo,
  nextTrack,
  previousTrack,
  setPlayerVolume,
  adjustPlayerVolume,
  togglePlayerMute,
  seekTo,
  seekRelative,
  toggleLike,
  toggleDislike,
  toggleShuffle,
  toggleRepeat
};
