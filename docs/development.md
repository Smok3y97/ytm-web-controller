<a id="top"></a>

# Development & Contribution Guide (`docs/development.md`)

This document outlines the local development setup, build scripts, testing procedures, packaging workflow, and versioning standards. For community contribution steps and PR guidelines, see [**`CONTRIBUTING.md`**](../CONTRIBUTING.md).

---

## 📑 Table of Contents
- [🛠️ Prerequisites](#-prerequisites)
- [🚀 Build & Packaging Commands](#-build--packaging-commands)
- [✨ Elgato SDK Linting & Code Style Guide](#-elgato-sdk-linting--code-style-guide)
- [📦 Packaging Pipeline (`scripts/package_plugin.ps1`)](#-packaging-pipeline-scriptspackage_pluginps1)
- [🏷️ Versioning Scheme](#-versioning-scheme)

---

## [🛠️ Prerequisites](#top)

- **Node.js**: `v24.0.0` or newer recommended.
- **npm**: `v10.0.0` or newer.
- **Elgato Stream Deck Software**: `v7.1+` (tested on `v7.5+`).
- **PowerShell**: Windows PowerShell or PowerShell 7 (for automated packaging scripts).

---

## [🚀 Build & Packaging Commands](#top)

All commands can be executed directly from the monorepo root:

```bash
# 1. Compile TypeScript and build plugin JS bundle via Rollup
npm run build

# 2. Run TypeScript typechecking & official Elgato ESLint check
npm run lint
# Or auto-fix and format with Prettier:
npm run lint:fix

# 3. Package release archive & automatically deploy to local Stream Deck plugins folder
npm run package
# (or execute directly with PowerShell):
powershell -ExecutionPolicy Bypass -File .\scripts\package_plugin.ps1

# 4. Synchronize versions centrally across all manifests & packages
npm run bump 1.8.0.0

# 5. Validate packaged plugin against official Elgato SDK Schema
npm run validate
# (or directly via npx):
npx streamdeck validate release/com.smok3y97.ytmusicweb.sdPlugin

# 6. Hot-restart plugin process in Stream Deck without restarting the app
npm run restart
# (or directly via npx):
npx streamdeck restart com.smok3y97.ytmusicweb

# Optional: Watch mode for active live development
npm run watch
```

---

## [✨ Elgato SDK Linting & Code Style Guide](#top)

The codebase strictly adheres to the official [Elgato Stream Deck Style Guide for Linting](https://docs.elgato.com/streamdeck/sdk/style-guide/linting):

- **ESLint Configuration**: Uses `@elgato/eslint-config` with flat config format (`plugin/eslint.config.js`).
- **Prettier Configuration**: Uses `@elgato/prettier-config` across TypeScript, JavaScript, CSS, and JSON files.
- **Automated Verification**: Enforces `0 errors` and `0 warnings` via `tsc --noEmit && eslint . --max-warnings 0`.

---

## [📦 Packaging Pipeline (`scripts/package_plugin.ps1`)](#top)

The automated packaging script executes a complete quality assurance and deployment pipeline:
1. **Automated Formatting & Linting**: Runs `npm run lint:fix` (Prettier code formatting and ESLint auto-fix) on the codebase.
2. **Bundle Compilation**: Compiles the plugin bundle with Rollup to `plugin/bin/plugin.js`.
3. **Asset Generation**: Generates all vector SVGs and PNG raster badges using `plugin/assets/generate_assets.ps1`.
4. **Staging**: Stages the `.sdPlugin` directory under `release/com.smok3y97.ytmusicweb.sdPlugin` (including localized language files `de.json`, `en.json`).
5. **Plugin Distribution Package**: Creates `release/com.smok3y97.ytmusicweb.streamDeckPlugin` release archive via `streamdeck pack`.
6. **Browser Extension Package**: Archives the companion browser extension into `release/extension.zip`.
7. **Live Deployment**: Automatically deploys the staged `.sdPlugin` directly to `%APPDATA%\Elgato\StreamDeck\Plugins\`.
8. **Hot Restart**: Automatically invokes `streamdeck restart` to instantly reload the live plugin in Stream Deck without restarting the application.

---

## [🏷️ Versioning Scheme](#top)

> [!NOTE]
> All version numbers shown in this guide (e.g. `1.7.0.0`) serve strictly as **illustrative examples** explaining formatting rules and command syntax. The live active version is defined centrally in [`version.json`](../version.json) and synchronized automatically across all manifests via `npm run bump`.

The project follows the official **4-digit Elgato Stream Deck Manifest Specification**:

$$\mathbf{\{Major\}.\{Minor\}.\{Patch\}.\{Build\}}$$

| Component | Format | Example | Purpose |
| :--- | :--- | :--- | :--- |
| **Stream Deck Plugin** (`plugin/manifest.json`) | 4-part numeric (`{M}.{m}.{p}.{b}`) | `1.7.0.0` | Strict Elgato Marketplace requirement (`^(0\|[1-9]\d*)(\.(0\|[1-9]\d*)){3}$`) for automated version comparison. |
| **Browser Extension** (`extension/manifest.json`) | `version`: 4-part numeric<br>`version_name`: string | `"1.7.0.0"`<br>`"1.7.0"` | `version` handles browser update comparisons; `version_name` defines user-facing store display. |
| **Node.js Packages** (`package.json`, `plugin/package.json`) | 4-part / SemVer | `1.7.0.0` | Synchronized monorepo package versions. |

### Version Semantics:
- **Major** (`{Major}`): Fundamental architectural overhauls, breaking changes, or SDK major upgrades.
- **Minor** (`{Minor}`): Substantial new user features or hardware integrations (e.g., adding dial actions, new background services, or handshake systems).
- **Patch** (`{Patch}`): Bug fixes, icon styling adjustments, code refactoring, and string corrections.
- **Build** (`{Build}`): Internal marketplace submission counter. Allows resubmissions without changing the public release version.
