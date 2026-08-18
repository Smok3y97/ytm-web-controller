<a id="top"></a>

# OBS Studio & Chatbot Setup Guide (`docs/obs-setup.md`)

This guide explains how to display live YouTube Music track metadata in OBS Studio and connect Twitch/YouTube/Kick chat bots.

---

## 📑 Table of Contents
- [🎨 1. OBS Browser Source Overlay (`/overlay`)](#-1-obs-browser-source-overlay-overlay)
- [🤖 2. Chatbot Current Song Command (`!song`)](#-2-chatbot-current-song-command-song)
- [📄 3. Classic OBS Text File Export (.txt)](#-3-classic-obs-text-file-export-txt)
- [❓ Troubleshooting & Tips](#-troubleshooting--tips)

---

## [🎨 1. OBS Browser Source Overlay (`/overlay`)](#top)

Add an animated now-playing music widget directly to OBS Studio as a **Browser Source**. The overlay connects locally to the plugin WebSocket and updates in real-time with zero polling overhead.

### 🚀 Step-by-Step Setup in OBS Studio:
1. Open **OBS Studio**.
2. Under **Sources**, click **+** (Add) ➔ **Browser**.
3. Name the source (e.g. `YTM Overlay`).
4. Set the **URL**:
   ```text
   http://localhost:39865/overlay
   ```
5. Set the **Width** and **Height** according to your chosen theme:
   - **Card Theme (`theme=card`)**: Width `460`, Height `180`
   - **Compact Theme (`theme=compact`)**: Width `400`, Height `100`
   - **Pill Theme (`theme=pill`)**: Width `420`, Height `90`
6. Check **Shutdown source when not visible** (optional, saves GPU cycles).
7. Click **OK**.

<p align="center">
  <img src="../screenshots/OBS-Browser-Overlay.png" alt="OBS Browser Source Music Overlay" width="480">
  <br>
  <em>Interactive OBS Studio Browser Source Overlay (<code>card</code> theme)</em>
</p>

---

### 📜 URL Parameters Reference

Customize the appearance simply by appending query parameters to `http://localhost:39865/overlay`:

#### Layout & Themes
| Parameter | Values | Default | Description |
| :--- | :--- | :--- | :--- |
| `theme` | `card`, `compact`, `pill` | `card` | Widget layout style. |
| `showCover` | `true`, `false` | `true` | Display or hide album artwork thumbnail. |
| `showAlbum` | `true`, `false` | `false` | Display album name on Card theme (default: 2-line Title & Artist layout). |
| `showProgress` | `true`, `false` | `true` | Display or hide the track progress bar. |
| `timeMode` | `remaining`, `current`, `duration`, `both`, `none` | `remaining` | Time display format (`-1:45`, `2:10`, `3:55`, `2:10 / 3:55`, or hidden). |
| `hideOnPause` | `true`, `false` | `false` | Automatically hide widget when music is paused. |

#### Typography & Colors
| Parameter | Values / Format | Default | Description |
| :--- | :--- | :--- | :--- |
| `template` | String with placeholders | `{artist} - {title}` | Custom text template (`{title}`, `{artist}`, `{album}`). |
| `text` / `textColor` | HEX Code (e.g. `ffffff`, `000000`) | `#ffffff` | Primary title text color. |
| `subColor` | HEX Code (e.g. `b3b3b3`, `888888`) | `#b3b3b3` | Secondary artist, album, and time text color. |
| `marquee` / `scroll` | `true`, `false` | `true` | Ping-pong scrolling for long song titles. |

#### Glassmorphism & Backgrounds
| Parameter | Values / Format | Default | Description |
| :--- | :--- | :--- | :--- |
| `accent` | HEX Code (e.g. `00d26a`, `3b82f6`, `ff0033`) | `#ff0033` | Accent color for progress bar fill, glow, and icons. |
| `bg` | HEX Code (e.g. `121214`) or `transparent` | Dark Frosted | Background fill. Use `transparent` for zero-background overlays. |
| `bgOpacity` | Number (`0` to `1` or `0` to `100`) | `0.85` | Opacity level of the background card. |
| `radius` | Number in px (e.g. `0`, `8`, `16`, `50`) | Theme default | Corner rounding radius (`radius=0` for sharp corners). |
| `width` | Number in px (e.g. `320`, `360`, `420`) | Theme default | Custom fixed widget width override. |
| `height` | Number in px (e.g. `50`, `60`, `96`) | Theme default | Custom fixed widget height override. |
| `border` | HEX Code or `none` | Subtly translucent | Custom border color or `border=none`. |
| `shadow` | `true`, `false` | `true` | Toggle container drop shadow. |

---

### 🎨 1-Click Copy Ready Overlay Presets

Copy any of these ready-to-use URLs directly into your OBS Studio Browser Source:

#### 1. Default Setting (Dark Frosted Glass Card)
Standard YouTube Music red accent with live album art, time remaining, and frosted card background:
```text
http://localhost:39865/overlay
```

#### 2. Pure Floating Overlay (Zero Background over Gameplay)
Completely transparent card background without borders or shadows for floating seamlessly over gaming streams:
```text
http://localhost:39865/overlay?bg=transparent&border=none&shadow=false
```

#### 3. Compact Stream Edge Bar (Custom Accent & Auto-Hide on Pause)
Slim single-line banner for top/bottom stream edges with custom sapphire accent, 420px width, and automatic hiding when music is paused:
```text
http://localhost:39865/overlay?theme=compact&accent=3B82F6&width=420&radius=8&timeMode=current&hideOnPause=true
```

#### 4. Twitch Purple Floating Pill (Curved Stadium Badge)
Curved 50px rounded pill widget with official Twitch purple border, minimalist layout, and hidden time labels:
```text
http://localhost:39865/overlay?theme=pill&accent=9146FF&border=9146FF&radius=50&timeMode=none
```

---

## [🤖 2. Chatbot Current Song Command (`!song`)](#top)

> [!IMPORTANT]
> **Local System Requirement (Zero Telemetry & Maximum Security)**:
> Because the endpoint `http://localhost:39865/api/current` runs strictly on your local PC via the Stream Deck plugin (ensuring complete privacy, zero telemetry, and zero latency), **your chatbot client MUST run locally on the same computer** (such as **Streamer.bot**, **MixItUp**, or **Fossabot Desktop**).
>
> Remote cloud-hosted bot web dashboards (such as cloud Nightbot or Streamlabs Cloudbot) **cannot reach your local `localhost` / `127.0.0.1` address**.

Let viewers query what song is currently playing via a simple read-only HTTP GET request (`http://localhost:39865/api/current`).

### 📝 Format Placeholders
Custom format with `?format=...`:
- `{title}`: Track title (e.g. `Never Gonna Give You Up`)
- `{artist}`: Performing artist (e.g. `Rick Astley`)
- `{album}`: Album or single name
- `{url}`: Direct YouTube Music link
- `{duration}`: Total track duration (e.g. `3:33`)
- `{currentTime}`: Elapsed time (e.g. `1:20`)

### 🤖 Local Bot Setup Guide:

#### 1. Streamer.bot (Recommended - Local Native Bot)
1. Open **Streamer.bot** on your streaming PC.
2. In **Actions**, click **Add** (Name: `Get Current Song`).
3. Add Sub-Action: **Core ➔ Network ➔ Fetch URL**:
   - URL: `http://localhost:39865/api/current?format=Now playing: {title} by {artist} ({url})`
   - Variable: `currentSong`
4. Add Sub-Action: **Twitch (or YouTube) ➔ Send Message**:
   - Message: `%currentSong%`
5. In **Commands**, add command `!song` and link it to the `Get Current Song` action.

#### 2. MixItUp Bot (Local Native Bot)
1. In MixItUp, add a new Chat Command: `!song`.
2. Add Action: **Web Request**:
   - Request Type: `GET`
   - URL: `http://localhost:39865/api/current?format=Now playing: {title} by {artist} | {url}`
   - Save Response To: `$songInfo`
3. Add Action: **Chat Message** ➔ Send: `$songInfo`.

---

## [📄 3. Classic OBS Text File Export (.txt)](#top)

For setups using native OBS **Text (GDI+)** or FreeType 2 sources:

1. In Stream Deck Property Inspector for any YouTube Music action, expand **OBS Overlay & Chatbot**.
2. Check **Enable OBS text export (.txt)** (Opt-in).
3. *(Optional)* Set a custom **File Path** (e.g. `C:\Stream\now_playing.txt`) or leave it blank to use `ytm_current_track.txt` inside the plugin directory.
4. *(Optional)* Customize the **Format** template (Default: `Currently Playing: {artist} - {title}`).
5. In OBS Studio:
   - Add a **Text (GDI+)** source.
   - Check **Read from file**.
   - Browse and select your configured text file path.

---

## [❓ Troubleshooting & Tips](#top)

* **Overlay appears blank or not updating**:
  - Ensure the browser extension is connected and YouTube Music is playing.
  - Right-click the Browser Source in OBS and select **Refresh**.
* **Changed the Server Port?**:
  - If you change the port to `40000` in Stream Deck settings, update your Browser Source URL (`http://localhost:40000/overlay`) and chatbot command accordingly.
