---
name: code-audit
description: Conducts a read-only architectural, performance, and code quality audit across the ytm-web-controller codebase with targeted scope isolation (`plugin`, `extension`, `diff`, `all`) to minimize token consumption. Use this skill when asked to audit code, analyze runtime bottlenecks, optimize event batching, inspect memory lifecycles, or identify refactoring and DRY opportunities without modifying any files.
---

# Code Audit & Refactoring Analysis (`code-audit`)

Conduct an in-depth, passive technical audit of the `ytm-web-controller` monorepo with strict token-budget conservation through targeted scope isolation.

---

## 1. Parameters & Slash-Command Specification

The `/code-audit` command accepts an optional scope argument to restrict reading exclusively to the targeted subsystem:

```bash
# Audit only the Stream Deck Plugin
/code-audit plugin
/code-audit --scope plugin

# Audit only the Browser Companion Extension
/code-audit extension
/code-audit --scope extension

# Audit only changed files and their direct interface imports
/code-audit diff
/code-audit --scope diff

# Audit the entire codebase (Default if called without argument)
/code-audit all
/code-audit --scope all
/code-audit
```

### Scope Resolution Logic
1. **Argument Extraction:** Check user prompt or slash command arguments for `--scope <name>` or positional keywords (`plugin`, `extension`, `diff`, `all`).
2. **Default Fallback:** If no argument is specified, default to `all`.
3. **Intent Confirmation:** If the user request mentions a specific subsystem (e.g., *"überprüfe die Extension"* or *"audit image-renderer in plugin"*), automatically resolve to the matching scope (`extension` or `plugin`) to prevent wasteful context reading.

---

## 2. Hard File & Context Boundaries (Token Conservation)

To avoid consuming excessive context tokens (saving up to 80 % per run compared to a full monorepo sweep), the agent is **STRICTLY PROHIBITED** from calling `view_file` or scanning files outside the active scope.

| Scope | Allowed Target Paths (Strict Boundary) | Strictly Ignored Paths (DO NOT READ) |
| :--- | :--- | :--- |
| **`plugin`** | `plugin/src/**`<br>`shared/**`<br>`plugin/package.json` | `extension/**`<br>`release/**`<br>`plugin/bin/**`<br>`plugin/com.smok3y97.ytmusicweb.sdPlugin/bin/**`<br>`assets/**`<br>`docs/**` |
| **`extension`** | `extension/**`<br>`shared/**`<br>`extension/manifest.json` | `plugin/**`<br>`release/**`<br>`docs/**`<br>`assets/**`<br>`scripts/**` (except pattern sync) |
| **`diff`** | Only files listed in `git diff --name-only origin/main...HEAD`<br>(or uncommitted changes via `git status --porcelain` / `git diff HEAD`), **plus their direct interface imports**. | All unchanged files that are not direct interface dependencies.<br>Build artifacts, assets, docs. |
| **`all`** | Full source codebase: `plugin/src/**`, `extension/**`, `shared/**`, `scripts/**`, manifests. | `release/**`, `plugin/bin/**`, `plugin/com.smok3y97.ytmusicweb.sdPlugin/bin/**`, raster assets. |

> [!IMPORTANT]
> **Token Protection Invariant:** Never read build artifacts (`plugin/bin/**`, `release/**`), binary/raster image assets, or documentation files unless explicitly requested. Abide strictly by the target path boundary for the active scope.

---

## 3. Operational Rules & Constraints

- **Strict Read-Only Mode:** Never edit, create, or delete code files during the audit. Produce only an actionable analytical report.
- **Zero-Findings Allowed (Anti-Hallucination Guardrail):** A clean bill of health with **zero findings (0 defects)** is an entirely valid, expected, and positive outcome when the codebase satisfies all guardrails. **NEVER** hallucinate, invent, or inflate artificial issues just to populate sections of the report. If no issues exist, state clearly that the target scope passed with zero findings.
- **Strict No-Nitpicking Policy:** Do not report cosmetic code formatting (handled by Prettier/ESLint), variable or parameter naming preferences, personal stylistic opinions, or ultra-hypothetical edge cases without realistic trigger paths.
- **Proof of Impact Required:** Every finding must have a demonstrable, realistic runtime defect (e.g. observable memory leak, unthrottled hardware/WebSocket flood, frame drop, event loop lag) or represent an unequivocal architectural violation (God-File, severe DRY duplication, missing lifecycle teardown, broken context boundary).
- **Honor Project Guardrails:** Never recommend solutions violating [`AGENTS.md`](../../../AGENTS.md) (see machine-readable catalog: [`resources/guardrails-catalog.json`](resources/guardrails-catalog.json)). Maintain zero-polling, preserve the 10-Hz hardware refresh limit, respect MAIN/ISOLATED context boundaries, and avoid disk I/O.

---

## 4. Scope-Aware Static Baseline & Quality Check

Before manual code reading, run automated static analysis scoped to the selected target:

### Scope `plugin`:
```bash
# 1. Scoped guardrail verification (Typing Discipline, Metadata Patterns)
node .agents/skills/code-audit/scripts/audit-guardrails.mjs --scope plugin

# 2. Plugin TypeScript typecheck (tsc --noEmit), ESLint (0 errors, 0 warnings), Prettier
npm run lint
```

### Scope `extension`:
```bash
# 1. Scoped guardrail verification (Zero-Polling, Context Isolation, Patterns)
node .agents/skills/code-audit/scripts/audit-guardrails.mjs --scope extension

# Note: Per AGENTS.md, 'npm run lint' is strictly skipped for extension-only audits!
```

### Scope `diff`:
```bash
# 1. Diff-scoped guardrail verification
node .agents/skills/code-audit/scripts/audit-guardrails.mjs --scope diff

# 2. Run lint only if plugin/src/ files were touched in the diff:
# npm run lint
```

### Scope `all`:
```bash
# 1. Comprehensive guardrail verification across all subsystems
npm run audit:guardrails

# 2. Full lint & typecheck
npm run lint
```

---

## 5. Subsystem-Specific Audit Catalogs

Inspect exclusively the relevant checklist items corresponding to the chosen scope:

### 🎛️ Catalog A: Scope `plugin`
1. **Hardware Refresh Limit (10 Hz) & Rotary Dials:**
   - Inspect all dial action implementations (`VolumeDialAction`, `SeekDialAction`, `TrackDialAction`).
   - Verify strict usage of `DialRotaryStreamer` with **100-ms throttle** and **110-ms settle debounce** to prevent Stream Deck hardware queue saturation during rapid dial rotations.
2. **Stream Deck IPC Hygiene:**
   - Verify deduplication of `setFeedback` calls (avoid sending identical UI update payloads when track/dial state has not changed).
   - Ensure `setState` calls are not redundantly dispatched on every tick (e.g. redundant state flips between 0 and 1).
3. **Timer & Lifecycle Hygiene:**
   - Verify that all active `setInterval` or `setTimeout` timers are completely cleared when actions or profiles become inactive (`willDisappear` lifecycle event).
   - Ensure background tasks do not continue ticking on unpinned or hidden dials.
4. **Caching & Memory Allocations:**
   - Audit [`ImageRenderer`](file:///c:/Users/Smok3y/Documents/Antigravity/ytm-web-controller/plugin/src/services/image-renderer.ts) for efficient FNV-1a hashing when deduplicating cover artwork and overlays.
   - Enforce bounded caching with LRU eviction to prevent unbounded Map growth across long listening sessions.
   - Eliminate unnecessary Base64 string allocations or temporary buffer constructions inside the render loop.
5. **Typing Discipline & Code Hygiene:**
   - Detect forbidden TypeScript escape hatches: `as any`, `@ts-ignore`, `@ts-expect-error`.
   - Ensure zero orphaned `console.log()` or `console.debug()` statements exist in production code (use dedicated logger).

---

### 🌐 Catalog B: Scope `extension`
1. **Lifecycle Teardown & Memory Leak Prevention:**
   - Verify complete teardown of all `MutationObserver` instances and window/document event listeners upon tab unloading (`beforeunload`, `pagehide`).
   - Prevent memory leaks across extended single-page application (SPA) sessions in YouTube Music.
2. **BFCache Compatibility:**
   - Verify proper handling of the Back-Forward Cache via `pageshow` (restoring reactive state/listeners) and `pagehide` (freezing/tearing down subscriptions).
   - Ensure no dangling timers or duplicate listener registrations occur upon cache restoration.
3. **Scrubbing DOM Query Avoidance:**
   - Verify that high-frequency events (`timeupdate`, seeking/scrubbing) do not perform repetitive DOM queries (`querySelector`).
   - Enforce negative caching for absent elements and dirty-checking prior to state dispatches.
4. **WebSocket Hygiene & Loop Prevention:**
   - Verify strict `isTabClosing` guard flag usage to block reconnection loops when a tab is navigated or closed.
   - Ensure prompt and lightweight responses to heartbeat frames (`ping`/`pong`).
5. **Zero-Polling & Context Isolation Boundaries:**
   - Enforce zero polling: strictly no `setInterval()` in `content.js` or `ytm-*.js`. State extraction must remain 100% reactive via `<video>` events and targeted mutations.
   - Ensure MAIN World scripts (`content.js`, `ytm-*.js`) have zero references to `chrome.*` APIs.
   - Ensure ISOLATED World (`bridge.js`) never accesses the DOM or `#movie_player`.

---

### 🔍 Catalog C: Scope `diff`
1. **Identify Modified Files:**
   ```bash
   git diff --name-only origin/main...HEAD
   # Or inspect unstaged/staged working tree:
   git status --porcelain
   ```
2. **Identify Direct Interface Dependencies:**
   - Read the import declarations of each modified file to determine touched contracts.
3. **Targeted Inspection:**
   - Apply Catalog A to modified `plugin/` files and Catalog B to modified `extension/` files.
   - Verify that interface changes have not broken shared assumptions or cross-boundary message contracts.

---

### 🌐 Catalog D: Scope `all` (Milestone Pre-Release Audit)
1. **Comprehensive Execution:**
   - Execute all checks from Catalog A and Catalog B.
2. **Cross-Subsystem Contract Verification:**
   - Validate WebSocket protocol schema consistency between `extension/bridge.js` dispatches and `plugin/src/services/websocket-server.ts` message parsing.
   - Verify patterns synchronization between `shared/metadata-patterns.json`, `extension/ytm-patterns.js`, and `plugin/src/services/metadata-patterns.ts`.
3. **Monolith & God-File Detection:**
   - Flag modules exceeding Single Responsibility Principle boundaries.

---

## 6. Report Output Format

Format the audit findings grouped strictly by severity with concrete file and line references (see reference implementation: [`examples/sample-audit-report.md`](examples/sample-audit-report.md)):

```markdown
# 🛡️ Code Quality & Architectural Audit Report

**Scope of Audit:** `plugin` | `extension` | `diff` | `all`  
**Execution Mode:** Read-Only Static & Architectural Analysis  
**Quality Baseline:** Passed / Issues Detected  

---

## 1. 🔴 Kritisch (Critical)
Runtime defects, memory leaks, unthrottled hardware floods, or guardrail breaches:
- **Location:** [path/to/file.ts:line](file:///path/to/file.ts#Lline)
- **Symptom / Trigger:** Detailed description of the runtime failure mechanism.
- **Guardrail Violated:** Reference to AGENTS.md / guardrails-catalog.json rule.
- **Remediation Proposal:** Minimal, safe code snippet for remediation.

---

## 2. 🟡 Optimierung (Optimization)
Performance bottlenecks, redundant IPC payloads, DOM churn, or cache efficiency:
- **Location:** [path/to/file.js:line](file:///path/to/file.js#Lline)
- **Issue Description:** Specific inefficiency (e.g. missing dirty-check, un-memoized regex).
- **Architectural Benefit:** Measurable impact on heap, CPU, or hardware responsiveness.
- **Remediation Proposal:** Suggested optimization.

---

## 3. 🔵 Clean Code & Hygiene
Type safety, SRP / God-File violations, DRY consolidation, or dead logging:
- **Location:** [path/to/file.ts:line](file:///path/to/file.ts#Lline)
- **Issue Description:** Concrete code smell or pattern divergence.
- **Remediation Proposal:** Suggested refactoring or interface adjustment.

---

## 4. Prioritized Implementation Roadmap
Sequence of independent, non-breaking Pull Requests to remediate findings without regressions.
```

### ✅ Clean Bill of Health (Zero Findings)
When all checks pass and no defects are detected, **do not hallucinate placeholder findings**. Render a concise, clean report:

```markdown
# 🛡️ Code Quality & Architectural Audit Report

**Scope of Audit:** `plugin` | `extension` | `diff` | `all`  
**Execution Mode:** Read-Only Static & Architectural Analysis  
**Quality Baseline:** Passed (`audit:guardrails` + static checks: 0 errors / 0 warnings)  

---

## ✅ Clean Bill of Health (0 Findings)
All analyzed components within scope satisfy the architectural guardrails, 10-Hz hardware limits, lifecycle teardown invariants, and typing standards. No runtime bottlenecks, memory leaks, or anti-patterns detected.
```