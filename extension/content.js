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
   * Resolves continuous MSE buffer offsets across playlist tracks
   */
  function extractTrackTiming(video) {
    let currentTime = 0;
    let duration = 0;
    let hasUiTiming = false;

    // 1. Try reading from .time-info text (most reliable for track-relative time in YTM)
    const timeInfoElem = $('ytmusic-player-bar .time-info') ||
      $('ytmusic-player-bar span.time-info') ||
      $('#time-info') ||
      $('.time-info');

    if (timeInfoElem && timeInfoElem.textContent) {
      const text = timeInfoElem.textContent.trim();
      if (text.includes('/')) {
        const parts = text.split('/');
        if (parts.length === 2) {
          const parsedCurrent = parseTimeString(parts[0]);
          const parsedDuration = parseTimeString(parts[1]);

          if (parsedDuration > 0) {
            duration = parsedDuration;
            currentTime = parsedCurrent;
            hasUiTiming = true;
          }
        }
      }
    }

    // 2. Try reading from Progress Bar slider attributes
    if (!hasUiTiming || duration === 0) {
      const progressBar = $('ytmusic-player-bar #progress-bar') ||
        $('#progress-bar') ||
        $('tp-yt-paper-slider#progress-bar') ||
        $('tp-yt-paper-progress#progress-bar') ||
        $('.progress-bar');

      if (progressBar) {
        const nowAttr = progressBar.getAttribute('aria-valuenow') ?? progressBar.getAttribute('value') ?? progressBar.value;
        const maxAttr = progressBar.getAttribute('aria-valuemax') ?? progressBar.getAttribute('max') ?? progressBar.max;

        const valNow = typeof nowAttr === 'number' ? nowAttr : parseInt(nowAttr, 10);
        const valMax = typeof maxAttr === 'number' ? maxAttr : parseInt(maxAttr, 10);

        if (!isNaN(valMax) && valMax > 0) {
          duration = valMax;
          if (!isNaN(valNow) && valNow >= 0) {
            currentTime = valNow;
          }
          hasUiTiming = true;
        }
      }
    }

    // 3. Fallback / Fine-tune with HTML5 video element
    if (video) {
      const vCur = (!isNaN(video.currentTime) && isFinite(video.currentTime)) ? Math.floor(video.currentTime) : 0;
      const vDur = (!isNaN(video.duration) && isFinite(video.duration) && video.duration > 0) ? Math.floor(video.duration) : 0;

      if (duration === 0 && vDur > 0) {
        duration = vDur;
      }

      // If duration is known, verify if video.currentTime is valid track time (not MSE cumulative buffer time)
      if (duration > 0) {
        if (vCur <= duration && (!hasUiTiming || Math.abs(vCur - currentTime) <= 3)) {
          currentTime = vCur;
        }
      } else {
        if (currentTime === 0 && vCur > 0) {
          currentTime = vCur;
        }
      }
    }

    // Clamp currentTime to [0, duration] if duration is known
    if (duration > 0) {
      currentTime = Math.min(duration, Math.max(0, currentTime));
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
          const playBtn = $('#play-pause-button, ytmusic-player-bar #play-pause-button');
          if (playBtn) playBtn.click();
        });
      } else {
        video.pause();
      }
    } else {
      const playBtn = $('#play-pause-button, ytmusic-player-bar #play-pause-button');
      if (playBtn) playBtn.click();
    }

    setTimeout(() => sendState(true), 50);
    setTimeout(() => sendState(true), 150);
    setTimeout(() => sendState(true), 350);
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

    // 1. Extract from YouTube Music Internal Player API
    try {
      const playerBar = $('ytmusic-player-bar');
      if (playerBar && playerBar.playerApi_?.getVideoData) {
        const vData = playerBar.playerApi_.getVideoData();
        if (vData?.title) title = vData.title.trim();
        if (vData?.author) artist = vData.author.trim();
        if (vData?.video_id) trackUrl = `https://music.youtube.com/watch?v=${vData.video_id}`;
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
          if (!trackUrl && titleLink.href) {
            trackUrl = titleLink.href;
          }
        }
      }
      if (!title) {
        const titleElem = $('ytmusic-player-bar .title') ||
          $('ytmusic-player-bar yt-formatted-string.title') ||
          $('.middle-controls .title');
        title = titleElem?.textContent?.trim() || mediaSession?.title || '';
      }
      if (!trackUrl && window.location.href.includes('music.youtube.com/watch')) {
        trackUrl = window.location.href;
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
        const bylineRawText = (bylineElem.textContent || '').replace(/[\s\u00A0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/g, ' ').trim();
        const parts = bylineRawText.split(/[\u2022\u00B7\u2023\u25E6\u2043\u2219·•|]/).map(p => p.trim()).filter(Boolean);

        if (parts.length > 0) {
          artist = parts[0];
        }
        if (parts.length > 1 && !/^\d{4}$/.test(parts[1])) {
          album = parts[1];
        }

        const allLinks = Array.from(bylineElem.querySelectorAll('a'));
        for (const a of allLinks) {
          const href = a.getAttribute('href') || a.href || '';
          if (!href) continue;

          if (href.includes('browse/MPRE') || href.includes('browse/FEmusic_library_album') || href.includes('album')) {
            if (!albumUrl) albumUrl = a.href;
          } else if (href.includes('channel/') || href.includes('browse/UC') || href.includes('artist')) {
            if (!artistUrl) artistUrl = a.href;
          }
        }
      }

      // Fallbacks from MediaSession
      if (!album && mediaSession?.album) {
        album = mediaSession.album.trim();
      }
      if (!artist && mediaSession?.artist) {
        artist = mediaSession.artist.trim();
      }

      // Clean artist and album
      artist = artist.replace(/[\s\u00A0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/g, ' ').trim();
      album = album.replace(/[\s\u00A0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/g, ' ').trim();

      // If album name is present inside artist string, strip it completely!
      if (album && artist.toLowerCase().includes(album.toLowerCase())) {
        const escapedAlbum = album.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        artist = artist.replace(new RegExp(`\\s*${escapedAlbum}`, 'gi'), '').trim();
      }

      // Strip 4-digit years, explicit badges, and trailing separators
      artist = artist.replace(/\b\d{4}\b/g, '').trim();
      artist = artist.replace(/^(E|\[E\])\s+/i, '').trim();
      artist = artist.replace(/[\u2022\u00B7\u2023\u25E6\u2043\u2219·•\-,|\s]+$/, '').trim();   // Normalize relative URLs
      if (trackUrl && trackUrl.startsWith('/')) trackUrl = `https://music.youtube.com${trackUrl}`;
      if (artistUrl && artistUrl.startsWith('/')) artistUrl = `https://music.youtube.com${artistUrl}`;
      if (albumUrl && albumUrl.startsWith('/')) albumUrl = `https://music.youtube.com${albumUrl}`;

      // Fallback URLs
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
    let volPercent = 100;
    let muted = false;

    if (video) {
      paused = video.paused;
      volPercent = Math.round(video.volume * 100);
      muted = video.muted;
      currentVolumePercent = volPercent;
    }

    const { currentTime, duration } = extractTrackTiming(video);

    const volume = volPercent;

    // 2. Like & Dislike Status
    let isLiked = false;
    let isDisliked = false;

    if (playerBar && typeof playerBar.likeStatus_ === 'string') {
      isLiked = playerBar.likeStatus_ === 'LIKE';
      isDisliked = playerBar.likeStatus_ === 'DISLIKE';
    } else {
      const likeButton = $('#like-button-renderer tp-yt-paper-icon-button#like-button') ||
        $('#like-button-renderer #button-shape-like button') ||
        $('ytmusic-like-button-renderer #button-shape-like') ||
        $('[aria-label*="mag ich" i]:not([aria-label*="nicht" i])') ||
        $('[aria-label*="like" i]:not([aria-label*="dislike" i])');

      const dislikeButton = $('#like-button-renderer tp-yt-paper-icon-button#dislike-button') ||
        $('#like-button-renderer #button-shape-dislike button') ||
        $('ytmusic-like-button-renderer #button-shape-dislike') ||
        $('[aria-label*="mag ich nicht" i]') ||
        $('[aria-label*="dislike" i]');

      const likeInner = likeButton?.querySelector('button');
      const dislikeInner = dislikeButton?.querySelector('button');

      isLiked = likeButton?.getAttribute('aria-pressed') === 'true' ||
        likeButton?.classList?.contains('selected') ||
        likeInner?.getAttribute('aria-pressed') === 'true' || false;

      isDisliked = dislikeButton?.getAttribute('aria-pressed') === 'true' ||
        dislikeButton?.classList?.contains('selected') ||
        dislikeInner?.getAttribute('aria-pressed') === 'true' || false;
    }

    // 3. Shuffle Status
    let shuffleActive = false;

    const shuffleButton = $('ytmusic-player-bar tp-yt-paper-icon-button.shuffle') ||
      $('ytmusic-player-bar .shuffle') ||
      $('tp-yt-paper-icon-button.shuffle') ||
      $('.shuffle-button');

    if (shuffleButton) {
      const innerBtn = shuffleButton.querySelector('button');
      const ironIcon = shuffleButton.querySelector('tp-yt-iron-icon, iron-icon, yt-icon, #icon, [icon]');
      const label = (shuffleButton.getAttribute('aria-label') || innerBtn?.getAttribute('aria-label') || '').toLowerCase();
      const title = (shuffleButton.getAttribute('title') || innerBtn?.getAttribute('title') || '').toLowerCase();
      const ariaPressed = (shuffleButton.getAttribute('aria-pressed') || innerBtn?.getAttribute('aria-pressed') || '').toLowerCase();
      const ariaChecked = (shuffleButton.getAttribute('aria-checked') || innerBtn?.getAttribute('aria-checked') || '').toLowerCase();
      const hasActiveAttr = shuffleButton.hasAttribute('active') || innerBtn?.hasAttribute('active') || false;
      const isSelected = shuffleButton.classList.contains('selected') || (innerBtn ? innerBtn.classList.contains('selected') : false);

      const hasDeactivateText = label.includes('deaktivieren') ||
        label.includes('ausschalten') ||
        label.includes('turn off') ||
        label.includes('is on') ||
        label.includes('zufallswiedergabe: ein') ||
        label.includes('zufallswiedergabe: an') ||
        title.includes('deaktivieren') ||
        title.includes('ausschalten') ||
        title.includes('turn off') ||
        title.includes('is on') ||
        title.includes('zufallswiedergabe: ein') ||
        title.includes('zufallswiedergabe: an');

      let isColorActive = false;
      try {
        const target = ironIcon || shuffleButton;
        const color = window.getComputedStyle(target).color || '';
        if (color.includes('255, 255, 255') || color.includes('rgb(255, 255, 255)')) {
          isColorActive = true;
        }
      } catch (e) { }

      if (hasDeactivateText || ariaPressed === 'true' || ariaChecked === 'true' || hasActiveAttr || isSelected || isColorActive) {
        shuffleActive = true;
      } else {
        shuffleActive = false;
      }
    }

    // 4. Repeat Status
    let repeatMode = 'OFF';

    const repeatButton = $('ytmusic-player-bar tp-yt-paper-icon-button.repeat') ||
      $('ytmusic-player-bar .repeat') ||
      $('tp-yt-paper-icon-button.repeat') ||
      $('.repeat-button');

    if (repeatButton) {
      const innerBtn = repeatButton.querySelector('button');
      const ironIcon = repeatButton.querySelector('tp-yt-iron-icon, iron-icon, yt-icon, #icon, [icon]');
      const iconAttr = (ironIcon?.getAttribute('icon') || repeatButton.getAttribute('icon') || '').toLowerCase();
      const label = (repeatButton.getAttribute('aria-label') || innerBtn?.getAttribute('aria-label') || '').toLowerCase();
      const title = (repeatButton.getAttribute('title') || innerBtn?.getAttribute('title') || '').toLowerCase();
      const ariaPressed = (repeatButton.getAttribute('aria-pressed') || innerBtn?.getAttribute('aria-pressed') || '').toLowerCase();
      const ariaChecked = (repeatButton.getAttribute('aria-checked') || innerBtn?.getAttribute('aria-checked') || '').toLowerCase();
      const hasActiveAttr = repeatButton.hasAttribute('active') || innerBtn?.hasAttribute('active') || false;
      const isSelected = repeatButton.classList.contains('selected') || (innerBtn ? innerBtn.classList.contains('selected') : false);

      let isColorActive = false;
      try {
        const target = ironIcon || repeatButton;
        const color = window.getComputedStyle(target).color || '';
        if (color.includes('255, 255, 255') || color.includes('rgb(255, 255, 255)')) {
          isColorActive = true;
        }
      } catch (e) { }

      const isRepeatActive = ariaPressed === 'true' ||
        ariaChecked === 'true' ||
        hasActiveAttr ||
        isSelected ||
        isColorActive ||
        label.includes('deaktivieren') ||
        label.includes('turn off') ||
        label.includes('alle wiederholen') ||
        label.includes('wiederholen: ein') ||
        label.includes('wiederholen: alle') ||
        title.includes('deaktivieren') ||
        title.includes('turn off') ||
        title.includes('alle wiederholen') ||
        title.includes('wiederholen: ein') ||
        title.includes('wiederholen: alle');

      const btnHtml = repeatButton.innerHTML.toLowerCase();
      const pathCount = (ironIcon || repeatButton).querySelectorAll('path').length;

      const isOne = (
        iconAttr.includes('one') ||
        iconAttr.includes('1') ||
        btnHtml.includes('repeat-one') ||
        btnHtml.includes('repeat_one') ||
        btnHtml.includes('repeat1') ||
        btnHtml.includes('-one') ||
        pathCount > 1 ||
        label.includes('titel') ||
        label.includes('song') ||
        label.includes('diesen') ||
        label.includes('aktuell') ||
        label.includes('einzel') ||
        label.includes('one') ||
        label.includes(' 1') ||
        label.includes(': 1') ||
        label.includes('(1)') ||
        title.includes('titel') ||
        title.includes('song') ||
        title.includes('diesen') ||
        title.includes('aktuell') ||
        title.includes('einzel') ||
        title.includes('one') ||
        title.includes(' 1') ||
        title.includes(': 1') ||
        title.includes('(1)')
      ) && !label.includes('alle') && !title.includes('alle');

      if (isRepeatActive && isOne) {
        repeatMode = 'ONE';
      } else if (isRepeatActive) {
        repeatMode = 'ALL';
      } else {
        repeatMode = 'OFF';
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
          state.albumUrl === lastSentState.albumUrl
        );

        if (isIdentical && (state.paused || Math.abs(state.currentTime - lastSentState.currentTime) < 1)) {
          return;
        }
      }

      lastSentState = { ...state };

      ws.send(JSON.stringify({
        type: 'STATE_UPDATE',
        timestamp: Date.now(),
        data: state
      }));
    } catch (err) {
      console.warn('[YTM Controller] Failed to send state over WebSocket:', err);
    }
  }

  /**
   * Execute control commands received from Stream Deck
   */
  function handleCommand(message) {
    if (!message || !message.command) return;

    try {
      const command = message.command;
      const payload = message.payload || {};
      const video = findVideoElement();

      console.log(`[YTM Controller] Executing command: ${command}`, payload);

      switch (command) {
        case 'playPause': {
          togglePlayPause();
          break;
        }

        case 'play': {
          const playBtn = $('#play-pause-button') ||
            $('ytmusic-player-bar #play-pause-button') ||
            $('tp-yt-paper-icon-button#play-pause-button') ||
            $('.play-pause-button');
          const video = findVideoElement();
          if (video && video.paused && playBtn) {
            const btn = playBtn.querySelector('button') || playBtn;
            try { btn.click(); } catch (e) { }
          } else if (video && video.paused) {
            video.play().catch(() => { });
          }
          setTimeout(() => sendState(true), 100);
          break;
        }

        case 'pause': {
          const playBtn = $('#play-pause-button') ||
            $('ytmusic-player-bar #play-pause-button') ||
            $('tp-yt-paper-icon-button#play-pause-button') ||
            $('.play-pause-button');
          const video = findVideoElement();
          if (video && !video.paused && playBtn) {
            const btn = playBtn.querySelector('button') || playBtn;
            try { btn.click(); } catch (e) { }
          } else if (video && !video.paused) {
            video.pause();
          }
          setTimeout(() => sendState(true), 100);
          break;
        }

        case 'next': {
          const nextBtn = $('.next-button, tp-yt-paper-icon-button.next-button, #next-button');
          if (nextBtn) {
            const btn = nextBtn.querySelector('button') || nextBtn;
            try { btn.click(); } catch (e) { }
          }
          setTimeout(() => sendState(true), 150);
          break;
        }

        case 'previous': {
          const prevBtn = $('.previous-button, tp-yt-paper-icon-button.previous-button, #previous-button');
          if (prevBtn) {
            const btn = prevBtn.querySelector('button') || prevBtn;
            try { btn.click(); } catch (e) { }
          }
          setTimeout(() => sendState(true), 150);
          break;
        }

        case 'like': {
          const likeBtn = $('#like-button-renderer #button-shape-like button') ||
            $('#like-button-renderer tp-yt-paper-icon-button#like-button') ||
            $('ytmusic-like-button-renderer #button-shape-like');
          if (likeBtn) {
            const btn = likeBtn.querySelector('button') || likeBtn;
            try { btn.click(); } catch (e) { }
          }
          setTimeout(() => sendState(true), 60);
          setTimeout(() => sendState(true), 200);
          setTimeout(() => sendState(true), 450);
          break;
        }

        case 'dislike': {
          const dislikeBtn = $('#like-button-renderer #button-shape-dislike button') ||
            $('#like-button-renderer tp-yt-paper-icon-button#dislike-button') ||
            $('ytmusic-like-button-renderer #button-shape-dislike');
          if (dislikeBtn) {
            const btn = dislikeBtn.querySelector('button') || dislikeBtn;
            try { btn.click(); } catch (e) { }
          }
          setTimeout(() => sendState(true), 60);
          setTimeout(() => sendState(true), 200);
          setTimeout(() => sendState(true), 450);
          break;
        }

        case 'shuffle': {
          const shuffleBtn = $('ytmusic-player-bar .shuffle') ||
            $('tp-yt-paper-icon-button.shuffle') ||
            $('.shuffle-button') ||
            $('[aria-label*="shuffle" i]') ||
            $('[aria-label*="zufall" i]');
          if (shuffleBtn) {
            const btn = shuffleBtn.querySelector('button') || shuffleBtn;
            try { btn.click(); } catch (e) { }
          }
          setTimeout(() => sendState(true), 60);
          setTimeout(() => sendState(true), 200);
          setTimeout(() => sendState(true), 450);
          break;
        }

        case 'repeat': {
          const repeatBtn = $('ytmusic-player-bar .repeat') ||
            $('tp-yt-paper-icon-button.repeat') ||
            $('.repeat-button') ||
            $('[aria-label*="repeat" i]') ||
            $('[aria-label*="wiederhol" i]');
          if (repeatBtn) {
            const btn = repeatBtn.querySelector('button') || repeatBtn;
            try { btn.click(); } catch (e) { }
          }
          setTimeout(() => sendState(true), 60);
          setTimeout(() => sendState(true), 200);
          setTimeout(() => sendState(true), 450);
          break;
        }

        case 'seek': {
          if (video && typeof payload.delta === 'number') {
            video.currentTime = Math.min(video.duration || 0, Math.max(0, video.currentTime + payload.delta));
          }
          break;
        }

        case 'requestState': {
          sendState(true);
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

        try {
          ws.send(JSON.stringify({
            type: 'REGISTER_CLIENT',
            client: 'ytm-extension',
            url: window.location.href
          }));
        } catch (e) { }

        sendState(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
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
    connectWebSocket(DEFAULT_PORT);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
