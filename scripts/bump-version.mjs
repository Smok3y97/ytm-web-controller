/**
 * Centralized Version Bump Script
 * 
 * Synchronizes the 4-part Elgato Stream Deck specification version across:
 * 1. version.json
 * 2. package.json (root)
 * 3. plugin/package.json
 * 4. plugin/manifest.json
 * 5. extension/manifest.json
 * 
 * Usage:
 *   node scripts/bump-version.mjs 1.5.0.0
 *   npm run bump 1.5.0.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const versionRegex = /^(0|[1-9]\d*)(\.(0|[1-9]\d*)){3}$/;

// 1. Determine target version
let targetVersion = process.argv[2];

const versionJsonPath = path.join(rootDir, 'version.json');

if (!targetVersion) {
  if (fs.existsSync(versionJsonPath)) {
    try {
      const vJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
      targetVersion = vJson.version;
    } catch (e) { }
  }
}

if (!targetVersion) {
  console.error('❌ Error: No version specified.');
  console.error('Usage: npm run bump <major.minor.patch.build> (e.g. npm run bump 1.5.0.0)');
  process.exit(1);
}

targetVersion = targetVersion.trim().replace(/^v/i, '');

// If 3 parts provided (e.g. 1.5.0), automatically append .0 for 4-digit Elgato standard
const parts = targetVersion.split('.');
if (parts.length === 3) {
  targetVersion = `${targetVersion}.0`;
}

if (!versionRegex.test(targetVersion)) {
  console.error(`❌ Error: Invalid version format '${targetVersion}'.`);
  console.error('Expected strictly 4 numeric parts matching regex ^(0|[1-9]\\d*)(\\.(0|[1-9]\\d*)){3}$ (e.g. 1.5.0.0).');
  process.exit(1);
}

const vParts = targetVersion.split('.');
const shortVersion = `${vParts[0]}.${vParts[1]}.${vParts[2]}`;

console.log(`\n🚀 Synchronizing project version to: ${targetVersion} (Display: v${shortVersion})\n`);

function updateJsonFile(filePath, updater) {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ Warning: File not found: ${filePath}`);
    return;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const json = JSON.parse(content);
  updater(json);
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log(`  ✓ Updated: ${path.relative(rootDir, filePath)}`);
}

// 1. version.json
updateJsonFile(versionJsonPath, (json) => {
  json.version = targetVersion;
});

// 2. root package.json
updateJsonFile(path.join(rootDir, 'package.json'), (json) => {
  json.version = targetVersion;
});

// 3. plugin/package.json
const pluginDir = path.join(rootDir, 'plugin');
updateJsonFile(path.join(pluginDir, 'package.json'), (json) => {
  json.version = targetVersion;
});

// 4. plugin/manifest.json
updateJsonFile(path.join(pluginDir, 'manifest.json'), (json) => {
  json.Version = targetVersion;
});

// 5. extension/manifest.json
updateJsonFile(path.join(rootDir, 'extension', 'manifest.json'), (json) => {
  json.version = targetVersion;
  json.version_name = shortVersion;
});

// 6. extension/popup.html static fallback
const popupHtmlPath = path.join(rootDir, 'extension', 'popup.html');
if (fs.existsSync(popupHtmlPath)) {
  let html = fs.readFileSync(popupHtmlPath, 'utf8');
  html = html.replace(/<span id="version-text">v[0-9.]+\s*•\s*Open Source<\/span>/i, `<span id="version-text">v${shortVersion} • Open Source</span>`);
  fs.writeFileSync(popupHtmlPath, html, 'utf8');
  console.log(`  ✓ Updated: ${path.relative(rootDir, popupHtmlPath)}`);
}

// 7. Let npm natively update package-lock.json files without manual JSON manipulation
try {
  if (fs.existsSync(path.join(pluginDir, 'package-lock.json'))) {
    execSync('npm install --package-lock-only', { cwd: pluginDir, stdio: 'ignore' });
    console.log(`  ✓ Updated (via npm): plugin/package-lock.json`);
  }
} catch (e) {
  console.warn(`  ⚠️ Warning: Could not update plugin/package-lock.json via npm.`);
}

console.log(`\n✅ Successfully synchronized all version files to ${targetVersion}!\n`);
