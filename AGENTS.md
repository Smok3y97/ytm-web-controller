# Developer & AI Agent Guidelines (`AGENTS.md`)

This document serves as the persistent technical guideline and architectural reference for AI coding agents (such as Google Antigravity / Gemini) and human contributors working on the `ytm-web-controller` codebase.

---

## 🏛️ 1. Architecture & Component Interaction

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

Stream Deck UI has distinct requirements for different asset types:

1. **Category & Sidebar Icon (`CategoryIcon`)**:
   - Location: `plugin/assets/category-icon.svg` (and referenced as `"CategoryIcon": "assets/category-icon"` in `manifest.json`).
   - Format: **SVG** (Vector) or PNG.
   - Design: **Monochromatic White (`#FFFFFF`)** on a transparent background. Represents YouTube Music concentric rings with play triangle.

2. **Main Plugin Icon (`Icon`)**:
   - Location: `plugin/assets/plugin-icon.png` (256×256) and `plugin/assets/plugin-icon@2x.png` (512×512).
   - Format: **PNG** (Strict requirement by Stream Deck preferences detail pane).
   - Design: **Official Full-Color YouTube Music Badge** (`#FF0033` red circular background with white inner ring and play triangle).

3. **Action Key & Dial Icons (`Actions[].Icon` & `Actions[].States[].Image`)**:
   - Location: `plugin/assets/actions/<action-name>/...`
   - Format: **SVG** (Vector).
   - Design: **Default White (`#FFFFFF`)** on transparent background for consistency across Stream Deck dark UI. Active highlight states (e.g. Liked, Disliked, Repeat-All) use active colors (`#FF0033`).

4. **Asset Generation**:
   - Run `powershell -ExecutionPolicy Bypass -File plugin/assets/generate_assets.ps1` to re-generate all SVG and PNG assets.

---

## 🚀 4. Build, Packaging & Validation Workflow

### Commands:
```bash
# 1. Compile TypeScript / Rollup bundle
npm run build

# 2. Package release archive & update local Stream Deck plugins
npm run package
# or directly:
powershell -ExecutionPolicy Bypass -File .\package_plugin.ps1

# 3. Validate packaged plugin against official Elgato SDK Schema
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

## ⚠️ 5. Critical Guidelines for AI Agents

* **Do Not Introduce Polling**: Always rely on WebSocket event messages from `content.js`. Do not add `setInterval` loops for querying music state.
* **Keep Memory-Only Buffering**: Do not write temporary album artwork to the local file system. Always use Base64 data URLs.
* **Preserve Monorepo Path Structure**:
  - `plugin/`: Stream Deck Node.js plugin.
  - `extension/`: Browser companion extension.
  - `release/`: Generated distribution packages.
* **Always Run Validation**: Before submitting any manifest changes, execute `npx streamdeck validate` on the staged plugin to guarantee `√ Validation successful (0 errors, 0 warnings)`.
