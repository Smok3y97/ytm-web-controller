# Developer & AI Agent Guidelines (`AGENTS.md`)

This document serves as the persistent technical guideline and architectural reference for AI coding agents (such as Google Antigravity / Gemini) and human contributors working on the `ytm-web-controller` codebase.

---

## 🏛️ 1. Architecture & Component Interaction

For detailed architectural diagrams, service descriptions, and data flows, refer to [`docs/architecture.md`](docs/architecture.md).

The project consists of two core components working together over a local WebSocket connection:

```
┌───────────────────────────────┐               ┌─────────────────────────────────┐
│     Browser Extension         │   WebSocket   │       Stream Deck Plugin        │
│  (Manifest V3 Content Script) │ ────────────► │      (Node.js SDK 2 Server)     │
│                               │  ws://127...  │                                 │
│  - Listens to <video> events  │  Port 39865   │  - Manages Keypad & Dial states │
│  - MutationObserver for DOM   │               │  - Discord RPC Broadcaster      │
│  - Zero polling overhead      │               │  - OBS Text Exporter (.txt)     │
│  - In-memory canvas renderer  │               │  - In-Memory Album Art Buffer   │
└───────────────────────────────┘               └─────────────────────────────────┘
```

1. **Browser Extension (`extension/`)**:
   - Injected into `https://music.youtube.com/*` with `MAIN` world execution.
   - Extracts playback states (`playbackState`, `title`, `artist`, `album`, `currentTime`, `duration`, `likeStatus`, `repeatMode`, `shuffleState`, `trackUrl`, `albumArt`).
   - **Zero Polling**: Never uses periodic `setInterval()` to query DOM. State updates are strictly dispatched on HTML5 `<video>` events (`play`, `pause`, `timeupdate`, `seeking`, `seeked`) and targeted DOM `MutationObserver` callbacks.

2. **Stream Deck Plugin (`plugin/`)**:
   - Built on `@elgato/streamdeck` SDK (SDK Version 2, Minimum Stream Deck Software: `6.5+`, Node.js `20`).
   - Hosts a local `ws.Server` (Default port: `39865`).
   - Handles multi-controller setups: standard Keypad actions and Stream Deck + Rotary Encoders (Dials & LCD Touchstrips).
   - **Zero Disk Footprint**: Computes dynamic images, cover thumbnails, and marquee LCD text strictly in memory using Base64 data URLs.

### 🧩 Modular Architecture & Single Responsibility Principle (SRP)
The entire codebase strictly follows a decoupled, modular architecture adhering to the Single Responsibility Principle:

- **Backend Services Layer (`plugin/src/services/`)**: Centralized, isolated services (`websocket-server.ts`, `state-manager.ts`, `marquee-service.ts`, `image-renderer.ts`, `discord-rpc.ts`, `obs-exporter.ts`, `clipboard.ts`) consumed exclusively via Singleton patterns.
- **Action Controllers Layer (`plugin/src/actions/`)**: Independent action handlers inheriting from shared base classes (`base-state-action.ts`, `base-volume-action.ts`).
- **Property Inspector Frontend Layer (`plugin/ui/`)**: Strict separation between the low-level SDK WebSocket bridge ([`streamdeck-client.js`](plugin/ui/streamdeck-client.js)), the modular global settings component ([`global-settings.js`](plugin/ui/global-settings.js)), and action-specific scripts.
- **Full Architecture & Component Reference**: Detailed diagrams, data flows, and full directory trees are maintained in [`docs/architecture.md`](docs/architecture.md).

---

## 🏷️ 2. Versioning Specification & Synchronization

The project strictly follows the **4-digit Elgato Stream Deck Manifest Specification**:

$$\mathbf{\{Major\}.\{Minor\}.\{Patch\}.\{Build\}}$$

### Strict Version Rules:
Whenever bumping versions, **ALL** of the following files MUST be synchronized:

| File | Property | Format Example | Requirement |
| :--- | :--- | :--- | :--- |
| [`plugin/manifest.json`](plugin/manifest.json) | `"Version"` | `"1.3.2.0"` | **Must be 4 numeric parts** matching regex `^(0\|[1-9]\d*)(\.(0\|[1-9]\d*)){3}$`. Required by Elgato CLI validation. |
| [`extension/manifest.json`](extension/manifest.json) | `"version"`<br>`"version_name"` | `"1.3.2.0"`<br>`"1.3.2"` | `version` must be 4-digit for automated update comparisons; `version_name` defines user-facing display. |
| [`plugin/package.json`](plugin/package.json) | `"version"` | `"1.3.2.0"` | Synchronized with plugin manifest version. |
| [`package.json`](package.json) | `"version"` | `"1.3.2.0"` | Synchronized monorepo root package version. |
| [`extension/popup.html`](extension/popup.html) & [`extension/popup.js`](extension/popup.js) | Version string | `v1.3.2` | Dynamically reads `manifest.version_name || manifest.version`. |

### Segment Semantics:
* **Major** (`1`): Fundamental architectural overhauls or SDK major upgrades.
* **Minor** (`3`): Substantial new user features (e.g., Stream Deck + Dial support, Discord RPC, OBS Text Export).
* **Patch** (`2`): Bug fixes, icon styling adjustments, metadata/URL fixes.
* **Build** (`0`): Internal marketplace submission counter. Allows resubmissions without changing the public release version.

---

## 🎨 3. Iconography & Asset Guidelines

Refer to [`docs/plugin-guideline.md`](docs/plugin-guideline.md) (and the official [Elgato Stream Deck Plugin Guidelines](https://docs.elgato.com/guidelines/stream-deck/plugins/)) for full asset specifications and marketplace requirements. Stream Deck UI has distinct requirements for different asset types:

1. **Main Plugin Icon (`Icon`)**:
   - Location: `plugin/assets/plugin-icon.png` (256×256 px) and `plugin/assets/plugin-icon@2x.png` (512×512 px).
   - Format: **PNG** (Strict requirement by Stream Deck preferences detail pane).
   - Design: **Official Full-Color YouTube Music Badge** (`#FF0033` red circular background with white inner ring and play triangle).

2. **Category & Sidebar Icon (`CategoryIcon`)**:
   - Location: `plugin/assets/category-icon.svg` (and referenced as `"CategoryIcon": "assets/category-icon"` in `manifest.json`).
   - Dimensions: 28×28 px (Standard DPI) / 56×56 px (`@2x` High DPI).
   - Format: **SVG** (Vector) or PNG.
   - Design: **Monochromatic White (`#FFFFFF`)** stroke on transparent background. No solid background fill.

3. **Action Key & Dial Icons (`Actions[].Icon` & `Actions[].States[].Image`)**:
   - Location: `plugin/assets/actions/<action-name>/...`
   - Dimensions: Action List Icons: 20×20 px (40×40 px `@2x`). Key State Icons: 72×72 px (144×144 px `@2x`).
   - Format: **SVG** (Vector).
   - Design: **Default White (`#FFFFFF`)** on transparent background for consistency across Stream Deck dark UI. Active highlight states (e.g. Liked, Disliked, Repeat-All) use active colors (`#FF0033`).

4. **Stream Deck + LCD Layouts & Touch Targets**:
   - Strip Dimensions: `200 × 100 px` per dial slot.
   - Interactive touch targets must be at least **`35 × 35 px`**. All elements must stay strictly within bounds.

5. **Asset Generation**:
   - Run `powershell -ExecutionPolicy Bypass -File plugin/assets/generate_assets.ps1` to re-generate all SVG and PNG assets.

---

## 📋 4. Elgato Marketplace & Plugin Guidelines Compliance

The plugin strictly adheres to [`docs/plugin-guideline.md`](docs/plugin-guideline.md):

1. **Identifiers & UUIDs**:
   - Root UUID: `com.smok3y97.ytmusicweb` (Reverse DNS).
   - Action UUID Prefix: Every action UUID **must** start with `com.smok3y97.ytmusicweb.<action>`.
   - Immutability: **Never** alter existing action UUIDs after release. Use `VisibleInActionsList: false` to deprecate actions.

2. **Naming & Action Limits**:
   - Plugin Name: Concise (<= 30 chars), descriptive, no author prefix in name.
   - Action Count: Keep between 2 and 30 actions.

3. **Performance & Programmatic Flooding Limit**:
   - Programmatic key/canvas/LCD rendering calls must **never exceed 10 updates per second (10 Hz)**.

4. **Visual Feedback (`showAlert` / `showOk`)**:
   - `showAlert`: Trigger on errors or unreachable WebSocket endpoints.
   - `showOk`: Trigger **only** when there is no other visual indicator of success (e.g. clipboard copy, file written). Never call `showOk` if the key icon or state updates dynamically.

5. **Property Inspector (PI) UI Rules**:
   - **Auto-Save**: Settings must save automatically on input change (`setSettings` / `setGlobalSettings`). **Never include a manual "Save" button.**
   - **No Visual Flickering**: Hide UI components by default and reveal them on DOM ready.
   - **Prohibited**: Do NOT include donation buttons, sponsor links, or raw copyright text in the Property Inspector.

---

## 🚀 5. Build, Packaging & Validation Workflow

### Commands:
```bash
# 1. Compile TypeScript / Rollup bundle
npm run build

# 2. Package release archive & update local Stream Deck plugins
npm run package
# or directly:
powershell -ExecutionPolicy Bypass -File .\package_plugin.ps1

# 3. Validate packaged plugin against official Elgato SDK Schema
npm run validate
# or directly:
npx streamdeck validate release/com.smok3y97.ytmusicweb.sdPlugin
```

### Packaging Script (`package_plugin.ps1`):
The packaging script automates:
1. Building plugin JS bundle with Rollup.
2. Invoking `generate_assets.ps1` to ensure all vector and raster assets are up to date.
3. Staging and creating `release/com.smok3y97.ytmusicweb.streamDeckPlugin`.
4. Packaging `release/extension.zip` for browser deployment.
5. Deploying the staged `.sdPlugin` directly to `%APPDATA%\Elgato\StreamDeck\Plugins\com.smok3y97.ytmusicweb.sdPlugin` for instant live testing.

---

## ⚠️ 6. Critical Guidelines for AI Agents

* **Maintain Architecture Documentation**: Always keep [`docs/architecture.md`](docs/architecture.md) up-to-date whenever new services, actions, UI components, or architectural workflows are added or modified.
* **Conditional Build & Validation**:
  - Run packaging and validation (`npm run package` / `npm run validate`) **only** when modifying code, assets, UI, or manifests (`plugin/`, `extension/`, `package.json`).
  - Do **not** trigger unnecessary build/package/validation runs when making changes strictly to markdown documentation (`.md` files).
* **Do Not Introduce Polling**: Always rely on WebSocket event messages from `content.js`. Do not add `setInterval` loops for querying music state.
* **Respect the 10 Hz Rendering Rate Limit**: Never flood Stream Deck hardware with canvas or LCD layout updates faster than 10 Hz.
* **Keep Memory-Only Buffering**: Do not write temporary album artwork to the local file system. Always use Base64 data URLs.
* **No Manual Save Buttons in PI**: All Property Inspector settings must auto-save on change.
* **Preserve Monorepo Path Structure**:
  - `plugin/`: Stream Deck Node.js plugin.
  - `extension/`: Browser companion extension.
  - `docs/`: Specifications and marketplace guidelines.
  - `release/`: Generated distribution packages.
* **Always Run Validation on Code Changes**: Before submitting any manifest or code changes, execute `npx streamdeck validate` on the staged plugin to guarantee `√ Validation successful (0 errors, 0 warnings)`.
