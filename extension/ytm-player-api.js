/**
 * YouTube Music Web Controller - Native Player API
 * 
 * Direct, zero-DOM interaction with the internal YouTube Player API (#movie_player).
 * Completely immune to CSS/DOM redesigns.
 */

'use strict';

window.YTM = window.YTM || {};

/**
 * Locate the YouTube Music player API instance
 */
function getPlayerApi() {
  const selectors = window.YTM.selectors?.player || {};

  // 1. Polymer playerBar API instance
  const playerBar = document.querySelector(selectors.playerBar || 'ytmusic-player-bar');
  if (playerBar?.playerApi_) return playerBar.playerApi_;

  // 2. Direct #movie_player element
  const moviePlayer = document.querySelector(selectors.moviePlayer || '#movie_player');
  if (moviePlayer && typeof moviePlayer.playVideo === 'function') return moviePlayer;

  // 3. YouTube player container
  const ytPlayer = document.querySelector(selectors.ytPlayer || 'ytmusic-player');
  if (ytPlayer?.playerApi_) return ytPlayer.playerApi_;
  if (ytPlayer?.getPlayer && typeof ytPlayer.getPlayer === 'function') {
    try {
      const p = ytPlayer.getPlayer();
      if (p) return p;
    } catch { }
  }

  return null;
}

/**
 * Get internal player state
 * 1 = PLAYING, 2 = PAUSED, 3 = BUFFERING
 */
function getPlayerState() {
  const player = getPlayerApi();
  if (player && typeof player.getPlayerState === 'function') {
    try {
      return player.getPlayerState();
    } catch { }
  }
  return null;
}

/**
 * Start video playback
 */
function playVideo() {
  const player = getPlayerApi();
  if (player && typeof player.playVideo === 'function') {
    try {
      player.playVideo();
      return true;
    } catch { }
  }
  return false;
}

/**
 * Pause video playback
 */
function pauseVideo() {
  const player = getPlayerApi();
  if (player && typeof player.pauseVideo === 'function') {
    try {
      player.pauseVideo();
      return true;
    } catch { }
  }
  return false;
}

/**
 * Toggle play/pause based on internal state
 */
function togglePlayPause() {
  const player = getPlayerApi();
  if (player && typeof player.getPlayerState === 'function') {
    try {
      const state = player.getPlayerState();
      if (state === 1) {
        if (typeof player.pauseVideo === 'function') {
          player.pauseVideo();
          return true;
        }
      } else {
        if (typeof player.playVideo === 'function') {
          player.playVideo();
          return true;
        }
      }
    } catch { }
  }
  return false;
}

/**
 * Skip to next video
 */
function nextVideo() {
  const player = getPlayerApi();
  if (player && typeof player.nextVideo === 'function') {
    try {
      player.nextVideo();
      return true;
    } catch { }
  }
  return false;
}

/**
 * Skip to previous video
 */
function previousVideo() {
  const player = getPlayerApi();
  if (player && typeof player.previousVideo === 'function') {
    try {
      player.previousVideo();
      return true;
    } catch { }
  }
  return false;
}

/**
 * Set playback volume (0 - 100)
 */
function setVolume(volumePercent) {
  const player = getPlayerApi();
  if (player && typeof player.setVolume === 'function') {
    try {
      const clamped = Math.min(100, Math.max(0, Math.round(volumePercent)));
      player.setVolume(clamped);
      if (clamped > 0 && typeof player.isMuted === 'function' && player.isMuted() && typeof player.unMute === 'function') {
        player.unMute();
      }
      return true;
    } catch { }
  }
  return false;
}

/**
 * Get current volume (0 - 100)
 */
function getVolume() {
  const player = getPlayerApi();
  if (player && typeof player.getVolume === 'function') {
    try {
      return player.getVolume();
    } catch { }
  }
  return null;
}

/**
 * Check if player is muted
 */
function isMuted() {
  const player = getPlayerApi();
  if (player && typeof player.isMuted === 'function') {
    try {
      return player.isMuted();
    } catch { }
  }
  return null;
}

/**
 * Mute player
 */
function mute() {
  const player = getPlayerApi();
  if (player && typeof player.mute === 'function') {
    try {
      player.mute();
      return true;
    } catch { }
  }
  return false;
}

/**
 * Unmute player
 */
function unMute() {
  const player = getPlayerApi();
  if (player && typeof player.unMute === 'function') {
    try {
      player.unMute();
      return true;
    } catch { }
  }
  return false;
}

/**
 * Toggle mute state
 */
function toggleMute() {
  const player = getPlayerApi();
  if (player && typeof player.isMuted === 'function') {
    try {
      if (player.isMuted()) {
        return unMute();
      } else {
        return mute();
      }
    } catch { }
  }
  return false;
}

/**
 * Seek to target time in seconds
 */
function seekTo(targetSeconds) {
  const player = getPlayerApi();
  if (player && typeof player.seekTo === 'function') {
    try {
      player.seekTo(targetSeconds, true);
      return true;
    } catch { }
  }
  return false;
}

/**
 * Get current playback position in seconds
 */
function getCurrentTime() {
  const player = getPlayerApi();
  if (player && typeof player.getCurrentTime === 'function') {
    try {
      return player.getCurrentTime();
    } catch { }
  }
  return null;
}

/**
 * Get total track duration in seconds
 */
function getDuration() {
  const player = getPlayerApi();
  if (player && typeof player.getDuration === 'function') {
    try {
      return player.getDuration();
    } catch { }
  }
  return null;
}

// Export Native Player API
window.YTM.playerApi = {
  getPlayerApi,
  getPlayerState,
  playVideo,
  pauseVideo,
  togglePlayPause,
  nextVideo,
  previousVideo,
  setVolume,
  getVolume,
  isMuted,
  mute,
  unMute,
  toggleMute,
  seekTo,
  getCurrentTime,
  getDuration
};
