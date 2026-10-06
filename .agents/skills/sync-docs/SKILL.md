---
name: sync-docs
description: Audits and synchronizes technical documentation (docs/ and README.md) against recent code, architectural, or configuration changes. Use this skill when actions, backend services, WebSocket/HTTP routes, state types, settings, or CLI scripts are added, renamed, or modified.
---

# Code-to-Documentation Synchronization (`sync-docs`)

Verify and maintain the single source of truth across all technical documentation in `docs/` and `README.md` following the priority hierarchy defined in `AGENTS.md`.

## 1. Documentation Priority Hierarchy

When code changes occur, inspect and synchronize documentation according to this hierarchy:
1. **Tier 1 (Highest Priority) — `docs/architecture.md`**:
   - Backend services (`plugin/src/services/`) and internal data flows.
   - WebSocket message schemas, protocol events, and reconnection handshakes.
   - HTTP endpoints (`/overlay`, `/api/current`), sequence diagrams, and LCD dial touchstrips.
2. **Tier 2 — Feature & Integration Guides**:
   - `docs/features.md`: Key actions, dial actions, and supported YouTube Music controls.
   - `docs/obs-setup.md`: Overlay URL parameters, template replacement tokens (`{title}`, `{artist}`), and chatbot integration.
   - `docs/configuration.md`: Property Inspector settings, toggle options, and global defaults.
3. **Tier 3 — Developer & Packaging Guides**:
   - `docs/development.md`: Build/packaging commands, npm scripts, and versioning tables.
   - `docs/ai-disclosure.md`: Technical disclosures and agent directives.
4. **Tier 4 — Marketplace Guidelines & Overview**:
   - `docs/plugin-guideline.md`: Elgato Marketplace specifications, icon dimensions, and UI limits.
   - `README.md`: High-level feature list, quickstart commands, and architectural summary.

## 2. Synchronization Audit Matrix

Check for mismatches between modified code components and documentation files (defined in machine-readable format: [`resources/doc-mapping.json`](resources/doc-mapping.json)):

| Modified Component | Triggers Review In | Verification Focus |
| :--- | :--- | :--- |
| `plugin/src/types/index.ts` | `docs/architecture.md`, `docs/obs-setup.md` | Are new properties in `TrackState`, `PlayerState`, or settings reflected in state payloads and template tokens? |
| `plugin/src/actions/*.ts` | `docs/features.md`, `manifest.json`, `README.md` | Are all actions documented with UUID, description, key states, and dial behaviors? |
| `plugin/src/services/http-api.ts` | `docs/architecture.md`, `docs/obs-setup.md` | Are new HTTP routes, query parameters, or chatbot responses documented? |
| `plugin/src/services/websocket-server.ts` | `docs/architecture.md` | Are handshake protocols, port bindings (39865), and event structures synchronized? |
| `extension/manifest.json` | `docs/development.md`, `docs/architecture.md` | Are permissions, content scripts, and context isolation boundaries (`MAIN` vs `ISOLATED`) accurately described? |
| `package.json` / `scripts/` | `docs/development.md`, `README.md` | Are all available npm scripts (`npm run <cmd>`) listed in the command tables? |

## 3. Automated Synchronization Audit

Run the automated synchronization verification script:
```bash
npm run docs:sync
# Or directly:
node .agents/skills/sync-docs/scripts/audit-sync.mjs
```
*(Automatically verifies that version numbers match across all manifests, action UUIDs are documented in `docs/features.md`, and all npm scripts are documented in `docs/development.md`).*

## 4. Manual Audit Procedure (Deep Inspection)

1. **Inspect Working Tree & Recent Diff:**
   ```bash
   git diff --name-only HEAD~1
   # Or inspect unstaged working tree changes:
   git status --short
   ```
2. **Cross-Reference Against Documentation Matrix:**
   - Identify every modified file belonging to `plugin/src/`, `extension/`, `scripts/`, or manifests.
   - Determine all matching Tier 1–4 documentation files.
3. **Structural Verification:**
   - If a new service or singleton was added in `plugin/src/services/`, confirm it is added to the Mermaid diagrams and layer lists in `docs/architecture.md`.
   - If an action was added or deprecated, verify that `VisibleInActionsList` deprecation rules in `docs/plugin-guideline.md` are respected.
   - Verify that all code symbols and filenames in markdown files are rendered as valid clickable links (`file:///...` or relative markdown links).

## 5. Output Report

Provide a structured Markdown report (see reference implementation: [`examples/sample-sync-report.md`](examples/sample-sync-report.md)):
1. **Change Inventory:** List of inspected code changes and affected functional domains.
2. **Missing or Outdated Documentation:** Exact file paths, section headings, and specific missing items.
3. **Required Updates:** Concrete Markdown diff proposals to bring documentation back into 100% synchronization.
