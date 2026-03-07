#!/usr/bin/env node
/**
 * Deploy Chat Desk release to goranked.gg
 *
 * Usage:
 *   node scripts/deploy-release.js
 *
 * Prerequisites:
 *   - Run from chatapp directory
 *   - Release files in release/ (latest.yml, *.exe, *.blockmap)
 *   - Goranked.gg at ../goranked.gg (or set RELEASE_DEST)
 *
 * The script copies release files to goranked.gg/public/chat-desk/releases/
 * and updates releases.json with the new version.
 */

const fs = require('fs');
const path = require('path');

const CHATAPP_ROOT = path.resolve(__dirname, '..');
const RELEASE_DIR = path.join(CHATAPP_ROOT, 'release');
const DEST_BASE = process.env.RELEASE_DEST || path.resolve(CHATAPP_ROOT, '../goranked.gg/public/chat-desk/releases');

const pkg = JSON.parse(fs.readFileSync(path.join(CHATAPP_ROOT, 'package.json'), 'utf8'));
const version = pkg.version;

function main() {
  if (!fs.existsSync(RELEASE_DIR)) {
    console.error('❌ Release directory not found. Run build first: npm run build:win:installer');
    process.exit(1);
  }

  const files = fs.readdirSync(RELEASE_DIR);
  const winFiles = files.filter(f =>
    f.endsWith('.exe') || f.endsWith('.blockmap') || f === 'latest.yml'
  );

  if (winFiles.length === 0) {
    console.error('❌ No Windows release files found in release/');
    console.error('   Expected: *.exe, *.blockmap, latest.yml');
    process.exit(1);
  }

  if (!fs.existsSync(DEST_BASE)) {
    fs.mkdirSync(DEST_BASE, { recursive: true });
  }

  console.log(`📦 Deploying v${version} to ${DEST_BASE}`);
  for (const f of winFiles) {
    const src = path.join(RELEASE_DIR, f);
    const dst = path.join(DEST_BASE, f);
    fs.copyFileSync(src, dst);
    console.log(`   ✓ ${f}`);
  }

  // Update releases.json
  const releasesPath = path.join(DEST_BASE, 'releases.json');
  let releases = [];
  if (fs.existsSync(releasesPath)) {
    try {
      releases = JSON.parse(fs.readFileSync(releasesPath, 'utf8'));
    } catch (e) {
      console.warn('⚠ Could not parse releases.json, starting fresh');
    }
  }

  const existing = releases.find(r => r.version === version || r.version === `v${version}`);
  if (!existing) {
    releases.unshift({
      version,
      releaseDate: new Date().toISOString(),
      changelog: process.env.CHANGELOG || `Оновлення до версії ${version}`,
    });
    fs.writeFileSync(releasesPath, JSON.stringify(releases, null, 2));
    console.log(`   ✓ releases.json updated with v${version}`);
  } else {
    console.log(`   ℹ v${version} already in releases.json`);
  }

  console.log('\n✅ Deploy complete. Updates will be served from:');
  console.log(`   https://goranked.gg/chat-desk/releases`);
}

main();
