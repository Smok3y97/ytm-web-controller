/**
 * YouTube Music Web Controller - Stream Deck Plugin Entry Point
 * 
 * UUID: com.smok3y97.ytmusicweb
 */

import streamDeck from '@elgato/streamdeck';
import { WebSocketService } from './services/websocket-server.js';
import { StateManager } from './services/state-manager.js';
import { DiscordRpcService } from './services/discord-rpc.js';
import { ObsExporterService } from './services/obs-exporter.js';
import { VersionControlService } from './services/version-control.js';
import { HttpApiService } from './services/http-api.js';
import { GlobalSettings, YTMPlaybackState } from './types/index.js';

// Action Handlers
import { PlayPauseAction } from './actions/play-pause.js';
import { TrackDialAction } from './actions/track-dial.js';
import { NextAction } from './actions/next.js';
import { PreviousAction } from './actions/previous.js';
import { LikeAction } from './actions/like.js';
import { DislikeAction } from './actions/dislike.js';
import { ShuffleAction } from './actions/shuffle.js';
import { RepeatAction } from './actions/repeat.js';
import { CopyUrlAction } from './actions/copy-url.js';
import { VolumeUpAction } from './actions/volume-up.js';
import { VolumeDownAction } from './actions/volume-down.js';
import { MuteAction } from './actions/mute.js';
import { VolumeDialAction } from './actions/volume-dial.js';
import { SeekDialAction } from './actions/seek-dial.js';

const wsService = WebSocketService.getInstance();
const stateManager = StateManager.getInstance();
const httpApiService = HttpApiService.getInstance();
const discordService = DiscordRpcService.getInstance();
const obsService = ObsExporterService.getInstance();
const versionService = VersionControlService.getInstance();

// Enable logging
streamDeck.logger.setLevel('info');
streamDeck.logger.info(`[YTM Controller] Initializing plugin (v${versionService.currentPluginVersion})...`);

// 1. Start WebSocket & HTTP server immediately on default/fallback port
wsService.start(39865).catch((err) => {
  streamDeck.logger.error(`[YTM Controller] WebSocket server start error: ${err}`);
});

// 2. Register active Action singletons
streamDeck.actions.registerAction(new PlayPauseAction());
streamDeck.actions.registerAction(new TrackDialAction());
streamDeck.actions.registerAction(new NextAction());
streamDeck.actions.registerAction(new PreviousAction());
streamDeck.actions.registerAction(new LikeAction());
streamDeck.actions.registerAction(new DislikeAction());
streamDeck.actions.registerAction(new ShuffleAction());
streamDeck.actions.registerAction(new RepeatAction());
streamDeck.actions.registerAction(new CopyUrlAction());
streamDeck.actions.registerAction(new VolumeUpAction());
streamDeck.actions.registerAction(new VolumeDownAction());
streamDeck.actions.registerAction(new MuteAction());
streamDeck.actions.registerAction(new VolumeDialAction());
streamDeck.actions.registerAction(new SeekDialAction());

// 3. Connect WebSocket state updates to StateManager
wsService.on('stateUpdate', (state: YTMPlaybackState) => {
  stateManager.updateState(state);
});

// 4. Handle Handshake events & sync version status to StateManager & GlobalSettings
wsService.on('handshake', async ({ isMismatch, version }: { isMismatch: boolean; version: string }) => {
  stateManager.setVersionMismatch(isMismatch, version);
  try {
    const globalSettings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
    await streamDeck.settings.setGlobalSettings<GlobalSettings>({
      ...globalSettings,
      isVersionMismatch: isMismatch,
      extensionVersion: version,
      requiredPluginVersion: versionService.minRequiredExtensionVersion,
      warningMessage: isMismatch ? versionService.getWarningMessage(version) : undefined
    });
  } catch (err) {
    streamDeck.logger.warn(`[YTM Controller] Could not persist handshake state to global settings: ${err}`);
  }
});

// 5. Handle Client Disconnect: Reset active playback state and version mismatch if all clients disconnect
wsService.on('clientDisconnected', async () => {
  if (!wsService.hasConnectedClients()) {
    stateManager.handleClientsDisconnected();
    try {
      const globalSettings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
      if (globalSettings.isVersionMismatch) {
        await streamDeck.settings.setGlobalSettings<GlobalSettings>({
          ...globalSettings,
          isVersionMismatch: false,
          warningMessage: undefined
        });
      }
    } catch { }
  }
});

// 6. Connect StateManager updates to Discord RPC, OBS Exporter & WebSocket Clients
stateManager.on('stateChanged', (state: YTMPlaybackState) => {
  discordService.updatePresence(state);
  obsService.updateExport(state);
  wsService.broadcastState(state);
});

// 7. Handle Property Inspector IPC messages
streamDeck.ui.onSendToPlugin(async (ev) => {
  const payload = ev.payload as { event?: string; url?: string };
  if (payload?.event === 'openUrl' && payload.url) {
    await streamDeck.system.openUrl(payload.url);
  }
});

// 8. Handle global settings changes (WebSocket Port, Discord RPC, OBS Exporter)
streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>(async (ev) => {
  const settings = ev.settings;
  const targetPort = settings.wsPort || 39865;

  if (wsService.getPort() !== targetPort) {
    streamDeck.logger.info(`[YTM Controller] Global port changed to ${targetPort}. Rebinding WebSocket server...`);
    stateManager.resetVersionStatus();
    await wsService.start(targetPort);
  }

  await discordService.setEnabled(!!settings.enableDiscordRPC, settings.discordClientId);
  await obsService.updateSettings(settings);
});

// 9. Connect to Stream Deck Application
streamDeck.connect().then(async () => {
  streamDeck.logger.info('[YTM Controller] Connected to Stream Deck software.');
  try {
    const globalSettings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
    if (globalSettings.wsPort && globalSettings.wsPort !== 39865) {
      await wsService.start(globalSettings.wsPort);
    }
    if (globalSettings.enableDiscordRPC) {
      await discordService.setEnabled(true, globalSettings.discordClientId);
    }
    await obsService.updateSettings(globalSettings);
  } catch (err) {
    streamDeck.logger.warn(`[YTM Controller] Could not fetch global settings: ${err}`);
  }
}).catch((err) => {
  streamDeck.logger.error(`[YTM Controller] Connection to Stream Deck failed: ${err}`);
});
