#!/usr/bin/env node
/**
 * Release wrapper: loads .env (GH_TOKEN) and runs the Windows build + publish.
 * Usage: npm run release:win
 */
const { spawnSync } = require('child_process');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

if (!process.env.GH_TOKEN) {
  console.error('[release] GH_TOKEN niet gevonden in apps/frontend/.env — voeg GH_TOKEN=ghp_... toe.');
  process.exit(1);
}

const args = process.argv.slice(2);
const publishFlag = args.includes('--no-publish') ? [] : ['--publish', 'always'];

const result = spawnSync(
  process.execPath,
  ['scripts/package-with-python.cjs', '--win', ...publishFlag],
  {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: process.env,
  }
);

process.exit(result.status ?? 1);
