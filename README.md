<a id="top"></a>

# YouTube Music Web Controller (`ytm-web-controller`)

<p align="center">
  <img src="screenshots/Banner.png" alt="YouTube Music Web Controller" width="100%">
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://github.com/smok3y97/ytm-web-controller/actions/workflows/ci.yml"><img src="https://github.com/smok3y97/ytm-web-controller/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/smok3y97/ytm-web-controller/releases"><img src="https://img.shields.io/github/v/release/smok3y97/ytm-web-controller?include_prereleases&label=Release&color=blue" alt="Latest Release"></a>
  <a href="https://www.elgato.com/stream-deck"><img src="https://img.shields.io/badge/Stream%20Deck-v7.1%2B-red.svg" alt="Stream Deck"></a>
  <a href="https://developer.chrome.com/docs/extensions/mv3/intro/"><img src="https://img.shields.io/badge/Extension-Manifest%20V3-green.svg" alt="Manifest V3"></a>
</p>

An ultra-lightweight, event-driven, resource-efficient open-source controller bridge connecting the official [YouTube Music Web App](https://music.youtube.com) directly to your **Elgato Stream Deck** (including **Stream Deck + Dials & LCD Touchstrips**).

---

## 📑 Table of Contents
- [🌟 Why This Exists](#why-this-exists)
- [✨ Key Features](#key-features)
- [🎥 Streamer & Creator Features](#streamer--creator-features)
- [📦 Quickstart & Installation](#quickstart--installation)
- [📚 Documentation & Guides](#documentation--guides)
- [🤖 AI Collaboration & Transparency](#ai-collaboration--transparency)
- [🧪 Tested Environments & Hardware](#tested-environments--hardware)
- [🗺️ Roadmap & Future Ideas](#roadmap)
- [📄 License](#license)

---

<a id="why-this-exists"></a>

## [🌟 Why This Exists](#top)

Most YouTube Music desktop solutions force you to install heavy, third-party desktop apps that drain your PC's memory and run sluggish background tasks while you are gaming, streaming, or working.

**YouTube Music Web Controller** lets you keep using the official YouTube Music web player or PWA you already love — seamlessly connected to your **Elgato Stream Deck**:

- 🚀 **Keep Using the Official Web Player**: Works directly with YouTube Music in your favorite browser (Chrome, Brave, Edge, etc.) with all your playlists, recommendations, and full official audio quality.
- ⚡ **Zero-Overhead & Local-First**: Event-driven WebSocket communication with zero DOM polling, and 100% in-memory RAM rendering without temporary cache files on disk (file export for OBS `.txt` is strictly opt-in).
- 🛡️ **Ultra-Lightweight & Private**: Completely invisible to your system — running locally with zero external telemetry, zero open firewall ports, and no impact on game performance or stream bitrates.

---

<a id="key-features"></a>

## [✨ Key Features](#top)

- 🎛️ **Stream Deck + Dial Controls**: Dial controls for Track Skipping, Volume, and Scrubbing/Seeking with real-time LCD progress bars and dynamic album cover thumbnails.
- 🔘 **13 Keypad Actions**: Live Song Cover Art backgrounds & track info overlay, Play/Pause, Volume Up/Down, Fast Forward / Rewind, Mute, Next/Prev, Like/Dislike, Shuffle, Repeat (Tri-State), and Copy Song URL.
- 💬 **Discord Rich Presence (RPC)**: Automatic status broadcasting with album art and animated progress across Desktop & Mobile *(clickable song links are supported on the Discord Desktop client)*.

> [!TIP]
> 📋 **Detailed Action Reference**: For full control tables, hardware feedbacks, and action specifications, see the **[Feature Matrix & Action Reference (`docs/features.md`)](docs/features.md)**.

---

<a id="streamer--creator-features"></a>
<a id="streamer-features"></a>

## [🎥 Streamer & Creator Features](#top)

- 🎨 **OBS Studio Browser Overlay**: Dynamic animated now-playing stream overlay (`/overlay`) with live album art, marquee scrolling, progress bar, themes (`card`, `compact`, `pill`), and HEX color customization.
- 🤖 **Chatbot Integration (`!song`)**: Lightweight read-only REST endpoint (`/api/current`) for Streamer.bot, MixItUp, and local bots with customizable response formats.
- 📄 **OBS Text File Export (.txt)**: Automatically writes live metadata (`{artist}`, `{title}`, `{album}`) to a local `.txt` file for classic OBS Text (GDI+) sources.

> [!TIP]
> 📖 **Full Streamer & Chatbot Guide**: For step-by-step setup, theme parameters, and bot commands (Streamer.bot, MixItUp), see the **[OBS Studio & Chatbot Setup Guide (`docs/obs-setup.md`)](docs/obs-setup.md)**.

---

<a id="quickstart--installation"></a>
<a id="quickstart"></a>

## [📦 Quickstart & Installation](#top)

### Step 1: Install the Stream Deck Plugin
1. Download the latest `com.smok3y97.ytmusicweb.streamDeckPlugin` from the [Releases](https://github.com/smok3y97/ytm-web-controller/releases) page.
2. Double-click the file to install it directly into Elgato Stream Deck.
3. Open Stream Deck and drag any **YouTube Music** action onto your keys or dials.

### Step 2: Install the Browser Extension
1. Download and unzip `extension.zip` from the [Releases](https://github.com/smok3y97/ytm-web-controller/releases) page.
2. In your browser (Chrome, Edge, Brave, etc.), navigate to `chrome://extensions` (or `about:debugging` in Firefox — *experimental / untested*).
3. Enable **Developer mode** (top-right toggle) and click **Load unpacked**.
4. Select the unzipped `extension` folder.

### Step 3: Start Playing Music!
1. Open [music.youtube.com](https://music.youtube.com).
2. The extension automatically connects to your Stream Deck via local WebSocket (`127.0.0.1:39865`).

---

<a id="documentation--guides"></a>
<a id="documentation"></a>

## [📚 Documentation & Guides](#top)

For detailed setup instructions, developer guidelines, and architectural specifications, check our dedicated documentation:

| Guide | Description |
| :--- | :--- |
| 📋 **[Feature Matrix & Action Reference](docs/features.md)** | Detailed breakdown of all Keypad and Dial actions, hardware feedbacks, and background services. |
| 🎥 **[OBS Studio & Chatbot Setup Guide](docs/obs-setup.md)** | Step-by-step instructions for setting up live overlays, chatbots, and text sources in OBS Studio. |
| ⚙️ **[Configuration & Customization Guide](docs/configuration.md)** | Complete breakdown of Property Inspector options, Discord RPC, Volume steps, and templates. |
| 🏛️ **[System Architecture & Data Flows](docs/architecture.md)** | Full technical specifications, Mermaid architecture diagrams, service breakdowns, and monorepo file tree. |
| 🏗️ **[Development & Contribution Guide](docs/development.md)** | Build commands, Rollup bundle setup, packaging pipeline, and versioning standards. |
| 📋 **[Marketplace Guidelines Compliance](docs/plugin-guideline.md)** | Elgato Stream Deck Marketplace compliance rules and asset specifications. |
| 🤖 **[AI Collaboration & Transparency](docs/ai-disclosure.md)** | Transparent breakdown of AI pair programming with Google Antigravity and quality assurance practices. |
| 🤝 **[Community Contribution Guidelines](CONTRIBUTING.md)** | Code of conduct, bug reporting, PR workflow, and coding standards. |
| 📋 **[Agent & Developer Guidelines](AGENTS.md)** | Persistent rules for human contributors and AI coding agents. |

---

<a id="ai-collaboration--transparency"></a>
<a id="ai-collaboration"></a>

## [🤖 AI Collaboration & Transparency](#top)

The source code, build scripts, vector assets, and UI components in this repository were **100% generated by Artificial Intelligence (Google Antigravity / Gemini AI)** under the architectural guidance and feature specification of the maintainer (**Smok3y97**). All functionality, dials, keys, and integrations are physically tested on hardware. For full details, see **[AI Collaboration & Transparency (`docs/ai-disclosure.md`)](docs/ai-disclosure.md)**.

---

<a id="tested-environments--hardware"></a>
<a id="tested-environments"></a>

## [🧪 Tested Environments & Hardware](#top)

All releases and features are physically tested and validated by the maintainer on live hardware:

- **Hardware**: Elgato Stream Deck +, Corsair Galleon 100 SD
- **Environment**: Windows 11, Google Chrome (Web Player & PWA), Discord Desktop, OBS Studio

> [!TIP]
> 🔍 **Detailed Specifications**: For exact software build numbers, testing methodology, and full verification policy, see the **[Verified Environments Reference in `docs/ai-disclosure.md`](docs/ai-disclosure.md#3-hardware-testing--verified-environments)**.

---

<a id="roadmap--future-ideas"></a>
<a id="roadmap"></a>

## [🗺️ Roadmap & Future Ideas](#top)

We are continuously exploring new ways to enhance YouTube Music Web Controller. Here is an overview of planned platform releases and potential future features under consideration:

### 🚀 Distribution & Platform Releases
- 🏬 **Elgato Stream Deck Marketplace Release**: Official distribution on the Elgato Marketplace for seamless one-click installation and automatic plugin updates directly within the Stream Deck app.
- 🌐 **Chrome Web Store Extension Release**: One-click browser companion installation via the official Chrome Web Store (and Firefox Add-ons).

### 💡 Potential Future Features & Ideas
- 🎬 **Song / Video Mode Toggle (`toggleSongVideo`)**: Keypad action to switch between pure audio playback and YouTube Music video mode.
- 📜 **Lyrics Tab Toggle (`toggleLyrics`)**: Direct action to open or close the dedicated song lyrics drawer in the web player.
- 📻 **Start Radio Station (`startRadio`)**: Action to instantly launch an endless dynamic radio mix based on the currently playing track.
- ⏩ **Playback Speed Toggle (`playbackRate`)**: Cycle playback speeds (e.g. `1.0x` ➔ `1.25x` ➔ `1.5x` ➔ `2.0x`) for podcasts and audiobooks on YouTube Music.
- 🎵 **Quick Playlist / Supermix Launcher**: Dedicated hotkeys to trigger custom playlist URLs or your personalized "My Supermix" directly in the web player.

---

<a id="license"></a>

## [📄 License](#top)

This project is licensed under the [MIT License](LICENSE).
