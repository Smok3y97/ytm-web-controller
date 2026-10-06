---
name: docs-review
description: Audits Markdown documentation for tone of voice, terminology consistency, active imperative voice, dead links, and syntax hygiene. Use this skill when reviewing, editing, or validating files in docs/, README.md, or guidelines across the repository.
---

# Documentation Styleguide & Hygiene Audit (`docs-review`)

Enforce editorial standards, tone of voice, objective phrasing, and syntactic integrity across all Markdown documentation in `ytm-web-controller`.

## 1. Editorial Rules & Tone of Voice

- **Objective Phrasing ("Why over What"):**
  - Explain *why* an architectural boundary, fallback, or setting exists.
  - Omit promotional buzzwords ("revolutionary", "blazing fast", "game-changing", "super easy").
- **Active & Imperative Language:**
  - Use active voice: *"State Manager caches the active track"* instead of *"The active track is cached by the State Manager"*.
  - Use direct imperative instructions in guides: *"Run `npm run build`"* instead of *"You can run `npm run build` if you want to build the project"*.
- **Standardized Project Terminology:**
  - Consult [Glossary Resource](resources/glossary.json) for the full machine-readable schema of allowed and forbidden terms.
  - Use **YouTube Music Web** (never abbreviate to "YTM" in public-facing prose, except in code paths or CLI flags).
  - Use **Stream Deck +** (capitalized with space before the plus).
  - Use **Property Inspector** (capitalized, never "PI" in public guides).
  - Use **MAIN World** and **ISOLATED World** (exact casing for extension context boundaries).
  - Use **Single Source of Truth (SSOT)** (consistent acronym and capitalization).
  - Use **4-digit Elgato format** (`Major.Minor.Patch.Build`).

## 2. Markdown Syntax & Hygiene Rules

1. **Table of Contents & Navigation:**
   - Every file under `docs/` must begin with `<a id="top"></a>`.
   - Major section headings must include a back-to-top link: `## [Title](#top)`.
   - Every document must maintain an updated `## 📑 Table of Contents`.
2. **GitHub Alert Standard:**
   - Standardize all callouts to official GitHub Alert syntax:
     ```markdown
     > [!NOTE]
     > [!TIP]
     > [!IMPORTANT]
     > [!WARNING]
     > [!CAUTION]
     ```
   - Disallow legacy unstructured emoji callouts (e.g., `> ⚠️ Warning:` or `> 💡 Note:`).
3. **Table Formatting & Pipe Escapes:**
   - Literal pipes `|` inside table cells (such as regular expressions or command flags) must be escaped as `\|` (e.g., `^(0\|[1-9]\d*)`). Unescaped pipes break GFM table rendering.
   - Avoid raw `<br>` or `<span>` tags outside of tightly constrained table cell wraps.
4. **Internal Link & Anchor Verification:**
   - Validate that internal links (`[Section](#section-anchor)`) resolve to existing headers or anchor IDs.
   - Verify that relative file links point to actual files in the repository.

## 3. Automated Execution via Helper Script

Run the automated documentation auditor:
```bash
npm run docs:audit
# Or directly:
node .agents/skills/docs-review/scripts/audit-docs.mjs
```
*(Automatically validates relative file links, heading anchors, TOC targets, top navigation links, GitHub Alert callouts, forbidden buzzwords, and preferred terminology).*

## 4. Manual Audit Execution Steps (Fallback)

1. **File Discovery:**
   - Scan all Markdown files: `docs/*.md`, `README.md`, `CONTRIBUTING.md`, `AGENTS.md`.
2. **Syntax & Link Inspection:**
   - Check for unescaped pipes in Markdown tables.
   - Check for orphaned HTML tags (`<span>`, unclosed `<div>`).
   - Check for broken anchors and missing `<a id="top"></a>` tags.
3. **Terminology & Tone Scan:**
   - Search for forbidden buzzwords and passive phrasing.
   - Verify capitalization of core terminology (`Stream Deck +`, `Property Inspector`, `MAIN World`).
4. **Admonition Standardization:**
   - Identify non-standard callout blocks and convert them to GFM Alert syntax.

## 5. Output Report

Format findings into an actionable table (see reference implementation: [`examples/sample-docs-audit-report.md`](examples/sample-docs-audit-report.md)):
- **Location:** File path and line number.
- **Rule Violated:** (e.g., "Non-standard Admonition", "Unescaped Table Pipe", "Inconsistent Terminology", "Passive Voice").
- **Current Content:** The offending string or line.
- **Remediation:** The exact corrected Markdown snippet.
