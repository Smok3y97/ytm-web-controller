/**
 * YouTube Music Web Controller - Playback State Extraction & Assembly
 * 
 * Extracts player metadata, timing, and volume, assembling a unified playback
 * state snapshot in coordination with ytm-controls.js and ytm-observers.js.
 */

'use strict';

window.YTM = window.YTM || {};

let lastResolvedVideoId = '';
let lastResolvedTrackKey = '';

/**
 * Get current player volume (0 - 100)
 */
function getPlayerVolume() {
  const apiVol = window.YTM.playerApi?.getVolume?.();
  if (typeof apiVol === 'number' && !isNaN(apiVol)) {
    return Math.round(apiVol);
  }

  const $ = window.YTM.utils?.$ || ((sel, parent = document) => {
    try { return parent.querySelector(sel); } catch { return null; }
  });
  const selectors = window.YTM.selectors?.player || {};
  const playerBar = $(selectors.playerBar || 'ytmusic-player-bar');
  if (playerBar && typeof playerBar.volume_ === 'number') {
    return Math.round(playerBar.volume_);
  }

  const slider = $(selectors.volumeSlider || 'ytmusic-player-bar #volume-slider');
  if (slider) {
    const val = slider.getAttribute('aria-valuenow') ?? slider.getAttribute('value') ?? slider.value;
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      return parsed;
    }
  }

  const findVideo = window.YTM.utils?.findVideoElement || (typeof findVideoElement === 'function' ? findVideoElement : () => document.querySelector('video'));
  const video = findVideo();
  if (video && typeof video.volume === 'number' && !isNaN(video.volume)) {
    return Math.round(video.volume * 100);
  }

  return 100;
}

/**
 * Get current player muted status
 */
function getPlayerMuted() {
  const apiMuted = window.YTM.playerApi?.isMuted?.();
  if (typeof apiMuted === 'boolean') {
    return apiMuted;
  }

  const $ = window.YTM.utils?.$ || ((sel, parent = document) => {
    try { return parent.querySelector(sel); } catch { return null; }
  });
  const selectors = window.YTM.selectors?.player || {};
  const playerBar = $(selectors.playerBar || 'ytmusic-player-bar');
  if (playerBar && typeof playerBar.muted_ === 'boolean') {
    return playerBar.muted_;
  }

  const muteBtn = $(selectors.volumeMuteButton || 'ytmusic-player-bar #volume-slider-volume-button');
  if (muteBtn) {
    const label = (muteBtn.getAttribute('aria-label') || muteBtn.querySelector('button')?.getAttribute('aria-label') || '').toLowerCase();
    const title = (muteBtn.getAttribute('title') || muteBtn.querySelector('button')?.getAttribute('title') || '').toLowerCase();
    if (label.includes('unmute') || label.includes('stummschaltung aufheben') || title.includes('unmute') || title.includes('stummschaltung aufheben')) {
      return true;
    }
  }

  const findVideo = window.YTM.utils?.findVideoElement || (typeof findVideoElement === 'function' ? findVideoElement : () => document.querySelector('video'));
  const video = findVideo();
  if (video) return video.muted;

  return false;
}

/**
 * Extract track metadata from DOM and MediaSession
 */
function extractTrackMetadata(mediaSession, playerBar) {
  let title = mediaSession?.title?.trim() || '';
  let artist = mediaSession?.artist?.trim() || '';
  let album = mediaSession?.album?.trim() || '';
  let coverUrl = '';
  let trackUrl = '';
  let artistUrl = '';
  let albumUrl = '';
  let videoId = '';

  const $ = window.YTM.utils?.$ || ((sel, parent = document) => {
    try { return parent.querySelector(sel); } catch { return null; }
  });
  const $$ = window.YTM.utils?.$$ || ((sel, parent = document) => {
    try { return Array.from(parent.querySelectorAll(sel)); } catch { return []; }
  });
  const cleanWhitespace = window.YTM.utils?.cleanWhitespace || (s => (s || '').trim());
  const isNonAlbumText = window.YTM.utils?.isNonAlbumText || (() => false);

  if (typeof extractArtworkUrl === 'function') {
    coverUrl = extractArtworkUrl(mediaSession);
  } else if (window.YTM?.utils?.extractArtworkUrl) {
    coverUrl = window.YTM.utils.extractArtworkUrl(mediaSession);
  }

  // Fallback metadata extraction from Polymer API & PlayerBar if missing
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

  // Extract Title, Artist, Album & URLs from DOM & MediaSession
  try {
    if (!title) {
      const titleLinkSel = window.YTM.selectors?.metadata?.titleLink || 'ytmusic-player-bar .title a, ytmusic-player-bar yt-formatted-string.title a, ytmusic-player-bar a.yt-simple-endpoint[href*="watch"]';
      const titleLink = $(titleLinkSel);
      if (titleLink) {
        title = titleLink.textContent?.trim() || '';
        if (!videoId && titleLink.href) {
          const match = titleLink.href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
          if (match && match[1]) videoId = match[1];
        }
      }
    }
    if (!title) {
      const titleSel = window.YTM.selectors?.metadata?.title || 'ytmusic-player-bar .title, ytmusic-player-bar yt-formatted-string.title, .title.ytmusic-player-bar, .middle-controls .title';
      const titleElem = $(titleSel);
      title = titleElem?.textContent?.trim() || mediaSession?.title || '';
    }

    // Short-circuit: Reuse cached videoId (or cached negative resolution) for active track
    const currentTrackKey = (title && artist) ? `${title}::${artist}` : '';
    if (!videoId && currentTrackKey && currentTrackKey === lastResolvedTrackKey) {
      videoId = lastResolvedVideoId;
    }

    // Deep DOM fallback scans only if not resolved yet for the active track
    if (!videoId && currentTrackKey && currentTrackKey !== lastResolvedTrackKey) {
      // 1. Extract videoId from watch links
      const watchLinksSel = window.YTM.selectors?.metadata?.watchLinks || 'ytmusic-player-bar a[href*="watch"], ytmusic-player-page a[href*="watch"], .middle-controls a[href*="watch"]';
      const watchLinks = $$(watchLinksSel);
      for (const link of watchLinks) {
        const href = link.getAttribute('href') || link.href || '';
        const match = href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        if (match && match[1]) {
          videoId = match[1];
          break;
        }
      }

      // 2. Extract videoId from current window URL
      if (!videoId && window.location.href.includes('watch')) {
        const match = window.location.href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        if (match && match[1]) {
          videoId = match[1];
        }
      }

      // 3. Extract videoId from artwork URLs
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

      // 4. Extract videoId from img tags in player bar
      if (!videoId) {
        const artworkImgsSel = window.YTM.selectors?.metadata?.artworkImgs || 'ytmusic-player-bar img';
        const imgs = $$(artworkImgsSel);
        for (const img of imgs) {
          const src = img.getAttribute('src') || img.src || '';
          const match = src.match(/\/vi\/([a-zA-Z0-9_-]{11})\//);
          if (match && match[1]) {
            videoId = match[1];
            break;
          }
        }
      }

      // Memoize resolved videoId (including negative empty result) for active track
      lastResolvedVideoId = videoId || '';
      lastResolvedTrackKey = currentTrackKey;
    } else if (videoId && currentTrackKey) {
      lastResolvedVideoId = videoId;
      lastResolvedTrackKey = currentTrackKey;
    }

    // Build canonical clean watch sharing URL if videoId found
    if (videoId) {
      trackUrl = `https://music.youtube.com/watch?v=${videoId}`;
    }

    // Query Byline element
    const bylineSel = window.YTM.selectors?.metadata?.byline || 'ytmusic-player-bar .byline, ytmusic-player-bar .subtitle, ytmusic-player-bar yt-formatted-string.byline, ytmusic-player-bar yt-formatted-string.subtitle, .middle-controls .byline, .middle-controls .subtitle, ytmusic-player-bar .content-info-wrapper .subtitle';
    const bylineElem = $(bylineSel);

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

    // Clean artist and album via centralized sanitizeArtist
    const sanitizeFn = window.YTM.utils?.sanitizeArtist || (typeof sanitizeArtist === 'function' ? sanitizeArtist : null);
    if (sanitizeFn) {
      const sanitized = sanitizeFn(artist, album);
      artist = sanitized.artist;
      if (!album && sanitized.extractedAlbum) {
        album = sanitized.extractedAlbum;
      }
    } else {
      artist = cleanWhitespace(artist);
      album = cleanWhitespace(album);
    }

    // Extra safeguard against non-album text strings
    if (album && isNonAlbumText(album)) {
      album = '';
      albumUrl = '';
    }

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

  return {
    title: title || 'Unbekannter Titel',
    artist: artist || 'Unbekannter Interpret',
    album: album || '',
    coverUrl,
    trackUrl,
    artistUrl,
    albumUrl
  };
}

/**
 * Extract audio playback and transport status
 */
function extractTransportState(video) {
  const volume = getPlayerVolume();
  const muted = getPlayerMuted();

  // Extract accurate track-relative duration & currentTime
  const api = window.YTM.playerApi;
  const currentTime = Math.floor(api?.getCurrentTime?.() ?? (video && !isNaN(video.currentTime) ? video.currentTime : 0));
  const duration = Math.floor(api?.getDuration?.() ?? (video && !isNaN(video.duration) ? video.duration : 0));
  const playerApi = typeof getPlayerApi === 'function' ? getPlayerApi() : window.YTM?.playerApi?.getPlayerApi?.();

  let paused = video ? video.paused : true;
  const playbackRate = video && typeof video.playbackRate === 'number' && !isNaN(video.playbackRate) ? video.playbackRate : 1;
  const timestamp = Date.now();

  // Evaluate playback state: MediaSession (Tier 1) -> Player API (Tier 2) -> Video (Tier 3)
  const msPlayback = navigator.mediaSession?.playbackState;
  if (msPlayback === 'playing') {
    paused = false;
  } else if (msPlayback === 'paused') {
    paused = true;
  } else if (playerApi && typeof playerApi.getPlayerState === 'function') {
    try {
      const pState = playerApi.getPlayerState();
      // 1 = PLAYING, 3 = BUFFERING
      if (pState === 1 || pState === 3) {
        paused = false;
      } else if (pState === 2) {
        paused = true;
      }
    } catch { }
  }

  return {
    volume,
    muted,
    currentTime,
    duration,
    paused,
    isPaused: paused,
    playbackRate,
    timestamp
  };
}

/**
 * Extract interactive control button states (delegates to centralized ytm-controls.js)
 */
function extractControlStates(playerBar) {
  if (window.YTM.controls?.extractControlStates) {
    return window.YTM.controls.extractControlStates(playerBar);
  }
  return {
    isLiked: false,
    isDisliked: false,
    shuffleActive: false,
    repeatMode: 'OFF'
  };
}

/**
 * Extract current playback metadata and player state from DOM & MediaSession
 */
function collectPlaybackState() {
  const findVideo = window.YTM.utils?.findVideoElement || (typeof findVideoElement === 'function' ? findVideoElement : () => document.querySelector('video'));
  const video = findVideo();
  const mediaSession = navigator.mediaSession?.metadata;
  const $ = window.YTM.utils?.$ || ((sel, parent = document) => {
    try { return parent.querySelector(sel); } catch { return null; }
  });
  const playerBar = $('ytmusic-player-bar');

  const metadata = extractTrackMetadata(mediaSession, playerBar);
  const transport = extractTransportState(video);
  const controls = extractControlStates(playerBar);

  return {
    ...metadata,
    coverBase64: '',
    ...transport,
    ...controls
  };
}

// Export state methods to YTM namespace with backward compatibility proxies
window.YTM.state = {
  getPlayerVolume,
  getPlayerMuted,
  extractTrackMetadata,
  extractTransportState,
  extractControlStates,
  collectPlaybackState,
  setupGlobalMediaListeners: () => window.YTM.observers?.setupGlobalMediaListeners?.(),
  teardownGlobalMediaListeners: () => window.YTM.observers?.teardownGlobalMediaListeners?.()
};
