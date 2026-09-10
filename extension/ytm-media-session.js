/**
 * YouTube Music Web Controller - Media Session API Integration (Tier 1 Primary)
 * 
 * Intercepts and captures official W3C Media Session action handlers and position
 * states registered by YouTube Music at document_start.
 * Provides the highest-tier, DOM-immune control and state extraction layer.
 */

'use strict';

window.YTM = window.YTM || {};

(function () {
  const isSupported = Boolean(typeof navigator !== 'undefined' && 'mediaSession' in navigator);
  const capturedHandlers = {};
  const positionState = {
    duration: 0,
    playbackRate: 1,
    position: 0,
    lastUpdatedTime: 0
  };

  if (isSupported) {
    try {
      // 1. Intercept setActionHandler to capture YouTube Music's internal callbacks
      const originalSetActionHandler = navigator.mediaSession.setActionHandler?.bind(navigator.mediaSession);
      if (typeof originalSetActionHandler === 'function') {
        navigator.mediaSession.setActionHandler = function (action, handler) {
          if (typeof handler === 'function') {
            capturedHandlers[action] = handler;
          } else {
            delete capturedHandlers[action];
          }
          return originalSetActionHandler(action, handler);
        };
      }

      // 2. Intercept setPositionState to capture exact track-relative position & duration
      const originalSetPositionState = navigator.mediaSession.setPositionState?.bind(navigator.mediaSession);
      if (typeof originalSetPositionState === 'function') {
        navigator.mediaSession.setPositionState = function (state) {
          if (state && typeof state === 'object') {
            if (typeof state.duration === 'number' && !isNaN(state.duration) && state.duration > 0) {
              positionState.duration = state.duration;
            }
            if (typeof state.playbackRate === 'number' && !isNaN(state.playbackRate)) {
              positionState.playbackRate = state.playbackRate;
            }
            if (typeof state.position === 'number' && !isNaN(state.position) && state.position >= 0) {
              positionState.position = state.position;
            }
            positionState.lastUpdatedTime = Date.now();
          }
          return originalSetPositionState(state);
        };
      }
    } catch (err) {
      console.warn('[YTM Controller] Could not hook navigator.mediaSession:', err);
    }
  }

  /**
   * Safely invoke a captured action handler with W3C details
   */
  function invokeHandler(action, details = {}) {
    const handler = capturedHandlers[action];
    if (typeof handler === 'function') {
      try {
        handler({ action, ...details });
        return true;
      } catch (err) {
        console.warn(`[YTM Controller] Error executing MediaSession handler for ${action}:`, err);
        return false;
      }
    }
    return false;
  }

  /**
   * Play video via MediaSession
   */
  function play() {
    return invokeHandler('play');
  }

  /**
   * Pause video via MediaSession
   */
  function pause() {
    return invokeHandler('pause');
  }

  /**
   * Toggle play/pause via MediaSession
   */
  function togglePlayPause() {
    if (navigator.mediaSession?.playbackState === 'playing') {
      return pause();
    }
    if (navigator.mediaSession?.playbackState === 'paused') {
      return play();
    }
    // If playbackState is not definitive, prefer play if paused or vice versa
    return play() || pause();
  }

  /**
   * Skip to next track via MediaSession
   */
  function nextTrack() {
    return invokeHandler('nexttrack');
  }

  /**
   * Skip to previous track via MediaSession
   */
  function previousTrack() {
    return invokeHandler('previoustrack');
  }

  /**
   * Seek to absolute position in seconds via MediaSession
   */
  function seekTo(seconds) {
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) return false;
    return invokeHandler('seekto', { seekTime: seconds, fastSeek: false });
  }

  /**
   * Seek relative delta in seconds via MediaSession
   */
  function seekRelative(deltaSeconds) {
    if (typeof deltaSeconds !== 'number' || isNaN(deltaSeconds) || deltaSeconds === 0) return false;

    // 1. If seekto is available and we know current position, calculate absolute target
    if (hasHandler('seekto')) {
      const pos = getPositionState();
      const cur = pos.currentTime;
      const dur = pos.duration;
      if (typeof cur === 'number') {
        const target = (dur > 0)
          ? Math.min(dur, Math.max(0, cur + deltaSeconds))
          : Math.max(0, cur + deltaSeconds);
        return seekTo(target);
      }
    }

    // 2. Fall back to standard seekforward / seekbackward action handlers
    if (deltaSeconds > 0 && hasHandler('seekforward')) {
      return invokeHandler('seekforward', { seekOffset: deltaSeconds });
    }
    if (deltaSeconds < 0 && hasHandler('seekbackward')) {
      return invokeHandler('seekbackward', { seekOffset: Math.abs(deltaSeconds) });
    }

    return false;
  }

  /**
   * Check if a specific action handler is registered
   */
  function hasHandler(action) {
    return typeof capturedHandlers[action] === 'function';
  }

  /**
   * Get official W3C playback state ('playing' | 'paused' | 'none')
   */
  function getPlaybackState() {
    if (!isSupported) return null;
    return navigator.mediaSession?.playbackState || null;
  }

  /**
   * Get official W3C metadata object
   */
  function getMetadata() {
    if (!isSupported) return null;
    return navigator.mediaSession?.metadata || null;
  }

  /**
   * Synchronize position state with active media element according to W3C § 4.5
   * ("The RECOMMENDED way to determine the position state is to monitor the media elements")
   */
  function syncMediaElement(video) {
    const api = window.YTM.playerApi;
    const apiCur = api?.getCurrentTime?.();
    const apiDur = api?.getDuration?.();

    const v = video || (typeof window.YTM.utils?.findVideoElement === 'function' ? window.YTM.utils.findVideoElement() : document.querySelector('video'));
    const isPaused = navigator.mediaSession?.playbackState === 'paused' || (v?.paused ?? true);

    // Duration: prefer playerApi > positionState (captured from setPositionState) > video.duration
    let dur = positionState.duration;
    if (typeof apiDur === 'number' && !isNaN(apiDur) && isFinite(apiDur) && apiDur > 0) {
      dur = apiDur;
    } else if (v && !isNaN(v.duration) && isFinite(v.duration) && v.duration > 0) {
      dur = v.duration;
    }

    // Current position: prefer playerApi > video.currentTime > positionState.position
    let cur = positionState.position;
    if (typeof apiCur === 'number' && !isNaN(apiCur) && isFinite(apiCur) && apiCur >= 0) {
      cur = (dur > 0) ? Math.min(dur, apiCur) : apiCur;
    } else if (v && !isNaN(v.currentTime) && isFinite(v.currentTime) && v.currentTime >= 0) {
      cur = (dur > 0 && v.currentTime >= dur) ? 0 : v.currentTime;
    }

    positionState.position = cur;
    if (dur > 0) positionState.duration = dur;
    positionState.playbackRate = isPaused ? 0 : 1;
    positionState.lastUpdatedTime = Date.now();
  }

  /**
   * Get W3C § 4.5 Position State snapshot.
   * Provides current position, duration, and timestamp for the Stream Deck plugin,
   * which then performs local interpolation to avoid unnecessary WebSocket calls.
   */
  function getPositionState(video) {
    syncMediaElement(video);

    return {
      currentTime: Math.floor(positionState.position),
      duration: Math.floor(positionState.duration),
      playbackRate: positionState.playbackRate,
      timestamp: positionState.lastUpdatedTime || Date.now()
    };
  }

  // Export MediaSession API layer
  window.YTM.mediaSession = {
    isSupported,
    hasHandler,
    play,
    pause,
    togglePlayPause,
    nextTrack,
    previousTrack,
    seekTo,
    seekRelative,
    getPlaybackState,
    getMetadata,
    getPositionState
  };
})();
