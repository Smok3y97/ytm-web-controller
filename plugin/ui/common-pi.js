/**
 * Shared Property Inspector Helper
 * Handles Stream Deck WebSocket connection and global settings (OBS, Discord RPC, WS Port)
 */

let piWebSocket = null;
let piUUID = null;
let piLocalSettings = {};
let piGlobalSettings = {};
let onLocalSettingsCallback = null;

// Global HTML elements
const enableObsCheckbox = document.getElementById('enableObsExport');
const obsFilePathInput = document.getElementById('obsFilePath');
const obsFormatTemplateInput = document.getElementById('obsFormatTemplate');
const obsClearOnPauseCheckbox = document.getElementById('obsClearOnPause');
const enableDiscordCheckbox = document.getElementById('enableDiscordRPC');
const discordClientIdInput = document.getElementById('discordClientId');
const wsPortInput = document.getElementById('wsPort');

function initPropertyInspector(onSettingsReceived) {
  onLocalSettingsCallback = onSettingsReceived;
}

function connectElgatoStreamDeckSocket(inPort, inPropertyInspectorUUID, inRegisterEvent, inInfo, inActionInfo) {
  piUUID = inPropertyInspectorUUID;
  const actionInfo = JSON.parse(inActionInfo);
  piLocalSettings = actionInfo.payload?.settings || {};

  piWebSocket = new WebSocket(`ws://127.0.0.1:${inPort}`);

  piWebSocket.onopen = () => {
    // Register PI
    piWebSocket.send(JSON.stringify({
      event: inRegisterEvent,
      uuid: inPropertyInspectorUUID
    }));

    // Request global settings
    piWebSocket.send(JSON.stringify({
      event: 'getGlobalSettings',
      context: piUUID
    }));

    // Request local settings
    piWebSocket.send(JSON.stringify({
      event: 'getSettings',
      context: piUUID
    }));

    if (onLocalSettingsCallback) {
      onLocalSettingsCallback(piLocalSettings);
    }
  };

  piWebSocket.onmessage = (evt) => {
    const jsonObj = JSON.parse(evt.data);
    const event = jsonObj.event;
    const payload = jsonObj.payload;

    if (event === 'didReceiveSettings') {
      piLocalSettings = payload.settings || {};
      if (onLocalSettingsCallback) {
        onLocalSettingsCallback(piLocalSettings);
      }
    } else if (event === 'didReceiveGlobalSettings') {
      piGlobalSettings = payload.settings || {};
      populateGlobalSettings(piGlobalSettings);
    }
  };
}

function populateGlobalSettings(gs) {
  if (enableObsCheckbox) enableObsCheckbox.checked = !!gs.enableObsExport;
  if (obsFilePathInput) obsFilePathInput.value = gs.obsFilePath || '';
  if (obsFormatTemplateInput) obsFormatTemplateInput.value = gs.obsFormatTemplate || 'Currently Playing: {artist} - {title}';
  if (obsClearOnPauseCheckbox) obsClearOnPauseCheckbox.checked = gs.obsClearOnPause !== false;
  if (enableDiscordCheckbox) enableDiscordCheckbox.checked = gs.enableDiscordRPC !== false;
  if (discordClientIdInput) discordClientIdInput.value = gs.discordClientId || '';
  if (wsPortInput) wsPortInput.value = gs.wsPort || 39865;
}

function saveLocalSettings(newSettings) {
  if (!piWebSocket || piWebSocket.readyState !== WebSocket.OPEN) return;
  piLocalSettings = Object.assign(piLocalSettings, newSettings);

  piWebSocket.send(JSON.stringify({
    event: 'setSettings',
    context: piUUID,
    payload: piLocalSettings
  }));
}

function saveGlobalSettings() {
  if (!piWebSocket || piWebSocket.readyState !== WebSocket.OPEN) return;

  if (enableObsCheckbox) globalSettings.enableObsExport = enableObsCheckbox.checked;
  if (obsFilePathInput) globalSettings.obsFilePath = obsFilePathInput.value.trim();
  if (obsFormatTemplateInput) globalSettings.obsFormatTemplate = obsFormatTemplateInput.value || 'Currently Playing: {artist} - {title}';
  if (obsClearOnPauseCheckbox) globalSettings.obsClearOnPause = obsClearOnPauseCheckbox.checked;
  if (enableDiscordCheckbox) globalSettings.enableDiscordRPC = enableDiscordCheckbox.checked;
  if (discordClientIdInput) globalSettings.discordClientId = discordClientIdInput.value.trim() || undefined;
  if (wsPortInput) globalSettings.wsPort = parseInt(wsPortInput.value, 10) || 39865;

  piWebSocket.send(JSON.stringify({
    event: 'setGlobalSettings',
    context: piUUID,
    payload: globalSettings
  }));
}

// Global listeners
if (enableObsCheckbox) enableObsCheckbox.addEventListener('change', saveGlobalSettings);
if (obsFilePathInput) {
  obsFilePathInput.addEventListener('change', saveGlobalSettings);
  obsFilePathInput.addEventListener('blur', saveGlobalSettings);
}
if (obsFormatTemplateInput) {
  obsFormatTemplateInput.addEventListener('change', saveGlobalSettings);
  obsFormatTemplateInput.addEventListener('input', saveGlobalSettings);
}
if (obsClearOnPauseCheckbox) obsClearOnPauseCheckbox.addEventListener('change', saveGlobalSettings);
if (enableDiscordCheckbox) enableDiscordCheckbox.addEventListener('change', saveGlobalSettings);
if (discordClientIdInput) {
  discordClientIdInput.addEventListener('change', saveGlobalSettings);
  discordClientIdInput.addEventListener('blur', saveGlobalSettings);
}
if (wsPortInput) {
  wsPortInput.addEventListener('change', saveGlobalSettings);
  wsPortInput.addEventListener('input', () => {
    const port = parseInt(wsPortInput.value, 10);
    if (port >= 1024 && port <= 65535) saveGlobalSettings();
  });
}
