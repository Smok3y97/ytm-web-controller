# Agent Skills Reference (`.agents/skills/`)

This directory houses specialized agentic workflow skills for Google Antigravity and automated development pair programming in `ytm-web-controller`.

---

## 📑 Available Skills Directory

| Skill | Slash Command | Category | Primary Purpose | When to Use |
| :--- | :--- | :--- | :--- | :--- |
| [**`code-audit`**](skills/code-audit/SKILL.md) | `/code-audit` | Quality & Performance | Read-only architectural, memory, SRP, and performance audit. | Inspect bottlenecks, hardware throttle limits (10 Hz), or review code without modifications. |
| [**`create-pr`**](skills/create-pr/SKILL.md) | `/create-pr` | Git & Release | Pre-flight quality gates, semantic branch creation, and PR opening via `gh`. | When code changes, bugfixes, or documentation edits are finished and ready for review. |
| [**`publish-release`**](skills/publish-release/SKILL.md) | `/publish-release` | Git & Release | Central 4-digit version bump (`npm run bump`), manifest sync, and git release tagging. | When publishing a new version to trigger the automated GitHub Actions release workflow. |
| [**`generate-assets`**](skills/generate-assets/SKILL.md) | `/generate-assets` | Assets & Compliance | Rebuild vector SVGs and PNG badges; validate against Elgato Marketplace guidelines. | When icons, dial layouts, or branding assets are modified or re-rendered. |
| [**`sync-docs`**](skills/sync-docs/SKILL.md) | `/sync-docs` | Documentation & SSOT | Audit and synchronize `docs/` and `README.md` against recent code changes. | After adding/modifying backend services, WebSocket events, actions, HTTP routes, or settings. |
| [**`docs-review`**](skills/docs-review/SKILL.md) | `/docs-review` | Documentation & Style | Editorial linting: tone of voice, imperative phrasing, terminology, and Markdown hygiene. | When reviewing or writing Markdown documentation to enforce styleguide rules and valid links. |
| [**`changelog-gen`**](skills/changelog-gen/SKILL.md) | `/changelog-gen` | Release & Changelog | Parse Conventional Commits between Git tags and format release notes. | Before a release or when updating `CHANGELOG.md` with grouped user-facing highlights. |

---

## ⚡ How to Trigger Skills

Skills can be invoked in two ways across Google Antigravity (IDE, CLI, and Web):
1. **Autonomous Invocation (Natural Language):** The agent automatically discovers available skills from `.agents/skills/` and activates them when your request matches the skill's description.
2. **Explicit Slash Commands:** Type the slash command directly into the prompt box (e.g. `/create-pr`, `/sync-docs`, `/publish-release`) to run the specific workflow immediately.

---

## 🛡️ Operational Guardrails Summary

1. **Strict Read-Only Mode in Audits:** `code-audit`, `sync-docs`, and `docs-review` never edit files without explicit user instruction.
2. **Quality Gates & Exemptions:** 
   - Code modifications require `npm run lint`, `npm run build`, and `npm run validate`.
   - Pure Markdown documentation edits (`*.md`) are **100% exempt** from linting, building, and schema validation per [`AGENTS.md`](../AGENTS.md).
3. **No Bundle Staging:** Never stage `release/**` or `plugin/bin/**` in any git workflow.
