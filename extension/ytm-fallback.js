/**
 * YouTube Music Web Controller - UI Controls & Hardware Fallback
 * 
 * Manages player controls that are not covered by the W3C Media Session API
 * (Like, Dislike, Shuffle, Repeat) and provides direct HTML5 <video> fallbacks
 * for volume and mute.
 * 
 * Playback actions (Play, Pause, Next, Prev, Seek) are strictly handled via
 * MediaSession (Tier 1) and Native Player API (Tier 2), eliminating brittle
 * DOM button clicks entirely.
 */

'use strict';

window.YTM = window.YTM || {};

function getVideo() {
  if (typeof findVideoElement === 'function') return findVideoElement();
  if (typeof window.YTM.utils?.findVideoElement === 'function') return window.YTM.utils.findVideoElement();
  const sel = window.YTM.selectors?.player?.video || 'video';
  return document.querySelector(sel);
}

function click(selector, parent = document) {
  if (!selector) return false;
  if (typeof clickElement === 'function') return clickElement(selector, parent);
  if (typeof window.YTM.utils?.clickElement === 'function') return window.YTM.utils.clickElement(selector, parent);
  try {
    const elem = parent.querySelector(selector);
    if (elem) {
      const btn = elem.querySelector('button') || elem;
      btn.click();
      return true;
    }
  } catch { }
  return false;
}

/**
 * Fallback: Set volume via HTML5 <video>
 */
function setPlayerVolume(targetPercent) {
  const clamped = Math.min(100, Math.max(0, Math.round(targetPercent)));
  const video = getVideo();
  if (video) {
    try {
      video.volume = clamped / 100;
      if (clamped > 0 && video.muted) video.muted = false;
      return true;
    } catch { }
  }
  return false;
}

/**
 * Fallback: Toggle mute state via HTML5 <video>
 */
function togglePlayerMute() {
  const video = getVideo();
  if (video) {
    try {
      video.muted = !video.muted;
      return true;
    } catch { }
  }
  return false;
}

/**
 * UI Control: Toggle Like
 */
function toggleLike() {
  const likeSel = window.YTM.selectors?.controls?.likeButton;
  const rendererSel = window.YTM.selectors?.controls?.likeRenderer;
  const renderer = rendererSel ? document.querySelector(rendererSel) : null;
  return click(likeSel, renderer || document);
}

/**
 * UI Control: Toggle Dislike
 */
function toggleDislike() {
  const dislikeSel = window.YTM.selectors?.controls?.dislikeButton;
  const rendererSel = window.YTM.selectors?.controls?.likeRenderer;
  const renderer = rendererSel ? document.querySelector(rendererSel) : null;
  return click(dislikeSel, renderer || document);
}

/**
 * UI Control: Toggle Shuffle
 */
function toggleShuffle() {
  const shuffleSel = window.YTM.selectors?.controls?.shuffleButton;
  return click(shuffleSel);
}

/**
 * UI Control: Toggle Repeat
 */
function toggleRepeat() {
  const repeatSel = window.YTM.selectors?.controls?.repeatButton;
  return click(repeatSel);
}

// Export UI & Fallback Controller
window.YTM.fallback = {
  findVideoElement: getVideo,
  setPlayerVolume,
  togglePlayerMute,
  toggleLike,
  toggleDislike,
  toggleShuffle,
  toggleRepeat
};
