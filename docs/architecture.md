# System Architecture & Technical Specifications (`docs/architecture.md`)

This document provides an in-depth technical overview of the **YouTube Music Web Controller** monorepo architecture, design principles, and component interactions.

---

## 🏛️ 1. High-Level System Overview

The project bridges the official [YouTube Music Web App](https://music.youtube.com) and the [Elgato Stream Deck](https://www.elgato.com/stream-deck) hardware using an event-driven, local WebSocket connection.

```mermaid
graph LR
    subgraph Browser ["🌐 Browser Companion Extension (extension/)"]
        YTM["YouTube Music Web Player\n(music.youtube.com)"]
        CS["Content Script\n(content.js)"]
        POP["Popup UI & Health Check\n(popup.html / popup.js)"]
        YTM -- "HTML5 <video> Events\n& DOM Mutations" --> CS
        POP -. "Health Check / Config" .-> CS
    end

    subgraph Plugin ["🎛️ Stream Deck Plugin (Node.js SDK 2)"]
        WSS["WebSocket Server\n(plugin/src/services/websocket-server.ts)"]
        SM["State Manager\n(plugin/src/services/state-manager.ts)"]
        MS["Marquee Service\n(plugin/src/services/marquee-service.ts)"]
        IR["Image Renderer\n(plugin/src/services/image-renderer.ts)"]
        DRPC["Discord RPC Service\n(plugin/src/services/discord-rpc.ts)"]
        OBS["OBS Exporter\n(plugin/src/services/obs-exporter.ts)"]
        
        CS -- "JSON State / Commands\nws://127.0.0.1:39865" --> WSS
        WSS --> SM
        SM --> MS
        SM --> IR
        SM --> DRPC
        SM --> OBS
    end

    subgraph Hardware ["🎮 Hardware & External Apps"]
        SD["Stream Deck Keypad / + Dials"]
        DISC["Discord Client\n(Rich Presence)"]
        OBSS["OBS Studio\n(Text GDI+ Overlay)"]
        
        SM --> SD
        MS --> SD
        IR --> SD
        DRPC --> DISC
        OBS --> OBSS
    end
```

---

## 🧩 2. Core Architectural Principles

1. **Zero-Polling (`setInterval == 0`)**:
   - The browser extension never polls the DOM on a periodic interval.
   - All state extractions are reactive, triggered strictly by native HTML5 `<video>` events (`play`, `pause`, `timeupdate`, `seeking`, `seeked`, `ratechange`, `volumechange`) and scoped `MutationObserver` callbacks on music metadata nodes.
   - When music is stopped or paused, CPU and network overhead drop to zero.

2. **Zero Disk Footprint**:
   - Dynamic LCD touchstrip layouts, animated dials, and album cover thumbnails are computed entirely in memory (RAM) and encoded as Base64 Data URLs.
   - No temporary image files are ever written to disk.

3. **Single Responsibility Principle (SRP) & Decoupling**:
   - Every system responsibility is encapsulated in an isolated service or component.
   - Action classes do not directly interact with raw sockets or third-party SDKs; they consume backend services via clean Singleton interfaces.

---

## 🏗️ 3. Complete Monorepo Structure

```
ytm-web-controller/
├── package.json                 # Monorepo root package configuration & npm scripts
├── package_plugin.ps1           # Packaging, asset generation & Stream Deck deployment script
├── AGENTS.md                    # Persistent Developer & AI Agent Guidelines
├── LICENSE                      # MIT License
├── README.md                    # User guide, installation walkthrough & setup documentation
├── docs/                        # Technical specifications & developer documentation
│   ├── architecture.md          # Complete system architecture specification & diagrams
│   └── plugin-guideline.md      # Elgato Marketplace compliance guidelines
├── screenshots/                 # Preview assets & documentation screenshots
│   ├── Banner.png               # GitHub repository hero banner
│   ├── StreamDeck.png           # Stream Deck action configuration preview
│   ├── Discord-Desktop-RPC.png  # Discord Desktop Rich Presence preview
│   └── Discord-Mobile-RPC.png   # Discord Mobile App Rich Presence preview
├── extension/                   # Manifest V3 Browser Companion Extension
│   ├── manifest.json            # MV3 Manifest with Chromium & Firefox Gecko compatibility
│   ├── content.js               # Reactive DOM observer & WebSocket client
│   ├── popup.html               # Extension status & port configuration UI
│   ├── popup.css                # Extension popup dark theme stylesheet
│   ├── popup.js                 # Port storage & live connection diagnostic tester
│   └── icons/                   # Extension toolbar icons (16, 48, 128 px)
└── plugin/                      # Stream Deck Plugin (Node.js SDK 2)
    ├── manifest.json            # Stream Deck Plugin Manifest (com.smok3y97.ytmusicweb)
    ├── package.json             # Plugin dependencies & rollup build scripts
    ├── rollup.config.mjs        # Rollup bundler configuration
    ├── tsconfig.json            # TypeScript compiler configuration
    ├── assets/                  # High-resolution vector & raster assets
    │   ├── category-icon.svg    # Monochromatic category icon (28x28 / 56x56)
    │   ├── plugin-icon.png      # Official Full-Color YouTube Music badge (256x256)
    │   ├── plugin-icon@2x.png   # High-DPI YouTube Music badge (512x512)
    │   ├── generate_assets.ps1  # Automated asset generator script
    │   └── actions/             # SVG action icons (playpause, dial, volumedial, etc.)
    ├── layouts/                 # Stream Deck + Dial LCD JSON layouts
    │   └── dial_layout.json     # Single-source-of-truth 4-item LCD strip layout
    ├── ui/                      # Modular Property Inspector (PI) Frontend
    │   ├── streamdeck-client.js # Low-level Stream Deck WebSocket SDK bridge
    │   ├── global-settings.js   # Global settings UI component (Discord / Streamer)
    │   ├── common.html          # Standard inspector for stateless/trigger keys
    │   ├── dial.html / dial.js  # Track Controller Dial inspector
    │   ├── volume-dial.html/.js # Volume Controller Dial inspector
    │   ├── seek-dial.html/.js   # Seek Controller Dial inspector
    │   ├── playpause.html/.js   # Play/Pause inspector (Album cover toggle)
    │   ├── volume.html/.js      # Volume Up & Down keys inspector
    │   └── css/sdpi.css         # Stream Deck Property Inspector stylesheet
    └── src/                     # Backend Source Code (TypeScript)
        ├── index.ts             # Plugin entry point & action registration
        ├── types/               # TypeScript interfaces & event payloads
        ├── services/            # Decoupled backend services layer
        │   ├── websocket-server.ts  # Local WebSocket server (port 39865)
        │   ├── state-manager.ts     # Centralized playback state store
        │   ├── marquee-service.ts   # Centralized Ping-Pong marquee scroller
        │   ├── image-renderer.ts    # In-memory RAM base64 canvas renderer
        │   ├── discord-rpc.ts       # Isolated Discord Rich Presence client
        │   ├── obs-exporter.ts      # Live .txt track info exporter for OBS
        │   └── clipboard.ts         # Native clipboard bridge for song URL copying
        └── actions/             # Independent Action Controllers
            ├── base-state-action.ts  # Base class for stateful keypad buttons
            ├── base-volume-action.ts # Base class for volume keypad buttons
            ├── play-pause.ts    # Play / Pause dual-state key handler
            ├── dial.ts          # Track Controller (Dial & LCD)
            ├── volume-dial.ts   # Volume Controller (Dial & LCD)
            ├── seek-dial.ts     # Seek Controller (Dial & LCD)
            ├── volume-up.ts     # Volume Up key
            ├── volume-down.ts   # Volume Down key
            ├── mute.ts          # Mute / Unmute toggle key
            ├── next.ts          # Next Track key
            ├── prev.ts          # Previous Track key
            ├── like.ts          # Like Track key
            ├── dislike.ts       # Dislike Track key
            ├── shuffle.ts       # Shuffle toggle key
            ├── repeat.ts        # Repeat mode cycle key
            └── copyurl.ts       # Copy Song URL key
```

---

## 🌐 4. Browser Companion Extension Layer (`extension/`)

The browser companion extension runs in the context of `https://music.youtube.com/*` and acts as the bridge between YouTube Music's web player DOM and the local Stream Deck WebSocket server.

### 📄 Component Breakdown:

1. **Manifest Configuration ([`extension/manifest.json`](../extension/manifest.json))**:
   - Built on **Manifest V3**.
   - Fully compatible with **Chromium** (Chrome, Edge, Brave, Opera, Vivaldi) and **Gecko** (Mozilla Firefox via `browser_specific_settings`).
   - Requests minimal permissions: `"storage"` (persisting custom WebSocket port) and host permission `"https://music.youtube.com/*"`.

2. **Content Script Engine ([`extension/content.js`](../extension/content.js))**:
   - Injected into `music.youtube.com` with `world: "MAIN"` execution to access media elements directly.
   - **HTML5 `<video>` Event Subscriptions**: Binds to `play`, `pause`, `timeupdate`, `seeking`, `seeked`, `ratechange`, `volumechange`, and `ended`.
   - **Targeted MutationObserver**: Listens specifically to `#layout`, `.middle-controls`, `ytmusic-player-bar`, and rating buttons without expensive full-document scans.
   - **Playback State Extraction**: Extracts `playbackState`, `title`, `artist`, `album`, `currentTime`, `duration`, `likeStatus`, `repeatMode`, `shuffleState`, `trackUrl`, and highest-resolution `albumArt`.
   - **Command Dispatcher**: Executes incoming remote commands from Stream Deck:
     - `play`, `pause`, `playPause`
     - `next`, `previous`
     - `setVolume(0-100)`, `volumeUp(step)`, `volumeDown(step)`, `toggleMute`
     - `seek(seconds)`, `seekTo(seconds)`
     - `toggleLike`, `toggleDislike`
     - `toggleShuffle`, `cycleRepeat`
   - **Resilient WebSocket Lifecycle**: Connects to `ws://127.0.0.1:${port}` with automated exponential backoff and reconnection if the Stream Deck plugin restarts.

3. **Extension Popup & Health Monitor ([`extension/popup.html`](../extension/popup.html), [`popup.js`](../extension/popup.js), [`popup.css`](../extension/popup.css))**:
   - Provides instant visual connection diagnostics (🟢 **Connected** / 🔴 **Disconnected**).
   - Allows users to change and persist custom WebSocket ports via `chrome.storage.local`.
   - Displays real-time track preview (Cover art, title, artist, playback progress) directly in the browser toolbar popup.

---

## 🔌 5. Backend Services Layer (`plugin/src/services/`)

| Service | File | Responsibility |
| :--- | :--- | :--- |
| **WebSocket Server** | [`websocket-server.ts`](../plugin/src/services/websocket-server.ts) | Hosts local `ws.Server` (port `39865`), handles connection lifecycles, and dispatches JSON commands. |
| **State Manager** | [`state-manager.ts`](../plugin/src/services/state-manager.ts) | Centralized, single-source-of-truth playback store emitting `stateChanged` events. |
| **Marquee Service** | [`marquee-service.ts`](../plugin/src/services/marquee-service.ts) | Centralized Ping-Pong (bounce) scroller with character-width estimation for Stream Deck + LCDs. |
| **Image Renderer** | [`image-renderer.ts`](../plugin/src/services/image-renderer.ts) | In-memory RAM base64 cover/canvas rendering without disk I/O. |
| **Discord RPC** | [`discord-rpc.ts`](../plugin/src/services/discord-rpc.ts) | Isolated Discord Rich Presence client with automatic backoff and reconnection. |
| **OBS Exporter** | [`obs-exporter.ts`](../plugin/src/services/obs-exporter.ts) | Isolated text file exporter for streamers (`.txt` overlay files). |
| **Clipboard** | [`clipboard.ts`](../plugin/src/services/clipboard.ts) | Cross-platform clipboard bridge for song URL sharing. |

---

## 🕹️ 6. Action Controllers Layer (`plugin/src/actions/`)

Each Stream Deck key and dial is an independent controller registered with the `@elgato/streamdeck` SDK:

* **Base Controllers**:
  * [`base-state-action.ts`](../plugin/src/actions/base-state-action.ts): Common base class handling connection indicators, dynamic SVG state switching, and StateManager lifecycle.
  * [`base-volume-action.ts`](../plugin/src/actions/base-volume-action.ts): Common base class for volume keys handling percentage formatting and Title Styler integration.
* **Keypad Actions**:
  * [`play-pause.ts`](../plugin/src/actions/play-pause.ts): Dual-state key with live album art canvas background rendering.
  * [`volume-up.ts`](../plugin/src/actions/volume-up.ts) & [`volume-down.ts`](../plugin/src/actions/volume-down.ts): Step-based volume adjustment with live `{volume}%` text.
  * [`mute.ts`](../plugin/src/actions/mute.ts), [`next.ts`](../plugin/src/actions/next.ts), [`prev.ts`](../plugin/src/actions/prev.ts), [`like.ts`](../plugin/src/actions/like.ts), [`dislike.ts`](../plugin/src/actions/dislike.ts), [`shuffle.ts`](../plugin/src/actions/shuffle.ts), [`repeat.ts`](../plugin/src/actions/repeat.ts), [`copyurl.ts`](../plugin/src/actions/copyurl.ts).
* **Stream Deck + Rotary Dials & LCD Touchstrips**:
  * [`dial.ts`](../plugin/src/actions/dial.ts) (Track Controller): Rotary track skipping, tap play/pause, animated LCD layout with marquee title scroller and progress bar.
  * [`volume-dial.ts`](../plugin/src/actions/volume-dial.ts) (Volume Controller): Rotary volume control, tap mute/unmute, live percentage and volume bar LCD feedback.
  * [`seek-dial.ts`](../plugin/src/actions/seek-dial.ts) (Seek Controller): Rotary scrub controller, tap play/pause, live time and progress LCD indicator.

---

## 🎨 7. Property Inspector (PI) Modular Architecture (`plugin/ui/`)

The Property Inspector frontend uses a component-based modular structure:

```
┌──────────────────────────────────────────────────────────┐
│  Property Inspector View (e.g. dial.html / volume.html)  │
├──────────────────────────────────────────────────────────┤
│  1. Action-Specific Controls (Local Inputs)              │
│     - Handled by action script (e.g. dial.js)            │
│     - Uses StreamDeckClient.onLocalSettings() / save()   │
├──────────────────────────────────────────────────────────┤
│  2. Global Plugin Settings (<div id="global-settings">)  │
│     - Injected dynamically by global-settings.js         │
│     - Discord Rich Presence (RPC) Toggle                 │
│     - Streamer Settings (OBS Export Accordion)           │
│     - Advanced / Connection Settings Accordion           │
├──────────────────────────────────────────────────────────┤
│  3. StreamDeckClient Bridge (streamdeck-client.js)       │
│     - Low-level WebSocket client to Stream Deck software │
│     - Auto-save dispatch (setSettings/setGlobalSettings) │
└──────────────────────────────────────────────────────────┘
```

* **No Redundancy**: Modifying or expanding Global Settings is done in **one single file** ([`global-settings.js`](../plugin/ui/global-settings.js)) and immediately takes effect across all 14 actions and dials.
* **Auto-Save**: Complies with Elgato guidelines; all changes persist on input change without manual save buttons.

---

## ⚡ 8. Stream Deck + Rotary Encoder & LCD Handling

* **Push-Jitter Suppression**: Ignores accidental rotary clicks within 250ms of a physical dial push.
* **Rotary Debounce Batching**: Batches rapid encoder turns over an 85ms window for smooth volume and scrubbing controls.
* **Ping-Pong Marquee**: Replaces jarring infinite conveyer loops with smooth back-and-forth bounce scrolling (~3.1 Hz) with 2.9s start and 2.5s end reading pauses.
* **10 Hz Rate Limit**: Prevents programmatic feedback flooding to protect hardware performance.
