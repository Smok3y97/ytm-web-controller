/**
 * YouTube Music Web Controller - State Extraction & Media Observers
 * 
 * High-precision metadata parser, player state collector (like, dislike, shuffle,
 * repeat, volume, timing), and reactive DOM/Media event listeners with zero polling overhead.
 */

'use strict';

window.YTM = window.YTM || {};

const TIMEUPDATE_THROTTLE_MS = 250;
let lastTimeUpdate = 0;
let hasInitializedMediaListeners = false;

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

  return 100;
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
  } catch { }

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

    // Extract videoId from watch links
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

    // Extract videoId from artwork URLs
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
      // Check explicit structured anchor links first
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

      // Parse byline textual segments (delimited by • or · or |)
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

    // If album name is present as a standalone segment or whole word inside artist, strip it safely
    if (album && album.length >= 3 && artist.length > album.length) {
      const escapedAlbum = album.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      artist = artist.replace(new RegExp(`(^|\\s*[\\u2022\\u00B7·•\\-|]\\s*|\\s+)${escapedAlbum}(\\s*[\\u2022\\u00B7·•\\-|]\\s*|\\s+|$)`, 'gi'), '$1').trim();
    }

    // Strip trailing 4-digit release years at the very end of string
    artist = artist.replace(/(?:[\s\u2022\u00B7·•\\-|]|\s+)\b(19|20)\d{2}\b$/g, '').trim();
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

    // Fallback search URLs
    if (!trackUrl && title) {
      trackUrl = `https://music.youtube.com/search?q=${encodeURIComponent(title + ' ' + (artist || ''))}`;
    }
    if (!artistUrl && artist) {
      artistUrl = `https://music.youtube.com/search?q=${encodeURIComponent(artist)}`;
    }
  } catch { }

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

  const cached = getCachedCover();
  if (coverUrl && coverUrl !== cached.url) {
    processCoverImage(coverUrl, (force) => {
      notifyState(force);
    });
  }

  let paused = true;
  const volPercent = getPlayerVolume();
  const muted = getPlayerMuted();

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

  const timing = (typeof extractTrackTiming === 'function')
    ? extractTrackTiming(video)
    : (window.YTM?.utils?.extractTrackTiming ? window.YTM.utils.extractTrackTiming(video) : { currentTime: video?.currentTime || 0, duration: video?.duration || 0 });
  const currentTime = timing.currentTime || 0;
  const duration = timing.duration || 0;
  const volume = volPercent;

  // Like & Dislike Status (Strictly scoped to bottom player bar)
  let isLiked = false;
  let isDisliked = false;

  const playerBarElem = $('ytmusic-player-bar');
  const likeRenderer = playerBarElem
    ? $('ytmusic-like-button-renderer, #like-button-renderer, .like-button-renderer', playerBarElem)
    : null;
  const likeStatusAttr = likeRenderer?.getAttribute('like-status')?.toUpperCase();

  if (likeStatusAttr === 'LIKE') {
    isLiked = true;
    isDisliked = false;
  } else if (likeStatusAttr === 'DISLIKE') {
    isLiked = false;
    isDisliked = true;
  } else if (likeStatusAttr === 'INDIFFERENT') {
    isLiked = false;
    isDisliked = false;
  } else if (playerBarElem && typeof playerBarElem.likeStatus_ === 'string' && playerBarElem.likeStatus_) {
    const ls = playerBarElem.likeStatus_.toUpperCase();
    isLiked = ls === 'LIKE';
    isDisliked = ls === 'DISLIKE';
  } else if (playerBarElem) {
    const likeButton = $('#like-button-renderer tp-yt-paper-icon-button#like-button', playerBarElem) ||
      $('#button-shape-like button', playerBarElem) ||
      $('ytmusic-like-button-renderer #button-shape-like button', playerBarElem) ||
      $('ytmusic-like-button-renderer #button-shape-like', playerBarElem) ||
      $('[aria-label*="mag ich" i]:not([aria-label*="nicht" i])', playerBarElem) ||
      $('[aria-label*="like" i]:not([aria-label*="dislike" i])', playerBarElem);

    const dislikeButton = $('#like-button-renderer tp-yt-paper-icon-button#dislike-button', playerBarElem) ||
      $('#button-shape-dislike button', playerBarElem) ||
      $('ytmusic-like-button-renderer #button-shape-dislike button', playerBarElem) ||
      $('ytmusic-like-button-renderer #button-shape-dislike', playerBarElem) ||
      $('[aria-label*="mag ich nicht" i]', playerBarElem) ||
      $('[aria-label*="dislike" i]', playerBarElem);

    isLiked = isButtonActive(likeButton);
    isDisliked = isButtonActive(dislikeButton);
  }

  // Shuffle Status
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
      shuffleActive = isButtonActive(shuffleButton, ['deaktivieren', 'ausschalten', 'turn off', 'is on']);
    }
  }

  // Repeat Status
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
      const ironIcon = repeatButton.querySelector('tp-yt-iron-icon, iron-icon, yt-icon, #icon, [icon]');
      const iconAttr = (
        ironIcon?.getAttribute('icon') ||
        repeatButton.getAttribute('icon') ||
        ironIcon?.getAttribute('src') ||
        ''
      ).toLowerCase();

      const btnHtml = repeatButton.innerHTML.toLowerCase();
      const innerBtn = repeatButton.querySelector('button');
      const label = (
        repeatButton.getAttribute('aria-label') ||
        innerBtn?.getAttribute('aria-label') ||
        repeatButton.getAttribute('title') ||
        innerBtn?.getAttribute('title') ||
        ''
      ).toLowerCase();

      const isCurrentlyActive = isButtonActive(repeatButton, ['deaktivieren', 'ausschalten', 'turn off', 'desactivar', 'désactiver', 'is on']);

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

  const latestCover = getCachedCover();

  return {
    title,
    artist,
    album,
    coverUrl,
    coverBase64: latestCover.base64,
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
 * Throttled timeupdate listener
 */
function onTimeUpdate() {
  const now = performance.now();
  if (now - lastTimeUpdate >= TIMEUPDATE_THROTTLE_MS) {
    lastTimeUpdate = now;
    notifyState(false);
  }
}

/**
 * Setup Global DOM, HTML5 Media, and MutationObserver listeners (Zero Polling)
 */
function setupGlobalMediaListeners() {
  if (hasInitializedMediaListeners) return;
  hasInitializedMediaListeners = true;

  document.addEventListener('play', () => notifyState(true), true);
  document.addEventListener('playing', () => notifyState(true), true);
  document.addEventListener('pause', () => notifyState(true), true);
  document.addEventListener('volumechange', () => notifyState(true), true);
  document.addEventListener('timeupdate', onTimeUpdate, true);
  document.addEventListener('seeking', () => notifyState(true), true);
  document.addEventListener('seeked', () => notifyState(true), true);
  document.addEventListener('ratechange', () => notifyState(true), true);
  document.addEventListener('loadedmetadata', () => notifyState(true), true);
  document.addEventListener('durationchange', () => notifyState(true), true);
  document.addEventListener('ended', () => notifyState(true), true);

  const targetNode = $('ytmusic-player-bar') || document.body;
  const observer = new MutationObserver(() => {
    notifyState(false);
  });
  observer.observe(targetNode, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['aria-pressed', 'aria-checked', 'aria-label', 'aria-valuenow', 'aria-valuemax', 'value', 'src', 'title', 'class', 'icon']
  });
}

// Export state methods to YTM namespace
window.YTM.state = {
  getPlayerVolume,
  getPlayerMuted,
  collectPlaybackState,
  onTimeUpdate,
  setupGlobalMediaListeners
};
