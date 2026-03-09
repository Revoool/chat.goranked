#!/usr/bin/env node
/**
 * Clean old GitHub Actions workflow runs and their artifacts.
 * Optionally trigger a new build.
 *
 * Usage: GITHUB_TOKEN=ghp_xxx node scripts/clean-gh-actions.js [options]
 * Or add GITHUB_TOKEN to .env (gitignored)
 *
 * Options:
 *   --keep N    Keep the N most recent runs (default: 1)
 *   --trigger   After cleanup, trigger workflow_dispatch for latest tag
 *   --tag TAG   Tag to use for --trigger (default: v2.0.20 from package.json)
 */

const fs = require('fs');
const path = require('path');

// Load .env if exists
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^GITHUB_TOKEN=(.+)$/);
    if (m) {
      process.env.GITHUB_TOKEN = m[1].trim().replace(/^["']|["']$/g, '');
      break;
    }
  }
}

const REPO = 'Revoool/chat.goranked';
const WORKFLOW_ID = 'build.yml';

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('Error: GITHUB_TOKEN is required');
    console.error('Create at: https://github.com/settings/tokens (scope: repo, workflow)');
    console.error('Usage: GITHUB_TOKEN=ghp_xxx node scripts/clean-gh-actions.js [--keep 3] [--trigger]');
    process.exit(1);
  }

  const keepIdx = process.argv.indexOf('--keep');
  const keep = keepIdx >= 0 && process.argv[keepIdx + 1]
    ? parseInt(process.argv[keepIdx + 1], 10)
    : 1;

  const doTrigger = process.argv.includes('--trigger');
  const tagIdx = process.argv.indexOf('--tag');
  let tag = (tagIdx >= 0 && process.argv[tagIdx + 1]) ? process.argv[tagIdx + 1] : null;
  if (!tag) {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    tag = 'v' + pkg.version;
  }

  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const base = `https://api.github.com/repos/${REPO}`;

  // List workflow runs
  const listRes = await fetch(
    `${base}/actions/workflows/${WORKFLOW_ID}/runs?per_page=100`,
    { headers }
  );
  if (!listRes.ok) {
    console.error('Failed to list runs:', listRes.status, await listRes.text());
    process.exit(1);
  }
  const listData = await listRes.json();
  const runs = listData.workflow_runs || [];

  runs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const toDelete = runs.slice(keep);
  if (toDelete.length > 0) {
    console.log(`Keeping ${keep} most recent run(s), deleting ${toDelete.length} old run(s)...`);
    for (const run of toDelete) {
      const runUrl = `${base}/actions/runs/${run.id}`;
      const delRes = await fetch(runUrl, { method: 'DELETE', headers });
      if (delRes.ok) {
        console.log(`  Deleted run #${run.run_number} (id: ${run.id})`);
      } else {
        console.error(`  Failed to delete run #${run.run_number}:`, delRes.status);
      }
    }
    console.log('Cleanup done.');
  } else {
    console.log('No old runs to delete.');
  }

  if (doTrigger) {
    const ref = tag.startsWith('v') ? `refs/tags/${tag}` : tag;
    console.log(`Triggering workflow for ${ref}...`);
    const triggerRes = await fetch(
      `${base}/actions/workflows/${WORKFLOW_ID}/dispatches`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref }),
      }
    );
    if (triggerRes.ok) {
      console.log('Workflow triggered. Check: https://github.com/' + REPO + '/actions');
    } else {
      console.error('Failed to trigger:', triggerRes.status, await triggerRes.text());
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
