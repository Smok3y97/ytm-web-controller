/**
 * YouTube Music Web Controller - Media & DOM Observers
 * 
 * Provides reactive, zero-polling lifecycle listeners for HTML5 <video> playback events
 * and a scoped MutationObserver for bottom player bar button attribute transitions.
 */

'use strict';

window.YTM = window.YTM || {};

let hasInitializedMediaListeners = false;
let activeObserver = null;
let initialObserver = null;
let mediaEventDebounceTimer = null;
let mutationDebounceTimer = null;
let registeredMediaListeners = [];

/**
 * Setup Global DOM, HTML5 Media, and MutationObserver listeners (Zero Polling, Zero Timeupdate)
 */
function setupGlobalMediaListeners() {
  if (hasInitializedMediaListeners) return;
  hasInitializedMediaListeners = true;

  const $ = window.YTM.utils?.$ || ((sel, parent = document) => {
    try { return parent.querySelector(sel); } catch { return null; }
  });

  let pendingForce = false;
  const sendSnapshot = (force = false) => {
    if (force) pendingForce = true;
    if (mediaEventDebounceTimer) {
      clearTimeout(mediaEventDebounceTimer);
    }
    mediaEventDebounceTimer = setTimeout(() => {
      const isForce = pendingForce;
      pendingForce = false;
      mediaEventDebounceTimer = null;
      const notify = window.YTM.utils?.notifyState || (typeof notifyState === 'function' ? notifyState : null);
      notify?.(isForce);
    }, 25);
  };

  // When track duration or metadata changes, notify immediately and schedule re-check for late-arriving metadata
  const onTrackTransition = () => {
    sendSnapshot(false);
    if (typeof window.YTM?.scheduleStateUpdates === 'function') {
      window.YTM.scheduleStateUpdates([75, 250]);
    }
  };

  const mediaEvents = [
    'play',
    'playing',
    'pause',
    'seeking',
    'seeked',
    'ratechange',
    'volumechange',
    'ended'
  ];

  for (const eventName of mediaEvents) {
    const handler = () => sendSnapshot(false);
    document.addEventListener(eventName, handler, true);
    registeredMediaListeners.push({ type: eventName, handler, useCapture: true });
  }

  const transitionEvents = ['durationchange', 'loadedmetadata'];
  for (const eventName of transitionEvents) {
    const handler = onTrackTransition;
    document.addEventListener(eventName, handler, true);
    registeredMediaListeners.push({ type: eventName, handler, useCapture: true });
  }

  // Slim MutationObserver for Like, Dislike, Shuffle, Repeat button states (Debounced & Scoped)
  const onMutation = () => {
    if (mutationDebounceTimer) return;
    mutationDebounceTimer = setTimeout(() => {
      mutationDebounceTimer = null;
      const notify = window.YTM.utils?.notifyState || (typeof notifyState === 'function' ? notifyState : null);
      notify?.(false);
    }, 60);
  };

  const playerBarObserverOptions = {
    childList: false,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-pressed', 'aria-checked', 'like-status', 'active', 'icon']
  };

  const playerBarSel = window.YTM.selectors?.player?.playerBar || 'ytmusic-player-bar';
  const playerBar = $(playerBarSel);
  if (playerBar) {
    activeObserver = new MutationObserver(onMutation);
    activeObserver.observe(playerBar, playerBarObserverOptions);
  } else {
    // If player-bar not rendered yet, temporarily observe document.body until player-bar appears
    const initialObserverOptions = {
      childList: true,
      subtree: true
    };
    initialObserver = new MutationObserver((mutations, obs) => {
      const bar = $(playerBarSel);
      if (bar) {
        // Disconnect from full document and narrow strictly to ytmusic-player-bar
        obs.disconnect();
        initialObserver = null;
        activeObserver = new MutationObserver(onMutation);
        activeObserver.observe(bar, playerBarObserverOptions);
      }
      onMutation();
    });
    initialObserver.observe(document.body || document.documentElement, initialObserverOptions);
  }
}

/**
 * Cleanly disconnect MutationObservers and remove global media event listeners
 */
function teardownGlobalMediaListeners() {
  if (activeObserver) {
    try {
      activeObserver.disconnect();
    } catch { }
    activeObserver = null;
  }
  if (initialObserver) {
    try {
      initialObserver.disconnect();
    } catch { }
    initialObserver = null;
  }
  if (mediaEventDebounceTimer) {
    clearTimeout(mediaEventDebounceTimer);
    mediaEventDebounceTimer = null;
  }
  if (mutationDebounceTimer) {
    clearTimeout(mutationDebounceTimer);
    mutationDebounceTimer = null;
  }
  for (const item of registeredMediaListeners) {
    try {
      document.removeEventListener(item.type, item.handler, item.useCapture);
    } catch { }
  }
  registeredMediaListeners = [];
  hasInitializedMediaListeners = false;
}

// Export media observers to YTM namespace
window.YTM.observers = {
  setupGlobalMediaListeners,
  teardownGlobalMediaListeners
};
