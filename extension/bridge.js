/**
 * YouTube Music Web Controller - Extension Bridge
 * 
 * Runs in ISOLATED world to provide access to chrome.storage and chrome.runtime
 * and bridges configuration & version mismatch status to content.js via window.postMessage.
 */

(() => {
  'use strict';

  function isContextValid() {
    try {
      return Boolean(typeof chrome !== 'undefined' && chrome?.runtime?.id);
    } catch {
      return false;
    }
  }

  function getApi() {
    if (!isContextValid()) return null;
    return typeof chrome !== 'undefined' && chrome.runtime ? chrome : (typeof browser !== 'undefined' ? browser : null);
  }

  function getManifestVersion() {
    try {
      const api = getApi();
      if (api?.runtime?.getManifest) {
        return api.runtime.getManifest().version || '1.6.0.0';
      }
    } catch (e) { }
    return '1.6.0.0';
  }

  function getStorage() {
    try {
      const api = getApi();
      return api?.storage?.local || null;
    } catch {
      return null;
    }
  }

  function sendConfigToPage(port) {
    try {
      window.postMessage({
        type: 'YTM_BRIDGE_CONFIG',
        version: getManifestVersion(),
        wsPort: port || 39865
      }, '*');
    } catch (e) { }
  }

  // 1. Initial config dispatch
  try {
    const storage = getStorage();
    if (storage) {
      storage.get({ wsPort: 39865 }, (items) => {
        try {
          if (!isContextValid()) return;
          sendConfigToPage(items?.wsPort || 39865);
        } catch (e) { }
      });

      const api = getApi();
      if (api?.storage?.onChanged) {
        api.storage.onChanged.addListener((changes, area) => {
          try {
            if (!isContextValid()) return;
            if (area === 'local' && changes.wsPort) {
              const newPort = changes.wsPort.newValue || 39865;
              window.postMessage({
                type: 'YTM_BRIDGE_PORT_UPDATE',
                wsPort: newPort
              }, '*');
            }
          } catch (e) { }
        });
      }
    } else {
      sendConfigToPage(39865);
    }
  } catch (e) {
    sendConfigToPage(39865);
  }

  // 2. Listen for messages from content.js (MAIN world)
  window.addEventListener('message', (event) => {
    try {
      if (event.source !== window || !event.data || typeof event.data !== 'object') return;
      if (!isContextValid()) return;

      const storage = getStorage();

      if (event.data.type === 'YTM_PAGE_REQUEST_CONFIG') {
        if (storage) {
          storage.get({ wsPort: 39865 }, (items) => {
            try {
              if (!isContextValid()) return;
              sendConfigToPage(items?.wsPort || 39865);
            } catch (e) { }
          });
        } else {
          sendConfigToPage(39865);
        }
      } else if (event.data.type === 'YTM_MISMATCH_STATUS') {
        if (storage) {
          storage.set({
            isMismatch: !!event.data.isMismatch,
            requiredPluginVersion: event.data.requiredPluginVersion || '1.6.0.0',
            currentPluginVersion: event.data.currentPluginVersion || '1.6.0.0',
            mismatchMessage: event.data.mismatchMessage || ''
          }, () => {
            if (chrome?.runtime?.lastError) {
              // Ignore invalid context or storage errors safely
            }
          });
        }
      } else if (event.data.type === 'YTM_FOCUS_TAB') {
        const api = getApi();
        if (api?.runtime?.sendMessage) {
          try {
            api.runtime.sendMessage({ type: 'YTM_FOCUS_TAB' }, () => {
              if (chrome?.runtime?.lastError) {
                // Ignore runtime errors
              }
            });
          } catch { }
        }
      }
    } catch (err) {
      // Suppress any context invalidation errors when extension reloads
    }
  });
})();
