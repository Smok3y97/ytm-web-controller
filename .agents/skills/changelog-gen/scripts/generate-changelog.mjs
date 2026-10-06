#!/usr/bin/env node
/**
 * Automated Release Notes & Changelog Generator
 * 
 * Formats Conventional Commits between Git tags into high-quality, structured
 * GitHub Release Notes with category emojis, commit links, and installation steps.
 * 
 * Usage:
 *   node generate-changelog.mjs
 *   node generate-changelog.mjs --help
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..', '..', '..');

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: node generate-changelog.mjs [options]

Options:
  --help, -h       Show this help message
  --tag <tag>      Specify base tag manually (default: latest tag from git describe)

Description:
  Parses conventional commits since the previous git release tag,
  groups them by category with emojis, formats sub-bullets from commit bodies,
  and attaches the standard Installation & Setup instructions and compare URL.
`);
  process.exit(0);
}

// 1. Read metadata from version.json and package.json
let targetVersion = '2.0.2.0';
try {
  const vJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'version.json'), 'utf8'));
  targetVersion = vJson.version || '2.0.2.0';
} catch (e) { }

let repoUrl = 'https://github.com/smok3y97/ytm-web-controller';
try {
  const pkgJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  if (pkgJson.repository && pkgJson.repository.url) {
    repoUrl = pkgJson.repository.url.replace(/\.git$/i, '');
  }
} catch (e) { }

// 2. Identify previous tag
let baseTag = '';
const tagArgIndex = process.argv.indexOf('--tag');
if (tagArgIndex !== -1 && process.argv[tagArgIndex + 1]) {
  baseTag = process.argv[tagArgIndex + 1];
} else {
  try {
    const allTags = execSync('git tag --sort=-creatordate', { cwd: rootDir, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    if (allTags.length > 0) {
      // If the latest tag is already targetVersion, compare against the previous tag
      if (allTags[0] === `v${targetVersion}` && allTags.length > 1) {
        baseTag = allTags[1];
      } else {
        baseTag = allTags[0];
      }
    }
  } catch (e) {
    try {
      baseTag = execSync('git rev-list --max-parents=0 HEAD', { cwd: rootDir, encoding: 'utf8' }).trim();
    } catch {
      baseTag = 'HEAD~10';
    }
  }
}

// 3. Extract commits with subject and body
let logOutput = '';
try {
  logOutput = execSync(`git log ${baseTag}..HEAD --pretty=format:"COMMIT_DELIM%h%x09%s%x09%b"`, { cwd: rootDir, encoding: 'utf8' }).trim();
} catch (e) {
  console.error(`❌ Error reading git log since tag '${baseTag}':`, e.message);
  process.exit(1);
}

if (!logOutput) {
  console.log(`No commits found between ${baseTag} and HEAD.`);
  process.exit(0);
}

const rawCommits = logOutput.split('COMMIT_DELIM').filter(Boolean);

// 4. Load Single Source of Truth (SSOT) for commit conventions
const conventionsPath = path.resolve(__dirname, '..', 'resources', 'commit-conventions.json');
let conventions = { types: {}, aliases: {}, breaking: { emoji: '⚠️', section: 'Breaking Changes' } };
try {
  conventions = JSON.parse(fs.readFileSync(conventionsPath, 'utf8'));
} catch (e) {
  console.warn(`⚠️ Warning: Could not read commit-conventions.json at ${conventionsPath}:`, e.message);
}

const categories = {
  breaking: {
    emoji: conventions.breaking?.emoji || '⚠️',
    name: conventions.breaking?.section || 'Breaking Changes',
    items: [],
  },
};

for (const [typeKey, typeConfig] of Object.entries(conventions.types || {})) {
  categories[typeKey] = {
    emoji: typeConfig.emoji || '📌',
    name: typeConfig.section || typeKey,
    items: [],
  };
}

const typeAliases = conventions.aliases || {};


for (const raw of rawCommits) {
  const parts = raw.split('\t');
  const hash = parts[0]?.trim();
  const rawSubject = parts[1]?.trim();
  const rawBody = parts[2]?.trim() || '';

  if (!hash || !rawSubject) continue;

  const isBreaking = rawSubject.includes('!:') || rawSubject.toLowerCase().includes('breaking change') || rawBody.toLowerCase().includes('breaking change');

  // Strip leading gitmojis so type can be matched cleanly
  const subject = rawSubject.replace(/^[\p{Extended_Pictographic}\s]+(?=[a-z]+(\(|$|:))/u, '').trim();
  const match = subject.match(/^([a-z]+)(\([^)]+\))?!?:?\s*(.*)$/iu);

  // Parse body bullet points
  const subBullets = [];
  if (rawBody) {
    const bodyLines = rawBody.split('\n');
    for (const bLine of bodyLines) {
      const trimmed = bLine.trim();
      if (!trimmed) continue;
      // Convert Markdown bullet or raw sentence into sub-bullet
      const bulletContent = trimmed.replace(/^[-*]\s*/, '').trim();
      if (bulletContent) {
        subBullets.push(bulletContent);
      }
    }
  }

  let type = 'chore';
  let formattedTitle = rawSubject;

  if (match) {
    type = match[1].toLowerCase();
    if (typeAliases[type]) {
      type = typeAliases[type];
    }
    const scope = match[2] ? match[2].slice(1, -1) : '';
    const desc = match[3] || rawSubject;
    const capitalized = desc.charAt(0).toUpperCase() + desc.slice(1);
    formattedTitle = scope ? `**${scope}:** ${capitalized}` : capitalized;
  }

  const commitObj = {
    hash,
    title: formattedTitle,
    subBullets,
  };

  if (isBreaking) {
    categories.breaking.items.push(commitObj);
  } else if (categories[type]) {
    categories[type].items.push(commitObj);
  } else {
    categories.chore.items.push(commitObj);
  }
}

// 5. Render Structured Release Notes
console.log(`# 🎵 Controller for YouTube Music Web – Release v${targetVersion}\n`);
console.log(`This release brings quality, stability, and performance improvements to the Stream Deck plugin and companion browser extension.\n`);
console.log(`---\n`);

let sectionIndex = 1;
for (const [key, section] of Object.entries(categories)) {
  if (section.items.length === 0) continue;

  console.log(`### ${section.emoji} ${sectionIndex}. ${section.name}`);
  for (const item of section.items) {
    const commitLink = `[\`${item.hash}\`](${repoUrl}/commit/${item.hash})`;
    const titleText = item.title.startsWith('**') ? item.title : `**${item.title}**`;
    console.log(`- ${titleText} (${commitLink}):`);
    if (item.subBullets.length > 0) {
      for (const bullet of item.subBullets) {
        console.log(`  - ${bullet}`);
      }
    }
  }
  console.log('\n---');
  sectionIndex++;
}

// 6. Append Standard Installation & Setup Instructions
console.log(`
## 📦 Installation & Setup

1. **Stream Deck Plugin**: Download \`com.smok3y97.ytmusicweb.streamDeckPlugin\` below and double-click to install.
2. **Browser Companion Extension**: Download \`extension.zip\`, extract it, and load it as an unpacked extension in your Chromium browser (\`chrome://extensions\` with Developer Mode enabled).

**Full Changelog**: ${repoUrl}/compare/${baseTag}...v${targetVersion}
`);
