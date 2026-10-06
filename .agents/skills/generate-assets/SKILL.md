---
name: generate-assets
description: Rebuilds and synchronizes all vector SVG and raster PNG icons, badges, and Stream Deck assets. Validates generated files against Elgato Marketplace dimension, format, and color guidelines. Use this skill when icon assets or visual styles are modified.
---

# Asset Generation & Marketplace Compliance

Rebuild project icons and verify them against official Elgato Marketplace specifications in `docs/plugin-guideline.md`.

## 1. Execute Asset Generation
Run the automated asset generator script:
```bash
npm run assets
```
*(On Windows environments, this invokes `scripts/generate_assets.ps1` for PNGs + `scripts/generate_svgs.mjs` for vector SVGs. On non-Windows environments without PowerShell GDI+, run `node scripts/generate_svgs.mjs` to synchronize SVGs).*

## 2. Automated Asset & Schema Validation

1. Run the project asset validator to verify that all icons referenced across manifests and extensions exist on disk:
   ```bash
   npm run assets:validate
   # Or directly:
   node .agents/skills/generate-assets/scripts/validate-assets.mjs
   ```

2. Execute the official Elgato CLI validation to verify that all asset paths, dimensions, and formats declared in `manifest.json` resolve correctly:
   ```bash
   npm run validate
   ```
   Ensure validation returns `0 errors` and `0 warnings`.

## 3. Visual & Dimensional Compliance Verification

Inspect generated assets against [`resources/asset-specs.json`](resources/asset-specs.json) and `docs/plugin-guideline.md` (see reference SVG implementation: [`examples/sample-icon.svg`](examples/sample-icon.svg)):
- **Plugin Icon:** `plugin-icon.png` (256×256 px) and `plugin-icon@2x.png` (512×512 px) as PNG with `#FF0033` circular disc.
- **Category Icon:** `category-icon.svg` as 28×28 px monochromatic `#FFFFFF` vector with no background fill.
- **Action Icons:** 20×20 px (40×40 px `@2x`) monochromatic `#FFFFFF` vectors.
- **Key State Icons:** 72×72 px (144×144 px `@2x`) SVGs (white default, active accent states).
- **Touch Targets:** LCD dial layout targets in `plugin/com.smok3y97.ytmusicweb.sdPlugin/layouts/dial_layout.json` satisfy the minimum 35×35 px requirement.

## 4. Git Staging Discipline
- Generated vector and raster icons under `plugin/com.smok3y97.ytmusicweb.sdPlugin/assets/` and `extension/icons/` are source assets and **must** be committed to version control.
- **Never** stage build bundles (`release/**`, `plugin/bin/**`). Verify with:
  ```bash
  git status --short
  ```

## 5. Summary Report
Report updated assets to the user and confirm compliance with Elgato Marketplace guidelines.