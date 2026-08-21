/**
 * YouTube Music Web Controller - Content Script Orchestrator
 * 
 * WebSocket communication lifecycle, command dispatcher, and initialization.
 * Bridges music.youtube.com with local Elgato Stream Deck & Discord RPC server.
 */

'use strict';

window.YTM = window.YTM || {};

const DEFAULT_PORT = 39865;

let ws = null;
let currentPort = DEFAULT_PORT;
let reconnectTimeout = null;
let reconnectAttempts = 0;
let isConnecting = false;
let bridgeVersion = '1.10.0.0';

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
 * Schedule state broadcasts at staggered intervals
 */
function scheduleStateUpdates(delays = [50, 150, 350]) {
  delays.forEach(d => setTimeout(() => sendState(true), d));
}
window.YTM.scheduleStateUpdates = scheduleStateUpdates;

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

    console.log(`[YTM Controller] Executing command: ${command}`, payload);
    switch (command) {
      case 'playPause': {
        togglePlayPause();
        break;
      }

      case 'play': {
        if (typeof playVideo === 'function') {
          playVideo();
        } else {
          togglePlayPause();
        }
        break;
      }

      case 'pause': {
        if (typeof pauseVideo === 'function') {
          pauseVideo();
        } else {
          togglePlayPause();
        }
        break;
      }

      case 'next': {
        const pb = $('ytmusic-player-bar');
        if (pb) {
          clickElement('.next-button, tp-yt-paper-icon-button.next-button, #next-button', pb);
        } else {
          clickElement('.next-button, tp-yt-paper-icon-button.next-button, #next-button');
        }
        scheduleStateUpdates([150]);
        break;
      }

      case 'previous': {
        const pb = $('ytmusic-player-bar');
        if (pb) {
          clickElement('.previous-button, tp-yt-paper-icon-button.previous-button, #previous-button', pb);
        } else {
          clickElement('.previous-button, tp-yt-paper-icon-button.previous-button, #previous-button');
        }
        scheduleStateUpdates([150]);
        break;
      }

      case 'like': {
        const pb = $('ytmusic-player-bar');
        if (pb) {
          const likeRenderer = $('ytmusic-like-button-renderer, #like-button-renderer, .middle-controls ytmusic-like-button-renderer', pb) || pb;
          const likeBtn = $(
            '#button-shape-like button, #button-shape-like, tp-yt-paper-icon-button#like-button, tp-yt-paper-icon-button.like, #like-button, [aria-label*="mag ich" i]:not([aria-label*="nicht" i]), [aria-label*="like" i]:not([aria-label*="dislike" i])',
            likeRenderer
          );
          if (likeBtn) {
            const btn = likeBtn.querySelector('button') || likeBtn;
            try { btn.click(); } catch (e) { }
          }
        }
        scheduleStateUpdates([60, 200, 450]);
        break;
      }

      case 'dislike': {
        const pb = $('ytmusic-player-bar');
        if (pb) {
          const likeRenderer = $('ytmusic-like-button-renderer, #like-button-renderer, .middle-controls ytmusic-like-button-renderer', pb) || pb;
          const dislikeBtn = $(
            '#button-shape-dislike button, #button-shape-dislike, tp-yt-paper-icon-button#dislike-button, tp-yt-paper-icon-button.dislike, #dislike-button, [aria-label*="mag ich nicht" i], [aria-label*="dislike" i]',
            likeRenderer
          );
          if (dislikeBtn) {
            const btn = dislikeBtn.querySelector('button') || dislikeBtn;
            try { btn.click(); } catch (e) { }
          }
        }
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

// Export orchestrator functions to YTM namespace
window.YTM.handleCommand = handleCommand;
window.YTM.connectWebSocket = connectWebSocket;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
