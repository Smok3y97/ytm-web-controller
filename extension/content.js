/**
 * YouTube Music Web Controller - Content Script
 * 
 * High-performance, bulletproof bridge between music.youtube.com and
 * the local Elgato Stream Deck plugin / Discord RPC WebSocket server.
 */

(() => {
  'use strict';

  const DEFAULT_PORT = 39865;
  const TIMEUPDATE_THROTTLE_MS = 250;

  let ws = null;
  let currentPort = DEFAULT_PORT;
  let reconnectTimeout = null;
  let reconnectAttempts = 0;
  let lastTimeUpdate = 0;
  let isConnecting = false;

  let cachedCoverUrl = '';
  let cachedCoverBase64 = '';

  let currentVolumePercent = 100;

  let lastSentState = {
    title: '',
    artist: '',
    album: '',
    coverUrl: '',
    coverBase64: '',
    trackUrl: '',
    artistUrl: '',
    albumUrl: '',
    paused: true,
    currentTime: 0,
    duration: 0,
    volume: 1,
    muted: false,
    isLiked: false,
    isDisliked: false,
    shuffleActive: false,
    repeatMode: 'OFF'
  };

  /**
   * Safe selector query helpers
   */
  const $ = (selector, parent = document) => {
    try {
      return parent.querySelector(selector);
    } catch {
      return null;
    }
  };

  const $$ = (selector, parent = document) => {
    try {
      return Array.from(parent.querySelectorAll(selector));
    } catch {
      return [];
    }
  };

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

    // 5. View count patterns across all YouTube languages (digits + view keyword or pure view keyword with count):
    // e.g. "20 Mio. Aufrufe", "20M views", "1.2M views", "500 Aufrufe", "1 Aufruf", "20 M de vues", "10 млн просмотров", "500 次观看", "100万回視聴", "1.2만회 조회"
    const hasViewKeyword = /(?:aufruf|view|vue|visualiza|visualizz|просмотр|перегляд|wyświetle|görüntüleme|weergaven|visning|katselukert|zhlédnut|zhliadnut|megtekintés|vizionar|προβολ|pregled|צפי|مشاهد|ditonton|lượt\s*xem|回視聴|次观看|次觀看|조회|ครั้ง)/i.test(s);
    if (hasDigits && hasViewKeyword) return true;

    // 6. Relative upload times across languages:
    // e.g. "vor 3 Jahren", "3 years ago", "il y a 2 ans", "hace 5 meses", "2 anni fa", "3 года назад", "1年前", "3년 전", "há 3 anos"
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
   * Schedule state broadcasts at staggered intervals
   */
  function scheduleStateUpdates(delays = [50, 150, 350]) {
    delays.forEach(d => setTimeout(() => sendState(true), d));
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
   * Extract accurate track-relative timing & duration
   * Supports Player API, YouTube Music Player Bar, Progress Slider, and HTML5 video
   */
  function extractTrackTiming(video) {
    let currentTime = 0;
    let duration = 0;

    // 1. Try reading directly from Player API (highest precision)
    const playerApi = getPlayerApi();
    if (playerApi) {
      try {
        const pDur = typeof playerApi.getDuration === 'function' ? playerApi.getDuration() : 0;
        const pCur = typeof playerApi.getCurrentTime === 'function' ? playerApi.getCurrentTime() : 0;
        if (typeof pDur === 'number' && !isNaN(pDur) && isFinite(pDur) && pDur > 0) {
          duration = Math.floor(pDur);
          if (typeof pCur === 'number' && !isNaN(pCur) && isFinite(pCur) && pCur >= 0) {
            currentTime = Math.min(duration, Math.floor(pCur));
          }
          return { currentTime, duration };
        }
      } catch (e) { }
    }

    // 2. Try reading from .time-info text (standard YouTube Music Player Bar)
    const timeInfoElem = $('ytmusic-player-bar .time-info, ytmusic-player-bar span.time-info, #time-info, .time-info');
    if (timeInfoElem && timeInfoElem.textContent) {
      const text = timeInfoElem.textContent.trim();
      if (text.includes('/')) {
        const parts = text.split('/');
        if (parts.length === 2) {
          const parsedCurrent = parseTimeString(parts[0]);
          const parsedDuration = parseTimeString(parts[1]);

          if (parsedDuration > 0) {
            duration = parsedDuration;
            currentTime = Math.min(duration, parsedCurrent);
            return { currentTime, duration };
          }
        }
      }
    }

    // 3. Try reading from YouTube Video Player Overlay (.ytp-time-display, .ytp-time-current, .ytp-time-duration)
    const ytpDuration = $('.ytp-time-duration')?.textContent?.trim();
    const ytpCurrent = $('.ytp-time-current')?.textContent?.trim();
    if (ytpDuration) {
      const parsedDur = parseTimeString(ytpDuration);
      if (parsedDur > 0) {
        duration = parsedDur;
        if (ytpCurrent) {
          currentTime = Math.min(duration, parseTimeString(ytpCurrent));
        }
        return { currentTime, duration };
      }
    }

    // 4. Try reading from Progress Bar slider attributes
    const progressBar = $('ytmusic-player-bar #progress-bar, tp-yt-paper-slider#progress-bar, #progress-bar');
    if (progressBar) {
      const nowAttr = progressBar.getAttribute('aria-valuenow') ?? progressBar.getAttribute('value') ?? progressBar.value;
      const maxAttr = progressBar.getAttribute('aria-valuemax') ?? progressBar.getAttribute('max') ?? progressBar.max;

      const valNow = typeof nowAttr === 'number' ? nowAttr : parseInt(nowAttr, 10);
      const valMax = typeof maxAttr === 'number' ? maxAttr : parseInt(maxAttr, 10);

      if (!isNaN(valMax) && valMax > 0) {
        duration = valMax;
        if (!isNaN(valNow) && valNow >= 0) {
          currentTime = Math.min(duration, valNow);
        }
        return { currentTime, duration };
      }
    }

    // 5. Fallback with HTML5 video element
    if (video) {
      const vCur = (!isNaN(video.currentTime) && isFinite(video.currentTime)) ? Math.floor(video.currentTime) : 0;
      const vDur = (!isNaN(video.duration) && isFinite(video.duration) && video.duration > 0) ? Math.floor(video.duration) : 0;
      duration = vDur;
      currentTime = duration > 0 ? Math.min(duration, vCur) : vCur;
    }

    return { currentTime, duration };
  }

  /**
   * Bulletproof Play / Pause Toggle
   */
  function togglePlayPause() {
    const video = findVideoElement();
    if (video) {
      if (video.paused) {
        video.play().catch(() => {
          clickElement('#play-pause-button, ytmusic-player-bar #play-pause-button');
        });
      } else {
        video.pause();
      }
    } else {
      clickElement('#play-pause-button, ytmusic-player-bar #play-pause-button');
    }

    scheduleStateUpdates([50, 150, 350]);
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
   * Get current player volume (0 - 100)
   */
  function getPlayerVolume() {
    const playerApi = getPlayerApi();
    if (playerApi && typeof playerApi.getVolume === 'function') {
      try {
        const v = playerApi.getVolume();
        if (typeof v === 'number' && !isNaN(v)) return Math.round(v);
      } catch (e) { }
    }

    const playerBar = $('ytmusic-player-bar');
    if (playerBar && typeof playerBar.volume_ === 'number') {
      return Math.round(playerBar.volume_);
    }

    const slider = $('ytmusic-player-bar #volume-slider') || $('tp-yt-paper-slider#volume-slider') || $('#volume-slider');
    if (slider) {
      const val = slider.getAttribute('aria-valuenow') ?? slider.getAttribute('value') ?? slider.value;
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
        return parsed;
      }
    }

    const video = findVideoElement();
    if (video && typeof video.volume === 'number' && !isNaN(video.volume)) {
      return Math.round(video.volume * 100);
    }

    return currentVolumePercent;
  }

  /**
   * Get current player muted status
   */
  function getPlayerMuted() {
    const playerApi = getPlayerApi();
    if (playerApi && typeof playerApi.isMuted === 'function') {
      try {
        return playerApi.isMuted();
      } catch (e) { }
    }

    const playerBar = $('ytmusic-player-bar');
    if (playerBar && typeof playerBar.muted_ === 'boolean') {
      return playerBar.muted_;
    }

    const muteBtn = $('ytmusic-player-bar #volume-slider-volume-button') ||
      $('ytmusic-player-bar .volume') ||
      $('ytmusic-player-bar tp-yt-paper-icon-button.volume');
    if (muteBtn) {
      const label = (muteBtn.getAttribute('aria-label') || muteBtn.querySelector('button')?.getAttribute('aria-label') || '').toLowerCase();
      const title = (muteBtn.getAttribute('title') || muteBtn.querySelector('button')?.getAttribute('title') || '').toLowerCase();
      if (label.includes('unmute') || label.includes('stummschaltung aufheben') || title.includes('unmute') || title.includes('stummschaltung aufheben')) {
        return true;
      }
    }

    const video = findVideoElement();
    if (video) return video.muted;

    return false;
  }

  /**
   * Set player volume (0 - 100) and sync UI
   */
  function setPlayerVolume(targetPercent) {
    const clamped = Math.min(100, Math.max(0, Math.round(targetPercent)));
    currentVolumePercent = clamped;

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

    scheduleStateUpdates([50, 150]);
  }

  /**
   * Adjust volume by relative delta
   */
  function adjustPlayerVolume(delta) {
    const current = getPlayerVolume();
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

    scheduleStateUpdates([60, 200]);
  }

  /**
   * Seek playback by relative delta in seconds
   */
  function seekRelative(deltaSeconds) {
    const video = findVideoElement();
    const { currentTime, duration } = extractTrackTiming(video);
    const target = duration > 0
      ? Math.min(duration, Math.max(0, currentTime + deltaSeconds))
      : Math.max(0, currentTime + deltaSeconds);
    seekTo(target);
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

    scheduleStateUpdates([50, 150]);
  }

  /**
   * Queue track into YouTube Music without interrupting active playback
   */
  function queueTrack(videoId, mode = 'playNext') {
    if (!videoId) return false;

    console.log(`[YTM Controller] 🎵 Queueing track ${videoId} (mode: ${mode})`);

    const playerApi = getPlayerApi();
    const video = findVideoElement();
    const isCurrentlyPlaying = (video && !video.paused && video.currentTime > 0) ||
      (playerApi && typeof playerApi.getPlayerState === 'function' && playerApi.getPlayerState() === 1);

    const actionName = mode === 'playNext' ? 'yt-play-next-action' : 'yt-add-to-queue-action';
    const actionPayload = {
      actionName: actionName,
      args: [{
        videoId: videoId,
        playlistId: '',
        action: mode === 'playNext' ? 'PLAY_NEXT' : 'ADD_TO_QUEUE'
      }],
      optionalAction: true
    };

    // 1. Dispatch custom yt-action with Shadow DOM piercing (bubbles: true, composed: true)
    const targets = [
      document.querySelector('ytmusic-app'),
      document.querySelector('ytmusic-player-bar'),
      document.querySelector('ytmusic-player-page'),
      document.querySelector('ytmusic-app-layout'),
      document.body,
      document,
      window
    ];

    targets.forEach((target) => {
      if (!target) return;
      try {
        target.dispatchEvent(new CustomEvent('yt-action', {
          bubbles: true,
          composed: true,
          detail: actionPayload
        }));
      } catch (e) { }

      try {
        if (typeof target.dispatch === 'function') {
          target.dispatch(actionPayload);
        }
        if (typeof target.dispatchAction === 'function') {
          target.dispatchAction(actionPayload);
        }
      } catch (e) { }
    });

    // 2. Dispatch yt-service-request for queue insertion
    try {
      document.dispatchEvent(new CustomEvent('yt-service-request', {
        bubbles: true,
        composed: true,
        detail: {
          action: mode === 'playNext' ? 'PLAY_NEXT' : 'ADD_TO_QUEUE',
          queueInsertEndpoint: { videoId: videoId }
        }
      }));
    } catch (e) { }

    // 3. Player Bar Queue object inspection
    try {
      const playerBar = document.querySelector('ytmusic-player-bar');
      if (playerBar) {
        if (playerBar.queue_ && typeof playerBar.queue_.add === 'function') {
          playerBar.queue_.add(videoId, mode === 'playNext');
        } else if (playerBar.queue_ && typeof playerBar.queue_.addToQueue === 'function') {
          playerBar.queue_.addToQueue(videoId);
        }
      }
    } catch (e) { }

    // 4. If Player API provides dedicated non-interruptive queue methods
    if (playerApi) {
      try {
        if (typeof playerApi.queueVideo === 'function') {
          playerApi.queueVideo({ videoId });
        } else if (typeof playerApi.addToQueue === 'function') {
          playerApi.addToQueue({ videoId });
        }
      } catch (e) { }
    }

    // 5. If player is completely empty and stopped, start playback
    if (!isCurrentlyPlaying && playerApi) {
      try {
        const currentId = playerApi.getVideoData?.()?.video_id;
        if (!currentId && typeof playerApi.loadVideoById === 'function') {
          playerApi.loadVideoById({ videoId });
        }
      } catch (e) { }
    }

    scheduleStateUpdates([200, 600]);
    return true;
  }

  /**
   * Convert an image URL to a clean Base64 Data URL in RAM
   */
  function processCoverImage(url) {
    if (!url) {
      cachedCoverUrl = '';
      cachedCoverBase64 = '';
      sendState(true);
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
          sendState(true);
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
          sendState(true);
        };
        reader.readAsDataURL(blob);
      })
      .catch(() => { });
  }

  /**
   * Extract current playback metadata and player state from DOM & MediaSession
   */
  function collectPlaybackState() {
    const video = findVideoElement();
    const mediaSession = navigator.mediaSession?.metadata;
    const playerBar = $('ytmusic-player-bar');

    let title = '';
    let artist = '';
    let album = '';
    let coverUrl = '';
    let trackUrl = '';
    let artistUrl = '';
    let albumUrl = '';

    let videoId = '';

    // 1. Extract from YouTube Music Internal Player API & Polymer Data
    try {
      const moviePlayer = $('#movie_player') || $('#player');
      const playerApi = playerBar?.playerApi_ || (moviePlayer?.getVideoData ? moviePlayer : null);

      if (playerApi?.getVideoData) {
        const vData = playerApi.getVideoData();
        if (vData?.title && !title) title = vData.title.trim();
        if (vData?.author && !artist) artist = vData.author.trim();
        if (vData?.video_id) videoId = vData.video_id;
      }
      if (!videoId && playerBar?.__data?.endpoint?.watchEndpoint?.videoId) {
        videoId = playerBar.__data.endpoint.watchEndpoint.videoId;
      }
    } catch {}

    // 2. Extract Title, Artist, Album & URLs from DOM & MediaSession
    try {
      if (!title) {
        const titleLink = $('ytmusic-player-bar .title a') ||
          $('ytmusic-player-bar yt-formatted-string.title a') ||
          $('ytmusic-player-bar a.yt-simple-endpoint[href*="watch"]');
        if (titleLink) {
          title = titleLink.textContent?.trim() || '';
          if (!videoId && titleLink.href) {
            const match = titleLink.href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
            if (match && match[1]) videoId = match[1];
          }
        }
      }
      if (!title) {
        const titleElem = $('ytmusic-player-bar .title') ||
          $('ytmusic-player-bar yt-formatted-string.title') ||
          $('.middle-controls .title');
        title = titleElem?.textContent?.trim() || mediaSession?.title || '';
      }

      // Extract videoId from any watch links in the player bar or player page
      if (!videoId) {
        const watchLinks = $$('ytmusic-player-bar a[href*="watch"], ytmusic-player-page a[href*="watch"], .middle-controls a[href*="watch"]');
        for (const link of watchLinks) {
          const href = link.getAttribute('href') || link.href || '';
          const match = href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
          if (match && match[1]) {
            videoId = match[1];
            break;
          }
        }
      }

      // Extract videoId from current window URL
      if (!videoId && window.location.href.includes('watch')) {
        const match = window.location.href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        if (match && match[1]) {
          videoId = match[1];
        }
      }

      // Extract videoId from artwork URLs (e.g. https://i.ytimg.com/vi/TVr_NgbzHqw/hqdefault.jpg)
      if (!videoId) {
        const artworks = mediaSession?.artwork || [];
        for (const art of artworks) {
          const src = art.src || '';
          const match = src.match(/\/vi\/([a-zA-Z0-9_-]{11})\//) || src.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
          if (match && match[1]) {
            videoId = match[1];
            break;
          }
        }
      }

      if (!videoId) {
        const imgs = $$('ytmusic-player-bar img, ytmusic-player-page img');
        for (const img of imgs) {
          const src = img.getAttribute('src') || img.src || '';
          const match = src.match(/\/vi\/([a-zA-Z0-9_-]{11})\//);
          if (match && match[1]) {
            videoId = match[1];
            break;
          }
        }
      }

      // Build canonical clean watch sharing URL if videoId found
      if (videoId) {
        trackUrl = `https://music.youtube.com/watch?v=${videoId}`;
      }

      // Query Byline element
      const bylineElem = $('ytmusic-player-bar .byline') ||
        $('ytmusic-player-bar .subtitle') ||
        $('ytmusic-player-bar yt-formatted-string.byline') ||
        $('ytmusic-player-bar yt-formatted-string.subtitle') ||
        $('.middle-controls .byline') ||
        $('.middle-controls .subtitle') ||
        $('ytmusic-player-bar .content-info-wrapper .subtitle');

      if (bylineElem) {
        // 1. Check explicit structured anchor links first
        const allLinks = Array.from(bylineElem.querySelectorAll('a'));
        let foundAlbumLink = false;

        for (const a of allLinks) {
          const href = a.getAttribute('href') || a.href || '';
          const text = a.textContent?.trim() || '';
          if (!href || !text) continue;

          if (href.includes('browse/MPRE') || href.includes('browse/FEmusic_library_album') || href.includes('browse/FEmusic_album') || href.includes('/album')) {
            if (!album && !isNonAlbumText(text)) {
              album = text;
              foundAlbumLink = true;
            }
            if (!albumUrl) albumUrl = a.href;
          } else if (href.includes('channel/') || href.includes('browse/UC') || href.includes('artist')) {
            if (!artistUrl) artistUrl = a.href;
          }
        }

        // 2. Parse byline textual segments (delimited by • or · or |)
        const bylineRawText = cleanWhitespace(bylineElem.textContent || '');
        const parts = bylineRawText.split(/[\u2022\u00B7\u2023\u25E6\u2043\u2219·•|]/).map(p => p.trim()).filter(Boolean);

        if (!artist && parts.length > 0) {
          artist = parts[0];
        }

        // Only search textual parts for album if no structured album link was found
        if (!album && !foundAlbumLink && parts.length > 1) {
          for (let i = 1; i < parts.length; i++) {
            const candidate = parts[i];
            if (!isNonAlbumText(candidate)) {
              album = candidate;
              break;
            }
          }
        }
      }

      // Fallbacks from MediaSession
      if (!album && mediaSession?.album && !isNonAlbumText(mediaSession.album)) {
        album = mediaSession.album.trim();
      }
      if (!artist && mediaSession?.artist) {
        artist = mediaSession.artist.trim();
      }

      // Clean artist and album
      artist = cleanWhitespace(artist);
      album = cleanWhitespace(album);

      // Extra safeguard against non-album text strings
      if (album && isNonAlbumText(album)) {
        album = '';
        albumUrl = '';
      }

      // If album name is present as a standalone segment or whole word inside artist, strip it safely!
      if (album && album.length >= 3 && artist.length > album.length) {
        const escapedAlbum = album.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        artist = artist.replace(new RegExp(`(^|\\s*[\\u2022\\u00B7·•\\-|]\\s*|\\s+)${escapedAlbum}(\\s*[\\u2022\\u00B7·•\\-|]\\s*|\\s+|$)`, 'gi'), '$1').trim();
      }

      // Strip trailing 4-digit release years at the very end of string (preserving band names like "The 1975" or "1984")
      artist = artist.replace(/(?:[\s\u2022\u00B7·•\-|]|\s+)\b(19|20)\d{2}\b$/g, '').trim();
      artist = artist.replace(/^(E|\[E\])\s+/i, '').trim();
      artist = artist.replace(/[\u2022\u00B7\u2023\u25E6\u2043\u2219·•\-,|\s]+$/, '').trim();

      // Normalize relative URLs
      if (trackUrl && trackUrl.startsWith('/')) trackUrl = `https://music.youtube.com${trackUrl}`;
      if (artistUrl && artistUrl.startsWith('/')) artistUrl = `https://music.youtube.com${artistUrl}`;
      if (albumUrl && albumUrl.startsWith('/')) albumUrl = `https://music.youtube.com${albumUrl}`;

      // Clean up trackUrl to canonical watch URL if it contains watch?v=
      if (trackUrl && trackUrl.includes('watch')) {
        const vMatch = trackUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        if (vMatch && vMatch[1]) {
          trackUrl = `https://music.youtube.com/watch?v=${vMatch[1]}`;
        }
      }

      // Fallback URLs only if direct watch URL could not be constructed
      if (!trackUrl && title) {
        trackUrl = `https://music.youtube.com/search?q=${encodeURIComponent(title + ' ' + (artist || ''))}`;
      }
      if (!artistUrl && artist) {
        artistUrl = `https://music.youtube.com/search?q=${encodeURIComponent(artist)}`;
      }
    } catch {}

    if (mediaSession?.artwork && mediaSession.artwork.length > 0) {
      const sortedArtworks = [...mediaSession.artwork].sort((a, b) => {
        const sizeA = parseInt(a.sizes?.split('x')[0] || '0', 10);
        const sizeB = parseInt(b.sizes?.split('x')[0] || '0', 10);
        return sizeB - sizeA;
      });
      coverUrl = sortedArtworks[0]?.src || '';
    }
    if (!coverUrl) {
      const imgElem = $('ytmusic-player-bar img#img') ||
        $('ytmusic-player-bar .thumbnail img') ||
        $('ytmusic-player-bar .image');
      coverUrl = imgElem?.src || '';
    }

    if (coverUrl && coverUrl !== cachedCoverUrl) {
      processCoverImage(coverUrl);
    }

    let paused = true;
    const volPercent = getPlayerVolume();
    const muted = getPlayerMuted();
    currentVolumePercent = volPercent;

    if (video) {
      paused = video.paused;
    }
    const playerApi = getPlayerApi();
    if (playerApi && typeof playerApi.getPlayerState === 'function') {
      try {
        const pState = playerApi.getPlayerState();
        // 1 = PLAYING, 3 = BUFFERING
        if (pState === 1 || pState === 3) {
          paused = false;
        } else if (pState === 2) {
          paused = true;
        }
      } catch (e) { }
    }

    const { currentTime, duration } = extractTrackTiming(video);

    const volume = volPercent;

    // 2. Like & Dislike Status
    let isLiked = false;
    let isDisliked = false;

    const likeRenderer = $('ytmusic-like-button-renderer, #like-button-renderer, ytmusic-player-bar ytmusic-like-button-renderer');
    const likeStatusAttr = likeRenderer?.getAttribute('like-status');

    if (likeStatusAttr === 'LIKE') {
      isLiked = true;
      isDisliked = false;
    } else if (likeStatusAttr === 'DISLIKE') {
      isLiked = false;
      isDisliked = true;
    } else if (playerBar && typeof playerBar.likeStatus_ === 'string') {
      isLiked = playerBar.likeStatus_ === 'LIKE';
      isDisliked = playerBar.likeStatus_ === 'DISLIKE';
    } else {
      const likeButton = $('#like-button-renderer tp-yt-paper-icon-button#like-button') ||
        $('#like-button-renderer #button-shape-like button') ||
        $('ytmusic-like-button-renderer #button-shape-like button') ||
        $('ytmusic-like-button-renderer #button-shape-like') ||
        $('[aria-label*="mag ich" i]:not([aria-label*="nicht" i])') ||
        $('[aria-label*="like" i]:not([aria-label*="dislike" i])');

      const dislikeButton = $('#like-button-renderer tp-yt-paper-icon-button#dislike-button') ||
        $('#like-button-renderer #button-shape-dislike button') ||
        $('ytmusic-like-button-renderer #button-shape-dislike button') ||
        $('ytmusic-like-button-renderer #button-shape-dislike') ||
        $('[aria-label*="mag ich nicht" i]') ||
        $('[aria-label*="dislike" i]');
      const likeInner = likeButton?.querySelector('button') || likeButton;
      const dislikeInner = dislikeButton?.querySelector('button') || dislikeButton;

      isLiked = likeButton?.getAttribute('aria-pressed') === 'true' ||
        likeButton?.classList?.contains('selected') ||
        likeInner?.getAttribute('aria-pressed') === 'true' || false;

      isDisliked = dislikeButton?.getAttribute('aria-pressed') === 'true' ||
        dislikeButton?.classList?.contains('selected') ||
        dislikeInner?.getAttribute('aria-pressed') === 'true' || false;
    }

    // 3. Shuffle Status
    let shuffleActive = false;

    const rawShuffle = playerBar?.shuffleOn_ ?? 
      playerBar?.shuffleActive_ ?? 
      playerBar?.__data?.shuffleOn ?? 
      playerBar?.__data?.shuffleActive;

    if (typeof rawShuffle === 'boolean') {
      shuffleActive = rawShuffle;
    } else {
      const shuffleButton = $('tp-yt-paper-icon-button.shuffle, .shuffle, #shuffle-button', playerBar) ||
        $('ytmusic-player-bar tp-yt-paper-icon-button.shuffle') ||
        $('ytmusic-player-bar .shuffle');

      if (shuffleButton) {
        const innerBtn = shuffleButton.querySelector('button');
        const ariaPressed = (shuffleButton.getAttribute('aria-pressed') || innerBtn?.getAttribute('aria-pressed') || '').toLowerCase();
        const ariaChecked = (shuffleButton.getAttribute('aria-checked') || innerBtn?.getAttribute('aria-checked') || '').toLowerCase();
        const hasActiveAttr = shuffleButton.hasAttribute('active') || innerBtn?.hasAttribute('active') || false;
        const isSelected = shuffleButton.classList.contains('selected') || (innerBtn ? innerBtn.classList.contains('selected') : false);

        const label = (
          shuffleButton.getAttribute('aria-label') ||
          innerBtn?.getAttribute('aria-label') ||
          shuffleButton.getAttribute('title') ||
          innerBtn?.getAttribute('title') ||
          ''
        ).toLowerCase();

        const hasDeactivateText = label.includes('deaktivieren') ||
          label.includes('ausschalten') ||
          label.includes('turn off') ||
          label.includes('is on');

        shuffleActive = ariaPressed === 'true' || ariaChecked === 'true' || hasActiveAttr || isSelected || hasDeactivateText;
      }
    }

    // 4. Repeat Status
    let repeatMode = 'OFF';

    const rawRepeat = playerBar?.repeatMode_ ?? 
      playerBar?.__data?.repeatMode ?? 
      playerBar?.__data?.repeatMode_ ?? 
      playerBar?.repeatMode;

    if (typeof rawRepeat === 'number') {
      if (rawRepeat === 2) repeatMode = 'ONE';
      else if (rawRepeat === 1) repeatMode = 'ALL';
      else repeatMode = 'OFF';
    } else if (typeof rawRepeat === 'string') {
      const rm = rawRepeat.toUpperCase().trim();
      if (rm === 'NONE' || rm === 'OFF' || rm === '0' || rm === 'REPEAT_OFF' || rm === 'REPEAT_NONE') {
        repeatMode = 'OFF';
      } else if (rm === 'ONE' || rm === '2' || rm === 'FEATURED' || rm === 'REPEAT_ONE' || rm === 'REPEAT_SINGLE' || rm === 'TRACK') {
        repeatMode = 'ONE';
      } else if (rm === 'ALL' || rm === '1' || rm === 'REPEAT_ALL') {
        repeatMode = 'ALL';
      } else {
        repeatMode = 'OFF';
      }
    } else if (typeof rawRepeat === 'boolean') {
      repeatMode = rawRepeat ? 'ALL' : 'OFF';
    } else {
      const repeatButton = $('tp-yt-paper-icon-button.repeat, .repeat, #repeat-button', playerBar) ||
        $('ytmusic-player-bar tp-yt-paper-icon-button.repeat') ||
        $('ytmusic-player-bar .repeat');

      if (repeatButton) {
        const innerBtn = repeatButton.querySelector('button');
        const ironIcon = repeatButton.querySelector('tp-yt-iron-icon, iron-icon, yt-icon, #icon, [icon]');
        const iconAttr = (
          ironIcon?.getAttribute('icon') ||
          repeatButton.getAttribute('icon') ||
          ironIcon?.getAttribute('src') ||
          ''
        ).toLowerCase();

        const btnHtml = repeatButton.innerHTML.toLowerCase();
        const label = (
          repeatButton.getAttribute('aria-label') ||
          innerBtn?.getAttribute('aria-label') ||
          repeatButton.getAttribute('title') ||
          innerBtn?.getAttribute('title') ||
          ''
        ).toLowerCase();

        const ariaPressed = (repeatButton.getAttribute('aria-pressed') || innerBtn?.getAttribute('aria-pressed') || '').toLowerCase();
        const ariaChecked = (repeatButton.getAttribute('aria-checked') || innerBtn?.getAttribute('aria-checked') || '').toLowerCase();
        const hasActiveAttr = repeatButton.hasAttribute('active') || innerBtn?.hasAttribute('active') || false;
        const isSelected = repeatButton.classList.contains('selected') || (innerBtn ? innerBtn.classList.contains('selected') : false);
        const isAriaActive = ariaPressed === 'true' || ariaChecked === 'true' || hasActiveAttr || isSelected;

        const hasDeactivateText = label.includes('deaktivieren') ||
          label.includes('ausschalten') ||
          label.includes('turn off') ||
          label.includes('desactivar') ||
          label.includes('désactiver') ||
          label.includes('is on');

        const isCurrentlyActive = isAriaActive || hasDeactivateText;

        const isOne = (
          iconAttr.includes('repeat_one') ||
          iconAttr.includes('repeat-one') ||
          iconAttr.includes('repeat1') ||
          btnHtml.includes('repeat_one') ||
          btnHtml.includes('repeat-one') ||
          btnHtml.includes('repeat1') ||
          btnHtml.includes('id="repeat-one"') ||
          btnHtml.includes('id="repeat_one"') ||
          label.includes('1 titel') ||
          label.includes('diesen titel') ||
          label.includes('aktuellen titel') ||
          label.includes('einzelnen titel') ||
          label.includes('wiederholen (1)') ||
          label.includes('wiederholung: 1') ||
          label.includes('repeat one') ||
          label.includes('repeat 1') ||
          label.includes('repeat: 1') ||
          label.includes('repeat: one') ||
          label.includes('repeat single') ||
          label.includes('repetir una') ||
          label.includes('repetir 1') ||
          label.includes('répéter le titre actuel') ||
          label.includes('répéter 1 titre') ||
          label.includes('répéter ce titre')
        ) && !label.includes('alle') && !label.includes('all') && !label.includes('tout') && !label.includes('todo') && !label.includes('aus') && !label.includes('off');

        if (isCurrentlyActive) {
          repeatMode = isOne ? 'ONE' : 'ALL';
        } else if (isOne && (iconAttr.includes('repeat_one') || iconAttr.includes('repeat-one') || label.includes('aktuellen') || label.includes('diesen') || label.includes('1 titel') || label.includes('repeat one'))) {
          repeatMode = 'ONE';
        } else {
          repeatMode = 'OFF';
        }
      }
    }

    return {
      title,
      artist,
      album,
      coverUrl,
      coverBase64: cachedCoverBase64,
      trackUrl,
      artistUrl,
      albumUrl,
      currentTime,
      duration,
      volume,
      paused,
      muted,
      isLiked,
      isDisliked,
      shuffleActive,
      repeatMode
    };
  }

  /**
   * Broadcast state payload over WebSocket
   */
  function sendState(force = false) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    try {
      const state = collectPlaybackState();

      if (!force) {
        const isIdentical = (
          state.title === lastSentState.title &&
          state.artist === lastSentState.artist &&
          state.album === lastSentState.album &&
          state.paused === lastSentState.paused &&
          state.duration === lastSentState.duration &&
          state.volume === lastSentState.volume &&
          state.muted === lastSentState.muted &&
          state.isLiked === lastSentState.isLiked &&
          state.isDisliked === lastSentState.isDisliked &&
          state.shuffleActive === lastSentState.shuffleActive &&
          state.repeatMode === lastSentState.repeatMode &&
          state.coverBase64 === lastSentState.coverBase64 &&
          state.trackUrl === lastSentState.trackUrl &&
          state.artistUrl === lastSentState.artistUrl &&
          state.albumUrl === lastSentState.albumUrl &&
          Math.abs(state.currentTime - (lastSentState.currentTime || 0)) < 1
        );

        if (isIdentical) return;
      }

      lastSentState = { ...state };

      ws.send(JSON.stringify({
        type: 'STATE_UPDATE',
        timestamp: Date.now(),
        data: state,
        state: state
      }));
    } catch (err) {
      console.error('[YTM Controller] Error collecting/sending state:', err);
    }
  }

  /**
   * Execute control commands received from Stream Deck
   */
  function handleCommand(message) {
    if (!message) return;

    try {
      const command = typeof message === 'string' ? message : message.command;
      const payload = (typeof message === 'object' && message ? message.payload : {}) || {};
      if (!command) return;

      console.log(`[YTM Controller] Executing command: ${command}`, payload);
      switch (command) {
        case 'playPause': {
          togglePlayPause();
          break;
        }

        case 'play': {
          const video = findVideoElement();
          if (video && video.paused) {
            video.play().catch(() => {
              clickElement('#play-pause-button, ytmusic-player-bar #play-pause-button, tp-yt-paper-icon-button#play-pause-button, .play-pause-button');
            });
          }
          scheduleStateUpdates([100]);
          break;
        }

        case 'pause': {
          const video = findVideoElement();
          if (video && !video.paused) {
            if (!clickElement('#play-pause-button, ytmusic-player-bar #play-pause-button, tp-yt-paper-icon-button#play-pause-button, .play-pause-button')) {
              video.pause();
            }
          }
          scheduleStateUpdates([100]);
          break;
        }

        case 'next': {
          clickElement('.next-button, tp-yt-paper-icon-button.next-button, #next-button');
          scheduleStateUpdates([150]);
          break;
        }

        case 'previous': {
          clickElement('.previous-button, tp-yt-paper-icon-button.previous-button, #previous-button');
          scheduleStateUpdates([150]);
          break;
        }

        case 'like': {
          clickElement(
            'ytmusic-like-button-renderer #button-shape-like button, ' +
            '#like-button-renderer #button-shape-like button, ' +
            '#like-button-renderer tp-yt-paper-icon-button#like-button, ' +
            'ytmusic-player-bar ytmusic-like-button-renderer #button-shape-like, ' +
            'ytmusic-like-button-renderer #button-shape-like, ' +
            'ytmusic-like-button-renderer tp-yt-paper-icon-button.like'
          );
          scheduleStateUpdates([60, 200, 450]);
          break;
        }

        case 'dislike': {
          clickElement(
            'ytmusic-like-button-renderer #button-shape-dislike button, ' +
            '#like-button-renderer #button-shape-dislike button, ' +
            '#like-button-renderer tp-yt-paper-icon-button#dislike-button, ' +
            'ytmusic-player-bar ytmusic-like-button-renderer #button-shape-dislike, ' +
            'ytmusic-like-button-renderer #button-shape-dislike, ' +
            'ytmusic-like-button-renderer tp-yt-paper-icon-button.dislike'
          );
          scheduleStateUpdates([60, 200, 450]);
          break;
        }

        case 'shuffle': {
          const shuffleSelectors = [
            'ytmusic-player-bar tp-yt-paper-icon-button.shuffle',
            'ytmusic-player-bar .shuffle',
            'ytmusic-player-bar #shuffle-button',
            'ytmusic-player-bar [aria-label*="zufall" i]',
            'ytmusic-player-bar [aria-label*="shuffle" i]'
          ];
          for (const sel of shuffleSelectors) {
            if (clickElement(sel)) break;
          }
          scheduleStateUpdates([60, 200, 450]);
          break;
        }

        case 'repeat': {
          const repeatSelectors = [
            'ytmusic-player-bar tp-yt-paper-icon-button.repeat',
            'ytmusic-player-bar .repeat',
            'ytmusic-player-bar #repeat-button',
            'ytmusic-player-bar [aria-label*="wiederhol" i]',
            'ytmusic-player-bar [aria-label*="repeat" i]'
          ];
          for (const sel of repeatSelectors) {
            if (clickElement(sel)) break;
          }
          scheduleStateUpdates([60, 200, 450]);
          break;
        }

        case 'volumeUp': {
          adjustPlayerVolume(payload.step || 5);
          break;
        }

        case 'volumeDown': {
          adjustPlayerVolume(-(payload.step || 5));
          break;
        }

        case 'adjustVolume': {
          adjustPlayerVolume(payload.delta || 0);
          break;
        }

        case 'setVolume': {
          if (typeof payload.volume === 'number') {
            setPlayerVolume(payload.volume);
          }
          break;
        }

        case 'toggleMute':
        case 'volumeMute': {
          togglePlayerMute();
          break;
        }

        case 'seek':
        case 'seekRelative': {
          const delta = typeof payload.seconds === 'number' ? payload.seconds : (typeof payload.delta === 'number' ? payload.delta : 0);
          seekRelative(delta);
          break;
        }

        case 'seekTo': {
          const time = typeof payload.time === 'number' ? payload.time : (typeof payload.seconds === 'number' ? payload.seconds : 0);
          seekTo(time);
          break;
        }

        case 'queueTrack':
        case 'playNext': {
          const videoId = payload.videoId || payload.id;
          const mode = payload.mode || 'playNext';
          if (videoId) {
            queueTrack(videoId, mode);
          }
          break;
        }

        case 'requestState': {
          lastSentState = {};
          sendState(true);
          scheduleStateUpdates([50, 200]);
          break;
        }

        case 'focusTab':
        case 'bringToFront': {
          try {
            window.focus();
            window.postMessage({ type: 'YTM_FOCUS_TAB' }, '*');
          } catch { }
          break;
        }

        default:
          console.log('[YTM Controller] Unknown command:', command);
      }
    } catch (err) {
      console.error('[YTM Controller] Error executing command:', err);
    }
  }

  function onTimeUpdate() {
    const now = performance.now();
    if (now - lastTimeUpdate >= TIMEUPDATE_THROTTLE_MS) {
      lastTimeUpdate = now;
      sendState(false);
    }
  }

  function setupGlobalMediaListeners() {
    document.addEventListener('play', () => sendState(true), true);
    document.addEventListener('playing', () => sendState(true), true);
    document.addEventListener('pause', () => sendState(true), true);
    document.addEventListener('volumechange', () => sendState(true), true);
    document.addEventListener('timeupdate', onTimeUpdate, true);
    document.addEventListener('ratechange', () => sendState(true), true);
    document.addEventListener('loadedmetadata', () => sendState(true), true);
    document.addEventListener('durationchange', () => sendState(true), true);
    document.addEventListener('ended', () => sendState(true), true);

    const targetNode = $('ytmusic-player-bar') || document.body;
    const observer = new MutationObserver(() => {
      sendState(false);
    });
    observer.observe(targetNode, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['aria-pressed', 'aria-checked', 'aria-label', 'aria-valuenow', 'aria-valuemax', 'value', 'src', 'title', 'class', 'icon']
    });

    // 500ms heartbeat ticker ensures smooth remaining time / progress updates even if tab is in background
    setInterval(() => {
      const video = findVideoElement();
      if (video && !video.paused) {
        sendState(false);
      }
    }, 500);
  }

  let bridgeVersion = '1.5.1.0';

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

  function connectWebSocket(port) {
    if (isConnecting) return;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      if (currentPort === port) return;
      ws.close();
    }

    currentPort = port || DEFAULT_PORT;
    isConnecting = true;

    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    const wsUrl = `ws://127.0.0.1:${currentPort}`;

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        isConnecting = false;
        reconnectAttempts = 0;
        console.log(`[YTM Controller] 🟢 Connected to Stream Deck on port ${currentPort}`);

        lastSentState = {};

        const extVersion = bridgeVersion || '1.5.0.0';
        const platform = detectBrowserPlatform();

        // 1. Send Handshake packet immediately before any playback events
        try {
          ws.send(JSON.stringify({
            type: 'handshake',
            version: extVersion,
            platform: platform
          }));
        } catch (e) { }

        // 2. Register client info
        try {
          ws.send(JSON.stringify({
            type: 'REGISTER_CLIENT',
            client: 'ytm-extension',
            version: extVersion,
            platform: platform,
            url: window.location.href
          }));
        } catch (e) { }

        sendState(true);
        scheduleStateUpdates([50, 150, 400]);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'handshake_ack') {
            const comp = compareVersions(bridgeVersion, data.version);
            if (comp === 0) {
              console.log(`[YTM Controller] 🟢 Handshake ACK received (Plugin v${data.version})`);
              reportMismatchStatus(false);
              sendState(true);
              scheduleStateUpdates([50, 200]);
            } else if (comp > 0) {
              console.warn(`[YTM Controller] ⚠️ Plugin v${data.version} is older than Extension v${bridgeVersion}`);
              reportMismatchStatus(true, bridgeVersion, data.version, `Stream Deck Plugin (v${data.version}) is outdated!`);
            } else {
              console.warn(`[YTM Controller] ⚠️ Extension v${bridgeVersion} is older than Plugin v${data.version}`);
              reportMismatchStatus(true, data.version, data.version, `Browser Extension (v${bridgeVersion}) is outdated!`);
            }
            return;
          }

          if (data.type === 'version_mismatch') {
            console.warn(`[YTM Controller] ⚠️ Version mismatch from Stream Deck Plugin:`, data);
            reportMismatchStatus(true, data.requiredPluginVersion, data.currentPluginVersion, data.message);
            return;
          }

          handleCommand(data);
        } catch (err) {
          console.warn('[YTM Controller] Invalid message:', event.data);
        }
      };

      ws.onclose = () => {
        isConnecting = false;
        ws = null;
        scheduleReconnect();
      };

      ws.onerror = () => {
        isConnecting = false;
      };
    } catch {
      isConnecting = false;
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    if (reconnectTimeout) return;
    reconnectAttempts++;
    const delay = Math.min(3000, 800 + reconnectAttempts * 400);
    reconnectTimeout = setTimeout(() => {
      reconnectTimeout = null;
      connectWebSocket(currentPort);
    }, delay);
  }

  function init() {
    console.log('[YTM Controller] ⚡ Initializing YouTube Music Content Script...');

    setupGlobalMediaListeners();

    // Listen for configuration from bridge script (ISOLATED world)
    window.addEventListener('message', (event) => {
      if (event.source !== window || !event.data || typeof event.data !== 'object') return;

      if (event.data.type === 'YTM_BRIDGE_CONFIG') {
        if (event.data.version) bridgeVersion = event.data.version;
        const targetPort = event.data.wsPort || DEFAULT_PORT;
        connectWebSocket(targetPort);
      } else if (event.data.type === 'YTM_BRIDGE_PORT_UPDATE') {
        const targetPort = event.data.wsPort || DEFAULT_PORT;
        if (targetPort !== currentPort) {
          console.log(`[YTM Controller] Switching WebSocket port to ${targetPort}`);
          connectWebSocket(targetPort);
        }
      }
    });

    // Request initial configuration from bridge
    try {
      window.postMessage({ type: 'YTM_PAGE_REQUEST_CONFIG' }, '*');
    } catch (e) { }

    // Fallback: If bridge doesn't respond within 200ms, connect with default port
    setTimeout(() => {
      if (!ws) {
        connectWebSocket(DEFAULT_PORT);
      }
    }, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
