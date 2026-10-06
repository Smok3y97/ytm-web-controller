---
name: code-audit
description: Conducts a read-only architectural, performance, and code quality audit across the ytm-web-controller codebase. Use this skill when asked to audit code, analyze runtime bottlenecks, optimize event batching, inspect memory lifecycles, or identify refactoring and DRY opportunities without modifying any files.
---

# Code Audit & Refactoring Analysis

Conduct an in-depth, passive technical audit of the `ytm-web-controller` monorepo.

## Operational Rules & Constraints
- **Strict Read-Only Mode:** Do not edit or delete any files. Produce only an actionable analytical report.
- **No Nitpicking:** Do not report variable or function naming preferences, code formatting issues handled by Prettier/ESLint, or hypothetical edge cases with near-zero probability.
- **Proof of Impact Required:** Every finding must cause an observable runtime defect (memory leak, frame drops, network flood, hardware queue lag) or represent a clear God-File / DRY violation.
- **Honor Project Guardrails:** Never recommend solutions violating `AGENTS.md` (see machine-readable catalog: [`resources/guardrails-catalog.json`](resources/guardrails-catalog.json)). Maintain zero-polling, preserve 10 Hz hardware limits, respect MAIN/ISOLATED context boundaries, and avoid disk I/O.

## 0. Static Baseline & Quality Check
Before manual code reading, run automated static analysis to audit guardrails, type safety, and linting:
```bash
# 1. Verify non-negotiable architectural guardrails (Zero-Polling, Context Isolation, Type Discipline)
npm run audit:guardrails
# Or directly:
node .agents/skills/code-audit/scripts/audit-guardrails.mjs

# 2. Run plugin TypeScript typecheck `tsc --noEmit`, ESLint (0 warnings), and Prettier
npm run lint
```

## Audit Domains
1. **Modularity & Single Responsibility Principle (SRP):**
   - Identify bloated files handling multiple domains (e.g., mixing WebSocket orchestration, state caching, and parsing).
   - Propose decoupled singleton services under `plugin/src/services/` or modular scripts under `extension/`.
2. **DRY & Redundancy Reduction:**
   - Detect duplicated logic across actions, services, or extension scripts (e.g., repeated sanitization, DOM queries, timeout handling).
3. **WebSocket Traffic & Event Batching:**
   - Inspect `extension/ytm-state.js` and `extension/content.js` for rapid successive WebSocket frame dispatches during state transitions.
   - Evaluate atomic microtask or debounce batching (`queueMicrotask`) to combine multiple updates into a single snapshot.
   - Verify hardware throttle compliance (10 Hz) during rapid Stream Deck dial rotations.
4. **Memory Lifecycle & Garbage Collection:**
   - Audit `plugin/src/services/image-renderer.ts` for heap churn or uncollected base64 buffers during frequent canvas updates.
   - Verify that all `MutationObserver` instances, event listeners, and WebSocket connections are properly detached on tab closure (`beforeunload` / `pagehide`).
5. **Type Discipline & Hygiene:**
   - Flag occurrences of `as any`, `@ts-ignore`, orphaned interfaces in `plugin/src/types/`, or lingering `console.log()` statements.
6. **Bundle Impact & Dependencies:**
   - Inspect `plugin/package.json` and `plugin/rollup.config.js` for unnecessary bundle bloat or non-tree-shaken imports in `plugin/com.smok3y97.ytmusicweb.sdPlugin/bin/plugin.js`.

## Report Output Format

Structure findings into three distinct sections (see reference implementation: [`examples/sample-audit-report.md`](examples/sample-audit-report.md)):
1. **Modularization & DRY Opportunities:** Component path, issue description, suggested file extraction, and architectural benefit.
2. **Performance & Memory Findings:** File path, symptom/trigger, and minimal code snippet for remediation.
3. **Prioritized Implementation Roadmap:** Recommended sequence of independent pull requests to avoid regressions.