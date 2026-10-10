/**
 * YouTube Music Web Controller - UI Controls & Hardware Fallback
 * 
 * Handles player controls that are not exposed by the Media Session API
 * (Like, Dislike, Shuffle, Repeat) via DOM buttons, and provides HTML5 <video>
 * fallbacks for volume and mute.
 */

'use strict';

window.YTM = window.YTM || {};

function getVideo() {
  const findVideo = window.YTM.utils?.findVideoElement || (typeof findVideoElement === 'function' ? findVideoElement : null);
  return findVideo ? findVideo() : document.querySelector('video');
}

function click(selector, parent = document) {
  if (!selector) return false;
  const clickFn = window.YTM.utils?.clickElement || (typeof clickElement === 'function' ? clickElement : null);
  if (clickFn) return clickFn(selector, parent);
  try {
    const elem = parent.querySelector(selector);
    const btn = elem?.querySelector('button') || elem;
    btn?.click();
    return Boolean(btn);
  } catch {
    return false;
  }
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
