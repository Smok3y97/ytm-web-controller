/**
 * YouTube Music Web Controller - Extension Bridge
 * 
 * Runs in ISOLATED world to provide access to chrome.storage and chrome.runtime
 * and bridges configuration & version mismatch status to content.js via window.postMessage.
 */

(() => {
  'use strict';

  const extensionApi = typeof chrome !== 'undefined' && chrome.runtime ? chrome : (typeof browser !== 'undefined' ? browser : null);
  if (!extensionApi) return;

  function getManifestVersion() {
    try {
      if (extensionApi.runtime?.getManifest) {
        return extensionApi.runtime.getManifest().version || '1.5.1.0';
      }
    } catch (e) { }
    return '1.5.1.0';
  }

  function getStorage() {
    return extensionApi.storage?.local || null;
  }

  function sendConfigToPage(port) {
    window.postMessage({
      type: 'YTM_BRIDGE_CONFIG',
      version: getManifestVersion(),
      wsPort: port || 39865
    }, '*');
  }

  // 1. Initial config dispatch
  const storage = getStorage();
  if (storage) {
    storage.get({ wsPort: 39865 }, (items) => {
      sendConfigToPage(items.wsPort || 39865);
    });

    if (extensionApi.storage?.onChanged) {
      extensionApi.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.wsPort) {
          const newPort = changes.wsPort.newValue || 39865;
          window.postMessage({
            type: 'YTM_BRIDGE_PORT_UPDATE',
            wsPort: newPort
          }, '*');
        }
      });
    }
  } else {
    sendConfigToPage(39865);
  }

  // 2. Listen for messages from content.js (MAIN world)
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || typeof event.data !== 'object') return;

    if (event.data.type === 'YTM_PAGE_REQUEST_CONFIG') {
      if (storage) {
        storage.get({ wsPort: 39865 }, (items) => {
          sendConfigToPage(items.wsPort || 39865);
        });
      } else {
        sendConfigToPage(39865);
      }
    } else if (event.data.type === 'YTM_MISMATCH_STATUS') {
      if (storage) {
        storage.set({
          isMismatch: !!event.data.isMismatch,
          requiredPluginVersion: event.data.requiredPluginVersion || '1.5.1.0',
          currentPluginVersion: event.data.currentPluginVersion || '1.5.1.0',
          mismatchMessage: event.data.mismatchMessage || ''
        });
      }
    }
  });
})();
