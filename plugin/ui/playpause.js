/**
 * Property Inspector for Play/Pause Action
 */

let websocket = null;
let uuid = null;
let actionInfo = {};
let settings = {};
let globalSettings = {};

const showCoverCheckbox = document.getElementById('showCoverAsBackground');
const enableObsCheckbox = document.getElementById('enableObsExport');
const obsFilePathInput = document.getElementById('obsFilePath');
const obsFormatTemplateInput = document.getElementById('obsFormatTemplate');
const obsClearOnPauseCheckbox = document.getElementById('obsClearOnPause');
const enableDiscordCheckbox = document.getElementById('enableDiscordRPC');
const discordClientIdInput = document.getElementById('discordClientId');
const wsPortInput = document.getElementById('wsPort');

function connectElgatoStreamDeckSocket(inPort, inPropertyInspectorUUID, inRegisterEvent, inInfo, inActionInfo) {
  uuid = inPropertyInspectorUUID;
  actionInfo = JSON.parse(inActionInfo);
  settings = actionInfo.payload?.settings || {};

  websocket = new WebSocket(`ws://127.0.0.1:${inPort}`);

  websocket.onopen = () => {
    // Register PI
    websocket.send(JSON.stringify({
      event: inRegisterEvent,
      uuid: inPropertyInspectorUUID
    }));

    // Request global settings
    websocket.send(JSON.stringify({
      event: 'getGlobalSettings',
      context: uuid
    }));

    // Request local settings
    websocket.send(JSON.stringify({
      event: 'getSettings',
      context: uuid
    }));

    // Populate local UI
    showCoverCheckbox.checked = !!settings.showCoverAsBackground;
  };

  websocket.onmessage = (evt) => {
    const jsonObj = JSON.parse(evt.data);
    const event = jsonObj.event;
    const payload = jsonObj.payload;

    if (event === 'didReceiveSettings') {
      settings = payload.settings || {};
      showCoverCheckbox.checked = !!settings.showCoverAsBackground;
    } else if (event === 'didReceiveGlobalSettings') {
      globalSettings = payload.settings || {};
      
      // OBS Settings
      if (enableObsCheckbox) {
        enableObsCheckbox.checked = !!globalSettings.enableObsExport;
      }
      if (obsFilePathInput) {
        obsFilePathInput.value = globalSettings.obsFilePath || '';
      }
      if (obsFormatTemplateInput) {
        obsFormatTemplateInput.value = globalSettings.obsFormatTemplate || 'Currently Playing: {artist} - {title}';
      }
      if (obsClearOnPauseCheckbox) {
        obsClearOnPauseCheckbox.checked = globalSettings.obsClearOnPause !== false;
      }

      // Discord & WebSocket Settings
      if (enableDiscordCheckbox) {
        enableDiscordCheckbox.checked = !!globalSettings.enableDiscordRPC;
      }
      if (discordClientIdInput) {
        discordClientIdInput.value = globalSettings.discordClientId || '';
      }
      if (wsPortInput) {
        wsPortInput.value = globalSettings.wsPort || 39865;
      }
    }
  };
}

function saveSettings() {
  if (!websocket || websocket.readyState !== WebSocket.OPEN) return;

  // Save local settings
  settings.showCoverAsBackground = showCoverCheckbox.checked;
  websocket.send(JSON.stringify({
    event: 'setSettings',
    context: uuid,
    payload: settings
  }));
}

function saveGlobalSettings() {
  if (!websocket || websocket.readyState !== WebSocket.OPEN) return;

  // OBS Settings
  if (enableObsCheckbox) {
    globalSettings.enableObsExport = enableObsCheckbox.checked;
  }
  if (obsFilePathInput) {
    globalSettings.obsFilePath = obsFilePathInput.value.trim();
  }
  if (obsFormatTemplateInput) {
    globalSettings.obsFormatTemplate = obsFormatTemplateInput.value || 'Currently Playing: {artist} - {title}';
  }
  if (obsClearOnPauseCheckbox) {
    globalSettings.obsClearOnPause = obsClearOnPauseCheckbox.checked;
  }

  // Discord & WebSocket Settings
  if (enableDiscordCheckbox) {
    globalSettings.enableDiscordRPC = enableDiscordCheckbox.checked;
  }
  if (discordClientIdInput) {
    globalSettings.discordClientId = discordClientIdInput.value.trim() || undefined;
  }
  if (wsPortInput) {
    const portVal = parseInt(wsPortInput.value, 10) || 39865;
    globalSettings.wsPort = portVal;
  }

  websocket.send(JSON.stringify({
    event: 'setGlobalSettings',
    context: uuid,
    payload: globalSettings
  }));
}

showCoverCheckbox.addEventListener('change', saveSettings);

if (enableObsCheckbox) {
  enableObsCheckbox.addEventListener('change', saveGlobalSettings);
}
if (obsFilePathInput) {
  obsFilePathInput.addEventListener('change', saveGlobalSettings);
  obsFilePathInput.addEventListener('blur', saveGlobalSettings);
}
if (obsFormatTemplateInput) {
  obsFormatTemplateInput.addEventListener('change', saveGlobalSettings);
  obsFormatTemplateInput.addEventListener('input', saveGlobalSettings);
}
if (obsClearOnPauseCheckbox) {
  obsClearOnPauseCheckbox.addEventListener('change', saveGlobalSettings);
}

if (enableDiscordCheckbox) {
  enableDiscordCheckbox.addEventListener('change', saveGlobalSettings);
}
if (discordClientIdInput) {
  discordClientIdInput.addEventListener('change', saveGlobalSettings);
}
if (wsPortInput) {
  wsPortInput.addEventListener('change', saveGlobalSettings);
  wsPortInput.addEventListener('input', () => {
    const port = parseInt(wsPortInput.value, 10);
    if (port >= 1024 && port <= 65535) {
      saveGlobalSettings();
    }
  });
}

