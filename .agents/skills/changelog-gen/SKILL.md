---
name: changelog-gen
description: Generates clean, grouped release notes and CHANGELOG entries from Conventional Commits between Git tags. Use this skill when preparing a release, summarizing changes since the last version, or updating CHANGELOG.md.
---

# Conventional Commit Changelog Generator (`changelog-gen`)

Extract and group git commit histories since the previous release tag to generate standardized, human-readable release notes.

## 1. Editorial Principles: User-First & Value-Oriented

- **Write for the End User:**
  - Focus on what the user experiences: *"Fixed an issue where closing a tab could disrupt playback controls"* instead of *"Guard WebSocket close on tab unload with isTabClosing to prevent reconnect loops in bfcache"*.
  - Explain the concrete benefit: *"Smoother dial scrolling without display lag on Stream Deck +"* instead of *"Implemented 10-Hz interval streaming and 110ms settle debounce in VolumeDialAction"*.
- **No Rigid "The Issue / The Fix" Boilerplate:**
  - Avoid repetitive and heavy "The Issue: ... / The Fix: ..." templates.
  - Use 1–2 natural, concise bullet points that explain the improvement directly.
- **Deep Dives via Commit Links:**
  - Technical users and contributors can click the linked commit hash (e.g. [`abc1234`](https://github.com/smok3y97/ytm-web-controller/commit/abc1234)) for code diffs, method signatures, and architectural changes.

## 2. Commit Classification Matrix (SSOT)

Commit classification rules, category emojis, section titles, and type aliases are strictly defined in the Single Source of Truth:
👉 [`resources/commit-conventions.json`](resources/commit-conventions.json) (Human-Readable Guide: [`docs/commit-conventions.md`](../../../docs/commit-conventions.md))

Both the automated generator (`generate-changelog.mjs`) and manual changelog edits dynamically follow this schema. Refer to this JSON file whenever inspecting or updating allowed commit types, scopes, emojis, or section names.



## 3. Execution Procedure

### Fast Path (Automated Helper Script)
Execute the bundled changelog generator script directly:
```bash
npm run changelog
# Or directly:
node .agents/skills/changelog-gen/scripts/generate-changelog.mjs
```
*(Automatically reads `version.json`, queries the previous tag via git, parses conventional commit headers, and outputs formatted Markdown).*

### Manual Path
If running in an environment without Node script execution:
1. **Identify Version Boundary:**
   ```bash
   git describe --tags --abbrev=0
   ```
2. **Extract Commit Log:**
   ```bash
   git log $(git describe --tags --abbrev=0)..HEAD --pretty=format:"%h - %s"
   ```
3. **Parse and Group Entries:**
   - Group entries into the sections listed in the classification matrix.
   - Format entries as clean Markdown bullet points focusing on user benefits.
4. **Target Version Header:**
   - Read version from `version.json` and append the current ISO date.

## 4. Standard Release Notes Output Format

Produce release notes adhering to the official project release template (see reference implementation: [`examples/sample-release-notes.md`](examples/sample-release-notes.md)):

```markdown
# 🎵 Controller for YouTube Music Web – Release v2.1.0.0

This release introduces new features, stability improvements, and hardware optimizations for the Stream Deck plugin and companion browser extension.

---

### 🚀 1. New Features
- **actions: Add dedicated Mute Toggle dial** ([`abc1234`](https://github.com/smok3y97/ytm-web-controller/commit/abc1234)):
  - Enables direct mute toggling via dial push while preserving rotary volume control
  - Synchronizes mute highlight indicator across all LCD touchstrips

---

### 🐛 2. Bug Fixes
- **core: Harden WebSocket reconnect arbitration** ([`def5678`](https://github.com/smok3y97/ytm-web-controller/commit/def5678)):
  - Resolves duplicate disconnect events during page reload
  - Restores playback controls immediately upon tab reconnection

---

### ⚡ 3. Performance & Hardware Protection
- **dial: Enforce strict 10-Hz encoder rate limit** ([`ghi9012`](https://github.com/smok3y97/ytm-web-controller/commit/ghi9012)):
  - Restricts canvas rendering updates to 10 Hz during rapid rotary spinning

---

## 📦 Installation & Setup

1. **Stream Deck Plugin**: Download `com.smok3y97.ytmusicweb.streamDeckPlugin` below and double-click to install.
2. **Browser Companion Extension**: Download `extension.zip`, extract it, and load it as an unpacked extension in your Chromium browser (`chrome://extensions` with Developer Mode enabled).

**Full Changelog**: https://github.com/smok3y97/ytm-web-controller/compare/v2.0.2.0...v2.1.0.0
```
