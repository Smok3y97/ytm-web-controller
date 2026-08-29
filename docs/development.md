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
- [🤖 CI/CD & Automated GitHub Releases](#-cicd--automated-github-releases)

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

---

## [🤖 CI/CD & Automated GitHub Releases](#top)

The repository utilizes GitHub Actions and Dependabot to automate testing, quality validation, release distribution, and dependency management.

### 1. Continuous Integration (`.github/workflows/ci.yml`)
- **Triggers**: On every `push` and `pull_request` against `main` and `master`.
- **Pipeline Tasks**:
  1. Installs monorepo and plugin dependencies (`npm ci`).
  2. Runs TypeScript typechecking and ESLint checks (`npm run lint`).
  3. Executes the full packaging pipeline (`scripts/package_plugin.ps1`).
  4. Validates the generated `.sdPlugin` using the official Elgato CLI (`streamdeck validate`).
  5. Uploads both generated distribution packages (`.streamDeckPlugin` and `extension.zip`) as workflow artifacts for immediate testing.

### 2. Automated GitHub Releases (`.github/workflows/release.yml`)
- **Triggers**: On tag push matching `v*` (e.g. `v1.11.0.0`) or manually via `workflow_dispatch`.
- **Pipeline Tasks**:
  1. Runs full linting, building, and Elgato CLI validation.
  2. Creates or updates the official GitHub Release with auto-generated release notes.
  3. Attaches both release assets:
     - `com.smok3y97.ytmusicweb.streamDeckPlugin`
     - `extension.zip`

#### 🚀 Step-by-Step Guide: How to Publish a New Release

Follow these 4 simple steps in your terminal (PowerShell / Terminal in VS Code / Antigravity) whenever you want to release a new version:

##### Step 1: Decide on your new version number
The version follows the 4-digit Elgato format: `Major.Minor.Patch.Build` (e.g. `1.12.0.0`).
- **New Feature / Action**: Increase the second number (e.g., `1.11.0.0` ➔ `1.12.0.0`).
- **Bugfix / Small adjustment**: Increase the third number (e.g., `1.11.0.0` ➔ `1.11.1.0`).

##### Step 2: Run the automated version bump command
This updates all 5 manifest, package, and configuration files automatically with a single command:
```bash
npm run bump 1.12.0.0
```

##### Step 3: Commit and Tag the release
Commit the modified files and create a Git version tag starting with `v`:
```bash
git commit -am "chore: release 1.12.0.0"
git tag v1.12.0.0
```

##### Step 4: Push to GitHub
Push your commits and tags to GitHub:
```bash
git push origin master --follow-tags
```
*(If your default branch is `main`, use `git push origin main --follow-tags`).*

---

> [!TIP]
> **What happens next automatically?**
> 1. GitHub Actions detects the new `v1.12.0.0` tag.
> 2. It builds, lints, and validates the plugin on a clean machine.
> 3. It generates the GitHub Release with changelog notes and attaches both `com.smok3y97.ytmusicweb.streamDeckPlugin` and `extension.zip` as downloadable assets.
> 4. You can monitor the live progress under the **Actions** tab in your GitHub repository!

---

#### 🖱️ Alternative: Manual Trigger via GitHub Web UI
If you prefer not to push tags via the command line:
1. Navigate to your repository on GitHub.
2. Click on the **Actions** tab at the top.
3. In the left sidebar, click on **Release**.
4. Click the **Run workflow** dropdown button on the right and click **Run workflow**.
5. The pipeline will automatically build and publish the release based on the current [`version.json`](../version.json).

### 3. Automated Dependency Management (`.github/dependabot.yml`)
- **Schedule**: Weekly automated scans.
- **Scope**:
  - Root `package.json` dependencies
  - Plugin `plugin/package.json` dependencies
  - GitHub Actions workflow versions
- Automatically triggers CI checks on every Dependabot PR to ensure compatibility.

