/**
 * YouTube Music Web Controller - Utilities & Helpers
 * 
 * DOM selectors, player element locators, text sanitization, timing parsers,
 * ID extraction, cover art canvas processing, version / platform utilities,
 * and unified button state helpers.
 */

'use strict';

/**
 * Global YTM namespace for cross-file module interoperability
 */
window.YTM = window.YTM || {};

/**
 * Safe selector query helpers
 */
function $(selector, parent = document) {
  try {
    return parent.querySelector(selector);
  } catch {
    return null;
  }
}

function $$(selector, parent = document) {
  try {
    return Array.from(parent.querySelectorAll(selector));
  } catch {
    return [];
  }
}

/**
 * Safely click a DOM element by selector
 */
function clickElement(selector, parent = document) {
  const elem = $(selector, parent);
  if (elem) {
    const btn = elem.querySelector('button') || elem;
    try {
      btn.click();
      return true;
    } catch (e) { }
  }
  return false;
}

/**
 * Locate the YouTube Music main playback video element
 */
function findVideoElement() {
  return $('.html5-main-video') ||
    $('#movie_player video') ||
    $('ytmusic-player video') ||
    $('ytmusic-player-bar video') ||
    $('video');
}

/**
 * Locate the YouTube Music player API instance
 */
function getPlayerApi() {
  const playerBar = $('ytmusic-player-bar');
  if (playerBar?.playerApi_) return playerBar.playerApi_;

  const moviePlayer = $('#movie_player') || $('#player') || $('.html5-video-player');
  if (moviePlayer && typeof moviePlayer.setVolume === 'function') return moviePlayer;

  const ytPlayer = $('ytmusic-player');
  if (ytPlayer?.playerApi_) return ytPlayer.playerApi_;
  if (ytPlayer?.getPlayer && typeof ytPlayer.getPlayer === 'function') {
    try {
      const p = ytPlayer.getPlayer();
      if (p) return p;
    } catch (e) { }
  }

  return null;
}

/**
 * Universal Button Active-State Checker
 * Evaluates aria-pressed, aria-checked, active attributes, selected classes,
 * and multi-language deactivation keywords.
 */
function isButtonActive(elem, deactivateKeywords = []) {
  if (!elem) return false;
  const inner = elem.querySelector('button') || elem;

  const ariaPressed = (elem.getAttribute('aria-pressed') || inner.getAttribute('aria-pressed') || '').toLowerCase();
  const ariaChecked = (elem.getAttribute('aria-checked') || inner.getAttribute('aria-checked') || '').toLowerCase();
  const hasActive = elem.hasAttribute('active') || inner.hasAttribute('active');
  const isSelected = elem.classList.contains('selected') || (inner !== elem && inner.classList.contains('selected'));

  if (ariaPressed === 'true' || ariaChecked === 'true' || hasActive || isSelected) {
    return true;
  }

  if (Array.isArray(deactivateKeywords) && deactivateKeywords.length > 0) {
    const label = (
      elem.getAttribute('aria-label') ||
      inner.getAttribute('aria-label') ||
      elem.getAttribute('title') ||
      inner.getAttribute('title') ||
      ''
    ).toLowerCase();

    if (deactivateKeywords.some(kw => label.includes(kw))) {
      return true;
    }
  }

  return false;
}

/**
 * Unified State Notification Trigger
 */
function notifyState(force = true, delays = []) {
  if (Array.isArray(delays) && delays.length > 0) {
    if (typeof window.YTM.scheduleStateUpdates === 'function') {
      window.YTM.scheduleStateUpdates(delays);
    } else if (typeof scheduleStateUpdates === 'function') {
      scheduleStateUpdates(delays);
    } else if (typeof window.YTM.sendState === 'function') {
      window.YTM.sendState(force);
    }
  } else {
    if (typeof window.YTM.sendState === 'function') {
      window.YTM.sendState(force);
    } else if (typeof sendState === 'function') {
      sendState(force);
    }
  }
}


/**
 * Normalize whitespace and special spaces
 */
function cleanWhitespace(str) {
  return (str || '').replace(/[\s\u00A0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/g, ' ').trim();
}

/**
 * Determine if a text fragment represents non-album metadata (view count, upload date, year, likes, etc.)
 */
function isNonAlbumText(text) {
  if (!text || typeof text !== 'string') return true;
  const s = text.trim();
  if (!s) return true;

  // 1. Year only (e.g. "2024", "1998")
  if (/^\d{4}$/.test(s)) return true;

  // 2. Explicit / parental badge
  if (/^(e|\[e\])$/i.test(s)) return true;

  // 3. Time duration format (e.g. "3:45", "01:23:45")
  if (/^\d+:\d+(?::\d+)?$/.test(s)) return true;

  // 4. Track count format (e.g. "12 tracks", "10 Titel", "8 morceaux", "15 canciones")
  if (/^\d+\s*(?:tracks?|titel|songs?|morceaux|canciones|brani|трек\w*|піс\w*)$/i.test(s)) return true;

  const hasDigits = /\d/.test(s);

  // 5. View count patterns across all YouTube languages
  const hasViewKeyword = /(?:aufruf|view|vue|visualiza|visualizz|просмотр|перегляд|wyświetle|görüntüleme|weergaven|visning|katselukert|zhlédnut|zhliadnut|megtekintés|vizionar|προβολ|pregled|צפי|مشاهد|ditonton|lượt\s*xem|回視聴|次观看|次觀看|조회|ครั้ง)/i.test(s);
  if (hasDigits && hasViewKeyword) return true;

  // 6. Relative upload times across languages
  const hasTimeKeyword = /(?:^vor\s|\bago$|^il y a\b|^hace\s|^há\s|\bfa$|назад$|тому$|önce$|temu$|előtt$|sedan$|siden$|sitten$|yang lalu$|^před\s|^pred\s|^acum\s|^πριν\s|^pre\s|לפני|قبل|trước$|ที่แล้ว$|年前|前$|전$)/i.test(s);
  if (hasTimeKeyword) return true;

  // 7. Date units with digits (e.g. "3 Jahre", "5 months", "2 days", etc.)
  const hasDateUnit = /(?:year|jahr|ans?|año|anno|год|лет|рок|month|monat|mois|mes|mese|месяц|місяц|week|woche|semaine|semana|settiman|недел|тижд|day|tag|jour|día|giorno|день|дней|днів|hour|stunde|heure|hora|ora|час|minute|минут|хвилин)/i.test(s);
  if (hasDigits && hasDateUnit && /(?:vor|ago|hace|há|fa|назад|тому|önce|temu|előtt|sedan|siden|sitten|yang lalu|před|pred|acum|πριν|pre|לפני|قبل|trước|ที่แล้ว)/i.test(s)) {
    return true;
  }

  // 8. Like / reaction / subscriber counts (e.g. "500k likes", "12 Tsd. Gefällt mir", "1.2M subscribers")
  const hasLikeKeyword = /(?:like|gefällt|gusta|j'aime|mi piace|лайк|좋아요|讚|赞|subscribers?|abonnenten?|abonnés?|suscriptores?|iscritti)/i.test(s);
  if (hasDigits && hasLikeKeyword) return true;

  return false;
}

/**
 * Parse mm:ss or hh:mm:ss string to integer seconds
 */
function parseTimeString(str) {
  if (!str) return 0;
  const clean = str.replace(/[^\d:]/g, '');
  if (!clean) return 0;
  const parts = clean.split(':').map(val => parseInt(val, 10));
  if (parts.length === 0 || parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0] || 0;
  return 0;
}

/**
 * Extract accurate track-relative timing & duration
 * Prioritizes canonical DOM time-info string over MSE chunk buffers to prevent truncated durations
 */
function extractTrackTiming(video) {
  let currentTime = 0;
  let duration = 0;
  let hasDefinitiveDuration = false;

  // 1. Primary: Extract accurate formatted duration from DOM .time-info (e.g. "0:19 / 3:33")
  const timeInfoElem = $('ytmusic-player-bar .time-info, ytmusic-player-bar span.time-info, #time-info, .time-info');
  if (timeInfoElem && timeInfoElem.textContent) {
    const text = cleanWhitespace(timeInfoElem.textContent);
    const timeMatches = text.match(/(\d+:\d+(?::\d+)?)/g);
    if (timeMatches && timeMatches.length >= 2) {
      const parsedCur = parseTimeString(timeMatches[0]);
      const parsedDur = parseTimeString(timeMatches[1]);
      if (parsedDur > 0) {
        duration = parsedDur;
        currentTime = Math.min(duration, parsedCur);
        hasDefinitiveDuration = true;
      }
    }
  }

  // 2. Extract from separate current-time and total-time or ytp-time elements
  if (!hasDefinitiveDuration) {
    const totalElem = $('ytmusic-player-bar .total-time, .ytp-time-duration, #time-info .total, ytmusic-player-bar span#duration');
    const curElem = $('ytmusic-player-bar .current-time, .ytp-time-current, #time-info .current');
    if (totalElem && totalElem.textContent) {
      const parsedDur = parseTimeString(totalElem.textContent);
      if (parsedDur > 0) {
        duration = parsedDur;
        if (curElem && curElem.textContent) {
          currentTime = Math.min(duration, parseTimeString(curElem.textContent));
        }
        hasDefinitiveDuration = true;
      }
    }
  }

  // 3. YouTube Music Polymer PlayerBar internal duration properties
  const playerBar = $('ytmusic-player-bar');
  if (playerBar && !hasDefinitiveDuration) {
    const pDataDur = playerBar.__data?.duration || playerBar.duration_;
    if (typeof pDataDur === 'number' && !isNaN(pDataDur) && pDataDur > 0) {
      duration = Math.floor(pDataDur);
      hasDefinitiveDuration = true;
    }
  }

  // 4. Progress bar slider attributes
  if (!hasDefinitiveDuration) {
    const progressBar = $('ytmusic-player-bar #progress-bar, tp-yt-paper-slider#progress-bar, #progress-bar');
    if (progressBar) {
      const maxAttr = progressBar.getAttribute('aria-valuemax') ?? progressBar.getAttribute('max') ?? progressBar.value;
      const nowAttr = progressBar.getAttribute('aria-valuenow') ?? progressBar.getAttribute('value') ?? progressBar.value;
      const valMax = typeof maxAttr === 'number' ? maxAttr : parseInt(maxAttr, 10);
      const valNow = typeof nowAttr === 'number' ? nowAttr : parseInt(nowAttr, 10);
      if (!isNaN(valMax) && valMax > 0) {
        duration = valMax;
        if (!isNaN(valNow) && valNow >= 0) {
          currentTime = Math.min(duration, valNow);
        }
        hasDefinitiveDuration = true;
      }
    }
  }

  // 5. Player API (use for real-time sub-second currentTime, and fallback/maximum duration)
  const playerApi = getPlayerApi();
  if (playerApi) {
    try {
      const pCur = typeof playerApi.getCurrentTime === 'function' ? playerApi.getCurrentTime() : 0;
      const pDur = typeof playerApi.getDuration === 'function' ? playerApi.getDuration() : 0;

      if (typeof pCur === 'number' && !isNaN(pCur) && isFinite(pCur) && pCur >= 0) {
        currentTime = Math.floor(pCur);
      }

      if (typeof pDur === 'number' && !isNaN(pDur) && isFinite(pDur) && pDur > 0) {
        const flooredDur = Math.floor(pDur);
        if (!hasDefinitiveDuration || flooredDur > duration) {
          duration = flooredDur;
          hasDefinitiveDuration = true;
        }
      }
    } catch (e) { }
  }

  // 6. HTML5 Video Element (fallback)
  if (video) {
    if (currentTime === 0 && !isNaN(video.currentTime) && isFinite(video.currentTime)) {
      currentTime = Math.floor(video.currentTime);
    }
    if (!hasDefinitiveDuration && !isNaN(video.duration) && isFinite(video.duration) && video.duration > 0) {
      const flooredDur = Math.floor(video.duration);
      if (flooredDur > duration) {
        duration = flooredDur;
      }
    }
  }

  if (duration > 0 && currentTime > duration) {
    currentTime = duration;
  }

  return { currentTime, duration };
}


/**
 * Cached Cover Art Data
 */
let cachedCoverUrl = '';
let cachedCoverBase64 = '';

function getCachedCover() {
  return {
    url: cachedCoverUrl,
    base64: cachedCoverBase64
  };
}

/**
 * Convert an image URL to a clean Base64 Data URL in RAM
 */
function processCoverImage(url, onStateCallback) {
  if (!url) {
    cachedCoverUrl = '';
    cachedCoverBase64 = '';
    if (typeof onStateCallback === 'function') onStateCallback(true);
    return;
  }

  if (url === cachedCoverUrl && cachedCoverBase64) {
    return;
  }

  cachedCoverUrl = url;

  // 1. Fast Canvas Capture from DOM image
  const domImg = $('ytmusic-player-bar img#img') ||
    $('ytmusic-player-bar .thumbnail img') ||
    $('ytmusic-player-bar .image') ||
    $('#layout ytmusic-player-bar img');

  if (domImg && domImg.complete && domImg.naturalWidth > 0) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 144;
      canvas.height = 144;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(domImg, 0, 0, 144, 144);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      if (dataUrl && dataUrl.length > 100) {
        cachedCoverBase64 = dataUrl;
        if (typeof onStateCallback === 'function') onStateCallback(true);
        return;
      }
    } catch (e) { }
  }

  // 2. Fetch binary blob
  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return res.blob();
    })
    .then(blob => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedCoverBase64 = reader.result || '';
        if (typeof onStateCallback === 'function') onStateCallback(true);
      };
      reader.readAsDataURL(blob);
    })
    .catch(() => { });
}

/**
 * Detect user browser platform for handshake diagnostics
 */
function detectBrowserPlatform() {
  const ua = (navigator.userAgent || '').toLowerCase();
  if (ua.includes('firefox') || ua.includes('fxios')) return 'firefox';
  if (ua.includes('edg/') || ua.includes('edge/')) return 'edge';
  if (navigator.brave && typeof navigator.brave.isBrave === 'function') return 'brave';
  if (ua.includes('opr/') || ua.includes('opera')) return 'opera';
  if (ua.includes('vivaldi')) return 'vivaldi';
  if (ua.includes('chrome') || ua.includes('crios')) return 'chromium';
  if (ua.includes('safari')) return 'safari';
  return 'browser';
}

/**
 * Compare semantic versions (e.g. "1.7.2.0" vs "1.7.1.0")
 */
function compareVersions(v1, v2) {
  const parts1 = (v1 || '').split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = (v2 || '').split('.').map((p) => parseInt(p, 10) || 0);
  const maxLen = Math.max(parts1.length, parts2.length, 4);

  for (let i = 0; i < maxLen; i++) {
    const n1 = parts1[i] || 0;
    const n2 = parts2[i] || 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
}

/**
 * Report version mismatch status to bridge / popup UI
 */
function reportMismatchStatus(isMismatch, requiredPluginVersion, currentPluginVersion, mismatchMessage) {
  try {
    window.postMessage({
      type: 'YTM_MISMATCH_STATUS',
      isMismatch: !!isMismatch,
      requiredPluginVersion: requiredPluginVersion || '',
      currentPluginVersion: currentPluginVersion || '',
      mismatchMessage: mismatchMessage || ''
    }, '*');
  } catch (e) { }
}

// Export utilities to YTM namespace
window.YTM.utils = {
  $,
  $$,
  clickElement,
  findVideoElement,
  getPlayerApi,
  isButtonActive,
  notifyState,
  cleanWhitespace,
  isNonAlbumText,
  parseTimeString,
  extractTrackTiming,
  getCachedCover,
  processCoverImage,
  detectBrowserPlatform,
  compareVersions,
  reportMismatchStatus
};
