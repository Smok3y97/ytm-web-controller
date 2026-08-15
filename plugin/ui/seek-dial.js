/**
 * Property Inspector for Seek Dial Action
 */

let websocket = null;
let uuid = null;
let actionInfo = {};
let settings = {};
let globalSettings = {};

// Local elements
const seekStepInput = document.getElementById('seekStep');
const titleTemplateInput = document.getElementById('titleTemplate');
const timeTemplateInput = document.getElementById('timeTemplate');
const showCoverCheckbox = document.getElementById('showCover');

// Global elements
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

    // Populate local fields
    if (seekStepInput) seekStepInput.value = settings.seekStep || 10;
    if (titleTemplateInput) titleTemplateInput.value = settings.titleTemplate || '{artist} - {title}';
    if (timeTemplateInput) timeTemplateInput.value = settings.timeTemplate || '{current} / {duration}';
    if (showCoverCheckbox) showCoverCheckbox.checked = settings.showCover !== false;
  };

  websocket.onmessage = (evt) => {
    const jsonObj = JSON.parse(evt.data);
    const event = jsonObj.event;
    const payload = jsonObj.payload;

    if (event === 'didReceiveSettings') {
      settings = payload.settings || {};
      if (seekStepInput && settings.seekStep !== undefined) seekStepInput.value = settings.seekStep;
      if (titleTemplateInput && settings.titleTemplate !== undefined) titleTemplateInput.value = settings.titleTemplate;
      if (timeTemplateInput && settings.timeTemplate !== undefined) timeTemplateInput.value = settings.timeTemplate;
      if (showCoverCheckbox && settings.showCover !== undefined) showCoverCheckbox.checked = settings.showCover !== false;
    } else if (event === 'didReceiveGlobalSettings') {
      globalSettings = payload.settings || {};
      populateGlobalSettings(globalSettings);
    }
  };
}

function populateGlobalSettings(gs) {
  if (enableObsCheckbox) {
    enableObsCheckbox.checked = !!gs.enableObsExport;
  }
  if (obsFilePathInput) {
    obsFilePathInput.value = gs.obsFilePath || '';
  }
  if (obsFormatTemplateInput) {
    obsFormatTemplateInput.value = gs.obsFormatTemplate || 'Currently Playing: {artist} - {title}';
  }
  if (obsClearOnPauseCheckbox) {
    obsClearOnPauseCheckbox.checked = gs.obsClearOnPause !== false;
  }
  if (enableDiscordCheckbox) {
    enableDiscordCheckbox.checked = gs.enableDiscordRPC !== false;
  }
  if (discordClientIdInput) {
    discordClientIdInput.value = gs.discordClientId || '';
  }
  if (wsPortInput) {
    wsPortInput.value = gs.wsPort || 39865;
  }
}

function saveSettings() {
  if (!websocket || websocket.readyState !== WebSocket.OPEN) return;

  if (seekStepInput) {
    const stepVal = parseInt(seekStepInput.value, 10) || 10;
    settings.seekStep = stepVal;
  }
  if (titleTemplateInput) settings.titleTemplate = titleTemplateInput.value;
  if (timeTemplateInput) settings.timeTemplate = timeTemplateInput.value;
  if (showCoverCheckbox) settings.showCover = showCoverCheckbox.checked;

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

// Local listeners
if (seekStepInput) {
  seekStepInput.addEventListener('change', saveSettings);
  seekStepInput.addEventListener('input', () => {
    const val = parseInt(seekStepInput.value, 10);
    if (val >= 1 && val <= 60) {
      saveSettings();
    }
  });
}
if (titleTemplateInput) {
  titleTemplateInput.addEventListener('input', saveSettings);
  titleTemplateInput.addEventListener('change', saveSettings);
  titleTemplateInput.addEventListener('blur', saveSettings);
}
if (timeTemplateInput) {
  timeTemplateInput.addEventListener('input', saveSettings);
  timeTemplateInput.addEventListener('change', saveSettings);
  timeTemplateInput.addEventListener('blur', saveSettings);
}
if (showCoverCheckbox) {
  showCoverCheckbox.addEventListener('change', saveSettings);
}

// Global listeners
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
  discordClientIdInput.addEventListener('blur', saveGlobalSettings);
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
