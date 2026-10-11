import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../../..');

// Parse CLI scope: plugin | extension | diff | all
const args = process.argv.slice(2);
let scope = 'all';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--scope' && args[i + 1]) {
    scope = args[i + 1].toLowerCase();
    i++;
  } else if (['plugin', 'extension', 'diff', 'all'].includes(args[i].toLowerCase())) {
    scope = args[i].toLowerCase();
  }
}

let diffFiles = [];
if (scope === 'diff') {
  try {
    const { execSync } = await import('node:child_process');
    const branchDiff = execSync('git diff --name-only origin/main...HEAD', { cwd: ROOT_DIR, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    const uncommittedDiff = execSync('git status --porcelain', { cwd: ROOT_DIR, encoding: 'utf8' }).trim().split('\n').filter(Boolean).map(line => line.slice(3).trim());
    diffFiles = Array.from(new Set([...branchDiff, ...uncommittedDiff])).map(f => f.replace(/\\/g, '/'));
  } catch {
    diffFiles = [];
  }
}

let errorCount = 0;
let warningCount = 0;

console.log(`🛡️ Auditing project guardrails and architectural constraints (Scope: ${scope})...\n`);

const shouldCheckExtension = scope === 'all' || scope === 'extension' || (scope === 'diff' && diffFiles.some(f => f.startsWith('extension/')));
const shouldCheckPlugin = scope === 'all' || scope === 'plugin' || (scope === 'diff' && diffFiles.some(f => f.startsWith('plugin/src/')));
const shouldCheckPatterns = scope === 'all' || scope === 'plugin' || scope === 'extension' || (scope === 'diff' && diffFiles.some(f => f.startsWith('shared/') || f.includes('patterns')));

const extensionDir = path.join(ROOT_DIR, 'extension');

// 1. Zero Polling Overhead (extension/content.js and extension/ytm-*.js)
if (shouldCheckExtension && fs.existsSync(extensionDir)) {
  console.log('📌 1. Verifying Zero Polling Overhead in Browser Extension...');
  let extFiles = fs.readdirSync(extensionDir).filter(f => f.endsWith('.js') && f !== 'background.js');
  if (scope === 'diff') {
    extFiles = extFiles.filter(f => diffFiles.includes(`extension/${f}`));
  }
  for (const file of extFiles) {
    const fullPath = path.join(extensionDir, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Ignore comment lines
      if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) continue;
      if (/\bsetInterval\s*\(/.test(line)) {
        console.error(`  ❌ [extension/${file}:${i + 1}] Forbidden setInterval() detected (violates Zero Polling Overhead): "${line.trim()}"`);
        errorCount++;
      }
    }
  }
}

// 2. Context Isolation (MAIN vs ISOLATED World)
if (shouldCheckExtension && fs.existsSync(extensionDir)) {
  console.log('📌 2. Verifying Context Isolation Boundaries...');
  // MAIN World files must NEVER access chrome.* APIs
  let mainWorldFiles = fs.readdirSync(extensionDir).filter(f => f.startsWith('ytm-') || f === 'content.js');
  if (scope === 'diff') {
    mainWorldFiles = mainWorldFiles.filter(f => diffFiles.includes(`extension/${f}`));
  }
  for (const file of mainWorldFiles) {
    const fullPath = path.join(extensionDir, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) continue;
      if (/\bchrome\.(storage|runtime|tabs|windows)\b/.test(line)) {
        console.error(`  ❌ [extension/${file}:${i + 1}] MAIN World script directly accesses chrome API (violates Context Isolation): "${line.trim()}"`);
        errorCount++;
      }
    }
  }

  // ISOLATED World (bridge.js) must NEVER query player DOM elements directly
  const bridgePath = path.join(extensionDir, 'bridge.js');
  if (fs.existsSync(bridgePath) && (scope !== 'diff' || diffFiles.includes('extension/bridge.js'))) {
    const bridgeContent = fs.readFileSync(bridgePath, 'utf8');
    const bridgeLines = bridgeContent.split('\n');
    for (let i = 0; i < bridgeLines.length; i++) {
      const line = bridgeLines[i];
      if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) continue;
      if (/#movie_player/.test(line) || /querySelector\s*\(\s*['"]video/i.test(line)) {
        console.error(`  ❌ [extension/bridge.js:${i + 1}] ISOLATED World script directly accesses player DOM (violates Context Isolation): "${line.trim()}"`);
        errorCount++;
      }
    }
  }
}

// 3. Strict Typing Discipline in plugin/src/
function getTsFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

const pluginSrcDir = path.join(ROOT_DIR, 'plugin/src');
if (shouldCheckPlugin && fs.existsSync(pluginSrcDir)) {
  console.log('📌 3. Verifying TypeScript Typing Discipline in plugin/src/...');
  let tsFiles = getTsFiles(pluginSrcDir);
  if (scope === 'diff') {
    tsFiles = tsFiles.filter(f => {
      const relPath = path.relative(ROOT_DIR, f).replace(/\\/g, '/');
      return diffFiles.includes(relPath);
    });
  }
  for (const file of tsFiles) {
    const relPath = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*\/\//.test(line) && !line.includes('@ts-')) continue;
      
      // Check for forbidden type assertions: 'as any'
      if (/\bas\s+any\b/.test(line)) {
        console.error(`  ❌ [${relPath}:${i + 1}] Forbidden 'as any' type assertion: "${line.trim()}"`);
        errorCount++;
      }
      // Check for forbidden @ts-ignore or @ts-expect-error
      if (/@ts-ignore|@ts-expect-error/.test(line)) {
        console.error(`  ❌ [${relPath}:${i + 1}] Forbidden TypeScript suppression directive: "${line.trim()}"`);
        errorCount++;
      }
      // Check for orphaned console.log in production code (allow logger or dedicated debug)
      if (/\bconsole\.(log|debug)\s*\(/.test(line)) {
        console.warn(`  ⚠️ [${relPath}:${i + 1}] Orphaned console.log/debug statement in plugin source: "${line.trim()}"`);
        warningCount++;
      }
    }
  }
}

// 4. Synchronized Metadata Patterns (SSOT: shared/metadata-patterns.json)
const syncScriptPath = path.join(ROOT_DIR, 'scripts/sync-patterns.mjs');
if (shouldCheckPatterns && fs.existsSync(syncScriptPath)) {
  console.log('📌 4. Verifying Metadata Patterns Synchronization...');
  try {
    const { execFileSync } = await import('node:child_process');
    execFileSync(process.execPath, [syncScriptPath, '--check'], { stdio: 'pipe' });
  } catch {
    console.error('  ❌ Generated pattern files are out of date! Run "npm run sync:patterns" to synchronize.');
    errorCount++;
  }
}

console.log('\n=======================================');
if (errorCount === 0 && warningCount === 0) {
  console.log('✅ All guardrail and architectural checks passed with 0 errors and 0 warnings!');
  process.exit(0);
} else if (errorCount === 0) {
  console.log(`⚠️ Guardrail audit completed with 0 errors and ${warningCount} warnings.`);
  process.exit(0);
} else {
  console.error(`❌ Guardrail audit failed with ${errorCount} errors and ${warningCount} warnings.`);
  process.exit(1);
}
