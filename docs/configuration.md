<a id="top"></a>

# Configuration & Customization Guide (`docs/configuration.md`)

This guide provides a comprehensive walkthrough of all user-facing configuration options and hardware interactions available in the Stream Deck Property Inspector.

---

## 📑 Table of Contents
- [🌐 1. Global Plugin Integrations (Plugin-Wide)](#-1-global-plugin-integrations-plugin-wide)
- [🎛️ 2. Stream Deck + Dials & LCD Customization](#-2-stream-deck--dials--lcd-customization)
- [🔘 3. Keypad Action Customization](#-3-keypad-action-customization)

---

## [🌐 1. Global Plugin Integrations (Plugin-Wide)](#top)

Global settings are accessible in the Property Inspector of **every single button and dial**. Modifying any of these options auto-saves and applies plugin-wide across all actions.

### 🎮 Discord Rich Presence (RPC)
- **Enable Discord Rich Presence (RPC)**: Direct toggle checkbox at the top of the Property Inspector. When checked, the plugin connects to your local Discord desktop client via local IPC socket and broadcasts your currently playing track in real-time.
- **Features**: Live album artwork thumbnail, animated timeline progress bar, and clickable track/artist profile buttons (interactive action buttons are rendered on the Discord Desktop client; status and timeline display across both Desktop and Mobile apps).

### 🎥 OBS Overlay & Chatbot Integrations
- **OBS Browser Overlay URL** (`http://localhost:39865/overlay`):
  - Direct one-click copy helper field for adding an animated, responsive music widget to OBS Studio as a **Browser Source**.
  - Supports comprehensive visual customization: `?theme=card|compact|pill`, `?accent=hex`, `?bg=hex|transparent`, `?bgOpacity=0..1`, `?text=hex`, `?subColor=hex`, `?radius=px`, `?border=hex|none`, `?shadow=none`, `?width=px`, `?timeMode=remaining|current|duration|both|none`, `?hideOnPause=true`.
- **Chatbot API URL** (`http://localhost:39865/api/current`):
  - Direct one-click copy helper field for local chat bots via Streamer.bot, MixItUp, or custom scripts (`!song`).
  - Supports custom format strings via `?format=...` with placeholders `{artist}`, `{title}`, `{album}`, `{url}`, `{duration}`, `{currentTime}`.
- **OBS Text File Export (.txt)**:
  - **Enable OBS text export (.txt)**: Automatically writes metadata of the currently playing track to a local text file for streaming overlays using OBS Text (GDI+).
  - **Text File (Required)**: Select your destination `.txt` file on your system using the **Browse...** button. When OBS text export is enabled, choosing a target text file is strictly required.
  - **Format Template**: Fully customizable string with placeholders `{artist}`, `{title}`, `{album}` (Default: `Currently Playing: {artist} - {title}`).
  - **Clear file on pause/stop**: When enabled (default), empties the text file whenever music is paused or stopped. Disabling OBS export also clears the file cleanly.

### 🔌 Advanced / Connection Settings
- **WebSocket Port** (Default: `39865`):
  - The local WebSocket server port used for communication between the browser extension and the Stream Deck plugin.
  - If port `39865` conflicts with other software on your PC, change it here and enter the matching port in the browser extension popup.
  - The plugin automatically rebinds the socket on-the-fly without requiring a restart of the Stream Deck software.
- **Discord Client ID (Application ID)** (Default: `1537908230209019954`):
  - The unique Application ID registered on the [Discord Developer Portal](https://discord.com/developers/applications) that defines the RPC profile name and branding (e.g. "Playing YouTube Music").
  - **Default Application ID**: Uses the pre-configured project app with official YouTube Music assets.
  - **Custom Application ID**: If you want your Discord profile to display a custom name, custom icons, or your own branding, create a Discord Application in the Developer Portal and enter your custom Client ID here. Leave blank to revert to the default.

---

## [🎛️ 2. Stream Deck + Dials & LCD Customization](#top)

### Track Controller (Dial)
- **Controls & Interactions**:
  - 🔄 **Rotate Clockwise**: Skip to next track in queue.
  - 🔄 **Rotate Counter-Clockwise**: Skip to previous track or restart current track.
  - 🔘 **Push Dial**: Toggle Play / Pause (protected by 250ms push-jitter suppression).
  - 👆 **Touchstrip Tap**: Toggle Play / Pause.
- **Title Template**: Format string for LCD song banner (Default: `{artist} - {title}`). Automatically uses Ping-Pong marquee bounce scrolling if text exceeds LCD width (198px).
- **Time Template**: Format string for LCD duration indicator (Default: `{remaining}`). Supports `{current}`, `{duration}`, and `{remaining}`.
- **Show Cover**: Toggles the 35×35 px album thumbnail on the left side of the LCD touchstrip.

### Volume Controller (Dial)
- **Controls & Interactions**:
  - 🔄 **Rotate Clockwise**: Increase volume (+Step Size).
  - 🔄 **Rotate Counter-Clockwise**: Decrease volume (-Step Size).
  - 🔘 **Push Dial**: Toggle Mute / Unmute.
  - 👆 **Touchstrip Tap**: Toggle Mute / Unmute.
- **Step Size (%)**: Adjust volume step per dial tick from **1% to 50%** (configured via range slider in 5% increments, Default: `5%`).
- **Show Cover**: Toggles the album cover thumbnail on the touchstrip.
- **LCD Feedback**: Displays real-time graphical volume bar, percentage readout (`100%`, `MUTED`), and cover artwork.

### Seek Controller (Dial)
- **Controls & Interactions**:
  - 🔄 **Rotate Clockwise**: Seek / scrub forward (+Seek Step).
  - 🔄 **Rotate Counter-Clockwise**: Seek / scrub backward (-Seek Step).
  - 🔘 **Push Dial**: Toggle Play / Pause.
  - 👆 **Touchstrip Tap**: Toggle Play / Pause.
- **Seek Step (s)**: Scrubbing duration per dial tick from **1s to 120s** (configured via range slider in 5s increments, Default: `10s`).
- **Title & Time Templates**: Configurable text templates for LCD readouts (`{current} / {duration}`, `{remaining}`, `{current}`).
- **Show Cover**: Toggles album art thumbnail on the LCD strip.

---

## [🔘 3. Keypad Action Customization](#top)

### Play / Pause
- **Controls & Interactions**:
  - 🔘 **Short Press**: Toggle Play / Pause state.
  - ⏳ **Long Press (Hold ~450ms)**: Bring the YouTube Music browser tab or PWA window directly to the foreground and focus it.
- **Album cover as button background**: When enabled, renders the high-resolution album cover art directly as the key background in memory (RAM). When disabled, uses official vector Play/Pause states.

### Copy Song URL
- **Copy Format**: Custom template copied to your clipboard on key press (Default: `{url}`).
- **Supported Placeholders**: `{url}`, `{title}`, `{artist}`, `{album}`, `{duration}`, `{currentTime}`.
- **Examples**:
  - `{url}` (Standard song link)
  - `{artist} - {title} ({url})` (Formatted track info with link)
  - `Now Playing: {artist} - {title}` (Formatted text for chat or social sharing)
- **Visual Feedback**: Green checkmark icon temporarily confirms successful copy directly on the key.

### Volume Up & Volume Down
- **Step Size (%)**: Percentage volume adjustment per keypress (**1% to 50%**, configured via range slider in 5% increments, Default: `5%`).
- **Show volume text on key**: Toggles real-time volume percentage readout directly on the key.
- **Text Format**: Template for volume text (`{volume}%`, `Vol {volume}%`).
- **Native Title Styler ("T")**: Use Stream Deck's native **"T" (Title Styler)** button above the Property Inspector to customize font family, text size, color, and vertical alignment (Top, Middle, Bottom).
