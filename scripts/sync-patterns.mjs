#!/usr/bin/env node
/**
 * Synchronize Metadata Patterns Script
 *
 * Reads shared/metadata-patterns.json (Single Source of Truth) and compiles:
 * 1. extension/ytm-patterns.js (Browser MAIN-World RegExp constants under window.YTM.patterns)
 * 2. plugin/src/services/metadata-patterns.ts (TypeScript RegExp constant exports)
 *
 * Usage:
 *   node scripts/sync-patterns.mjs          # Generate & write files
 *   node scripts/sync-patterns.mjs --check  # Verify up-to-date without modifying (CI/Guardrail)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const PATTERNS_JSON_PATH = path.join(ROOT_DIR, 'shared', 'metadata-patterns.json');
const EXTENSION_OUTPUT_PATH = path.join(ROOT_DIR, 'extension', 'ytm-patterns.js');
const PLUGIN_OUTPUT_PATH = path.join(ROOT_DIR, 'plugin', 'src', 'services', 'metadata-patterns.ts');

const isCheckOnly = process.argv.includes('--check');

// 1. Read and validate Single Source of Truth
if (!fs.existsSync(PATTERNS_JSON_PATH)) {
  console.error(`❌ [sync-patterns] Source file not found: ${PATTERNS_JSON_PATH}`);
  process.exit(1);
}

const rawConfig = fs.readFileSync(PATTERNS_JSON_PATH, 'utf8');
let config;
try {
  config = JSON.parse(rawConfig);
} catch (err) {
  console.error(`❌ [sync-patterns] Failed to parse JSON in ${PATTERNS_JSON_PATH}: ${err.message}`);
  process.exit(1);
}

const entries = Object.entries(config.patterns || {});
if (entries.length === 0) {
  console.error('❌ [sync-patterns] No patterns found in configuration!');
  process.exit(1);
}

// Validate each regex compiles without errors
for (const [key, item] of entries) {
  try {
    new RegExp(item.pattern, item.flags || '');
  } catch (err) {
    console.error(`❌ [sync-patterns] Invalid regex pattern for "${key}": ${err.message}`);
    process.exit(1);
  }
}

// 2. Generate extension/ytm-patterns.js
const extensionLines = [
  '/**',
  ' * YouTube Music Web Controller - Metadata Patterns',
  ' *',
  ' * AUTO-GENERATED FILE - DO NOT EDIT MANUALLY!',
  ' * Source of Truth: shared/metadata-patterns.json',
  ' * Generated via: npm run sync:patterns',
  ' */',
  '',
  "'use strict';",
  '',
  'window.YTM = window.YTM || {};',
  '',
  'window.YTM.patterns = {',
];

for (const [, item] of entries) {
  const flags = item.flags || '';
  const desc = item.description ? `  // ${item.description}\n` : '';
  extensionLines.push(`${desc}  ${item.constantName}: new RegExp(${JSON.stringify(item.pattern)}, ${JSON.stringify(flags)}),`);
}

extensionLines.push('};', '');
const extensionContent = extensionLines.join('\n');

// 3. Generate plugin/src/services/metadata-patterns.ts
const pluginLines = [
  '/**',
  ' * Metadata Patterns Service Constants',
  ' *',
  ' * AUTO-GENERATED FILE - DO NOT EDIT MANUALLY!',
  ' * Source of Truth: shared/metadata-patterns.json',
  ' * Generated via: npm run sync:patterns',
  ' */',
  '',
];

for (const [, item] of entries) {
  const flags = item.flags || '';
  if (item.description) {
    pluginLines.push(`/** ${item.description} */`);
  }
  pluginLines.push(`export const ${item.constantName} = new RegExp(${JSON.stringify(item.pattern)}, ${JSON.stringify(flags)});`);
  pluginLines.push('');
}

const pluginContent = pluginLines.join('\n');

let formattedPluginContent = pluginContent;
try {
  const prettierPath = path.join(ROOT_DIR, 'plugin/node_modules/prettier/index.mjs');
  if (fs.existsSync(prettierPath)) {
    const prettier = await import(pathToFileURL(prettierPath).href);
    const cfg = await prettier.resolveConfig(PLUGIN_OUTPUT_PATH);
    formattedPluginContent = await prettier.format(pluginContent, { ...cfg, parser: 'typescript' });
  }
} catch {
  // Prettier fallback if node_modules not yet present
}

// 4. Check or Write
if (isCheckOnly) {
  let isOutOfDate = false;

  const currentExt = fs.existsSync(EXTENSION_OUTPUT_PATH) ? fs.readFileSync(EXTENSION_OUTPUT_PATH, 'utf8') : null;
  const currentPlugin = fs.existsSync(PLUGIN_OUTPUT_PATH) ? fs.readFileSync(PLUGIN_OUTPUT_PATH, 'utf8') : null;

  if (currentExt !== extensionContent) {
    console.error(`❌ [sync-patterns] ${path.relative(ROOT_DIR, EXTENSION_OUTPUT_PATH)} is missing or out of date!`);
    isOutOfDate = true;
  }

  if (currentPlugin !== formattedPluginContent) {
    console.error(`❌ [sync-patterns] ${path.relative(ROOT_DIR, PLUGIN_OUTPUT_PATH)} is missing or out of date!`);
    isOutOfDate = true;
  }

  if (isOutOfDate) {
    console.error('\nRun "npm run sync:patterns" to regenerate files from shared/metadata-patterns.json.\n');
    process.exit(1);
  }

  console.log('✅ [sync-patterns] All metadata pattern files are up to date.');
  process.exit(0);
} else {
  fs.writeFileSync(EXTENSION_OUTPUT_PATH, extensionContent, 'utf8');
  console.log(`✅ [sync-patterns] Generated ${path.relative(ROOT_DIR, EXTENSION_OUTPUT_PATH)}`);

  fs.writeFileSync(PLUGIN_OUTPUT_PATH, formattedPluginContent, 'utf8');
  console.log(`✅ [sync-patterns] Generated ${path.relative(ROOT_DIR, PLUGIN_OUTPUT_PATH)}`);
}
