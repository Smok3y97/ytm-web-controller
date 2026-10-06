---
name: publish-release
description: Prepares and triggers an automated GitHub Release for ytm-web-controller. Runs full validation, executes npm run bump with a 4-part version number, stages all synchronized manifest files, commits, creates a matching git tag, and pushes to GitHub to initiate the release pipeline. Use this skill when publishing a new version.
---

# Automated Release Workflow

Publish a new version of `ytm-web-controller` following Elgato 4-digit version specifications (see complete reference walkthrough: [`examples/sample-release-workflow.md`](examples/sample-release-workflow.md)).

## 1. Prerequisites & Validation
1. Verify current branch is `main` and fully synchronized with remote:
   ```bash
   git branch --show-current
   git pull --ff-only origin main
   ```
2. Ensure no uncommitted working tree changes exist before proceeding:
   ```bash
   git status --porcelain
   ```
3. Execute pre-release quality checks:
   - `npm run lint` (TypeScript, ESLint, Prettier verification)
   - `npm run build` (verifies clean Rollup compilation of production bundle)
   - `npm run validate` (verifies Elgato SDK manifest & asset schema)

## 2. Version Synchronization & Release Notes
1. *(Recommended)* Run `npm run changelog` (via `changelog-gen` skill) to generate structured, user-oriented release notes for the commit body and GitHub Release.
2. Execute the central version bump script using the target 4-digit version (`Major.Minor.Patch.Build`):
   ```bash
   npm run bump <version>
   # Example: npm run bump 2.1.0.0
   ```
2. Confirm synchronization across all 7 managed files updated by `scripts/bump-version.mjs` (defined in [`resources/release-manifest-targets.json`](resources/release-manifest-targets.json)):
   - `version.json` (monorepo SSOT)
   - `package.json` (root package)
   - `plugin/package.json`
   - `plugin/package-lock.json` (updated natively via npm)
   - `plugin/com.smok3y97.ytmusicweb.sdPlugin/manifest.json`
   - `extension/manifest.json`
   - `plugin/src/services/version-control.ts` (manifest fallback constants)

## 3. Commit & Tagging
1. Stage all synchronized version files:
   ```bash
   git add version.json package.json plugin/package.json plugin/package-lock.json plugin/com.smok3y97.ytmusicweb.sdPlugin/manifest.json extension/manifest.json plugin/src/services/version-control.ts
   ```
2. Create the release commit using Conventional Commits with a mandatory body:
   ```bash
   git commit -m "chore(release): bump version to <version>" -m "- Synchronized all manifests to <version> via npm run bump"
   ```
3. Create the git release tag matching the `v*` pattern required by `.github/workflows/release.yml`:
   ```bash
   git tag v<version>
   ```

> [!IMPORTANT]
> - The `v` prefix is mandatory (e.g. `v2.1.0.0`). Tags pushed without `v` will **not** trigger `.github/workflows/release.yml`.
> - **Do not add textual pre-release suffixes** (e.g. `-alpha` or `-beta`). The official Elgato SDK schema strictly requires 4 numeric digits (`Major.Minor.Patch.Build`). For test builds or marketplace revisions, increment the fourth `{Build}` digit instead (e.g. `2.1.0.1`).

## 4. Push to Remote
Push both the release commit and tag to GitHub to trigger the release workflow:
```bash
git push origin main
git push origin v<version>
```
Confirm to the user that `.github/workflows/release.yml` has been triggered to build and publish release assets (`com.smok3y97.ytmusicweb.streamDeckPlugin` and `extension.zip`).