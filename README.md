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
- ⚡ **Ultra-Lightweight with Zero Lag**: Built to be completely invisible to your system. It will never slow down your games, stream bitrate, or background tasks.
- 🎛️ **Full Stream Deck + Dial Support**: Enjoy smooth rotary dials for volume, scrubbing, and track skipping, complete with live album art and auto-scrolling song titles on the LCD screen.
- 💬 **Discord Rich Presence Included**: Automatically show your friends what you are listening to in your Discord profile (with live progress on Desktop & Mobile, plus clickable song links on the Desktop app).
- 🎥 **Built for Streamers**: Effortlessly display your currently playing song in your OBS Studio stream overlays with zero complicated setup.

---

## 📋 Feature Matrix

### 🎛️ Stream Deck + Rotary Dials & LCD Touchstrips

| Action | Control Type | Hardware Feedback | Description |
| :--- | :--- | :--- | :--- |
| **Track Controller** | Rotary Dial + LCD Tap | Auto-scrolling title/artist, cover thumbnail, live time & track progress bar | Rotate to skip tracks (Next / Previous). Push dial or tap LCD touchstrip to toggle Play/Pause. Includes push-jitter suppression. |
| **Volume Controller** | Rotary Dial + LCD Tap | Real-time volume bar, percentage readout (`100%`, `MUTED`), cover thumbnail | Rotate to adjust volume (1% – 25% step). Push dial or tap LCD touchstrip to toggle Mute / Unmute. |
| **Seek Controller** | Rotary Dial + LCD Tap | Real-time track progress bar, `{current} / {duration}` time display, cover thumbnail | Rotate to scrub forward/backward in track (1s – 60s step, default 10s). Push dial or tap LCD touchstrip to toggle Play/Pause. |

### 🔘 Keypad Actions

| Action | Key Type | Dynamic Feedback | Description |
| :--- | :--- | :--- | :--- |
| **Play / Pause** | Dual-State | Dynamic Play/Pause vector state or live **Album Cover Art as button background** | Toggles playback state. Cover art is rendered directly in RAM with zero disk I/O. |
| **Volume Up** | Single Key | Live `{volume}%` text readout | Increases playback volume by configurable step (1% – 25%). Fully stylable via native Title Styler. |
| **Volume Down** | Single Key | Live `{volume}%` text readout | Decreases playback volume by configurable step (1% – 25%). Fully stylable via native Title Styler. |
| **Mute / Unmute** | Dual-State | Dynamic Unmuted / Muted speaker icons | Toggles mute status for active playback. |
| **Next Track** | Single Key | Official vector Next icon | Skips to the next track in current queue. |
| **Previous Track** | Single Key | Official vector Previous icon | Skips to previous track or restarts current track. |
| **Like Track** | Dual-State | Dynamic active/inactive thumbs-up highlight (`#FF0033`) | Toggles like rating on current song. |
| **Dislike Track** | Dual-State | Dynamic active/inactive thumbs-down highlight (`#FF0033`) | Toggles dislike rating on current song. |
| **Shuffle** | Dual-State | Dynamic active/inactive shuffle highlight (`#FF0033`) | Toggles queue shuffle mode on/off. |
| **Repeat Mode** | Tri-State | Dynamic cycle icons: **Off** ➔ **All** ➔ **One (1)** | Cycles playlist repeat modes. |
| **Copy Song URL** | Single Key | Visual success indicator (`showOk`) | Copies current track URL directly to clipboard for fast sharing. |

### 📡 Integrations & Background Services

| Feature | Target App | Key Capabilities |
| :--- | :--- | :--- |
| **Discord Rich Presence (RPC)** | Discord Desktop & Mobile | Real-time status, album art, and animated timeline progress across Desktop & Mobile (interactive clickable song buttons available on Discord Desktop client). |
| **Streamer Settings (OBS Export)** | OBS Studio / Streamlabs | Automatically writes live track metadata (`{artist}`, `{title}`, `{album}`) to a local `.txt` file for OBS Text (GDI+) overlay sources. Optional clear-on-pause. |

---

## 📸 Screenshots & Live Preview

<p align="center">
  <img src="screenshots/StreamDeck.png" alt="Elgato Stream Deck Action Setup" width="800">
  <br>
  <em>Stream Deck Plugin Action Setup & Dynamic Key / Dial Configuration</em>
</p>

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
  - **Elgato Stream Deck +** (Physical Keys, Rotary Encoders & LCD Touchstrip)
  - **Corsair Galleon 100 SD** (Physical Keys & Rotary Encoders)
- **Software Tested**:
  - **Elgato Stream Deck Software**: `v7.5.1 (22901)` (Minimum required: `v6.5+`)
  - **Discord Windows Client**: `v1.0.9253 x64 (88414)` (Desktop Rich Presence)
  - **OBS Studio**: `v28+` (Text GDI+ stream overlays)
  - **Browsers**: Google Chrome (Official Web Player & PWA), Brave, Microsoft Edge *(Mozilla Firefox is supported via Manifest V3 Gecko compatibility, but currently untested)*.

---

## 🤝 Contributing & License

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/smok3y97/ytm-web-controller/issues).

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

Developed with ❤️ by **Smok3y97** for the YouTube Music & Stream Deck community.
