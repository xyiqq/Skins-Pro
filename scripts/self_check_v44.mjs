#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKINS_DIR = path.join(ROOT, 'skins-pro');
const SKIP = new Set(['AEON', 'AEON_glass', 'minecraft', 'modern', 'visionOS', 'ios-27', 'default']);

const slugs = fs.readdirSync(SKINS_DIR).filter((s) => !SKIP.has(s) && fs.statSync(path.join(SKINS_DIR, s)).isDirectory());

const issues = [];
for (const slug of slugs) {
  const dir = path.join(SKINS_DIR, slug);
  const css = fs.readFileSync(path.join(dir, 'theme.css'), 'utf8');
  const checks = {
    quoteHide: /\.welcome-group\s+\.welcome\s+\.quote[^}]*display\s*:\s*none/.test(css),
    welcomeLayoutOk: !/(?:^|[\r\n])\.welcome\s*\{[^}]*grid-area\s*:\s*welcome/m.test(css),
    hasBg: fs.existsSync(path.join(dir, 'background.png')),
    hasPortrait: css.includes('orientation: portrait') || css.includes('visionOS responsive port'),
    hasSpWrap: css.includes('.sp-wrap'),
    hasWeatherPatch: css.includes('/* skins-pro weather layout patch */'),
    stageTransparent: !/\.stage\s*\{[^}]*background\s*:\s*var\(--sp-panel-bg\)/.test(css),
    imageCount: fs.readdirSync(dir).filter((f) => /\.(png|jpg|jpeg)$/i.test(f)).length === 31,
  };
  const bad = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  if (bad.length) issues.push({ slug, bad });
}

const validate = spawnSync(process.execPath, [path.join(ROOT, 'scripts/validate_all_skins.mjs')], { encoding: 'utf8' });
const validateFail = validate.status !== 0;

const pass = issues.length === 0 && !validateFail;
console.log(JSON.stringify({
  pass,
  skinRuleIssues: issues.length,
  validateExit: validate.status,
  sampleIssues: issues.slice(0, 10),
}, null, 2));
process.exit(pass ? 0 : 1);
