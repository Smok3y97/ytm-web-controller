# Development & Contribution Guide (`docs/development.md`)

This document outlines the local development setup, build scripts, testing procedures, packaging workflow, and versioning standards.

---

## 🛠️ Prerequisites

- **Node.js**: `v20.0.0` or newer recommended.
- **npm**: `v10.0.0` or newer.
- **Elgato Stream Deck Software**: `v6.5+` (tested on `v7.5+`).
- **PowerShell**: Windows PowerShell or PowerShell 7 (for automated packaging scripts).

---

## 🚀 Build & Packaging Commands

All commands can be executed directly from the monorepo root:

```bash
# 1. Compile TypeScript and build plugin JS bundle via Rollup
npm run build

# 2. Package release archive & automatically deploy to local Stream Deck plugins folder
npm run package
# (or execute directly with PowerShell):
powershell -ExecutionPolicy Bypass -File .\package_plugin.ps1

# 3. Validate packaged plugin against official Elgato SDK Schema
npm run validate
# (or directly via npx):
npx streamdeck validate release/com.smok3y97.ytmusicweb.sdPlugin

# Optional: Watch mode for active live development
npm run watch
```

---

## 📦 Packaging Pipeline (`package_plugin.ps1`)

The automated packaging script performs the following tasks:
1. Compiles the plugin bundle with Rollup to `plugin/bin/plugin.js`.
2. Generates all vector SVGs and PNG raster badges using `plugin/assets/generate_assets.ps1`.
3. Stages the `.sdPlugin` directory under `release/com.smok3y97.ytmusicweb.sdPlugin`.
4. Creates `release/com.smok3y97.ytmusicweb.streamDeckPlugin` distribution archive.
5. Archives the companion browser extension into `release/extension.zip`.
6. Automatically copies the staged `.sdPlugin` to `%APPDATA%\Elgato\StreamDeck\Plugins\` for instantaneous testing in your local Stream Deck app.

---

## 🏷️ Versioning Scheme

The project follows the official **4-digit Elgato Stream Deck Manifest Specification**:

$$\mathbf{\{Major\}.\{Minor\}.\{Patch\}.\{Build\}}$$

| Component | Format | Example | Purpose |
| :--- | :--- | :--- | :--- |
| **Stream Deck Plugin** (`plugin/manifest.json`) | 4-part numeric (`{M}.{m}.{p}.{b}`) | `1.4.2.0` | Strict Elgato Marketplace requirement (`^(0\|[1-9]\d*)(\.(0\|[1-9]\d*)){3}$`) for automated version comparison. |
| **Browser Extension** (`extension/manifest.json`) | `version`: 4-part numeric<br>`version_name`: string | `"1.4.2.0"`<br>`"1.4.2"` | `version` handles browser update comparisons; `version_name` defines user-facing store display. |
| **Node.js Packages** (`package.json`, `plugin/package.json`) | 4-part / SemVer | `1.4.2.0` | Synchronized monorepo package versions. |

### Version Semantics:
- **Major** (`1`): Fundamental architectural changes or SDK upgrades.
- **Minor** (`4`): Substantial new user features (Dials, Discord RPC, OBS Exporter).
- **Patch** (`2`): Bug fixes, icon styling, and metadata corrections.
- **Build** (`0`): Internal marketplace submission counter.
