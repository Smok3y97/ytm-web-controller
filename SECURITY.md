# Security Policy

## Supported Versions

Security fixes and maintenance updates are actively applied to the latest release of YouTube Music Web Controller.

| Version | Supported          |
| :--- | :--- |
| Latest Release (v1.x) | :white_check_mark: |
| Older Versions (< v1.11.0.0) | :x: |

---

## 🛡️ Security Architecture & Privacy Guarantee

YouTube Music Web Controller is designed with a strict **local-first and privacy-conscious** architecture:

- **Local Loopback Only**: The WebSocket bridge between the Browser Extension and Stream Deck plugin listens strictly on `127.0.0.1:39865` (localhost). It does not bind to external interfaces or expose any ports across local networks or the internet.
- **Zero External Telemetry**: The plugin and extension do not collect, track, or transmit any user activity, telemetry, passwords, Google account credentials, or listening habits.
- **No Third-Party Cloud Dependencies**: All playback events and metadata flow directly between your local browser tab and your local Stream Deck device.
- **In-Memory Rendering**: Dynamic cover artwork, dial thumbnails, and LCD layouts are generated in-memory (RAM) with zero disk caching.

---

## 🚨 Reporting a Vulnerability

Security and privacy are taken very seriously in this project. If you discover a security vulnerability, potential privilege escalation, or unauthorized data exposure:

1. **Do NOT open a public GitHub issue.**
2. Please report the issue privately using **[GitHub Private Vulnerability Reporting](https://github.com/Smok3y97/ytm-web-controller/security/advisories/new)** (Security tab ➔ Report a vulnerability).
3. Provide a clear explanation of the issue, including:
   - Steps to reproduce or proof-of-concept code.
   - Affected components (Browser extension, WebSocket server, Stream Deck plugin, or Windows focus helper).
   - Impact assessment.

### What to Expect:
- **Review**: As an independent, single-maintainer open-source project, reports will be reviewed on a best-effort basis as time permits.
- **Resolution**: Valid issues will be investigated and addressed in an upcoming release.
- **Attribution**: Once resolved, credit and appreciation will be given in the release notes (unless requested otherwise).
