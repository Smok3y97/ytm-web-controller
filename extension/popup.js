/**
 * YouTube Music Web Controller - Popup Script
 */

document.addEventListener('DOMContentLoaded', () => {
  const DEFAULT_PORT = 39865;
  const storageApi = typeof chrome !== 'undefined' && chrome.storage ? chrome.storage : (typeof browser !== 'undefined' ? browser.storage : null);

  const portInput = document.getElementById('ws-port');
  const savePortBtn = document.getElementById('save-port-btn');
  const testConnectionBtn = document.getElementById('test-connection-btn');
  const statusBadge = document.getElementById('status-badge');
  const statusText = document.getElementById('status-text');
  const toastMessage = document.getElementById('toast-message');
  const versionText = document.getElementById('version-text');

  if (versionText && typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
    const manifest = chrome.runtime.getManifest();
    const displayVersion = manifest.version_name || manifest.version;
    if (displayVersion) {
      versionText.textContent = `v${displayVersion} • Open Source`;
    }
  }

  let toastTimeout = null;

  function showToast(message, type = 'success') {
    if (toastTimeout) clearTimeout(toastTimeout);
    toastMessage.textContent = message;
    toastMessage.className = `toast ${type}`;
    toastMessage.classList.remove('hidden');

    toastTimeout = setTimeout(() => {
      toastMessage.classList.add('hidden');
    }, 3000);
  }

  function setStatus(status) {
    statusBadge.className = 'status-badge ' + status;
    if (status === 'connected') {
      statusText.textContent = 'Connected';
    } else if (status === 'connecting') {
      statusText.textContent = 'Checking...';
    } else {
      statusText.textContent = 'Disconnected';
    }
  }

  function loadSettings() {
    if (storageApi && storageApi.local) {
      storageApi.local.get({ wsPort: DEFAULT_PORT }, (items) => {
        const port = items.wsPort || DEFAULT_PORT;
        portInput.value = port;
        testConnection(port, false);
      });
    } else {
      portInput.value = DEFAULT_PORT;
      testConnection(DEFAULT_PORT, false);
    }
  }

  function saveSettings() {
    const port = parseInt(portInput.value, 10);
    if (isNaN(port) || port < 1024 || port > 65535) {
      showToast('Port must be between 1024 and 65535', 'error');
      return;
    }

    if (storageApi && storageApi.local) {
      storageApi.local.set({ wsPort: port }, () => {
        showToast(`Port saved: ${port}`, 'success');
        testConnection(port, true);
      });
    } else {
      showToast(`Port saved: ${port}`, 'success');
      testConnection(port, true);
    }
  }

  function testConnection(port, notify = true) {
    setStatus('connecting');
    const wsUrl = `ws://127.0.0.1:${port}`;
    let socket = null;
    let didConnect = false;

    const timeout = setTimeout(() => {
      if (!didConnect) {
        if (socket) {
          try { socket.close(); } catch (e) { }
        }
        setStatus('disconnected');
        if (notify) showToast(`Cannot reach Stream Deck plugin on port ${port}`, 'error');
      }
    }, 2000);

    try {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        didConnect = true;
        clearTimeout(timeout);
        setStatus('connected');
        if (notify) showToast('Successfully connected to Stream Deck plugin!', 'success');
        try { socket.close(); } catch (e) { }
      };

      socket.onerror = () => {
        clearTimeout(timeout);
        setStatus('disconnected');
        if (notify) showToast(`Plugin not running on port ${port}`, 'error');
      };
    } catch (err) {
      clearTimeout(timeout);
      setStatus('disconnected');
      if (notify) showToast(`Connection error: ${err.message}`, 'error');
    }
  }

  // Event Listeners
  savePortBtn.addEventListener('click', saveSettings);

  portInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveSettings();
  });

  testConnectionBtn.addEventListener('click', () => {
    const port = parseInt(portInput.value, 10) || DEFAULT_PORT;
    testConnection(port, true);
  });

  // Initial load
  loadSettings();
});
