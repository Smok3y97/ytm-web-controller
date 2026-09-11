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
  const sel = window.YTM.selectors?.player?.video;
  if (sel) {
    const v = $(sel);
    if (v) return v;
  }
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
  if (window.YTM.playerApi?.getPlayerApi) {
    return window.YTM.playerApi.getPlayerApi();
  }

  const selectors = window.YTM.selectors?.player || {};
  const playerBar = $(selectors.playerBar || 'ytmusic-player-bar');
  if (playerBar?.playerApi_) return playerBar.playerApi_;

  const moviePlayer = $(selectors.moviePlayer || '#movie_player') || $('#player') || $('.html5-video-player');
  if (moviePlayer && typeof moviePlayer.setVolume === 'function') return moviePlayer;

  const ytPlayer = $(selectors.ytPlayer || 'ytmusic-player');
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
 * Extract best artwork URL from MediaSession metadata (prefers 226x226 for LCD/Keys)
 */
function extractArtworkUrl(mediaSession) {
  const artworks = mediaSession?.artwork;
  if (!artworks || !Array.isArray(artworks) || artworks.length === 0) {
    return '';
  }

  // Prefer 226x226 (optimal resolution for Stream Deck LCD touchstrips and keypad keys)
  const preferred = artworks.find(a => a && a.sizes === '226x226');
  if (preferred?.src) return preferred.src;

  // Otherwise sort by resolution descending
  const sorted = [...artworks].sort((a, b) => {
    const sizeA = parseInt(a?.sizes?.split('x')[0] || '0', 10);
    const sizeB = parseInt(b?.sizes?.split('x')[0] || '0', 10);
    return sizeB - sizeA;
  });

  return sorted[0]?.src || artworks[artworks.length - 1]?.src || '';
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

/**
 * Convert time string (e.g. "3:45", "03:45", "1:15:30") to total seconds
 */
function parseTimeToSeconds(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const parts = cleanWhitespace(timeStr).split(':').map(p => parseInt(p, 10));
  if (parts.some(p => isNaN(p) || p < 0)) return 0;

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 1) {
    return parts[0];
  }
  return 0;
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
  extractArtworkUrl,
  detectBrowserPlatform,
  compareVersions,
  reportMismatchStatus,
  parseTimeToSeconds
};
