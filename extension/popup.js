/**
 * YouTube Music Web Controller - Popup Script
 * 
 * Manages WebSocket port configuration, connection health checks,
 * and bidirectional version handshake diagnostics across Chromium & Firefox.
 */

document.addEventListener('DOMContentLoaded', () => {
  const DEFAULT_PORT = 39865;
  const extensionApi = typeof chrome !== 'undefined' && chrome.runtime ? chrome : (typeof browser !== 'undefined' ? browser : null);
  const storageApi = extensionApi?.storage?.local || null;

  const portInput = document.getElementById('ws-port');
  const savePortBtn = document.getElementById('save-port-btn');
  const testConnectionBtn = document.getElementById('test-connection-btn');
  const statusBadge = document.getElementById('status-badge');
  const statusText = document.getElementById('status-text');
  const toastMessage = document.getElementById('toast-message');
  const versionText = document.getElementById('version-text');
  const mismatchBanner = document.getElementById('mismatch-banner');
  const mismatchText = document.getElementById('mismatch-text');

  function compareVersions(v1, v2) {
    const parts1 = (v1 || '').split('.').map((p) => parseInt(p, 10) || 0);
    const parts2 = (v2 || '').split('.').map((p) => parseInt(p, 10) || 0);
    const maxLen = Math.max(parts1.length, parts2.length, 4);

    for (let i = 0; i < maxLen; i++) {
      const n1 = parts1[i] || 0;
      const n2 = parts2[i] || 0;
      if (n1 > n2) return 1;
      if (n1 < n2) return -1;
    }
    return 0;
  }

  function getManifestVersion() {
    try {
      if (extensionApi?.runtime?.getManifest) {
        const manifest = extensionApi.runtime.getManifest();
        return manifest.version || '1.5.0.0';
      }
    } catch (e) { }
    return '1.5.0.0';
  }

  function getDisplayVersion() {
    try {
      if (extensionApi?.runtime?.getManifest) {
        const manifest = extensionApi.runtime.getManifest();
        return manifest.version_name || manifest.version || '1.5.0';
      }
    } catch (e) { }
    return '1.5.0';
  }

  function detectBrowserPlatform() {
    const ua = (navigator.userAgent || '').toLowerCase();
    if (ua.includes('firefox') || ua.includes('fxios')) return 'firefox';
    if (ua.includes('edg/') || ua.includes('edge/')) return 'edge';
    if (navigator.brave && typeof navigator.brave.isBrave === 'function') return 'brave';
    if (ua.includes('opr/') || ua.includes('opera')) return 'opera';
    if (ua.includes('vivaldi')) return 'vivaldi';
    if (ua.includes('chrome') || ua.includes('crios')) return 'chromium';
    if (ua.includes('safari')) return 'safari';
    return 'browser';
  }

  if (versionText) {
    versionText.textContent = `v${getDisplayVersion()} • Open Source`;
  }

  let toastTimeout = null;

  function showToast(message, type = 'success') {
    if (toastTimeout) clearTimeout(toastTimeout);
    toastMessage.textContent = message;
    toastMessage.className = `toast ${type}`;
    toastMessage.classList.remove('hidden');

    toastTimeout = setTimeout(() => {
      toastMessage.classList.add('hidden');
    }, 3500);
  }

  function setStatus(status) {
    statusBadge.className = 'status-badge ' + status;
    if (status === 'connected') {
      statusText.textContent = 'Connected';
    } else if (status === 'mismatch') {
      statusText.textContent = 'Version Mismatch';
    } else if (status === 'connecting') {
      statusText.textContent = 'Checking...';
    } else {
      statusText.textContent = 'Disconnected';
    }
  }

  function updateMismatchUI(isMismatch, requiredVersion, isPluginOutdated = false) {
    if (!mismatchBanner) return;
    if (isMismatch) {
      const reqVer = requiredVersion || '1.5.0.0';
      if (mismatchText) {
        mismatchText.textContent = isPluginOutdated
          ? `Requires Stream Deck Plugin v${reqVer}+`
          : `Requires Plugin/Extension v${reqVer}+`;
      }
      mismatchBanner.classList.remove('hidden');
      setStatus('mismatch');
    } else {
      mismatchBanner.classList.add('hidden');
    }
  }

  function loadSettings() {
    if (storageApi) {
      storageApi.get(
        {
          wsPort: DEFAULT_PORT,
          isMismatch: false,
          requiredPluginVersion: '1.5.0.0',
          currentPluginVersion: '1.5.0.0'
        },
        (items) => {
          const port = items.wsPort || DEFAULT_PORT;
          portInput.value = port;
          if (items.isMismatch) {
            const extVer = getManifestVersion();
            const isPluginOutdated = compareVersions(extVer, items.currentPluginVersion) > 0;
            updateMismatchUI(true, items.requiredPluginVersion, isPluginOutdated);
          }
          testConnection(port, false);
        }
      );
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

    if (storageApi) {
      storageApi.set({ wsPort: port }, () => {
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
    }, 2500);

    try {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        didConnect = true;

        // Perform live handshake diagnostic
        const extVersion = getManifestVersion();
        const platform = detectBrowserPlatform();

        try {
          socket.send(JSON.stringify({
            type: 'handshake',
            version: extVersion,
            platform: platform
          }));
        } catch (e) { }
      };

      socket.onmessage = (event) => {
        clearTimeout(timeout);
        try {
          const data = JSON.parse(event.data);
          const extVersion = getManifestVersion();

          if (data.type === 'handshake_ack') {
            const comp = compareVersions(extVersion, data.version);
            if (comp === 0) {
              updateMismatchUI(false);
              if (storageApi) {
                storageApi.set({ isMismatch: false });
              }
              setStatus('connected');
              if (notify) showToast(`Connected to Stream Deck Plugin (v${data.version})!`, 'success');
              try { socket.close(); } catch (e) { }
              return;
            }

            // Version differs despite ACK
            const isPluginOutdated = comp > 0;
            const reqVer = isPluginOutdated ? extVersion : data.version;
            updateMismatchUI(true, reqVer, isPluginOutdated);
            if (storageApi) {
              storageApi.set({
                isMismatch: true,
                requiredPluginVersion: reqVer,
                currentPluginVersion: data.version
              });
            }
            setStatus('mismatch');
            if (notify) {
              showToast(
                isPluginOutdated
                  ? `Plugin Outdated: Requires Plugin v${extVersion}+`
                  : `Extension Outdated: Requires Extension v${data.version}+`,
                'error'
              );
            }
            try { socket.close(); } catch (e) { }
            return;
          }

          if (data.type === 'version_mismatch') {
            const reqVer = data.requiredPluginVersion || '1.5.0.0';
            const isPluginOutdated = compareVersions(extVersion, data.currentPluginVersion) > 0;
            updateMismatchUI(true, reqVer, isPluginOutdated);
            if (storageApi) {
              storageApi.set({
                isMismatch: true,
                requiredPluginVersion: reqVer,
                currentPluginVersion: data.currentPluginVersion
              });
            }
            setStatus('mismatch');
            if (notify) {
              showToast(
                isPluginOutdated
                  ? `Plugin Outdated: Requires Plugin v${extVersion}+`
                  : `Version Mismatch: Requires Plugin v${reqVer}+`,
                'error'
              );
            }
            try { socket.close(); } catch (e) { }
            return;
          }
        } catch { }

        // Fallback for non-handshake response
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
