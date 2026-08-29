## 📝 Description

Please provide a clear and concise summary of the changes introduced in this pull request and the motivation behind them.

Fixes #(issue) <!-- Replace with issue number if applicable -->

---

## 🔍 Type of Change

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 🎨 Code style / Refactoring (formatting, rename, architectural cleanup)
- [ ] 📚 Documentation update
- [ ] ⚙️ CI/CD / Build tooling update

---

## 🏛️ Architectural Compliance Checklist

- [ ] **Zero DOM Polling**: Extension changes dispatch state exclusively on `<video>` events and targeted `MutationObserver` callbacks.
- [ ] **Zero Disk Footprint**: Cover artwork and canvas layouts are generated purely in memory (Base64 data URLs).
- [ ] **10 Hz Rate Limit**: Stream Deck hardware programmatic updates do not exceed 10 updates per second.
- [ ] **Property Inspector Auto-Save**: All Property Inspector settings save automatically on input change (`setSettings` / `setGlobalSettings`) with no manual save buttons.
- [ ] **i18n & Localization**: UI strings and keys are maintained in `plugin/en.json` (and `plugin/de.json`).

---

## 🧪 Quality Assurance & Testing Checklist

- [ ] Run typechecking and linting: `npm run lint` (`0 errors, 0 warnings`)
- [ ] Run plugin build: `npm run build`
- [ ] Validate against official Elgato SDK Schema: `npm run validate`
- [ ] Tested on live Stream Deck hardware or staging profile
