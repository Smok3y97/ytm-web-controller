/**
 * YouTube Music Web Controller - Media Session API Integration
 * 
 * Captures W3C Media Session action handlers and metadata registered by YouTube Music.
 * Serves as the primary control and metadata layer.
 */

'use strict';

window.YTM = window.YTM || {};

(function () {
  const isSupported = Boolean(typeof navigator !== 'undefined' && 'mediaSession' in navigator);
  const capturedHandlers = {};

  if (isSupported) {
    try {
      // Intercept setActionHandler to capture YouTube Music's internal callbacks
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
      const cur = window.YTM.playerApi?.getCurrentTime?.();
      const dur = window.YTM.playerApi?.getDuration?.();
      if (typeof cur === 'number' && !isNaN(cur)) {
        const target = (typeof dur === 'number' && dur > 0)
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
    getMetadata
  };
})();
