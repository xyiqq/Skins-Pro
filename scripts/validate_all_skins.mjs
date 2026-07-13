#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKINS_DIR = path.join(ROOT, 'skins-pro');
const VALIDATE = path.resolve('C:/Users/dazhazhang/.cursor/skills/skins-pro/scripts/validate_skin.js');
const SKIP = new Set(['AEON', 'AEON_glass', 'minecraft', 'modern', 'visionOS', 'ios-27', 'default']);

const slugs = fs.readdirSync(SKINS_DIR).filter((s) => !SKIP.has(s) && fs.statSync(path.join(SKINS_DIR, s)).isDirectory());
const fails = [];

for (const slug of slugs) {
  const r = spawnSync(process.execPath, [VALIDATE, path.join(SKINS_DIR, slug)], { encoding: 'utf8' });
  if (r.status !== 0) fails.push({ slug, out: (r.stdout || '') + (r.stderr || '') });
}

console.log(JSON.stringify({ total: slugs.length, fail: fails.length, fails: fails.slice(0, 15) }, null, 2));
process.exit(fails.length ? 1 : 0);
