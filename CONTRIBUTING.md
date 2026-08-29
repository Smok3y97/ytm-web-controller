# Contributing to YouTube Music Web Controller (`CONTRIBUTING.md`)

Thank you for your interest in contributing to **YouTube Music Web Controller**! 🎉

Whether you are reporting a bug, proposing new features, improving documentation, or submitting pull requests, any help in making this open-source controller even better is warmly appreciated.

---

## 📑 Table of Contents
- [Code of Conduct](#-code-of-conduct)
- [How Can I Contribute?](#-how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features & Actions](#suggesting-features--actions)
  - [Submitting Pull Requests](#submitting-pull-requests)
- [Local Development Setup](#-local-development-setup)
  - [Prerequisites](#prerequisites)
  - [Build, Package & Validate Commands](#build-package--validate-commands)
- [Architecture & Coding Standards](#-architecture--coding-standards)
  - [1. Zero DOM Polling](#1-zero-dom-polling)
  - [2. Zero Disk Footprint (In-Memory Canvas)](#2-zero-disk-footprint-in-memory-canvas)
  - [3. 10 Hz Stream Deck Hardware Rate Limit](#3-10-hz-stream-deck-hardware-rate-limit)
  - [4. Single Responsibility Principle (SRP)](#4-single-responsibility-principle-srp)
  - [5. Property Inspector (PI) Auto-Save](#5-property-inspector-pi-auto-save)
  - [6. Internationalization (i18n)](#6-internationalization-i18n)
  - [7. Versioning & Package Locks](#7-versioning--package-locks)
- [AI Pair Programming & Transparency](#-ai-pair-programming--transparency)
- [Related Documentation](#-related-documentation)

---

## 🤝 Code of Conduct

The project is dedicated to providing a welcoming, inclusive, and harassment-free community for everyone.

All contributors and participants are expected to uphold the **[Code of Conduct](CODE_OF_CONDUCT.md)** (Contributor Covenant v2.1). Please review the full guidelines to understand community standards and enforcement responsibilities.

---

## 💡 How Can I Contribute?

### Reporting Bugs
Before filing a new report, please search [existing issues](https://github.com/Smok3y97/ytm-web-controller/issues) to avoid duplicates. When opening a bug report, use the **[Bug Report Template](https://github.com/Smok3y97/ytm-web-controller/issues/new?template=bug_report.yml)** to provide:
- **Environment**: OS (Windows 10/11), Browser (Chrome, Brave, Edge), Stream Deck Software Version.
- **Hardware**: Stream Deck model (Stream Deck +, Keypad, Neo, Mini, XL, Mobile).
- **Steps to Reproduce**: Clear, reproducible step-by-step instructions.
- **Expected vs. Actual Behavior**: What happened vs. what you expected.
- **Logs / Screenshots**: Stream Deck plugin logs or browser console errors (`F12` on music.youtube.com).

### Suggesting Features & Actions
Feature requests and action proposals are always welcome! Please use the **[Feature Request Template](https://github.com/Smok3y97/ytm-web-controller/issues/new?template=feature_request.yml)**:
- Explain the use case and why it would benefit users or streamers.
- Describe the proposed hardware interaction (e.g. Keypad press/hold, Dial rotation, LCD touch).

### Submitting Pull Requests
1. **Fork & Branch**: Fork the repository and create a descriptive feature branch (e.g. `feature/new-dial-action` or `fix/obs-export-path`).
2. **Follow Coding Standards**: Ensure changes adhere to the project's architectural principles and pass all linting and validation checks.
3. **Validate**: Always run `npm run validate` locally before submitting to guarantee compliance with the Elgato SDK schema.
4. **Open a PR**: Submit a Pull Request using the standard PR template. GitHub Actions CI will automatically run all lint, typecheck, build, and validation checks on your PR.

---

## 🛠️ Local Development Setup

### Prerequisites
- **Node.js**: `v24.0.0` or newer.
- **npm**: `v10.0.0` or newer.
- **Elgato Stream Deck Software**: `v7.1+` (tested on `v7.5+`).
- **PowerShell**: Windows PowerShell or PowerShell 7 (for automated packaging scripts).

### Build, Package & Validate Commands

```bash
# 1. Install dependencies
npm install

# 2. Compile TypeScript and build plugin JS bundle via Rollup
npm run build

# 3. Run ESLint and code style checks
npm run lint
# Or auto-fix:
npm run lint:fix

# 4. Package release archive & automatically deploy to local Stream Deck plugins folder
npm run package
# (or execute directly with PowerShell):
powershell -ExecutionPolicy Bypass -File .\scripts\package_plugin.ps1

# 5. Validate packaged plugin against official Elgato SDK Schema
npm run validate
# (or directly via npx):
npx streamdeck validate release/com.smok3y97.ytmusicweb.sdPlugin

# 6. Centralized version bump across all manifests & packages
npm run bump <version>  # e.g. npm run bump 1.9.1.0
```

---

## 🏛️ Architecture & Coding Standards

Contributors must adhere to the core architectural guidelines outlined in [`docs/architecture.md`](docs/architecture.md) and [`AGENTS.md`](AGENTS.md):

### 1. Zero DOM Polling
- **Never** use `setInterval()` in the browser extension to query music player state.
- All state changes must be strictly event-driven via native HTML5 `<video>` events (`play`, `pause`, `timeupdate`, `seeking`, `seeked`) and targeted DOM `MutationObserver` callbacks.

### 2. Zero Disk Footprint (In-Memory Canvas)
- All dynamic cover artwork, dial thumbnails, and LCD layouts must be rendered in-memory (RAM) and encoded as Base64 data URLs.
- Temporary files must not be written to disk (OBS `.txt` export is the only, strictly opt-in file output).

### 3. 10 Hz Stream Deck Hardware Rate Limit
- Programmatic canvas, dial, LCD, or key image updates must never flood the Stream Deck hardware faster than **10 updates per second (10 Hz)**.

### 4. Single Responsibility Principle (SRP)
- Keep backend services (`plugin/src/services/`) decoupled and consumed via Singleton patterns.
- Action classes (`plugin/src/actions/`) inherit from base action controllers and must not directly manipulate raw sockets or external APIs.

### 5. Property Inspector (PI) Auto-Save
- All Property Inspector inputs must save automatically on input/change (`setSettings` / `setGlobalSettings`).
- **Never add a manual "Save" button** in the Property Inspector.

### 6. Internationalization (i18n) & Translation Policy
- **English (`en`) is the only strictly required base language** for contributions, new features, actions, and settings.
- When adding new actions, settings, or UI strings, **maintain keys and placeholders exclusively in the centralized language files** ([`plugin/en.json`](plugin/en.json) and [`plugin/de.json`](plugin/de.json)). The Property Inspector ([`plugin/ui/i18n.js`](plugin/ui/i18n.js)) dynamically loads these files at runtime with zero duplication.
- **Fallback Rule**: If you are not fluent in or unsure about a non-English translation (such as German), simply **insert the English text as the value** in the non-English file rather than omitting the key.
- **Architectural Guarantee**: The plugin runtime and Property Inspector loader ([`plugin/ui/i18n.js`](plugin/ui/i18n.js)) are engineered with automatic fallback cascading: whenever a translation key is missing, empty, or undefined in an active non-English locale, it automatically resolves to the English default text without runtime errors or blank UI fields.

### 7. Versioning & Package Locks
- Follow the 4-digit Elgato Stream Deck specification: `{Major}.{Minor}.{Patch}.{Build}` (e.g. `1.9.1.0`).
- Manage versions exclusively through `npm run bump <version>`.
- **Never manually edit `package-lock.json` files**.

---

## 🤖 AI Pair Programming & Transparency

This project embraces transparent AI collaboration. If you use AI coding assistants (such as Google Antigravity, Gemini, GitHub Copilot, or Claude) when contributing:
- Ensure all generated code is thoroughly tested, linted, and reviewed.
- Verify changes against live hardware or staging builds.
- See **[AI Collaboration & Transparency (`docs/ai-disclosure.md`)](docs/ai-disclosure.md)** for quality assurance principles and verified hardware testing details.

---

## 📚 Related Documentation

- 🏛️ **[System Architecture & Data Flows (`docs/architecture.md`)](docs/architecture.md)**
- 📋 **[Feature Matrix & Action Reference (`docs/features.md`)](docs/features.md)**
- ⚙️ **[Configuration Guide (`docs/configuration.md`)](docs/configuration.md)**
- 🎥 **[OBS Studio & Chatbot Setup (`docs/obs-setup.md`)](docs/obs-setup.md)**
- 🏗️ **[Development Guide (`docs/development.md`)](docs/development.md)**
- 📋 **[Marketplace Guidelines (`docs/plugin-guideline.md`)](docs/plugin-guideline.md)**
- 🤝 **[Code of Conduct (`CODE_OF_CONDUCT.md`)](CODE_OF_CONDUCT.md)**
- 🔒 **[Security Policy (`SECURITY.md`)](SECURITY.md)**
- 🤖 **[Agent Guidelines (`AGENTS.md`)](AGENTS.md)**
