import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../../..');

// Load asset specifications resource
const specsPath = path.join(__dirname, '../resources/asset-specs.json');
let specs = null;
if (fs.existsSync(specsPath)) {
  specs = JSON.parse(fs.readFileSync(specsPath, 'utf8'));
}

let errorCount = 0;
let warningCount = 0;

console.log('🎨 Auditing asset specifications and marketplace compliance...\n');

// 1. Verify Plugin Manifest Assets
console.log('📌 1. Verifying Stream Deck Plugin Manifest Assets...');
const pluginDir = path.join(ROOT_DIR, 'plugin/com.smok3y97.ytmusicweb.sdPlugin');
const manifestPath = path.join(pluginDir, 'manifest.json');

if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  function checkAssetFile(basePath, label) {
    if (!basePath) return;
    const candidates = [
      path.join(pluginDir, basePath),
      path.join(pluginDir, `${basePath}.png`),
      path.join(pluginDir, `${basePath}.svg`)
    ];
    const exists = candidates.some(c => fs.existsSync(c));
    if (!exists) {
      console.error(`  ❌ Missing asset for ${label}: "${basePath}"`);
      errorCount++;
    }
  }

  checkAssetFile(manifest.Icon, 'Plugin Icon');
  checkAssetFile(manifest.CategoryIcon, 'Category Icon');

  for (const action of manifest.Actions || []) {
    checkAssetFile(action.Icon, `Action Icon (${action.Name})`);
    for (const state of action.States || []) {
      checkAssetFile(state.Image, `Action State Image (${action.Name})`);
    }
  }
} else {
  console.error('  ❌ Plugin manifest not found at:', manifestPath);
  errorCount++;
}

// 2. Verify Browser Extension Icons
console.log('📌 2. Verifying Browser Extension Icons...');
const extManifestPath = path.join(ROOT_DIR, 'extension/manifest.json');
if (fs.existsSync(extManifestPath)) {
  const extManifest = JSON.parse(fs.readFileSync(extManifestPath, 'utf8'));
  const iconPaths = new Set([
    ...Object.values(extManifest.icons || {}),
    ...Object.values(extManifest.action?.default_icon || {})
  ]);

  for (const relIcon of iconPaths) {
    const iconFullPath = path.join(ROOT_DIR, 'extension', relIcon);
    if (!fs.existsSync(iconFullPath)) {
      console.error(`  ❌ Missing browser extension icon: "extension/${relIcon}"`);
      errorCount++;
    }
  }
}

// 3. Verify LCD Touchstrip Dial Layout Structure
console.log('📌 3. Verifying LCD Dial Layout Specification...');
const dialLayoutPath = path.join(pluginDir, 'layouts/dial_layout.json');
if (fs.existsSync(dialLayoutPath)) {
  const layout = JSON.parse(fs.readFileSync(dialLayoutPath, 'utf8'));
  if (!layout.items || !Array.isArray(layout.items)) {
    console.error('  ❌ Dial layout missing valid "items" array');
    errorCount++;
  }
} else {
  console.warn('  ⚠️ Dial layout not found at:', dialLayoutPath);
  warningCount++;
}

console.log('\n=======================================');
if (errorCount === 0 && warningCount === 0) {
  console.log('✅ All asset validation checks passed with 0 errors and 0 warnings!');
  process.exit(0);
} else if (errorCount === 0) {
  console.log(`⚠️ Asset validation completed with 0 errors and ${warningCount} warnings.`);
  process.exit(0);
} else {
  console.error(`❌ Asset validation failed with ${errorCount} errors and ${warningCount} warnings.`);
  process.exit(1);
}
