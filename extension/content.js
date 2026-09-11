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
let bridgeVersion = '1.11.5.0';

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
  volume: 1,
  muted: false,
  isLiked: false,
  isDisliked: false,
  shuffleActive: false,
  repeatMode: 'OFF'
};

/**
 * Schedule state broadcasts at staggered intervals
 */
function scheduleStateUpdates(delays = [50, 150, 350]) {
  delays.forEach(d => setTimeout(() => sendState(true), d));
}
window.YTM.scheduleStateUpdates = scheduleStateUpdates;

/**
 * Notify server when tab is closing
 */
function notifyTabClosed() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify({
        type: 'TAB_CLOSED',
        tabId: tabId
      }));
    } catch { }
  }
}

/**
 * Broadcast state payload over WebSocket
 */
function sendState(force = false) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  try {
    const state = typeof collectPlaybackState === 'function' ? collectPlaybackState() : null;
    if (!state) return;

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
        state.coverUrl === lastSentState.coverUrl &&
        state.trackUrl === lastSentState.trackUrl &&
        state.artistUrl === lastSentState.artistUrl &&
        state.albumUrl === lastSentState.albumUrl &&
        Math.abs(state.currentTime - (lastSentState.currentTime || 0)) < 1.5
      );

      if (isIdentical) return;
    }

    lastSentState = { ...state };

    const timestamp = state.timestamp || Date.now();
    const isPlaying = !state.paused;
    ws.send(JSON.stringify({
      type: 'STATE_UPDATE',
      event: 'STATE_UPDATE',
      timestamp,
      tabId: tabId,
      isPlaying: isPlaying,
      data: state,
      state: state
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

    console.log('[YTM Controller] Executing command:', command, payload);
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
        console.log('[YTM Controller] Unknown command:', command);
    }
  } catch (err) {
    console.error('[YTM Controller] Error executing command:', err);
  }
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
      console.log(`[YTM Controller] 🟢 Connected to Stream Deck on port ${currentPort}`);

      lastSentState = {};

      const extVersion = bridgeVersion || '1.8.0.0';
      const platform = detectBrowserPlatform();

      // 1. Send Handshake packet immediately before any playback events
      try {
        ws.send(JSON.stringify({
          type: 'handshake',
          version: extVersion,
          platform: platform,
          tabId: tabId
        }));
      } catch (e) { }

      // 2. Register client info
      try {
        const msPlaying = window.YTM.mediaSession?.getPlaybackState?.() === 'playing';
        const video = typeof findVideoElement === 'function' ? findVideoElement() : null;
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

      sendState(true);
      scheduleStateUpdates([50, 150, 400]);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'handshake_ack') {
          const comp = compareVersions(bridgeVersion, data.version);
          if (comp === 0) {
            console.log('[YTM Controller] 🟢 Handshake ACK received (Plugin v%s)', data.version);
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

/**
 * Schedule reconnect with exponential backoff capped at 3s
 */
function scheduleReconnect() {
  if (reconnectTimeout) return;
  reconnectAttempts++;
  const delay = Math.min(3000, 800 + reconnectAttempts * 400);
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    connectWebSocket(currentPort);
  }, delay);
}

/**
 * Extension initialization
 */
function init() {
  console.log('[YTM Controller] ⚡ Initializing YouTube Music Content Script...');

  if (typeof setupGlobalMediaListeners === 'function') {
    setupGlobalMediaListeners();
  }

  // Deregister tab on close or navigation
  window.addEventListener('beforeunload', notifyTabClosed);
  window.addEventListener('pagehide', notifyTabClosed);

  // Sync state when tab becomes visible
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      sendState(true);
    }
  });

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
        console.log('[YTM Controller] Switching WebSocket port to', targetPort);
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
