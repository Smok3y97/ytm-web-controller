# YouTube Music Web Controller (`ytm-web-controller`)

<p align="center">
  <img src="screenshots/Banner.png" alt="YouTube Music Web Controller" width="100%">
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://github.com/smok3y97/ytm-web-controller/releases"><img src="https://img.shields.io/github/v/release/smok3y97/ytm-web-controller?include_prereleases&label=Release&color=blue" alt="Latest Release"></a>
  <a href="https://www.elgato.com/stream-deck"><img src="https://img.shields.io/badge/Stream%20Deck-v6.5%2B-red.svg" alt="Stream Deck"></a>
  <a href="https://developer.chrome.com/docs/extensions/mv3/intro/"><img src="https://img.shields.io/badge/Extension-Manifest%20V3-green.svg" alt="Manifest V3"></a>
</p>

An ultra-lightweight, event-driven, resource-efficient open-source controller bridge connecting the official [YouTube Music Web App](https://music.youtube.com) directly to your **Elgato Stream Deck** (including **Stream Deck + Dials & LCD Touchstrips**).

---

## 🌟 Why This Exists

Most YouTube Music desktop solutions force you to install heavy, third-party desktop apps that drain your PC's memory and run sluggish background tasks while you are gaming, streaming, or working.

**YouTube Music Web Controller** lets you keep using the official YouTube Music web player or PWA you already love — seamlessly connected to your **Elgato Stream Deck**:

- 🚀 **Keep Using the Official Web Player**: Works directly with YouTube Music in your favorite browser (Chrome, Brave, Edge, etc.) with all your playlists, recommendations, and full official audio quality.
- ⚡ **Zero-Overhead & Local-First**: Event-driven WebSocket communication with zero DOM polling, and 100% in-memory rendering with zero disk footprint.
- 🛡️ **Ultra-Lightweight & Private**: Completely invisible to your system — running locally with zero external telemetry, zero open firewall ports, and no impact on game performance or stream bitrates.

---

## ✨ Key Features

- 🎛️ **Stream Deck + Dial Controls**: Dial controls for Track Skipping, Volume, and Scrubbing/Seeking with real-time LCD progress bars and dynamic album cover thumbnails.
- 🔘 **12+ Keypad Actions**: Live Album Cover Art backgrounds, Play/Pause, Volume Up/Down, Mute, Next/Prev, Like/Dislike, Shuffle, Repeat (Tri-State), Copy Song URL, and Song Request toggles.
- 💬 **Discord Rich Presence (RPC)**: Automatic status broadcasting with album art and animated progress across Desktop & Mobile *(clickable song links are supported on the Discord Desktop client)*.

> [!TIP]
> 📋 **Detailed Action Reference**: For full control tables, hardware feedbacks, and action specifications, see the **[Feature Matrix & Action Reference (`docs/features.md`)](docs/features.md)**.

---

## 🎥 Streamer & Content Creator Features

The plugin includes a lightweight local HTTP server layer on port `39865` running alongside the WebSocket server to power overlays, chatbots, and song requests with zero external tools or open firewall ports:

### 1. Interactive OBS Studio Browser Overlay
Add an animated now-playing music widget directly to OBS Studio as a **Browser Source**:
- **URL**: `http://localhost:39865/overlay`
- **Themes**: `card` (default), `compact`, `pill`
- **Customizable**: Customize accent colors, transparency, borders, and animations simply via URL parameters (e.g. `http://localhost:39865/overlay?theme=card&accent=ff0033`).

<p align="center">
  <img src="screenshots/OBS-Browser-Overlay.png" alt="OBS Browser Source Music Overlay" width="480">
  <br>
  <em>Interactive OBS Studio Browser Source Overlay (<code>card</code> theme)</em>
</p>

### 2. Chatbot Integrations & Viewer Song Requests *(WIP)*

> [!NOTE]
> 🚧 **Work in Progress (WIP)**: The viewer song request endpoint (`/api/playnext`) and queue integration are currently in active development.

Let viewers query the current track or queue songs in your Twitch, YouTube, or Kick chat:
- **Query Song (`!song`)**:
  ```text
  !addcom !song $(urlfetch http://localhost:39865/api/current?format=Now playing: {title} by {artist} 🎶 ({url}))
  ```
- **Song Requests (`!playnext`)**:
  ```text
  !addcom !playnext $(urlfetch http://localhost:39865/api/playnext?url=$(querystring))
  ```
- **Stream Deck Key (`Toggle Song Requests`)**: Instantly pause or resume viewer song requests on-the-fly during your stream.
- **Troll Protection**: Includes a built-in **Song Blacklist** in the Property Inspector to block unwanted video IDs or meme links automatically.

### 3. Classic OBS Text File Export (`.txt`)
Automatically exports live track metadata (`{artist}`, `{title}`, `{album}`) to a local `.txt` file for native OBS **Text (GDI+)** sources.

> [!TIP]
> 📖 **Full Setup Guide**: For comprehensive step-by-step instructions, complete URL parameter tables, and configuration guides for **Nightbot, Streamer.bot, Streamlabs Cloudbot, MixItUp, and Fossabot**, see the **[OBS Studio & Chatbot Setup Guide (`docs/obs-setup.md`)](docs/obs-setup.md)**.

<table align="center">
  <tr>
    <th align="center">🖥️ Discord Desktop Rich Presence</th>
    <th align="center">📱 Discord Mobile App Rich Presence</th>
  </tr>
  <tr>
    <td align="center" valign="middle">
      <img src="screenshots/Discord-Desktop-RPC.png" alt="Discord Rich Presence Desktop" width="300">
    </td>
    <td align="center" valign="middle">
      <img src="screenshots/Discord-Mobile-RPC.png" alt="Discord Mobile App Rich Presence" width="300">
    </td>
  </tr>
</table>

---

## 📦 Quickstart & Installation

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

## 📚 Documentation & Guides

For detailed setup instructions, developer guidelines, and architectural specifications, check our dedicated documentation:

| Guide | Description |
| :--- | :--- |
| 📋 **[Feature Matrix & Action Reference](docs/features.md)** | Detailed breakdown of all Keypad and Dial actions, hardware feedbacks, and background services. |
| 🎥 **[OBS Studio Overlay Setup Guide](docs/obs-setup.md)** | Step-by-step instructions for setting up live `.txt` overlay sources in OBS Studio. |
| ⚙️ **[Configuration & Customization Guide](docs/configuration.md)** | Complete breakdown of Property Inspector options, Discord RPC, Volume steps, and templates. |
| 🏛️ **[System Architecture & Data Flows](docs/architecture.md)** | Full technical specifications, Mermaid architecture diagrams, service breakdowns, and monorepo file tree. |
| 🏗️ **[Development & Contribution Guide](docs/development.md)** | Build commands, Rollup bundle setup, packaging pipeline, and versioning standards. |
| 📋 **[Marketplace Guidelines Compliance](docs/plugin-guideline.md)** | Elgato Stream Deck Marketplace compliance rules and asset specifications. |
| 🤖 **[AI Collaboration & Transparency](docs/ai-disclosure.md)** | Transparent breakdown of AI pair programming with Google Antigravity and quality assurance practices. |
| 📋 **[Agent & Developer Guidelines](AGENTS.md)** | Persistent rules for human contributors and AI coding agents. |

---

## 🤖 AI Collaboration & Transparency

The source code, build scripts, vector assets, and UI components in this repository were **100% generated by Artificial Intelligence (Google Antigravity / Gemini AI)** under the architectural guidance and feature specification of the maintainer (**Smok3y97**). All functionality, dials, keys, and integrations are physically tested on hardware. For full details, see **[AI Collaboration & Transparency (`docs/ai-disclosure.md`)](docs/ai-disclosure.md)**.

---

## 🧪 Tested Environments & Hardware

- **Operating System**: Windows 11
- **Hardware Controllers**:
  - **Elgato Stream Deck +** (Physical Keys, Dials & LCD Touchstrip)
  - **Corsair Galleon 100 SD** (Physical Keys & Dials)
- **Software Tested**:
  - **Elgato Stream Deck Software**: `v7.5.1 (22901)` (Minimum required: `v6.5+`)
  - **Discord Windows Client**: `v1.0.9253 x64 (88414)` (Desktop Rich Presence)
  - **OBS Studio**: `v28+` (Text GDI+ stream overlays)
  - **Browser**: Google Chrome (Official Web Player & PWA) *(Other Chromium browsers and Firefox are built on standard web extension APIs, but have not been personally tested)*.

---

## 🤝 Contributing & License

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/smok3y97/ytm-web-controller/issues).

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

Developed with ❤️ by **Smok3y97** for the YouTube Music & Stream Deck community.
