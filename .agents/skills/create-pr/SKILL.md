---
name: create-pr
description: Verifies pre-flight quality gates, creates a semantic git branch, stages changes, commits using Conventional Commits with a mandatory body, pushes to GitHub, and prepares the Pull Request. Use this skill when a feature, refactoring, or bugfix is complete and ready to be submitted.
---

# Pull Request Creation Workflow

Encapsulate completed changes into an isolated git branch and open a verified Pull Request against `main`.

## 1. Pre-Flight Quality Gates
Run static analysis, bundle compilation, and schema verification before touching git:
1. `npm run lint` (runs TypeScript typecheck `tsc --noEmit`, ESLint with 0 warnings, and Prettier verification)
2. `npm run build` (compiles plugin bundle via Rollup to ensure 0 bundling errors per `AGENTS.md` Definition of Done)
3. `npm run validate` (validates plugin against official Elgato SDK schema)

> If any command returns errors or warnings, abort immediately, fix the issues, and re-run checks.

> [!NOTE]
> **Non-Plugin Scope Exemption:** If modified files do NOT touch the Stream Deck plugin (`plugin/**`) — e.g. changes are confined to the companion browser extension (`extension/**`), helper scripts (`scripts/**`), agent skills (`.agents/**`), or documentation (`docs/**`, `*.md`) — completely skip steps 1–3 (`lint`, `build`, `validate`). Proceed directly to Branch Preparation.


## 2. Working Tree & Branch Preparation
1. Verify pending changes exist:
   ```bash
   git status --short
   ```
2. Check the current branch using `git branch --show-current`. If on `main`, create and checkout a semantic branch (governed by [`resources/branch-naming-rules.json`](resources/branch-naming-rules.json)):
   - Features: `git checkout -b feat/<short-name>`
   - Bugfixes: `git checkout -b fix/<short-name>`
   - Refactoring & Performance: `git checkout -b refactor/<short-name>` or `git checkout -b perf/<short-name>`
   - Documentation: `git checkout -b docs/<short-name>`
   - Tooling & Chore: `git checkout -b chore/<short-name>`

## 3. Conventional Commit
1. Stage modified files explicitly. **Never** stage generated bundles (`release/**`, `plugin/bin/**`) or lockfiles without npm.
2. Commit changes using Conventional Commits with an imperative summary and a descriptive body explaining what and why:
   ```bash
   git commit -m "<type>(<scope>): <short imperative summary>" -m "- <Bullet point explaining what changed>" -m "- <Bullet point explaining why the change was made>"
   ```
   *Allowed `<type>` prefixes (governed by [`commit-conventions.json`](../changelog-gen/resources/commit-conventions.json)):* `feat`, `fix`, `perf`, `refactor`, `docs`, `style`, `test`, `chore` (with aliases `ci`, `build`). Never write `feature` or `bugfix`.


## 4. Push & Pull Request Submission

1. Push the branch to the remote repository:
   ```bash
   git push -u origin HEAD
   ```

2. Format the Pull Request description based on the canonical template in [`resources/pull_request_template.md`](resources/pull_request_template.md) (synchronized with [`.github/pull_request_template.md`](../../../.github/pull_request_template.md) and illustrated in [`examples/pr-template.md`](examples/pr-template.md)):
   - **Title:** Same as the Conventional Commit header (`<type>(<scope>): <summary>`).
   - **Description (`## 📝 Description`):** Summary bullet points explaining what changed and the motivation/architecture rationale behind it.
   - **Type of Change (`## 🔍 Type of Change`):** Check the applicable category box (`Bug fix`, `New feature`, `Code style / Refactoring`, `Documentation update`, `CI/CD / Build tooling update`).
   - **Architectural Compliance Checklist (`## 🏛️ Architectural Compliance Checklist`):** Check off applicable architecture rules (Zero DOM Polling, Zero Disk Footprint, 10 Hz Rate Limit, Property Inspector Auto-Save, i18n & Localization).
   - **Quality Assurance Checklist (`## 🧪 Quality Assurance & Testing Checklist`):**
     - For **Plugin Changes (`plugin/**`)**: Check off `npm run lint`, `npm run build`, and `npm run validate`.
     - For **Non-Plugin Changes** (docs, skills, scripts, extension): Note that plugin quality gates were safely skipped per `AGENTS.md`.

3. Provide the user with the direct GitHub Pull Request URL:
   `https://github.com/Smok3y97/ytm-web-controller/pull/new/<branch-name>`
   *(or the compare link `https://github.com/Smok3y97/ytm-web-controller/compare/main...<branch-name>?expand=1`).*

4. Notify the user that GitHub Actions CI (`.github/workflows/ci.yml`) will automatically trigger on the PR to validate build integrity.