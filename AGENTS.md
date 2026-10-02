# Developer & AI Agent Guidelines (`AGENTS.md`)

Technical directives and non-negotiable operational guardrails for AI coding agents and human contributors on `ytm-web-controller`.

---

## 📚 1. Reference Documentation

Consult the specialized documentation before modifying components:
- **System Architecture & Data Flows:** [`docs/architecture.md`](docs/architecture.md) — End-to-end state flow, context boundaries, backend services, LCD dial layouts, and time interpolation.
- **Build, Packaging & Release Workflows:** [`docs/development.md`](docs/development.md) — Local toolchain, `npm run bump` synchronization table, release tagging, and packaging pipeline (`scripts/package_plugin.ps1`).
- **Elgato Marketplace & Asset Specifications:** [`docs/plugin-guideline.md`](docs/plugin-guideline.md) — UUID format, visual feedback (`showAlert`/`showOk`), Property Inspector UI rules, exact icon DPI dimensions, and asset generation.

---

## 🚨 2. Non-Negotiable Guardrails & Hard Rules

- **Generated & Packed Files:** Never manually edit `release/**`, `plugin/bin/**`, or `plugin/package-lock.json`. Dependencies and lockfiles must strictly be managed natively via `npm`.
- **Zero Polling Overhead:** Never introduce `setInterval()` or polling loops in `extension/content.js`. State extraction is strictly reactive via HTML5 `<video>` events (`play`, `pause`, `seeking`, `seeked`, `durationchange`, `ratechange`, `volumechange`) and scoped `MutationObserver` callbacks.
- **Context Isolation:**
  - **MAIN World (`extension/ytm-*.js`, `extension/content.js`):** Interacts with YouTube Music DOM and Player API (`#movie_player`). Has **zero** access to Chrome Extension runtime APIs (`chrome.*`).
  - **ISOLATED World (`extension/bridge.js`):** Interacts with `chrome.storage` and manifest data. Has **zero** access to YouTube internal DOM or Player APIs.
  - **Bridge Communication:** Communicate across worlds exclusively via bidirectional `window.postMessage`.
- **In-Memory Asset Pipeline:** Keep cover art, thumbnails, and canvas drawings strictly in RAM as Base64 Data URLs. Never write temporary image assets to disk.
- **Hardware Refresh Limit:** Programmatic updates to Stream Deck keys, canvas drawings, and LCD touchstrips must never exceed **10 updates per second (10 Hz)**.
- **Volume Clamping:** YouTube Music volume is strictly an integer between `0` and `100`. Clamp all dial rotation and step calculations to `[0, 100]` before WebSocket dispatch.
- **Central Versioning:** Never manually edit version strings across manifests. Always use `npm run bump <version>` (synchronizes `version.json`, plugin/extension manifests, and package files).
- **Immutable Action UUIDs:** Never alter existing action UUIDs in `manifest.json` after release. Deprecate legacy actions using `"VisibleInActionsList": false`.
- **Strict Typing Discipline:** Prohibited: `as any`, `@ts-ignore`, `@ts-expect-error`. Define or extend interfaces in `plugin/src/types/`.

---

## 💬 3. Code Style & Commenting

- **Intent Over Syntax ("Why over What"):** Explain *why* a particular branch, fallback, or guard exists. Avoid narrating obvious syntax.
- **Document Quirks & Workarounds:** Explicitly document mitigations for YouTube Music DOM mutations, Sandboxing/MAIN-world isolation, and Stream Deck SDK quirks.
- **Visual Section Separators:** Use concise single-line comment anchors above major logical phases.
- **Objective Phrasing:** Single-line comments end without a period. Strictly omit promotional buzzwords or fluff.

---

## 🛑 4. Definition of Done (Task Checklist)

Every pull request or task completion must verify:
1. **Typecheck & Bundle:** `npx --prefix plugin tsc --noEmit -p plugin/tsconfig.json` passes with 0 errors, followed by successful `npm run build`.
2. **Linting:** `npm run lint` completes with 0 errors and 0 warnings.
3. **Elgato CLI Schema:** `npm run validate` passes official Elgato SDK schema validation with 0 errors and 0 warnings.
4. **Clean Production Code:** No orphaned `console.log()` statements left in production code (use dedicated plugin/extension loggers).
5. **Documentation Sync:** Any addition or modification to services, routes, settings, or CLI commands must be reflected in `docs/` and `README.md` within the same turn.

---

## 📦 5. Git & Workflow Discipline

- **Structured Commit Messages:** Commits must follow Conventional Commits with a mandatory body:
  ```text
  <type>(<scope>): <short imperative summary>

  - <bullet point explaining what changed>
  - <bullet point explaining why the change was made>
  ```
- **Conditional Builds:** Run packaging and validation (`npm run package` / `npm run validate`) only when code, assets, UI, or manifests are modified. Skip build/validation for documentation-only changes.
- **Documentation Priority Hierarchy:**
  1. [`docs/architecture.md`](docs/architecture.md) (Highest Priority): Backend services, WebSocket/HTTP routes, sequence diagrams.
  2. [`docs/obs-setup.md`](docs/obs-setup.md), [`docs/features.md`](docs/features.md), [`docs/configuration.md`](docs/configuration.md): Action tables, chatbot routes, and user settings.
  3. [`docs/development.md`](docs/development.md), [`docs/ai-disclosure.md`](docs/ai-disclosure.md): Workflows, build commands, and AI transparency.
  4. [`docs/plugin-guideline.md`](docs/plugin-guideline.md): Elgato marketplace compliance reference.
- **Browser Security & Standby:** Minimize permissions in `extension/manifest.json`. Reconnection attempts in `content.js` are bounded (max 3); enter 100% passive standby on disconnect and wake exclusively on user playback events.
