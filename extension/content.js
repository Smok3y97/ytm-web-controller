/**
 * YouTube Music Web Controller - Content Script Orchestrator
 * 
 * WebSocket communication lifecycle, command dispatcher, and initialization.
 * Bridges music.youtube.com with local Elgato Stream Deck & Discord RPC server.
 */

'use strict';

window.YTM = window.YTM || {};

const DEFAULT_PORT = 39865;
const tabId = 'tab_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();

let ws = null;
let currentPort = DEFAULT_PORT;
let reconnectTimeout = null;
let reconnectAttempts = 0;
let isConnecting = false;
let isTabClosing = false;
let lastSentTime = 0;
let bridgeVersion = '';

let lastSentState = {
  title: '',
  artist: '',
  album: '',
  coverUrl: '',
  trackUrl: '',
  artistUrl: '',
  albumUrl: '',
  paused: true,
  currentTime: 0,
  duration: 0,
  volume: 100,
  muted: false,
  isLiked: false,
  isDisliked: false,
  shuffleActive: false,
  repeatMode: 'OFF'
};

let scheduledTimers = [];
let microtaskScheduled = false;
let pendingForceSend = false;

/**
 * Cancel any pending staggered update checks
 */
function clearScheduledUpdates() {
  while (scheduledTimers.length > 0) {
    clearTimeout(scheduledTimers.pop());
  }
}

/**
 * Schedule state checks at staggered intervals for late-arriving DOM/MediaSession metadata
 * Evaluates dirty-checking so identical state is not transmitted
 */
function scheduleStateUpdates(delays = [60, 200, 450]) {
  clearScheduledUpdates();
  delays.forEach(d => {
    const timer = setTimeout(() => {
      sendState(false);
    }, d);
    scheduledTimers.push(timer);
  });
}
window.YTM.scheduleStateUpdates = scheduleStateUpdates;

/**
 * Coalesce multiple synchronous state notification triggers into a single atomic microtask snapshot
 */
function queueStateSnapshot(force = false) {
  if (force) pendingForceSend = true;
  if (microtaskScheduled) return;
  microtaskScheduled = true;
  queueMicrotask(() => {
    microtaskScheduled = false;
    const isForce = pendingForceSend;
    pendingForceSend = false;
    sendState(isForce);
  });
}
window.YTM.queueStateSnapshot = queueStateSnapshot;

/**
 * Notify server when tab is closing and cleanly detach observers
 */
function notifyTabClosed() {
  isTabClosing = true;
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  clearScheduledUpdates();

  // Cleanly detach MutationObservers and Media Listeners
  if (typeof window.YTM?.state?.teardownGlobalMediaListeners === 'function') {
    try {
      window.YTM.state.teardownGlobalMediaListeners();
    } catch { }
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify({
        type: 'TAB_CLOSED',
        tabId: tabId
      }));
      ws.close();
    } catch { }
  }
}

/**
 * Broadcast state payload over WebSocket
 */
function sendState(force = false) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  try {
    const collector = window.YTM?.state?.collectPlaybackState || (typeof collectPlaybackState === 'function' ? collectPlaybackState : null);
    const state = collector ? collector() : null;
    if (!state) return;

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
      state.coverUrl === lastSentState.coverUrl &&
      state.trackUrl === lastSentState.trackUrl &&
      state.artistUrl === lastSentState.artistUrl &&
      state.albumUrl === lastSentState.albumUrl &&
      Math.abs(state.currentTime - (lastSentState.currentTime || 0)) < 1.5
    );

    const now = Date.now();
    if (!force && isIdentical) return;
    if (force && isIdentical && (now - lastSentTime < 250)) return;

    lastSentTime = now;
    lastSentState = { ...state };

    const timestamp = state.timestamp || Date.now();
    const isPlaying = !state.paused;
    ws.send(JSON.stringify({
      type: 'STATE_UPDATE',
      timestamp,
      tabId: tabId,
      isPlaying: isPlaying,
      data: state
    }));
  } catch (err) {
    console.error('[YTM Controller] Error collecting/sending state:', err);
  }
}
window.YTM.sendState = sendState;

/**
 * Execute control commands received from Stream Deck / HTTP API
 */
function handleCommand(message) {
  if (!message) return;

  try {
    const command = typeof message === 'string' ? message : message.command;
    const payload = (typeof message === 'object' && message ? message.payload : {}) || {};
    if (!command) return;

    const actions = window.YTM.actions || {};

    switch (command) {
      case 'playPause': {
        actions.togglePlayPause?.();
        break;
      }

      case 'play': {
        actions.playVideo?.();
        break;
      }

      case 'pause': {
        actions.pauseVideo?.();
        break;
      }

      case 'next': {
        actions.nextTrack?.();
        break;
      }

      case 'previous': {
        actions.previousTrack?.();
        break;
      }

      case 'like': {
        actions.toggleLike?.();
        break;
      }

      case 'dislike': {
        actions.toggleDislike?.();
        break;
      }

      case 'shuffle': {
        actions.toggleShuffle?.();
        break;
      }

      case 'repeat': {
        actions.toggleRepeat?.();
        break;
      }

      case 'volumeUp': {
        actions.adjustPlayerVolume?.(payload.step || 5);
        break;
      }

      case 'volumeDown': {
        actions.adjustPlayerVolume?.(-(payload.step || 5));
        break;
      }

      case 'adjustVolume': {
        actions.adjustPlayerVolume?.(payload.delta || 0);
        break;
      }

      case 'setVolume': {
        if (typeof payload.volume === 'number') {
          actions.setPlayerVolume?.(payload.volume);
        }
        break;
      }

      case 'toggleMute':
      case 'volumeMute': {
        actions.togglePlayerMute?.();
        break;
      }

      case 'seek':
      case 'seekRelative': {
        const delta = typeof payload.seconds === 'number' ? payload.seconds : (typeof payload.delta === 'number' ? payload.delta : 0);
        actions.seekRelative?.(delta);
        break;
      }

      case 'seekTo': {
        const time = typeof payload.time === 'number' ? payload.time : (typeof payload.seconds === 'number' ? payload.seconds : 0);
        actions.seekTo?.(time);
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
        console.warn('[YTM Controller] Unknown command:', command);
    }
  } catch (err) {
    console.error('[YTM Controller] Error executing command:', err);
  }
}

/**
 * Send handshake packet to Stream Deck plugin
 */
function sendHandshake(version) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const extVersion = version || bridgeVersion || '';
  const platform = detectBrowserPlatform();
  try {
    ws.send(JSON.stringify({
      type: 'handshake',
      version: extVersion,
      platform: platform,
      tabId: tabId
    }));
  } catch (e) { }
}

/**
 * Register client info with Stream Deck plugin
 */
function registerClient(version) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const extVersion = version || bridgeVersion || '';
  const platform = detectBrowserPlatform();
  try {
    const msPlaying = window.YTM.mediaSession?.getPlaybackState?.() === 'playing';
    const video = (typeof findVideoElement === 'function' ? findVideoElement() : null) || window.YTM?.utils?.findVideoElement?.();
    const isPlaying = msPlaying || (video ? !video.paused : false);
    ws.send(JSON.stringify({
      type: 'REGISTER_CLIENT',
      client: 'ytm-extension',
      version: extVersion,
      platform: platform,
      url: window.location.href,
      tabId: tabId,
      isPlaying: isPlaying
    }));
  } catch (e) { }
}

/**
 * Connect to Stream Deck local WebSocket server
 */
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
      console.info(`[YTM Controller] 🟢 Connected to Stream Deck on port ${currentPort}`);

      lastSentState = {};

      const extVersion = bridgeVersion || '';

      // 1. Send Handshake packet immediately before any playback events
      sendHandshake(extVersion);

      // 2. Register client info
      registerClient(extVersion);

      sendState(true);
      scheduleStateUpdates([50, 150, 400]);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'handshake_ack') {
          const comp = compareVersions(bridgeVersion, data.version);
          if (comp === 0) {
            console.info('[YTM Controller] 🟢 Handshake ACK received (Plugin v%s)', data.version);
            reportMismatchStatus(false);
            sendState(true);
            scheduleStateUpdates([50, 200]);
          } else if (comp > 0) {
            console.warn('[YTM Controller] ⚠️ Plugin is older than Extension (Plugin v%s, Extension v%s)', data.version, bridgeVersion);
            reportMismatchStatus(true, bridgeVersion, data.version, `Stream Deck Plugin (v${data.version}) is outdated!`);
          } else {
            console.warn('[YTM Controller] ⚠️ Extension is older than Plugin (Extension v%s, Plugin v%s)', bridgeVersion, data.version);
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
      if (isTabClosing) return;
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

const MAX_FAST_RETRIES = 3;

/**
 * Schedule reconnect with fast bounded retries
 * Retries up to 3 times to handle plugin hot-reloads, then enters passive standby (zero polling)
 */
function scheduleReconnect() {
  if (reconnectTimeout) return;
  if (reconnectAttempts >= MAX_FAST_RETRIES) {
    // Zero Polling: Discontinue timers and enter passive standby until triggered by playback events
    return;
  }

  reconnectAttempts++;
  const delay = 600 + reconnectAttempts * 500; // 1100ms, 1600ms, 2100ms

  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    connectWebSocket(currentPort);
  }, delay);
}

/**
 * Wake connection from passive standby upon genuine user or media events
 */
function wakeFromStandby() {
  isTabClosing = false;

  // Restore reactivity if listeners were previously torn down during pagehide / suspend
  const setupMedia = window.YTM?.state?.setupGlobalMediaListeners || (typeof setupGlobalMediaListeners === 'function' ? setupGlobalMediaListeners : null);
  if (setupMedia) {
    try {
      setupMedia();
    } catch { }
  }

  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }
  reconnectAttempts = 0;
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  connectWebSocket(currentPort);
}

/**
 * Extension initialization
 */
function init() {
  console.info('[YTM Controller] ⚡ Initializing YouTube Music Content Script...');

  const setupMedia = window.YTM?.state?.setupGlobalMediaListeners || (typeof setupGlobalMediaListeners === 'function' ? setupGlobalMediaListeners : null);
  if (setupMedia) {
    setupMedia();
  }

  // Deregister tab on close or navigation, and restore on bfcache pageshow
  window.addEventListener('beforeunload', notifyTabClosed);
  window.addEventListener('pagehide', notifyTabClosed);
  window.addEventListener('pageshow', () => {
    wakeFromStandby();
    if (ws && ws.readyState === WebSocket.OPEN) {
      lastSentState = {};
      sendState(true);
    }
  });

  // Passive event wakeups: Reconnect on user or playback events without any polling timers
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        wakeFromStandby();
      } else {
        lastSentState = {};
        sendState(true);
      }
    }
  });

  window.addEventListener('focus', wakeFromStandby);
  document.addEventListener('play', wakeFromStandby, true);
  document.addEventListener('loadedmetadata', wakeFromStandby, true);

  // Listen for configuration from bridge script (ISOLATED world)
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || typeof event.data !== 'object') return;

    if (event.data.type === 'YTM_BRIDGE_CONFIG') {
      const prevVersion = bridgeVersion;
      if (event.data.version) bridgeVersion = event.data.version;
      const targetPort = event.data.wsPort || DEFAULT_PORT;
      if (ws && ws.readyState === WebSocket.OPEN && targetPort === currentPort) {
        if (bridgeVersion && bridgeVersion !== prevVersion) {
          sendHandshake(bridgeVersion);
          registerClient(bridgeVersion);
          sendState(true);
        }
      } else {
        connectWebSocket(targetPort);
      }
    } else if (event.data.type === 'YTM_BRIDGE_PORT_UPDATE') {
      const targetPort = event.data.wsPort || DEFAULT_PORT;
      if (targetPort !== currentPort) {
        console.info('[YTM Controller] Switching WebSocket port to', targetPort);
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

// Export orchestrator functions to YTM namespace
window.YTM.handleCommand = handleCommand;
window.YTM.connectWebSocket = connectWebSocket;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
