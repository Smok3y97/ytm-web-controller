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
  - Prevents USB bus flooding on Stream Deck +

---

## 📦 Installation & Setup

1. **Stream Deck Plugin**: Download `com.smok3y97.ytmusicweb.streamDeckPlugin` below and double-click to install.
2. **Browser Companion Extension**: Download `extension.zip`, extract it, and load it as an unpacked extension in your Chromium browser (`chrome://extensions` with Developer Mode enabled).

**Full Changelog**: https://github.com/smok3y97/ytm-web-controller/compare/v2.0.2.0...v2.1.0.0
