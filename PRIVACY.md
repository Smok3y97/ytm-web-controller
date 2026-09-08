# Privacy Policy (`PRIVACY.md`)

**Last updated:** September 8, 2026

This Privacy Policy applies to the **Controller for YouTube Music Web** Elgato Stream Deck plugin and companion browser extension (**Controller Companion for YouTube Music Web**).

---

## 🔒 1. Single Purpose & Core Principles

The single purpose of this extension and plugin is to bridge playback controls and metadata between your active [YouTube Music](https://music.youtube.com) web player and your local [Elgato Stream Deck](https://www.elgato.com/stream-deck) hardware (including Dials, LCD Touchstrips, and keypad actions).

I believe in strict privacy by design:
- **Zero External Data Collection**: I do not collect, log, track, sell, or transmit any user data, personal information, listening habits, or telemetry to any external servers or third-party tracking services.
- **Local-First Architecture**: All communication occurs strictly over local loopback connections (`127.0.0.1`) on your own computer.
- **Zero Disk Footprint**: Cover thumbnails and LCD canvases are processed strictly in memory (RAM).

---

## 🛡️ 2. Information Handled

### A. Playback Metadata (Processed Locally Only)
When you play audio on `music.youtube.com`, the companion extension reads:
- Track title, artist, album name, duration, and playback position
- Player state (play/pause, volume level, mute, repeat mode, shuffle, like/dislike rating)
- Album art image URL (to render thumbnails onto your Stream Deck keys and dials)

**This data never leaves your computer.** It is transmitted directly across your local WebSocket connection (`127.0.0.1:39865`) to your locally running Stream Deck plugin.

### B. Account & Credentials
The extension and plugin **never access, read, or handle** your Google account credentials, passwords, billing information, payment details, or personal emails.

---

## 🔑 3. Extension Permissions Rationale

The browser companion extension requests the minimum necessary permissions in [`extension/manifest.json`](extension/manifest.json):

| Permission | Technical Reason |
| :--- | :--- |
| `storage` | Stores your customized local WebSocket port (default `39865`) within Chrome's local storage so settings persist across browser restarts. |
| `tabs` | Used solely to bring the existing YouTube Music tab to the foreground when you press and hold the Play/Pause key on your Stream Deck. |
| `host_permissions` (`https://music.youtube.com/*`) | Required to inject the content script into the YouTube Music web player to receive playback events and send control commands. |
| `host_permissions` (`https://*.googleusercontent.com/*`, `*.ggpht.com/*`, `*.ytimg.com/*`) | Required to fetch album artwork thumbnails into an in-memory canvas for your Stream Deck keys. |

---

## 🌐 4. Third-Party Integrations (Opt-In Only)

- **Discord Rich Presence (RPC)**:
  If explicitly enabled by the user in Stream Deck settings, the plugin connects locally to the Discord desktop client via local IPC socket to display your current song status. No data is sent to external Discord API endpoints.
- **OBS Studio Overlay & Text Export**:
  If explicitly configured by the streamer, the plugin serves a local HTTP overlay at `http://127.0.0.1:39865/overlay` and writes live track info to a local text file chosen by the user.

---

## 📜 5. Trademark Notice

YouTube Music is a trademark of Google LLC. This project is an independent open-source tool developed by Smok3y97 and is not affiliated with, sponsored, or endorsed by Google LLC.

---

## 📬 6. Contact & Questions

If you have questions about this Privacy Policy or security practices, please open an issue or security advisory on GitHub:  
[https://github.com/Smok3y97/ytm-web-controller](https://github.com/Smok3y97/ytm-web-controller)
