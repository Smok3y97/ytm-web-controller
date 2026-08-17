<a id="top"></a>

# Elgato Stream Deck Plugin Guidelines (`docs/plugin-guideline.md`)

Official style guide and technical metadata requirements for publishing plugins on the **Elgato Marketplace**, based on the official [Elgato Stream Deck Plugin Guidelines](https://docs.elgato.com/guidelines/stream-deck/plugins/).

---

## 📑 Table of Contents
- [1. Identifiers & UUIDs](#1-identifiers--uuids)
- [2. Naming & Metadata](#2-naming--metadata)
- [3. Asset Specifications & Icon Dimensions](#3-asset-specifications--icon-dimensions)
- [4. Visual Feedback & Logging](#4-visual-feedback--logging)
- [5. Property Inspector (UI Guidelines)](#5-property-inspector-ui-guidelines)

---

## [1. Identifiers & UUIDs](#top)

Universally unique identifiers (UUIDs) identify your plugin and its individual actions across Stream Deck and Marketplace.

* **Format:** Use Reverse DNS notation: `{DOMAIN}.{PRODUCT}` / `com.{author}.{plugin-name}` (e.g. `com.smok3y97.ytmusicweb`).
* **Action UUID Prefix:** Every action UUID **must** be prefixed with your plugin's root UUID (e.g. `com.smok3y97.ytmusicweb.playpause`).
* **Immutability:** **Never** change UUIDs after publishing a plugin. To deprecate an action, clone it and set `VisibleInActionsList: false` on the legacy action.

---

## [2. Naming & Metadata](#top)

### Plugin Name
* Unique, concise, and descriptive (approx. 30 characters or less).
* Accurately reflects plugin functionality (e.g. `"YouTube Music Web Controller"`).
* **Do NOT** include your author/organization name in the plugin name (Marketplace displays author metadata separately).

### Author Field
* Matches your Marketplace account/organization name, real name, or online alias.
* Free of copyright/trademark infringements and offensive terms.

### Categories & Actions
* **Category Name:** Must match or closely mirror the plugin name. Do not append author names.
* **Action Names:** Concise (<= 30 characters), clear, and specific (e.g. `"Volume Up"`, `"Play / Pause"`).
* **Tooltips:** Specify descriptive tooltips for every action.
* **Action Count:** Provide a balanced set of functionality—between **2 and 30 actions** per plugin. Avoid static, non-configurable duplicate actions.

---

## [3. Asset Specifications & Icon Dimensions](#top)

| Asset Type | Standard DPI | High DPI (`@2x`) | Supported Formats | Color & Style Requirements |
| :--- | :--- | :--- | :--- | :--- |
| **Plugin Icon** (Preferences) | `256 × 256 px` | `512 × 512 px` | PNG | Full-color or branded, transparent or styled background. |
| **Category Icon** (Action List) | `28 × 28 px` | `56 × 56 px` | SVG (Recommended) / PNG | **Monochromatic**, `#FFFFFF` white stroke, transparent background. No solid background fill. |
| **Action Icon** (Action List) | `20 × 20 px` | `40 × 40 px` | SVG (Recommended) / PNG | **Monochromatic**, `#FFFFFF` white stroke, transparent background. No solid background fill. |
| **Key State Icons** | `72 × 72 px` | `144 × 144 px` | SVG (Recommended), PNG, GIF | Crisp vector scaling. Reflects active/inactive states dynamically. |
| **Stream Deck + LCD Layout** | `200 × 100 px` | Native Canvas/JSON | JSON Layout / In-Memory SVG | Interactive touch targets must be at least **`35 × 35 px`**. All elements must stay strictly within bounds. |

> ⚠️ **Programmatic Flooding Limit:** Programmatic canvas/key render calls must not exceed **10 updates per second** (10 Hz).

---

## [4. Visual Feedback & Logging](#top)

* **`showAlert`:** Trigger when an action fails, an endpoint is unreachable, or an error occurs (applicable to both keys and dials).
* **`showOk`:** Trigger **only** when there is no other visual indicator of success (e.g. clipboard copy, file written). Do **not** use `showOk` if the key icon or state updates visually.
* **Logging:** Maintain structured logging via the SDK logger for error diagnostics and troubleshooting.

---

## [5. Property Inspector (UI Guidelines)](#top)

* **Auto-Save:** Settings must save automatically on input change (`setSettings` / `setGlobalSettings`). **Never include a manual "Save" button.**
* **Input Elements:**
  * Use `<input type="checkbox">` for boolean toggles.
  * Use `<select>` or radio buttons for single-choice options.
  * Provide immediate validation feedback on invalid inputs (e.g. invalid file paths or port ranges).
* **Layout & Content:**
  * Keep configuration compact. Avoid large paragraphs of informational text.
  * Hide UI components by default and reveal them on DOM ready to eliminate visual flickering.
  * **Prohibited:** Do NOT place donation buttons, sponsor links, or raw copyright text in the Property Inspector (use Marketplace product page links instead).
