# Developer & AI Agent Guidelines (`AGENTS.md`)

This document serves as the persistent technical guideline and architectural reference for AI coding agents (such as Google Antigravity / Gemini) and human contributors working on the `ytm-web-controller` codebase.

---

## 🏛️ 1. Architecture & Component Interaction

For detailed architectural diagrams, service descriptions, and data flows, refer to [`docs/architecture.md`](docs/architecture.md).

The project consists of two core components working together over a local WebSocket connection:

```
┌───────────────────────────────┐               ┌─────────────────────────────────┐
│     Browser Extension         │   WebSocket   │       Stream Deck Plugin        │
│  (Manifest V3 Content Script) │ ────────────► │      (Node.js SDK 3 Server)     │
│                               │  ws://127...  │                                 │
│  - Listens to <video> events  │  Port 39865   │  - Manages Keypad & Dial states │
│  - MutationObserver for DOM   │               │  - Discord RPC Broadcaster      │
│  - Zero polling overhead      │               │  - OBS Text Exporter (.txt)     │
│  - Auto-reconnect & Handshake │               │  - In-Memory Canvas & Art Buffer│
└───────────────────────────────┘               └─────────────────────────────────┘
```

### 📁 Repository Layout
- `extension/`: Chrome/Brave/Edge extension (Manifest V3, Content Script executing in `MAIN` world).
- `plugin/`: Stream Deck Node.js Plugin (SDK v3, TypeScript, Rollup bundle).
- `scripts/`: Automation and build scripts (asset generation, packaging, and validation helpers).
- `docs/`: Architecture specifications, OBS guides, feature documentation, and Elgato guidelines.
- `release/`: Generated distribution packages (`.streamDeckPlugin` and `extension.zip`).

### 🔄 End-to-End State Flow
```text
1. Event Trigger:
   YouTube Music Web DOM (<video> status events & MutationObserver for toggles)
2. Extension Extraction:
   ytm-media-session.js (Metadata) + ytm-player-api.js (Timing) ──► ytm-state.js
3. Transport:
   content.js ──► Local WebSocket (ws://127.0.0.1:39865)
4. Plugin Backend:
   websocket-server.ts (Tab arbitration) ──► state-manager.ts (State cache & time interpolation)
5. Distribution Layer:
   ├── Action Controllers (Hardware keys & dials via image-renderer.ts / marquee-service.ts)
   ├── discord-rpc.ts (Desktop Rich Presence)
   ├── obs-exporter.ts (Live .txt file output)
   └── http-api.ts (/overlay OBS widget & /api/current chatbot endpoint)
```

### 🌐 Extension Context Boundaries
- **MAIN World (`extension/ytm-*.js`, `extension/content.js`):** Interacts directly with YouTube Music DOM, Polymer UI components, and the `#movie_player` API. It has **zero direct access** to Chrome Extension runtime APIs (`chrome.storage`, `chrome.runtime`).
- **ISOLATED World (`extension/bridge.js`):** Bridges manifest metadata and stored port configurations. It communicates with the MAIN world exclusively via bidirectional `window.postMessage`.
- **Strict Rule:** Never attempt to call `chrome.*` APIs inside MAIN world scripts, and never query YouTube player internals directly inside `bridge.js`.

---

## 🚨 2. Critical Rules & Edge Cases

- **Never edit generated/packed files:** Never manually edit `release/**`, `plugin/bin/**`, or `plugin/package-lock.json`. Dependencies and lockfiles must strictly be managed natively via `npm`.
- **Zero Polling Overhead:** Never introduce `setInterval()` or polling loops in `extension/content.js`. Playback updates are strictly event-driven via `<video>` events (`play`, `pause`, `timeupdate`, `seeking`, `seeked`) and targeted DOM `MutationObserver` callbacks.
- **In-Memory Assets Only:** Never write temporary cover art or thumbnails to the file system. All image transformations, canvas compositions, and artwork buffering must remain in RAM as Base64 data URLs.
- **10 Hz Hardware Limit:** Programmatic updates to Stream Deck keys, canvas graphics, and LCD touchstrips must never exceed 10 updates per second (10 Hz).
- **Central Version Source:** Never manually edit version strings across manifests or package files. Always use the central bump command: `npm run bump <version>`.
- **Immutable Action UUIDs:** Never modify existing action UUIDs in `manifest.json` after release (use `"VisibleInActionsList": false` to deprecate actions).
- **Volume Clamping (0–100):** YouTube Music treats volume strictly as an integer between `0` and `100`. When mapping Stream Deck dial rotations (+/- 2% or 5%), always clamp the calculated value to `[0, 100]` before dispatching.
- **Client-Side Time Interpolation:** Do not expect real-time WebSocket ticks for playback position during playback. Progress timelines must be interpolated client-side (`StateManager.getInterpolatedCurrentTime()`) using snapshot timestamps.
- **String Sanitization:** Track titles and artists often contain unescaped HTML entities (e.g. `&amp;`) or emojis. Always sanitize text before passing it to canvas SVG templates or OBS `.txt` exports.
- **Strict Typing Discipline:** Avoid `as any`, `@ts-ignore`, and `@ts-expect-error`. If payload or SDK event types are missing, define or extend explicit TypeScript interfaces in `plugin/src/types/` instead of bypassing the type checker.

---

## 🧩 3. Modular Architecture & Single Responsibility Principle (SRP)

The codebase strictly follows a decoupled, modular architecture adhering to the Single Responsibility Principle:

- **Backend Services Layer (`plugin/src/services/`)**: Centralized, isolated services (`websocket-server.ts`, `state-manager.ts`, `marquee-service.ts`, `image-renderer.ts`, `warning-icons.ts`, `version-control.ts`, `discord-rpc.ts`, `obs-exporter.ts`, `clipboard.ts`) consumed exclusively via Singleton patterns.
- **Action Controllers Layer (`plugin/src/actions/`)**: Independent action handlers inheriting from shared base classes (`base-state-action.ts`, `base-volume-action.ts`, `base-dial-action.ts`).
- **Property Inspector Frontend Layer (`plugin/ui/`)**: Strict separation between the low-level SDK WebSocket bridge ([`streamdeck-client.js`](plugin/ui/streamdeck-client.js)), the modular global settings component ([`global-settings.js`](plugin/ui/global-settings.js)), and action-specific scripts.
- **Full Architecture & Component Reference**: Detailed diagrams, data flows, and full directory trees are maintained in [`docs/architecture.md`](docs/architecture.md).

---

## 🏷️ 4. Versioning Specification & Centralized Synchronization

The project strictly follows the **4-digit Elgato Stream Deck Manifest Specification**:

$$\mathbf{\{Major\}.\{Minor\}.\{Patch\}.\{Build\}}$$

### 🚀 Centralized Single Command Versioning:
Versions are managed centrally via [`version.json`](version.json) and automated with:
```bash
npm run bump <version>
# Example:
npm run bump 1.5.0.0
```

Running `npm run bump` automatically updates and synchronizes all required files:
| File | Property | Format Example | Requirement |
| :--- | :--- | :--- | :--- |
| [`version.json`](version.json) | `"version"` | `"1.5.0.0"` | **Single Source of Truth** for the entire monorepo. |
| [`plugin/manifest.json`](plugin/manifest.json) | `"Version"` | `"1.5.0.0"` | **Must be 4 numeric parts** matching regex `^(0\|[1-9]\d*)(\.(0\|[1-9]\d*)){3}$`. Required by Elgato CLI validation. |
| [`extension/manifest.json`](extension/manifest.json) | `"version"`<br>`"version_name"` | `"1.5.0.0"`<br>`"1.5.0"` | `version` must be 4-digit for automated update comparisons; `version_name` defines user-facing display. |
| [`plugin/package.json`](plugin/package.json) | `"version"` | `"1.5.0.0"` | Synchronized with plugin manifest version. |
| [`plugin/package-lock.json`](plugin/package-lock.json) | `"version"` | `"1.5.0.0"` | Synchronized natively via `npm install --package-lock-only` (never edited manually). |
| [`package.json`](package.json) | `"version"` | `"1.5.0.0"` | Synchronized monorepo root package version. |
| `plugin/src/services/version-control.ts` | Dynamic Import | — | Dynamically imports `manifest.json` at build time; requires **zero** manual editing. |
| [`extension/popup.html`](extension/popup.html) & [`extension/popup.js`](extension/popup.js) | Version string | `v1.5.0` | Dynamically reads `manifest.version_name || manifest.version`. |

### Segment Semantics:
* **Major** (`{Major}`): Fundamental architectural overhauls, breaking changes, or SDK major upgrades.
* **Minor** (`{Minor}`): Substantial new user features or hardware integrations (e.g., dial support, new background services, or protocol handshakes).
* **Patch** (`{Patch}`): Bug fixes, icon styling adjustments, code refactoring, and metadata/URL fixes.
* **Build** (`{Build}`): Internal marketplace submission counter. Allows resubmissions without changing the public release version.

> [!NOTE]
> Version numbers appearing in code snippets, tables, or guides within [`docs/development.md`](docs/development.md) serve strictly as **illustrative examples** and do **not** need to be edited or bumped with each release. The live version is defined solely by [`version.json`](version.json) and synchronized across the 5 manifest/package files.

### 🏷️ Creating and Triggering a GitHub Release
To trigger the automated GitHub Actions release pipeline (`release.yml`), the version tag must be created and pushed along with the bump commit:

```bash
# 1. Bump version across all 5 manifests / package files
npm run bump <version>  # e.g., npm run bump 1.5.0.0

# 2. Stage and commit the synchronized files
git add version.json package.json plugin/manifest.json plugin/package.json plugin/package-lock.json extension/manifest.json
git commit -m "chore(release): bump version to <version>" -m "- Synchronized all manifests to <version> via npm run bump"

# 3. Create the version tag matching the v{Major}.{Minor}.{Patch}.{Build} pattern
git tag v<version>  # e.g., git tag v1.5.0.0

# 4. Push commit and tag to GitHub to trigger the release workflow
git push origin main
git push origin v<version>
```
*Note: The `.github/workflows/release.yml` pipeline strictly listens to tags matching `v*.*.*.*`. Pushing only the commit will trigger the CI test pipeline, but will NOT create a GitHub Release.*

---

## 🎨 5. Iconography & Asset Guidelines

Refer to [`docs/plugin-guideline.md`](docs/plugin-guideline.md) (and the official [Elgato Stream Deck Plugin Guidelines](https://docs.elgato.com/guidelines/stream-deck/plugins/)) for full asset specifications and marketplace requirements. Stream Deck UI has distinct requirements for different asset types:

1. **Main Plugin Icon (`Icon`)**:
   - Location: `plugin/assets/plugin-icon.png` (256×256 px) and `plugin/assets/plugin-icon@2x.png` (512×512 px).
   - Format: **PNG** (Strict requirement by Stream Deck preferences detail pane).
   - Design: **Brand-Compliant Circular Badge** (Transparent background with `#FF0033` red circular disc and crisp white stylized audio-controller headphones + play glyph).

2. **Category & Sidebar Icon (`CategoryIcon`)**:
   - Location: `plugin/assets/category-icon.svg` (and referenced as `"CategoryIcon": "assets/category-icon"` in `manifest.json`).
   - Dimensions: 28×28 px (Standard DPI) / 56×56 px (`@2x` High DPI).
   - Format: **SVG** (Vector) or PNG.
   - Design: **Monochromatic White (`#FFFFFF`)** glyph on transparent background (stylized minimalist headphones with embedded play triangle). No solid background fill.

3. **Action Key & Dial Icons (`Actions[].Icon` & `Actions[].States[].Image`)**:
   - Location: `plugin/assets/actions/<action-name>/...`
   - Dimensions: Action List Icons: 20×20 px (40×40 px `@2x`). Key State Icons: 72×72 px (144×144 px `@2x`).
   - Format: **SVG** (Vector).
   - Design: **Default White (`#FFFFFF`)** on transparent background for consistency across Stream Deck dark UI. Active highlight states (e.g. Liked, Disliked, Repeat-All) use active colors (`#FF0033`).

4. **Stream Deck + LCD Layouts & Touch Targets**:
   - Strip Dimensions: `200 × 100 px` per dial slot.
   - Interactive touch targets must be at least **`35 × 35 px`**. All elements must stay strictly within bounds.

5. **Asset Generation**:
   - Run `npm run assets` (or `powershell -ExecutionPolicy Bypass -File scripts/generate_assets.ps1`) to re-generate all SVG and PNG assets.

---

## 📋 6. Elgato Marketplace & Plugin Guidelines Compliance

The plugin strictly adheres to [`docs/plugin-guideline.md`](docs/plugin-guideline.md):

1. **Identifiers & UUIDs**:
   - Root UUID: `com.smok3y97.ytmusicweb` (Reverse DNS).
   - Action UUID Prefix: Every action UUID **must** start with `com.smok3y97.ytmusicweb.<action>`.
   - Immutability: **Never** alter existing action UUIDs after release.

2. **Naming & Action Limits**:
   - Plugin Name: Concise (<= 30 chars), descriptive, no author prefix in name.
   - Action Count: Keep between 2 and 30 actions.

3. **Visual Feedback (`showAlert` / `showOk`)**:
   - `showAlert`: Trigger on errors or unreachable WebSocket endpoints.
   - `showOk`: Trigger **only** when there is no other visual indicator of success (e.g. clipboard copy, file written). Never call `showOk` if the key icon or state updates dynamically.

4. **Property Inspector (PI) UI Rules**:
   - **Auto-Save**: Settings must save automatically on input change (`setSettings` / `setGlobalSettings`). **Never include a manual "Save" button.**
   - **No Visual Flickering**: Hide UI components by default and reveal them on DOM ready.
   - **Prohibited**: Do NOT include donation buttons, sponsor links, or raw copyright text in the Property Inspector.

---

## 💬 7. Code Commenting Guidelines for AI Agents

- **Explain Intent, Not Syntax ("Why over What"):** Comments must explain *why* a particular piece of logic, guard clause, or branch exists rather than narrating what the syntax does. Avoid trivial comments (e.g. do not put `// Set volume` directly above `setVolume()`).
- **Document Workarounds & Quirks:** Any fallback logic addressing YouTube Music DOM mutations, Sandboxing/MAIN world isolation, or Stream Deck SDK specifics must explicitly state the problem or bug being mitigated.
- **Visual Section Separators:** For complex methods or multibranch logic, use a short, concise one-line comment above major logical steps as a visual anchor.
- **No Trailing Periods:** Single-line comments should end without a period (concise imperative style).
- **No Marketing Fluff:** Avoid hyperbolic buzzwords ("blazing", "ultra-optimized", "bulletproof") in code comments and docstrings; keep language strictly technical and objective.

---

## 🚀 8. Build, Packaging & Validation Workflow

### Commands:
```bash
# 0. Fast TypeScript validation (type check only without building bundles)
npx --prefix plugin tsc --noEmit -p plugin/tsconfig.json

# 1. Compile TypeScript / Rollup bundle
npm run build

# 2. Package release archive & update local Stream Deck plugins
npm run package
# or directly:
powershell -ExecutionPolicy Bypass -File .\scripts\package_plugin.ps1

# 3. Validate packaged plugin against official Elgato SDK Schema
npm run validate
# or directly:
npx streamdeck validate release/com.smok3y97.ytmusicweb.sdPlugin

# 4. Hot-restart plugin in Stream Deck app without restarting Stream Deck
npm run restart
# or directly:
npx streamdeck restart com.smok3y97.ytmusicweb
```

### Packaging Script (`scripts/package_plugin.ps1`):
The packaging script automates:
1. Running Prettier formatting and ESLint checks (`npm run lint:fix`).
2. Building plugin JS bundle with Rollup (`npm run build`).
3. Invoking `scripts/generate_assets.ps1` to ensure all vector and raster assets are up to date.
4. Staging and packaging `release/com.smok3y97.ytmusicweb.streamDeckPlugin` via `streamdeck pack`.
5. Packaging `release/extension.zip` for browser deployment.
6. Deploying the staged `.sdPlugin` directly to `%APPDATA%\Elgato\StreamDeck\Plugins\com.smok3y97.ytmusicweb.sdPlugin`.
7. Hot-restarting the live plugin process in Stream Deck via `streamdeck restart` for instant live testing.

### CI/CD & Automated GitHub Releases:
- **CI Pipeline (`.github/workflows/ci.yml`)**: Automatically triggered on pushes and PRs (`main`/`master`) on `ubuntu-latest`. Validates types (`tsc`), linting (`eslint`), builds the plugin bundle, validates via `streamdeck validate`, and uploads test build artifacts (`.streamDeckPlugin` and `extension.zip`).
- **Release Pipeline (`.github/workflows/release.yml`)**: Triggered upon pushing a version tag (e.g. `v1.12.0.0` following `npm run bump <version>`) on `ubuntu-latest`. Packages, validates, and automatically publishes the official GitHub Release with attached `.streamDeckPlugin` and `extension.zip` binaries.
- **Dependency Automation (`.github/dependabot.yml`)**: Scans weekly for dependency and GitHub Actions security/version updates.

### 🛑 Definition of Done (Task Checklist)
Before completing any task, verify the following checklist:
1. `npx --prefix plugin tsc --noEmit -p plugin/tsconfig.json` passes with 0 type errors, followed by `npm run build` for the final bundle.
2. `npm run lint` (or Prettier/ESLint) completes with 0 errors and 0 warnings.
3. `npm run validate` confirms official Elgato SDK schema compliance with 0 errors and 0 warnings.
4. No orphaned `console.log()` debug statements left in production code (only use the dedicated plugin/extension logger).
5. Any additions or modifications to services, routes, or settings are synchronized in the relevant markdown files in `docs/` and `README.md` within the same change.

---

## ⚠️ 9. Critical Operational Guidelines for AI Agents

### 📚 Documentation Maintenance Hierarchy
Always synchronize documentation within the same turn whenever code, features, routes, or settings change:
- **`docs/architecture.md` (Highest Priority):** Must meticulously reflect any backend service changes, REST/WebSocket routes, Mermaid diagrams, and directory tree updates.
- **User & Streamer Guides (`docs/obs-setup.md`, `docs/features.md`, `docs/configuration.md`):** Keep all action tables, chatbot commands, query parameters, and OBS setup instructions accurate.
- **Developer Guides (`docs/development.md`, `docs/ai-disclosure.md`):** Keep setup instructions, prerequisites, and build commands up to date without stale information.
- **Immutable Upstream Reference:** Do NOT edit `docs/plugin-guideline.md`. It serves as an immutable copy of official Elgato specifications.
- **Edit Style:** Keep documentation edits minimal, precise, and technical. Avoid cosmetic rephrasing, tone drift, or fluff.

### 🛡️ Browser Security & Runtime Isolation
- **Principle of Least Privilege:** Strictly minimize permissions in `extension/manifest.json`. Never request broad permissions (e.g. `"tabs"`, broad host permissions) unless technically unavoidable. Update `PRIVACY.md` whenever data flows or permissions change.
- **Passive Standby Over Infinite Loops:** Reconnection attempts in `extension/content.js` must be strictly bounded (max 3 attempts). The extension must enter a 100% passive standby mode and wake up exclusively on user playback events.
- **UI State Synchronization:** When dispatching volume/mute controls in `extension/ytm-actions.js`, always trigger Polymer UI updates alongside native Player API calls to keep YouTube Music's visual sliders in sync with hardware inputs.

### 📦 Git & Workflow Discipline
- **Conditional Builds:** Run packaging and validation (`npm run package` / `npm run validate`) only when code, assets, UI, or manifests are modified. Do not execute build or validation commands for documentation-only changes.
- **Structured Commit Messages:** Commits must follow Conventional Commits with a mandatory body. Never create single-line or vague commit messages:
  ```text
  <type>(<scope>): <short imperative summary>

  - <bullet point explaining what changed>
  - <bullet point explaining why the change was made>
  ```
