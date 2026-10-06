import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../../..');

let errorCount = 0;
let warningCount = 0;

console.log('🔄 Auditing code-to-documentation synchronization...\n');

// 1. Version Synchronization across all manifests
console.log('📌 1. Verifying Version Synchronization across Manifests...');
const versionFile = path.join(ROOT_DIR, 'version.json');
if (fs.existsSync(versionFile)) {
  const { version: targetVersion } = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
  console.log(`  Target Monorepo Version: ${targetVersion}`);

  const filesToCheck = [
    { path: 'package.json', get: json => json.version },
    { path: 'plugin/package.json', get: json => json.version },
    { path: 'plugin/com.smok3y97.ytmusicweb.sdPlugin/manifest.json', get: json => json.Version },
    { path: 'extension/manifest.json', get: json => json.version }
  ];

  for (const item of filesToCheck) {
    const fullPath = path.join(ROOT_DIR, item.path);
    if (fs.existsSync(fullPath)) {
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      const val = item.get(data);
      if (val !== targetVersion) {
        console.error(`  ❌ [${item.path}] Version mismatch: found "${val}", expected "${targetVersion}"`);
        errorCount++;
      }
    } else {
      console.error(`  ❌ [${item.path}] File not found`);
      errorCount++;
    }
  }
}

// 2. Action UUID Documentation in docs/features.md
console.log('📌 2. Verifying Action Documentation in docs/features.md...');
const manifestPath = path.join(ROOT_DIR, 'plugin/com.smok3y97.ytmusicweb.sdPlugin/manifest.json');
const featuresDocPath = path.join(ROOT_DIR, 'docs/features.md');

if (fs.existsSync(manifestPath) && fs.existsSync(featuresDocPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const featuresContent = fs.readFileSync(featuresDocPath, 'utf8');

  for (const action of manifest.Actions || []) {
    const uuid = action.UUID;
    const name = action.Name;
    const cleanName = name.replace(/\s*\(Dial\)/, '');
    const isDocumented = featuresContent.includes(uuid) || featuresContent.includes(name) || featuresContent.includes(cleanName);
    if (!isDocumented) {
      console.error(`  ❌ [docs/features.md] Action "${name}" (${uuid}) is not documented`);
      errorCount++;
    }
  }
}

// 3. NPM Scripts Documentation in docs/development.md
console.log('📌 3. Verifying NPM Scripts Documentation in docs/development.md...');
const pkgPath = path.join(ROOT_DIR, 'package.json');
const devDocPath = path.join(ROOT_DIR, 'docs/development.md');

if (fs.existsSync(pkgPath) && fs.existsSync(devDocPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const devDocContent = fs.readFileSync(devDocPath, 'utf8');

  // Core user-facing and workflow scripts that must be documented
  const essentialScripts = Object.keys(pkg.scripts || []).filter(s => !s.startsWith('pre') && !s.startsWith('post'));
  for (const script of essentialScripts) {
    if (!devDocContent.includes(`npm run ${script}`)) {
      console.warn(`  ⚠️ [docs/development.md] Script "npm run ${script}" is not documented in the command tables`);
      warningCount++;
    }
  }
}

console.log('\n=======================================');
if (errorCount === 0 && warningCount === 0) {
  console.log('✅ All synchronization checks passed with 0 errors and 0 warnings!');
  process.exit(0);
} else if (errorCount === 0) {
  console.log(`⚠️ Synchronization check completed with 0 errors and ${warningCount} warnings.`);
  process.exit(0);
} else {
  console.error(`❌ Synchronization check failed with ${errorCount} errors and ${warningCount} warnings.`);
  process.exit(1);
}
