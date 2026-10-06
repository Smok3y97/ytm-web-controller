# 🚀 Automated Release Workflow (Reference Example)

Walkthrough of publishing a new release for `ytm-web-controller` following Elgato 4-digit version specifications.

---

## 1. Quality Gates & Sync Verification

```bash
# Verify working tree is clean
git status --short

# Run quality checks across skills
npm run docs:audit
npm run docs:sync
npm run audit:guardrails
npm run assets:validate

# For plugin changes, run compiler & Elgato CLI validation
npm run lint
npm run build
npm run validate
```

---

## 2. Version Bump & Changelog Generation

```bash
# Execute centralized version bump across all 7 manifests
npm run bump 2.1.0.0

# Generate user-oriented release notes from git commits
npm run changelog
```

---

## 3. Git Staging, Release Commit & Tag

```bash
# Stage synchronized version manifests
git add version.json package.json plugin/package.json plugin/package-lock.json plugin/com.smok3y97.ytmusicweb.sdPlugin/manifest.json extension/manifest.json plugin/src/services/version-control.ts

# Create Conventional Commit with mandatory body
git commit -m "chore(release): bump version to 2.1.0.0" -m "- Synchronized all 7 manifests to 2.1.0.0 via npm run bump"

# Create release tag (mandatory 'v' prefix)
git tag v2.1.0.0

# Push commit and tag to GitHub to trigger automated release pipeline
git push origin main
git push origin v2.1.0.0
```

---

## 4. Pipeline Execution Confirmation

GitHub Actions workflow `.github/workflows/release.yml` will automatically:
1. Compile the production plugin bundle with Rollup.
2. Package the release archive (`com.smok3y97.ytmusicweb.streamDeckPlugin`).
3. Bundle the browser companion extension into `extension.zip`.
4. Create the GitHub Release and attach both downloadable assets.
