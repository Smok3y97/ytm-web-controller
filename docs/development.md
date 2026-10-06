<a id="top"></a>

# Development & Contribution Guide (`docs/development.md`)

This document outlines the local development setup, build scripts, testing procedures, packaging workflow, and versioning standards. For community contribution steps and PR guidelines, see [**`CONTRIBUTING.md`**](../CONTRIBUTING.md).

---

## 📑 Table of Contents
- [🛠️ Prerequisites](#-prerequisites)
- [🚀 Build & Packaging Commands](#-build--packaging-commands)
- [✨ Elgato SDK Linting & Code Style Guide](#-elgato-sdk-linting--code-style-guide)
- [📦 Packaging Pipeline (`scripts/package_plugin.ps1`)](#-packaging-pipeline-scriptspackagepluginps1)
- [🏷️ Versioning Scheme](#-versioning-scheme)
- [🤖 CI/CD & Automated GitHub Releases](#-cicd--automated-github-releases)

---

## [🛠️ Prerequisites](#top)

- **Node.js**: `v24.0.0` or newer (**mandatory requirement**).
- **npm**: `v10.0.0` or newer.
- **Elgato Stream Deck Software**: `v7.1+` (mandatory requirement for Node.js 24 runtime support; actively tested on `v7.6`).
- **Elgato Stream Deck SDK**: **SDK 3** (**mandatory requirement**).
- **PowerShell**: Windows PowerShell 5.1 or PowerShell 7 (**optional**; helper for local Windows deployment scripts `package_plugin.ps1` and `generate_assets.ps1`; cross-platform builds, CI/CD, and all standard workflows run completely via cross-platform `npm` scripts and Elgato CLI).

---

## [🚀 Build & Packaging Commands](#top)

All commands can be executed directly from the monorepo root:

```bash
# 1. Compile TypeScript and build plugin JS bundle via Rollup
npm run build

# 2. Run TypeScript typechecking & official Elgato ESLint check
npm run lint
# Auto-fix lint issues:
npm run lint:fix
# Format source code or verify formatting with Prettier:
npm run format
npm run format:check

# 3. Package release archive & automatically deploy to local Stream Deck plugins folder
npm run package
# (or execute directly with PowerShell):
powershell -ExecutionPolicy Bypass -File .\scripts\package_plugin.ps1

# 4. Synchronize versions centrally across all manifests & packages
npm run bump 1.8.0.0

# 5. Validate plugin against official Elgato SDK Schema
npm run validate
# (or directly via npx):
npx streamdeck validate plugin/com.smok3y97.ytmusicweb.sdPlugin

# 6. Hot-restart plugin process in Stream Deck without restarting the app
npm run restart
# (or directly via npx):
npx streamdeck restart com.smok3y97.ytmusicweb

# Optional: Watch mode for active live development
npm run watch

# Quality assurance & agent skill tooling
npm run docs:audit         # Run full documentation hygiene, link & anchor audit
npm run docs:sync          # Verify code-to-documentation and version synchronization
npm run audit:guardrails   # Statically audit architectural constraints & guardrails
npm run assets:validate    # Validate icon assets, extensions & touch target specs
npm run changelog          # Generate release notes from git commits
npm run docs:conventions   # Synchronize docs/commit-conventions.md from JSON configuration
```


---

## [✨ Elgato SDK Linting & Code Style Guide](#top)

The codebase strictly adheres to the official [Elgato Stream Deck Style Guide for Linting](https://docs.elgato.com/streamdeck/sdk/style-guide/linting):

- **ESLint Configuration**: Uses `@elgato/eslint-config` with flat config format (`plugin/eslint.config.js`).
- **Prettier Configuration**: Uses `@elgato/prettier-config` across TypeScript, JavaScript, CSS, and JSON files.
- **Automated Verification**: Enforces `0 errors` and `0 warnings` via `tsc --noEmit && eslint . --max-warnings 0 && prettier --check .`.

> [!NOTE]
> **Plugin-Only Scope for Linting & Validation:** `npm run lint`, `npm run build`, and `npm run validate` are strictly scoped to the Stream Deck plugin (`plugin/**`). When changes only affect the companion browser extension (`extension/**`), helper scripts (`scripts/**`), agent skills (`.agents/**`), or Markdown documentation (`*.md`, `docs/**`), running local linting, bundle compilation, and Elgato CLI validation is not required and should be skipped.


---

## [📦 Packaging Pipeline (`scripts/package_plugin.ps1`)](#top)

The automated packaging script executes a complete quality assurance and deployment pipeline:
1. **Automated Verification & Linting**: Runs `npm run lint` (TypeScript typecheck, ESLint checks with 0 warnings, and Prettier formatting verification) on the codebase.
2. **Bundle Compilation**: Compiles the plugin bundle with Rollup directly to `plugin/com.smok3y97.ytmusicweb.sdPlugin/bin/plugin.js`.
3. **Asset Generation**: Generates all vector SVGs and PNG raster badges using `scripts/generate_assets.ps1` (or `npm run assets`) into `plugin/com.smok3y97.ytmusicweb.sdPlugin/assets/`.
4. **Plugin Distribution Package**: Creates `release/com.smok3y97.ytmusicweb.streamDeckPlugin` release archive directly from `plugin/com.smok3y97.ytmusicweb.sdPlugin` via `streamdeck pack`.
5. **Browser Extension Package**: Archives the companion browser extension into `release/extension.zip`.
6. **Live Deployment**: Automatically deploys the `.sdPlugin` directory directly to `%APPDATA%\Elgato\StreamDeck\Plugins\`.
7. **Hot Restart**: Automatically invokes `streamdeck restart` to instantly reload the live plugin in Stream Deck without restarting the application.

> [!NOTE]
> For exact asset dimensions, icon specifications, and marketplace guidelines, refer to [**`docs/plugin-guideline.md`**](plugin-guideline.md).

---

## [🏷️ Versioning Scheme](#top)

> [!NOTE]
> All version numbers shown in this guide (e.g. `1.7.0.0`) serve strictly as **illustrative examples** explaining formatting rules and command syntax. The live active version is defined centrally in [`version.json`](../version.json) and synchronized automatically across all manifests via `npm run bump`.

The project follows the official **4-digit Elgato Stream Deck Manifest Specification**:

$$\mathbf{\{Major\}.\{Minor\}.\{Patch\}.\{Build\}}$$

### 🚀 Centralized Single Command Versioning (`npm run bump`)

Versions are managed centrally via [`version.json`](../version.json) and automated with:
```bash
npm run bump <version>
# Example:
npm run bump 1.5.0.0
```

Running `npm run bump` automatically updates and synchronizes all required files:
| File | Property | Format Example | Requirement |
| :--- | :--- | :--- | :--- |
| [`version.json`](../version.json) | `"version"` | `"2.0.1.0"` | **Single Source of Truth** for the entire monorepo. |
| [`plugin/com.smok3y97.ytmusicweb.sdPlugin/manifest.json`](../plugin/com.smok3y97.ytmusicweb.sdPlugin/manifest.json) | `"Version"` | `"2.0.1.0"` | **Must be 4 numeric parts** matching regex `^(0\|[1-9]\d*)(\.(0\|[1-9]\d*)){3}$`. Required by Elgato CLI validation. |
| [`extension/manifest.json`](../extension/manifest.json) | `"version"`<br>`"version_name"` | `"2.0.1.0"`<br>`"2.0.1"` | `version` must be 4-digit for automated update comparisons; `version_name` defines user-facing display. |
| [`plugin/package.json`](../plugin/package.json) | `"version"` | `"2.0.1.0"` | Synchronized with plugin manifest version. |
| [`plugin/package-lock.json`](../plugin/package-lock.json) | `"version"` | `"2.0.1.0"` | Synchronized natively via `npm install --package-lock-only` (never edited manually). |
| [`package.json`](../package.json) | `"version"` | `"2.0.1.0"` | Synchronized monorepo root package version. |
| [`plugin/src/services/version-control.ts`](../plugin/src/services/version-control.ts) | Fallback constants | `"2.0.1.0"` | Manifest import with synchronized compile-time fallbacks. |
| [`extension/manifest.json`](../extension/manifest.json) | `"version"`<br>`"version_name"` | `"2.0.1.0"`<br>`"2.0.1"` | **Native SSOT for Extension**: Synchronously read via `chrome.runtime.getManifest()` and bridged to MAIN World DOM dataset; zero static code fallbacks. |

### Version Semantics:
- **Major** (`{Major}`): Fundamental architectural overhauls, breaking changes, or SDK major upgrades.
- **Minor** (`{Minor}`): Substantial new user features or hardware integrations (e.g., adding dial actions, new background services, or handshake systems).
- **Patch** (`{Patch}`): Bug fixes, icon styling adjustments, code refactoring, and string corrections.
- **Build** (`{Build}`): Internal marketplace submission counter. Allows resubmissions without changing the public release version.

### 🏷️ GitHub Tagging & Release Rules

- **Mandatory `v` Prefix for Tags:**  
  While GitHub suggests prefixing tags with `v` as common practice, in `ytm-web-controller` it is **mandatory**. The automated release pipeline ([`.github/workflows/release.yml`](../.github/workflows/release.yml)) strictly listens to tags matching `v*` (e.g. `v2.0.2.0`). Tags pushed without the `v` prefix will **not** trigger release compilation or binary packaging.
- **Elgato 4-Part Constraint vs. Semantic Pre-Release Suffixes:**  
  Standard semantic versioning often uses textual prerelease suffixes (e.g. `v1.0.0-alpha` or `v2.0.0-beta.1`).  
  > [!WARNING]  
  > **Do not use textual prerelease suffixes like `-alpha` or `-beta` in project version files.** The Elgato Stream Deck CLI (`npm run validate`) strictly enforces a 4-part numeric regex `^(0|[1-9]\d*)(\.(0|[1-9]\d*)){3}$`. Suffixes will fail official marketplace schema validation. For test builds or marketplace revisions, increment the fourth `{Build}` digit instead (e.g. `2.1.0.1`).
- **Automatic "Latest Release" Labeling:**  
  GitHub automatically assigns the **Latest Release** badge to newly published releases with the highest version number. Production releases automatically receive this status upon tag push.

---

## [🤖 CI/CD & Automated GitHub Releases](#top)

The repository utilizes GitHub Actions and Dependabot to automate testing, quality validation, release distribution, and dependency management.

### 1. Continuous Integration (`.github/workflows/ci.yml`)
- **Triggers**: On every `push` and `pull_request` against `main` and `master` (path-filtered to code, extensions, scripts, and manifests; Markdown documentation changes do not trigger CI runs).
- **Pipeline Tasks**:
  1. Installs monorepo and plugin dependencies (`npm ci`).
  2. Runs TypeScript typechecking and ESLint checks (`npm run lint`).
  3. Compiles the plugin bundle with Rollup (`npm run build`).
  4. Compiles the native Windows focus helper binary via Mono (`mcs`).
  5. Validates the plugin using the official Elgato CLI (`npm run validate`).
  6. Packages the Stream Deck plugin via official CLI (`streamdeck pack`).
  7. Packages the companion browser extension (`extension.zip`).
  8. Uploads both generated distribution packages (`.streamDeckPlugin` and `extension.zip`) as workflow artifacts for immediate testing.

### 2. Automated GitHub Releases (`.github/workflows/release.yml`)
- **Triggers**: On tag push matching `v*` (e.g. `v1.11.0.0`) or manually via `workflow_dispatch`.
- **Pipeline Tasks**:
  1. Runs identical transparent building, compiling, and Elgato CLI validation steps.
  2. Packages both release binaries (`.streamDeckPlugin` and `extension.zip`).
  3. Creates or updates the official GitHub Release with auto-generated release notes.
  4. Attaches both release assets:
     - `com.smok3y97.ytmusicweb.streamDeckPlugin`
     - `extension.zip`

#### 🚀 Step-by-Step Guide: How to Publish a New Release

Follow these steps in your terminal whenever you want to release a new version:

##### Step 1: Decide on your new version number
The version follows the 4-digit Elgato format: `Major.Minor.Patch.Build` (e.g. `1.12.0.0`).
- **New Feature / Action**: Increase the second number (e.g., `1.11.0.0` ➔ `1.12.0.0`).
- **Bugfix / Small adjustment**: Increase the third number (e.g., `1.11.0.0` ➔ `1.11.1.0`).

##### Step 2: Run the automated version bump command
This updates all 5 manifest, package, and configuration files automatically with a single command:
```bash
npm run bump <version>  # e.g., npm run bump 1.12.0.0
```

##### Step 3: Stage, Commit, and Tag the release
Stage the synchronized files and commit them using structured Conventional Commits with a mandatory body, then create a Git version tag starting with `v`:
```bash
# Stage the synchronized files
git add version.json package.json plugin/com.smok3y97.ytmusicweb.sdPlugin/manifest.json plugin/package.json plugin/package-lock.json extension/manifest.json

# Commit following Conventional Commits format
git commit -m "chore(release): bump version to <version>" -m "- Synchronized all manifests to <version> via npm run bump"

# Create version tag matching the v{Major}.{Minor}.{Patch}.{Build} pattern
git tag v<version>  # e.g., git tag v1.12.0.0
```

> [!IMPORTANT]
> The `.github/workflows/release.yml` pipeline strictly listens to tags matching `v*.*.*.*`. Pushing only the commit will trigger the CI test pipeline, but will **NOT** create a GitHub Release.

##### Step 4: Push to GitHub
Push your commit and tag to GitHub to trigger the release workflow:
```bash
git push origin main
git push origin v<version>
```

##### 📝 Git Commit Conventions
Commits must follow Conventional Commits with a mandatory descriptive body:
```text
<type>(<scope>): <short imperative summary>

- <bullet point explaining what changed>
- <bullet point explaining why the change was made>
```

All allowed commit types (e.g. `feat`, `fix`, `perf`, `refactor`), category emojis, descriptions, and release note mappings are documented in **[Commit Conventions & Categories (`docs/commit-conventions.md`)](commit-conventions.md)** (defined in [`.agents/skills/changelog-gen/resources/commit-conventions.json`](../.agents/skills/changelog-gen/resources/commit-conventions.json)).


*(Automated release note generator: `npm run changelog` or `node .agents/skills/changelog-gen/scripts/generate-changelog.mjs`).*




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

