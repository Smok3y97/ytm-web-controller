# Pull Request Template Reference

Use this reference layout based on [`.github/pull_request_template.md`](../../../.github/pull_request_template.md) and [`resources/pull_request_template.md`](../resources/pull_request_template.md) when constructing PR descriptions on GitHub.

---

## Example 1: Code Pull Request (`feat/` or `fix/`)

```markdown
## 📝 Description

Implement dedicated Mute Dial action for Stream Deck +:
- Add mute state tracking and toggle logic in State Manager
- Provide instant visual mute indicator feedback on dial rotation/push

Resolves issue #42 by enabling direct mute toggling via dial push while preserving volume rotation. Conforms to Stream Deck SDK 3 dial hierarchy and 10-Hz hardware throttle limit.

---

## 🔍 Type of Change

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [x] ✨ New feature (non-breaking change which adds functionality)
- [ ] 🎨 Code style / Refactoring (formatting, rename, architectural cleanup)
- [ ] 📚 Documentation update
- [ ] ⚙️ CI/CD / Build tooling update

---

## 🏛️ Architectural Compliance Checklist

- [x] **Zero DOM Polling**: Extension changes dispatch state exclusively on `<video>` events and targeted `MutationObserver` callbacks.
- [x] **Zero Disk Footprint**: Cover artwork and canvas layouts are generated purely in memory (Base64 data URLs).
- [x] **10 Hz Rate Limit**: Stream Deck hardware programmatic updates do not exceed 10 updates per second.
- [x] **Property Inspector Auto-Save**: All Property Inspector settings save automatically on input change (`setSettings` / `setGlobalSettings`) with no manual save buttons.
- [x] **i18n & Localization**: UI strings and keys are maintained in `plugin/com.smok3y97.ytmusicweb.sdPlugin/en.json` (and `plugin/com.smok3y97.ytmusicweb.sdPlugin/de.json`).

---

## 🧪 Quality Assurance & Testing Checklist

- [x] Run typechecking and linting: `npm run lint` (`0 errors, 0 warnings`)
- [x] Run plugin build: `npm run build`
- [x] Validate against official Elgato SDK Schema: `npm run validate`
- [x] Tested on live Stream Deck hardware or staging profile
```

---

## Example 2: Documentation-Only Pull Request (`docs/`)

```markdown
## 📝 Description

- Update LCD touchstrip layout documentation in `docs/architecture.md`
- Clarify active pause indicator rendering rules in `docs/features.md`

Keeps technical documentation synchronized with recent image-renderer changes per AGENTS.md.

---

## 🔍 Type of Change

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 🎨 Code style / Refactoring (formatting, rename, architectural cleanup)
- [x] 📚 Documentation update
- [ ] ⚙️ CI/CD / Build tooling update

---

## 🏛️ Architectural Compliance Checklist

- [x] **Zero DOM Polling**: Extension changes dispatch state exclusively on `<video>` events and targeted `MutationObserver` callbacks.
- [x] **Zero Disk Footprint**: Cover artwork and canvas layouts are generated purely in memory (Base64 data URLs).
- [x] **10 Hz Rate Limit**: Stream Deck hardware programmatic updates do not exceed 10 updates per second.
- [x] **Property Inspector Auto-Save**: All Property Inspector settings save automatically on input change (`setSettings` / `setGlobalSettings`) with no manual save buttons.
- [x] **i18n & Localization**: UI strings and keys are maintained in `plugin/com.smok3y97.ytmusicweb.sdPlugin/en.json` (and `plugin/com.smok3y97.ytmusicweb.sdPlugin/de.json`).

---

## 🧪 Quality Assurance & Testing Checklist

> [!NOTE]
> `npm run lint`, `npm run build`, and `npm run validate` are strictly required only when files in `plugin/**` are modified. Skip these checks for extension, documentation, tooling, or skill changes.

- [x] Documentation-only change (plugin code quality gates safely skipped per AGENTS.md)
```
