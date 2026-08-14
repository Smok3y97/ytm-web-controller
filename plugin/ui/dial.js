/**
 * Property Inspector for Stream Deck + Dial Action
 */

let websocket = null;
let uuid = null;
let actionInfo = {};
let settings = {};
let globalSettings = {};

const modeSelect = document.getElementById('mode');
const volumeStepInput = document.getElementById('volumeStep');
const titleTemplateInput = document.getElementById('titleTemplate');
const timeTemplateInput = document.getElementById('timeTemplate');
const showCoverCheckbox = document.getElementById('showCover');
const enableDiscordCheckbox = document.getElementById('enableDiscordRPC');
const wsPortInput = document.getElementById('wsPort');

function connectElgatoStreamDeckSocket(inPort, inPropertyInspectorUUID, inRegisterEvent, inInfo, inActionInfo) {
  uuid = inPropertyInspectorUUID;
  actionInfo = JSON.parse(inActionInfo);
  settings = actionInfo.payload?.settings || {};

  websocket = new WebSocket(`ws://127.0.0.1:${inPort}`);

  websocket.onopen = () => {
    websocket.send(JSON.stringify({
      event: inRegisterEvent,
      uuid: inPropertyInspectorUUID
    }));

    websocket.send(JSON.stringify({
      event: 'getGlobalSettings',
      context: uuid
    }));

    websocket.send(JSON.stringify({
      event: 'getSettings',
      context: uuid
    }));

    // Populate local fields
    modeSelect.value = settings.mode || 'volume';
    volumeStepInput.value = settings.volumeStep || 5;
    titleTemplateInput.value = settings.titleTemplate || '{artist} - {title}';
    timeTemplateInput.value = settings.timeTemplate || '{remaining}';
    showCoverCheckbox.checked = settings.showCover !== false;
  };

  websocket.onmessage = (evt) => {
    const jsonObj = JSON.parse(evt.data);
    const event = jsonObj.event;
    const payload = jsonObj.payload;

    if (event === 'didReceiveSettings') {
      settings = payload.settings || {};
      modeSelect.value = settings.mode || 'volume';
      volumeStepInput.value = settings.volumeStep || 5;
      titleTemplateInput.value = settings.titleTemplate || '{artist} - {title}';
      timeTemplateInput.value = settings.timeTemplate || '{remaining}';
      showCoverCheckbox.checked = settings.showCover !== false;
    } else if (event === 'didReceiveGlobalSettings') {
      globalSettings = payload.settings || {};
      enableDiscordCheckbox.checked = !!globalSettings.enableDiscordRPC;
      wsPortInput.value = globalSettings.wsPort || 39865;
    }
  };
}

function saveSettings() {
  if (!websocket || websocket.readyState !== WebSocket.OPEN) return;

  settings.mode = modeSelect.value;
  settings.volumeStep = Math.min(10, Math.max(1, parseInt(volumeStepInput.value, 10) || 5));
  settings.titleTemplate = titleTemplateInput.value;
  settings.timeTemplate = timeTemplateInput.value;
  settings.showCover = showCoverCheckbox.checked;

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

modeSelect.addEventListener('change', saveSettings);
volumeStepInput.addEventListener('change', saveSettings);
titleTemplateInput.addEventListener('input', saveSettings);
timeTemplateInput.addEventListener('input', saveSettings);
showCoverCheckbox.addEventListener('change', saveSettings);

enableDiscordCheckbox.addEventListener('change', saveGlobalSettings);
wsPortInput.addEventListener('change', saveGlobalSettings);
wsPortInput.addEventListener('input', () => {
  const port = parseInt(wsPortInput.value, 10);
  if (port >= 1024 && port <= 65535) {
    saveGlobalSettings();
  }
});
