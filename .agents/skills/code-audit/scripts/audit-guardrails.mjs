import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../../..');

let errorCount = 0;
let warningCount = 0;

console.log('🛡️ Auditing project guardrails and architectural constraints...\n');

// 1. Zero Polling Overhead (extension/content.js and extension/ytm-*.js)
console.log('📌 1. Verifying Zero Polling Overhead in Browser Extension...');
const extensionDir = path.join(ROOT_DIR, 'extension');
if (fs.existsSync(extensionDir)) {
  const extFiles = fs.readdirSync(extensionDir).filter(f => f.endsWith('.js') && f !== 'background.js');
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
console.log('📌 2. Verifying Context Isolation Boundaries...');
if (fs.existsSync(extensionDir)) {
  // MAIN World files must NEVER access chrome.* APIs
  const mainWorldFiles = fs.readdirSync(extensionDir).filter(f => f.startsWith('ytm-') || f === 'content.js');
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
  if (fs.existsSync(bridgePath)) {
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
console.log('📌 3. Verifying TypeScript Typing Discipline in plugin/src/...');
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
if (fs.existsSync(pluginSrcDir)) {
  const tsFiles = getTsFiles(pluginSrcDir);
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
