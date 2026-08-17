# OBS Studio Overlay & Chatbot Setup Guide (`docs/obs-setup.md`)

This guide explains how to integrate live YouTube Music track metadata into your OBS Studio stream setup. The plugin offers three integration methods:

| Method | Best For | Features |
| :--- | :--- | :--- |
| **Method 1: Browser Source Overlay** *(Recommended)* | Modern, dynamic animated stream widgets | Live album art, ping-pong title scroll, animated progress bar, themes, HEX colors, and transparency. |
| **Method 2: Chatbot Metadata API (`/api/current`)** | Twitch/YouTube chat commands (`!song`) | Instant plaintext HTTP endpoint, customizable placeholders, zero bot latency. |
| **Method 3: Chatbot Song Requests (`/api/playnext`)** | Viewer song requests & Twitch Channel Points | Non-interruptive queueing, blacklist protection, custom feedback templates, and Stream Deck toggle. |
| **Method 4: Text File Export (`.txt`)** | Classic GDI+ text sources & marquee filters | File-based output for native OBS Text sources. |

---

## 🎨 Method 1: Interactive OBS Browser Overlay

The plugin hosts a lightweight, zero-dependency HTML5/CSS3 widget served directly on port `39865` (or your configured port) and synchronised via local WebSockets:

```
┌────────────────────────┐    Real-Time WebSocket    ┌────────────────────────┐
│   Stream Deck Plugin   │ ────────────────────────► │   OBS Browser Source   │
│  (Port 39865 HTTP/WS)  │     live state events     │  (Album Art + Marquee) │
└────────────────────────┘                           └────────────────────────┘
```

### 🚀 Step-by-Step Setup in OBS Studio:
1. Open **OBS Studio**.
2. Under **Sources**, click **+** (Add) ➔ **Browser**.
3. Name the source (e.g., `YTM Overlay` or `Now Playing Widget`).
4. Set the **URL**:
   ```text
   http://localhost:39865/overlay
   ```
5. Set the **Width** and **Height** according to your chosen theme (includes safety margins for shadows and padding):
   - **Card Theme (`theme=card`)**: Width `400`, Height `130` (Widget: `360px`)
   - **Compact Theme (`theme=compact`)**: Width `360`, Height `75` (Widget: `320px`)
   - **Pill Theme (`theme=pill`)**: Width `380`, Height `65` (Widget: `340px`)
6. Check **Shutdown source when not visible** (optional, saves GPU cycles when hidden).
7. Click **OK**.

---

### 📜 Complete URL Parameters Reference

Customize the widget simply by appending search parameters to the Browser Source URL:

#### 1. Layout & Theme
| Parameter | Values | Default | Description |
| :--- | :--- | :--- | :--- |
| `theme` | `card`, `compact`, `pill` | `card` | Widget layout style. |
| `showCover` | `true`, `false` | `true` | Display or hide the album cover thumbnail. |
| `showProgress` | `true`, `false` | `true` | Display or hide the track progress bar. |
| `timeMode` | `remaining`, `current`, `duration`, `both`, `none` | `remaining` | Time display mode (`-1:45`, `2:10`, `3:55`, `2:10 / 3:55`, or hidden). |
| `hideOnPause` | `true`, `false` | `false` | Automatically hide widget when music is paused. |

#### 2. Typography & Custom Titles
| Parameter | Values | Default | Description |
| :--- | :--- | :--- | :--- |
| `template` | Placeholders string | `{artist} - {title}` | Custom formatting. Supported placeholders: `{title}`, `{artist}`, `{album}`, `{duration}`, `{currentTime}`. |
| `text` / `textColor` | HEX Code (e.g. `ffffff`, `000000`) | `#ffffff` | Primary song title text color. |
| `subColor` | HEX Code (e.g. `b3b3b3`, `888888`) | `#b3b3b3` | Secondary artist, album, and time text color. |

#### 3. Marquee Auto-Scroll (Ping-Pong Animation)
| Parameter | Values | Default | Description |
| :--- | :--- | :--- | :--- |
| `marquee` / `scroll` | `true`, `false` | `true` | When enabled, song titles or artist names that exceed container width automatically scroll back and forth (Ping-Pong). |

> [!TIP]
> **How Marquee Works**: When a title is too long (e.g., `You're Not Done (Lyr. Angelique Lourens)`), the overlay pauses at the start for ~2 seconds, smoothly scrolls across at ~22px/s, pauses at the end for ~2 seconds, and scrolls back. Edge gradient masking ensures text never cuts off abruptly against the container border.

#### 4. Color, Glassmorphism & Background Styling
| Parameter | Values / Format | Default | Description |
| :--- | :--- | :--- | :--- |
| `accent` | HEX Code (e.g. `00d26a`, `3b82f6`, `ff0033`) | `#ff0033` | Accent color for progress bar fill, glow, and icons. |
| `bg` | HEX Code (e.g. `121214`, `000000`) or `transparent` / `none` | Dark Frosted | Background fill. Use `transparent` for pure zero-background overlays. |
| `bgOpacity` | Number (`0` to `1` or `0` to `100`) | `0.88` | Opacity level of the background. |
| `radius` | Number in px (e.g. `0`, `8`, `16`, `50`) | Theme default | Corner rounding radius. Use `radius=0` for sharp rectangular corners. |
| `width` | Number in px (e.g. `300`, `380`, `450`) | Theme default | Custom fixed widget width override. |
| `border` | HEX Code or `none` / `false` / `0` | Subtly translucent | Custom border color, or `border=none` to remove the border completely. |
| `shadow` | `true`, `false` / `none` | `true` | Enable or disable the container drop shadow. |
| `blur` | Pixel value (e.g. `0`, `8px`, `20px`) or `none` | `16px` | Backdrop filter glassmorphism blur intensity. |
| `port` | Number | `39865` | Stream Deck WebSocket port (defaults to current server port). |

---

### 🎨 Visual Theme & Style Examples

Here is a collection of ready-to-use URLs for various stream aesthetics:

#### 1. Classic Dark Glass Card (Default)
Standard card with dark frosted glass background and YouTube Music red accents:
```text
http://localhost:39865/overlay
```

#### 2. Pure Transparent Floating Overlay (Zero Background)
Text, cover art, and progress bar float seamlessly over your gameplay or stream background without any boxes or shadows:
```text
http://localhost:39865/overlay?bg=transparent&border=none&shadow=none
```

#### 3. Emerald Green Cyberpunk Theme
Vibrant green progress bar and glow on sleek obsidian black card:
```text
http://localhost:39865/overlay?accent=00d26a&bg=0a0a0c&border=00d26a
```

#### 4. Twitch / Sapphire Blue Pill
Minimalist rounded floating pill with electric blue progress and time hidden:
```text
http://localhost:39865/overlay?theme=pill&accent=3b82f6&timeMode=none
```

#### 5. Streamer Sunset / Pastel Pink Theme
Soft pastel aesthetic with pink accents and curved border:
```text
http://localhost:39865/overlay?accent=ff66cc&bg=18101a&radius=18&border=ff66cc
```

#### 6. Minimal Top-Bar Banner (Compact Header)
Ultra-compact single-line layout ideal for stream headers or screen edges:
```text
http://localhost:39865/overlay?theme=compact&accent=ff7700&timeMode=current
```

#### 7. Sharp Modern (Zero Radius, No Blur)
Flat geometric aesthetic with square corners and no glass blur:
```text
http://localhost:39865/overlay?radius=0&blur=none&bg=111111&border=333333
```

#### 8. Cover Art & Title Only (No Progress Bar)
Clean, distraction-free display showing only album art, title, and artist:
```text
http://localhost:39865/overlay?showProgress=false
```

---

## 🤖 Method 2: Chatbot Song Request Commands (`!song`)

Let viewers check what song is currently playing in your Twitch, YouTube, or Kick chat via Nightbot, Streamer.bot, Streamlabs Cloudbot, MixItUp, or Fossabot.

```
┌──────────────┐   Chat Command   ┌──────────────┐   HTTP GET /api/current   ┌────────────────────┐
│ Stream Viewers│ ──────────────► │  Stream Bot  │ ────────────────────────► │ Stream Deck Server │
│   (!song)    │ ◄────────────── │ (Nightbot...)│ ◄──────────────────────── │  (Port 39865 API)  │
└──────────────┘   Replies Track  └──────────────┘      Formatted Text       └────────────────────┘
```

---

### 📝 Placeholders & Aliases Table

You can construct any response format using the `?format=...` query parameter:

| Placeholder | Supported Aliases | Description | Example Value |
| :--- | :--- | :--- | :--- |
| **`{title}`** | `{song}`, `{track}`, `{titel}` | Song title | `You're Not Done` |
| **`{artist}`** | `{channel}`, `{author}`, `{interpret}`, `{künstler}` | Performing artist(s) | `DJ Johnny SA` |
| **`{album}`** | — | Album / single name | `You're Not Done` |
| **`{url}`** | `{link}`, `{trackUrl}`, `{songUrl}` | Direct YouTube Music track link | `https://music.youtube.com/watch?v=dQw4w9WgXcQ` |
| **`{duration}`** | `{total}`, `{totalTime}`, `{length}` | Formatted total track length | `3:45` |
| **`{currentTime}`** | `{current}`, `{time}`, `{elapsed}` | Current playback position | `1:20` |

> [!NOTE]
> If YouTube Music is idle, closed, or paused without active media, the API cleanly returns: `"No music playing"`.

---

### 🤖 Bot-by-Bot Setup Guide:

#### 1. Nightbot (Twitch / YouTube / Kick)
Enter this command directly in your Twitch/YouTube chat as broadcaster or moderator:

* **Standard (Artist + Title + Direct Link)**:
  ```text
  !addcom !song $(urlfetch http://localhost:39865/api/current?format=🎶 Now playing: {title} by {artist} | Link: {url})
  ```
  *Chat Output:* `🎶 Now playing: You're Not Done by DJ Johnny SA | Link: https://music.youtube.com/watch?v=...`

* **Compact (Artist - Title)**:
  ```text
  !addcom !song $(urlfetch http://localhost:39865/api/current)
  ```
  *Chat Output:* `DJ Johnny SA - You're Not Done`

* **Detailed with Time Progress & Link**:
  ```text
  !addcom !song $(urlfetch http://localhost:39865/api/current?format=🎵 Current Track: "{title}" by {artist} [{currentTime}/{duration}] ➔ {url})
  ```

---

#### 2. Streamer.bot (Twitch / YouTube)
1. In Streamer.bot, go to **Actions** ➔ Right-click ➔ **Add** (Name: `Get Current Song`).
2. In Sub-Actions, right-click ➔ **Core** ➔ **Network** ➔ **Fetch URL**.
   - **URL**: `http://localhost:39865/api/current?format=Now playing: {title} by {artist} ({url})`
   - **Variable Name**: `currentSong`
3. Add Sub-Action ➔ **Twitch** (or YouTube) ➔ **Send Message**:
   - **Message**: `%currentSong%`
4. Go to **Commands** ➔ Add `!song` and link it to the `Get Current Song` action.

---

#### 3. Streamlabs Cloudbot
In your Streamlabs Dashboard under **Cloudbot** ➔ **Commands** ➔ **Add Command**:
* **Command**: `!song`
* **Response**:
  ```text
  {readapi.http://localhost:39865/api/current?format=🎶 {title} by {artist} ({url})}
  ```

---

#### 4. MixItUp Bot
1. In MixItUp, go to **Commands** ➔ **Add Command** (Chat Command `!song`).
2. Add an Action: **Web Request**.
   - **Type**: `GET`
   - **URL**: `http://localhost:39865/api/current?format=Now playing: {title} by {artist} | {url}`
   - **Response Variable**: `songInfo`
3. Add an Action: **Chat Message**.
   - **Message**: `$songInfo`

---

#### 5. Fossabot
In your Fossabot dashboard under **Commands** ➔ **Custom Commands**:
* **Command**: `!song`
* **Response**:
  ```text
  $(customapi http://localhost:39865/api/current?format={artist} - {title} ({url}))
  ```

---

## 🎶 Method 3: Chatbot Song Requests & Queueing (`!playnext` / `!queue`)

Viewers can queue songs directly into your active YouTube Music session via chat command or Twitch Channel Points.

```
┌──────────────┐   !playnext <url>   ┌──────────────┐   GET /api/playnext?url=...   ┌────────────────────┐   WebSocket   ┌────────────────────┐
│ Stream Viewers│ ─────────────────► │  Nightbot /  │ ────────────────────────────► │ Stream Deck Server │ ────────────► │ Browser Extension  │
│              │ ◄───────────────── │ Streamer.bot │ ◄──────────────────────────── │  (Port 39865)      │ (queueTrack)  │ (YouTube Music Web)│
└──────────────┘    "Added to queue" └──────────────┘       Formatted Response      └────────────────────┘               └────────────────────┘
```

### 1. Bot Command Setup:

* **Nightbot (`!playnext <link>`)**:
  ```text
  !addcom !playnext $(urlfetch http://localhost:39865/api/playnext?url=$(querystring))
  ```

* **Streamer.bot (Twitch Channel Points Reward)**:
  1. Add Sub-Action ➔ **Core** ➔ **Network** ➔ **Fetch URL**.
     - **URL**: `http://localhost:39865/api/playnext?url=%rawInput%`
     - **Variable**: `queueResponse`
  2. Add Sub-Action ➔ **Twitch** ➔ **Send Message**:
     - **Message**: `%queueResponse%`

* **Nightbot with Custom Response**:
  ```text
  !addcom !playnext $(urlfetch http://localhost:39865/api/playnext?url=$(querystring)&format=🎶 Song request added: {url})
  ```

---

### 2. Supported Link Formats:
The endpoint automatically extracts and validates the 11-character video ID from:
- `https://music.youtube.com/watch?v=VIDEO_ID`
- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/shorts/VIDEO_ID`
- Raw 11-character Video ID (`dQw4w9WgXcQ`)

---

### 3. Customizable Feedback Templates:
In the Property Inspector under **Streamer Settings**, you can customize all response messages:

| Template | Default String | Description | Placeholders |
| :--- | :--- | :--- | :--- |
| **Success Message** | `Added to queue: {url} 🎶` | Returned when song is successfully queued. | `{url}`, `{videoId}`, `{mode}` |
| **Paused Message** | `Song requests are currently paused by the streamer.` | Returned when streamer has toggled requests off. | — |
| **Error Message** | `Invalid YouTube link or video ID.` | Returned when link/ID cannot be parsed. | — |
| **Blocked Message** | `This song is blocked from requests 🚫` | Returned when a viewer requests a blacklisted track. | — |

---

### 4. Song Blacklist / Banned IDs:
Exclude specific troll songs, copyright tracks, or meme videos from chat requests:
- In the Property Inspector under **Streamer Settings**, enter banned video IDs or URLs separated by commas in **Song Blacklist**:
  ```text
  dQw4w9WgXcQ, https://youtu.be/...
  ```
- When a viewer attempts to request any blacklisted song, the bot immediately rejects the request with the **Blocked Message**.

---

### 5. Stream Deck Key: "Toggle Song Requests"
Add the **Toggle Song Requests** action to your Stream Deck keypad:
- **State 0 (Requests ON)**: Green badge (`Requests ON`) — viewers can queue songs.
- **State 1 (Requests OFF)**: Red badge (`Requests OFF`) — requests are paused instantly without needing to delete or disable bot commands.

---

## 📄 Method 4: Classic OBS Text File Export (.txt)

For setups that require native OBS GDI+ or FreeType 2 text sources:

```
┌────────────────────────┐      Writes .txt       ┌────────────────────────┐      GDI+ Source      ┌────────────────────────┐
│   Stream Deck Plugin   │ ─────────────────────► │  ytm_current_track.txt │ ────────────────────► │       OBS Studio       │
│  (obs-exporter.ts)     │     on track change    │     (Local File)       │    auto-refreshed     │     (Stream Overlay)   │
└────────────────────────┘                        └────────────────────────┘                       └────────────────────────┘
```

### Setup Steps:
1. Open the Stream Deck application and click on any **YouTube Music** key.
2. In the Property Inspector on the right, expand the **Streamer Settings** accordion.
3. Check **Enable OBS text export (.txt)**.
4. Set your export destination file path (e.g. `C:\Users\username\Documents\ytm_current_track.txt`).
5. (Optional) Customize the template (e.g. `🎵 Now Playing: {artist} - {title}`).
6. In OBS Studio:
   - Add a **Text (GDI+)** source.
   - Check **Read from file**.
   - Browse and select your `.txt` file path.
   - Adjust fonts, colors, and outlines as desired.

---

## ❓ Troubleshooting & Tips

* **Overlay appears blank or not updating**:
  - Ensure the browser extension is connected (green badge) and YouTube Music is playing.
  - Right-click the Browser Source in OBS and select **Refresh** (or **Interact** ➔ reload).
* **Changed the WebSocket Port?**:
  - If you change `wsPort` in the Property Inspector (e.g., to `40000`), update your Browser Source URL to match (`http://localhost:40000/overlay`).
* **Overlay cutting off on the side**:
  - Increase the Width of your Browser Source in OBS (e.g., set Width to `420` or `460`).
