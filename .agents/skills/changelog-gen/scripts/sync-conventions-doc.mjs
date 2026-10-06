#!/usr/bin/env node
/**
 * Synchronize Human-Readable Commit Conventions Documentation
 * 
 * Reads the Single Source of Truth (resources/commit-conventions.json)
 * and generates docs/commit-conventions.md for human contributors and GitHub readers.
 * 
 * Usage:
 *   node sync-conventions-doc.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..', '..', '..');
const jsonPath = path.resolve(__dirname, '..', 'resources', 'commit-conventions.json');
const targetDocPath = path.resolve(rootDir, 'docs', 'commit-conventions.md');

const conventions = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// Invert aliases to group them by target type
const aliasesByType = {};
for (const [alias, target] of Object.entries(conventions.aliases || {})) {
  if (!aliasesByType[target]) aliasesByType[target] = [];
  aliasesByType[target].push(`\`${alias}\``);
}

let tableRows = [];
for (const [typeKey, config] of Object.entries(conventions.types || {})) {
  const scopes = (config.scope_examples || []).map(s => `\`${s}\``).join(', ') || '—';
  const aliases = aliasesByType[typeKey] ? aliasesByType[typeKey].join(', ') : '—';
  tableRows.push(
    `| \`${typeKey}\` | ${config.emoji} | ${config.section} | ${config.description} | ${scopes} | ${aliases} |`
  );
}

if (conventions.breaking) {
  tableRows.push(
    `| \`!:\` / \`BREAKING CHANGE:\` | ${conventions.breaking.emoji} | ${conventions.breaking.section} | ${conventions.breaking.description} | *(any)* | — |`
  );
}

const content = `<a id="top"></a>

# 📝 Git Commit Conventions & Categories (\`docs/commit-conventions.md\`)

> [!NOTE]
> **Centralized Specification:** This guide is automatically generated from the machine-readable configuration at [\`.agents/skills/changelog-gen/resources/commit-conventions.json\`](../.agents/skills/changelog-gen/resources/commit-conventions.json).
> To update types, emojis, or descriptions, modify the JSON source and run \`npm run docs:conventions\`.

This guide defines the required Conventional Commit standard for all contributions, pull requests, automated releases, and changelog generation in **Controller for YouTube Music Web**.

---

## 📑 Table of Contents
- [📑 1. Commit Message Structure](#-1-commit-message-structure)
- [📊 2. Commit Classification Matrix](#-2-commit-classification-matrix)
- [💡 3. Good vs. Bad Examples](#-3-good-vs-bad-examples)
- [🛠️ 4. Automated Tooling & Synchronization](#-4-automated-tooling--synchronization)

---

## [📑 1. Commit Message Structure](#top)

Every commit must follow Conventional Commits with a mandatory descriptive body:

\`\`\`text
<type>(<scope>): <short imperative summary>

- <bullet point explaining what changed>
- <bullet point explaining why the change was made>
\`\`\`

### Structural Rules:
1. **Summary Line:** Maximum 72 characters, lowercase type and scope, imperative mood (e.g. \`add\`, \`fix\`, \`refactor\`; not \`added\` or \`fixes\`), no trailing period.
2. **Mandatory Body:** Single-line commits without a descriptive body are rejected. The body must contain at least one bullet point explaining **what** changed and **why**.
3. **Automated Changelog Integration:** The automated release note generator (\`npm run changelog\`) parses these bullet points directly into published GitHub Release Notes.

---

## [📊 2. Commit Classification Matrix](#top)

| Type | Emoji | Release Notes Category | Description | Example Scopes | Aliases |
| :--- | :---: | :--- | :--- | :--- | :--- |
${tableRows.join('\n')}

---

## [💡 3. Good vs. Bad Examples](#top)


### ✅ Good Commits

\`\`\`bash
# Example 1: New Action Feature
git commit -m "feat(actions): add mute toggle dial action" \\
  -m "- Implement rotary volume control with direct push mute toggle" \\
  -m "- Synchronize LCD mute indicator across all active dials"

# Example 2: Bug Fix with Scope
git commit -m "fix(core): prevent duplicate disconnect events on tab reload" \\
  -m "- Guard WebSocket close during tab unload using isTabClosing flag" \\
  -m "- Resolves infinite reconnect loops in bfcache navigation"

# Example 3: Performance Optimization
git commit -m "perf(dial): throttle encoder rendering to 10 Hz" \\
  -m "- Enforce 100ms interval limit on LCD touchstrip canvas updates" \\
  -m "- Eliminates touchstrip display lag when spinning encoder dials rapidly"
\`\`\`

### ❌ Bad Commits (Will Be Rejected)

\`\`\`bash
# Bad: Missing mandatory body explaining why
git commit -m "fix: fix bug"

# Bad: Non-standard type prefix (use 'feat' instead of 'feature')
git commit -m "feature(dial): new dial"

# Bad: Non-standard type prefix (use 'fix' instead of 'bugfix')
git commit -m "bugfix: fixed websocket"

# Bad: Past tense summary without explanation
git commit -m "fixed stuff"
\`\`\`

---

## [🛠️ 4. Automated Tooling & Synchronization](#top)

- **Changelog Generator:** Run \`npm run changelog\` to generate formatted GitHub Release Notes from recent commits.
- **Doc Synchronization:** Run \`npm run docs:conventions\` to regenerate this file whenever \`commit-conventions.json\` is modified.
- **Assisted PR Creation:** Agents use the \`/create-pr\` skill to enforce conventional commit syntax and quality gates automatically.
`;

fs.writeFileSync(targetDocPath, content, 'utf8');
console.log(`✅ Successfully generated ${path.relative(rootDir, targetDocPath)} from commit-conventions.json`);
