/**
 * Property Inspector for Play/Pause Action
 */

let websocket = null;
let uuid = null;
let actionInfo = {};
let settings = {};
let globalSettings = {};

const showCoverCheckbox = document.getElementById('showCoverAsBackground');
const enableDiscordCheckbox = document.getElementById('enableDiscordRPC');
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
      enableDiscordCheckbox.checked = !!globalSettings.enableDiscordRPC;
      wsPortInput.value = globalSettings.wsPort || 39865;
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

  const portVal = parseInt(wsPortInput.value, 10) || 39865;
  globalSettings.enableDiscordRPC = enableDiscordCheckbox.checked;
  globalSettings.wsPort = portVal;

  websocket.send(JSON.stringify({
    event: 'setGlobalSettings',
    context: uuid,
    payload: globalSettings
  }));
}

showCoverCheckbox.addEventListener('change', saveSettings);
enableDiscordCheckbox.addEventListener('change', saveGlobalSettings);
wsPortInput.addEventListener('change', saveGlobalSettings);
wsPortInput.addEventListener('input', () => {
  const port = parseInt(wsPortInput.value, 10);
  if (port >= 1024 && port <= 65535) {
    saveGlobalSettings();
  }
});
