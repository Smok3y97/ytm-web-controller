import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../../..');

// Load glossary
const glossaryPath = path.join(__dirname, '../resources/glossary.json');
let glossary = { terminology: { preferred: [], forbidden_buzzwords: [] } };
if (fs.existsSync(glossaryPath)) {
  glossary = JSON.parse(fs.readFileSync(glossaryPath, 'utf8'));
}

function githubSlug(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_]/g, '')
    // strip unicode variation selectors
    .replace(/[\uFE00-\uFE0F]/g, '')
    // remove punctuation/emojis except letters, numbers, spaces, hyphens
    .replace(/[^\p{L}\p{N}\p{Pc}\- \t]/gu, '')
    .replace(/[ \t]/g, '-');
}

function getMarkdownFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (['node_modules', '.git', 'bin', 'release', 'scratch'].includes(entry.name)) {
      continue;
    }
    if (entry.isDirectory()) {
      results.push(...getMarkdownFiles(fullPath));
    } else if (entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = [
  ...getMarkdownFiles(path.join(ROOT_DIR, 'docs')),
  path.join(ROOT_DIR, 'README.md'),
  path.join(ROOT_DIR, 'CONTRIBUTING.md'),
  path.join(ROOT_DIR, 'AGENTS.md')
].filter(f => fs.existsSync(f));

let errorCount = 0;
let warningCount = 0;

console.log('🔍 Auditing documentation hygiene across repository...\n');

// 1. Audit Forbidden Buzzwords & Terminology
console.log('📌 1. Checking Editorial Tone & Terminology...');
for (const file of files) {
  const relPath = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');

  // Forbidden buzzwords
  for (const bw of glossary.terminology.forbidden_buzzwords || []) {
    const regex = new RegExp(`\\b${bw}\\b`, 'i');
    if (regex.test(content)) {
      console.error(`  ❌ [${relPath}] Contains forbidden buzzword: "${bw}"`);
      errorCount++;
    }
  }

  // Preferred terminology violations (case-sensitive check on prose outside code spans)
  // Remove fenced code blocks, inline code blocks, and accepted definition abbreviations
  const proseOnly = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/Property Inspector \(PI\)/g, '');

  for (const item of glossary.terminology.preferred || []) {
    for (const forbidden of item.forbidden || []) {
      const escaped = forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`);
      if (regex.test(proseOnly)) {
        console.warn(`  ⚠️ [${relPath}] Uses discouraged term "${forbidden}". Prefer "${item.term}".`);
        warningCount++;
      }
    }
  }
}

// 2. Audit Relative File Links
console.log('📌 2. Checking Relative File Links...');
for (const file of files) {
  const relPath = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  const fileDir = path.dirname(file);
  const content = fs.readFileSync(file, 'utf8');

  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  for (const match of content.matchAll(linkRegex)) {
    const link = match[2].trim();
    if (link.startsWith('http://') || link.startsWith('https://') || link.startsWith('mailto:') || link.startsWith('#')) {
      continue;
    }
    const targetPathOnly = link.split('#')[0];
    if (targetPathOnly) {
      const resolved = path.resolve(fileDir, targetPathOnly);
      if (!fs.existsSync(resolved)) {
        console.error(`  ❌ [${relPath}] Dead relative link "${link}" (resolved to: ${resolved})`);
        errorCount++;
      }
    }
  }
}

// 3. Audit Anchors & Table of Contents
console.log('📌 3. Checking Anchors and TOC Targets...');
for (const file of files) {
  const relPath = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  const anchors = new Set(['top']);
  const slugCounts = {};

  for (const line of lines) {
    const hMatch = line.match(/^#{1,6}\s+(.*)/);
    if (hMatch) {
      let rawText = hMatch[1].trim();
      let slug = githubSlug(rawText);
      if (slugCounts[slug] !== undefined) {
        slugCounts[slug]++;
        slug = `${slug}-${slugCounts[slug]}`;
      } else {
        slugCounts[slug] = 0;
      }
      anchors.add(slug);
    }
    const idMatches = line.matchAll(/<a\s+(?:id|name)=["']([^"']+)["']/gi);
    for (const idm of idMatches) {
      anchors.add(idm[1]);
    }
  }

  const linkMatches = content.matchAll(/\[([^\]]+)\]\(#([^)]+)\)/g);
  for (const lm of linkMatches) {
    const text = lm[1];
    const target = lm[2];
    if (!anchors.has(target)) {
      console.error(`  ❌ [${relPath}] Broken fragment link: [${text}](#${target}) - anchor not found`);
      errorCount++;
    }
  }
}

// 4. Audit Navigation Standards for docs/*.md
console.log('📌 4. Checking docs/ Navigation Standards (<a id="top"></a> & ## [Title](#top))...');
const docsDir = path.join(ROOT_DIR, 'docs');
if (fs.existsSync(docsDir)) {
  const docsFiles = fs.readdirSync(docsDir).filter(f => f.endsWith('.md')).map(f => path.join(docsDir, f));
  for (const file of docsFiles) {
    const relPath = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    if (!content.includes('<a id="top"></a>')) {
      console.error(`  ❌ [${relPath}] Missing '<a id="top"></a>' anchor at the top of the file`);
      errorCount++;
    }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^##\s+/.test(line)) {
        if (!line.includes('Table of Contents') && !/\[.*\]\(#top\)/.test(line)) {
          console.error(`  ❌ [${relPath}:${i + 1}] Section header missing back-to-top link: ${line}`);
          errorCount++;
        }
      }
    }
  }
}

// 5. Audit GitHub Alert Callout Syntax
console.log('📌 5. Checking GitHub Alert Callout Syntax...');
for (const file of files) {
  const relPath = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*>\s*(⚠️|💡|ℹ️|❗|🔥|📌)\s+/.test(lines[i])) {
      console.error(`  ❌ [${relPath}:${i + 1}] Legacy emoji callout found. Use '> [!NOTE]' / '> [!WARNING]' instead: "${lines[i].trim()}"`);
      errorCount++;
    }
  }
}

// Summary
console.log('\n=======================================');
if (errorCount === 0 && warningCount === 0) {
  console.log('✅ All documentation checks passed with 0 errors and 0 warnings!');
  process.exit(0);
} else if (errorCount === 0) {
  console.log(`⚠️ Documentation check completed with 0 errors and ${warningCount} warnings.`);
  process.exit(0);
} else {
  console.error(`❌ Documentation check failed with ${errorCount} errors and ${warningCount} warnings.`);
  process.exit(1);
}
