# OBS Studio Overlay Setup Guide (`docs/obs-setup.md`)

This guide explains how to display live YouTube Music track metadata in OBS Studio stream overlays using the **Streamer Settings (OBS Text Export)** feature.

---

## 📋 Overview

The Stream Deck plugin automatically writes currently playing track information to a local text file (`.txt`) whenever a song changes, plays, or pauses. OBS Studio reads this file in real-time via a standard **Text (GDI+)** source.

```
┌────────────────────────┐      Writes .txt       ┌────────────────────────┐      GDI+ Source      ┌────────────────────────┐
│   Stream Deck Plugin   │ ─────────────────────► │  ytm_current_track.txt │ ────────────────────► │       OBS Studio       │
│  (obs-exporter.ts)     │     on track change    │     (Local File)       │    auto-refreshed     │     (Stream Overlay)   │
└────────────────────────┘                        └────────────────────────┘                       └────────────────────────┘
```

---

## ⚙️ Step-by-Step Configuration

### Step 1: Configure the Stream Deck Plugin
1. In the Elgato Stream Deck software, click on any **YouTube Music** key or dial to open the Property Inspector.
2. Expand the **Streamer Settings** accordion.
3. Check the **Enable OBS text export (.txt)** checkbox.
4. Enter an absolute target file path on your computer (e.g. `C:\Users\YourUsername\Documents\ytm_current_track.txt`). The directory will be created automatically if it does not exist.
5. (Optional) Customize the **Format Template** using placeholders:
   - `{artist}`: Current track artist(s)
   - `{title}`: Current track title
   - `{album}`: Current album name
   - *Example:* `Currently Playing: {artist} - {title}`
6. (Optional) Toggle **Clear file on pause/stop** (enabled by default) to automatically empty the text file when playback is paused.

---

### Step 2: Add the Text Source in OBS Studio
1. Open **OBS Studio**.
2. In your active Scene, click the **+** (Add) button under **Sources**.
3. Select **Text (GDI+)** on Windows (or **Text (FreeType 2)** on macOS/Linux).
4. Name the source (e.g. `Current Track`).
5. Check the **Read from file** checkbox.
6. Click **Browse** and select the `.txt` file path configured in Step 1.
7. Customize your typography:
   - **Font & Size**: Choose a modern, legible font (e.g. Roboto, Montserrat, Inter).
   - **Color & Gradients**: Match your stream overlay theme.
   - **Outline & Drop Shadow**: Add a subtle dark outline for maximum readability over varied video content.
   - **Alignment**: Set horizontal and vertical text alignment.
8. Click **OK**.

---

## 💡 Pro-Tips for Streamers

- **Scrolling Ticker**: In OBS Studio, right-click your Text Source ➔ **Filters** ➔ click **+** ➔ select **Scroll** to create an animated marquee banner for long song titles.
- **Scene Transitions**: If you stream games with full-screen capture, placing the track text source in a nested overlay scene keeps your stream layout modular and clean.
