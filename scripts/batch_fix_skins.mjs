#!/usr/bin/env node
/**
 * Batch-apply v4.4 welcome layout, quote hide, background.png contract, and stage visibility.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SKINS_DIR = path.join(ROOT, 'skins-pro');
const SKIP = new Set(['AEON', 'AEON_glass', 'minecraft', 'modern', 'visionOS', 'ios-27', 'default']);

const BG_SRC_NAMES = ['background.jpg', 'base-texture.jpg', 'stage-background.jpg', 'stage-background.png'];

function fixCss(css, slug) {
  let out = css;
  let changed = false;

  // .welcome must NOT claim grid-area:welcome (only .welcome-group does)
  const welcomeRule = out.replace(
    /(\.welcome\s*\{[^}]*?)grid-area\s*:\s*welcome\s*;?/g,
    (m, pre) => {
      changed = true;
      return pre;
    },
  );
  if (welcomeRule !== out) out = welcomeRule;

  // Normalize background texture tokens
  const tokenFix = out
    .replace(/url\("\.\/background\.jpg"\)/g, 'url("./background.png")')
    .replace(/url\('\.\/background\.jpg'\)/g, "url('./background.png')")
    .replace(/url\("\.\/base-texture\.jpg"\)/g, 'url("./background.png")')
    .replace(/url\("\.\/stage-background\.jpg"\)/g, 'url("./background.png")');
  if (tokenFix !== out) {
    out = tokenFix;
    changed = true;
  }

  // Upgrade welcome-group block layout inside weather patch
  if (out.includes('/* skins-pro weather layout patch */')) {
    const blockRe = /\/\* skins-pro weather layout patch \*\/[\s\S]*?\/\* end skins-pro weather layout patch \*\//;
    const block = out.match(blockRe)?.[0] ?? '';
    let nb = block;
    let blockChanged = false;

    if (/\.welcome-group\s*\{[^}]*display\s*:\s*block/.test(nb)) {
      nb = nb.replace(
        /(\.welcome-group\s*\{[^}]*?)display\s*:\s*block\s*;?/,
        '$1display:grid; grid-template-rows:auto auto; gap:0; align-self:start; max-width:540px;',
      );
      blockChanged = true;
    }
    if (!/\.welcome-group\s*\{[^}]*grid-area\s*:\s*welcome/.test(nb)) {
      nb = nb.replace(/(\.welcome-group\s*\{)/, '$1\n  grid-area:welcome;');
      blockChanged = true;
    }
    if (!/\.welcome-group\s*>\s*\.welcome[^}]*grid-area\s*:\s*unset/.test(nb)) {
      if (/\.welcome-group\s*>\s*\.welcome\s*\{/.test(nb)) {
        nb = nb.replace(/(\.welcome-group\s*>\s*\.welcome\s*\{[^}]*)\}/, '$1 grid-area:unset; }');
      } else {
        nb = nb.replace(
          /(\.welcome-group\s*\{[\s\S]*?\})/,
          '$1\n.welcome-group > .welcome { max-width:100%; grid-area:unset; }',
        );
      }
      blockChanged = true;
    }
    if (!/\.welcome-group\s+\.welcome\s+\.quote[^}]*display\s*:\s*none/.test(nb) && !/\.welcome-group\s*\.welcome\s*\.quote[^}]*display\s*:\s*none/.test(nb)) {
      nb = nb.replace(
        /(\.welcome-group\s*>\s*\.welcome\s*\{[^}]*\})/,
        '$1\n.welcome-group .welcome .quote { display:none; }',
      );
      blockChanged = true;
    }
    if (/\.weather-with-meta\s*\{/.test(nb) && !/\.weather-with-meta\s*\{[^}]*grid-area\s*:\s*unset/.test(nb)) {
      nb = nb.replace(/(\.weather-with-meta\s*\{[^}]*)\}/, '$1 grid-area:unset; }');
      blockChanged = true;
    }

    if (blockChanged) {
      out = out.replace(blockRe, nb);
      changed = true;
    }
  } else {
    const insert = `
/* skins-pro weather layout patch */
.welcome-group {
  grid-area:welcome;
  display:grid;
  grid-template-rows:auto auto;
  gap:0;
  min-width:0;
  align-self:start;
  max-width:540px;
}
.welcome-group > .welcome { max-width:100%; grid-area:unset; }
.welcome-group .welcome .quote { display:none; }
.weather-with-meta { display:flex; align-items:flex-start; margin-top:var(--sp-space-md,12px); grid-area:unset; }
/* end skins-pro weather layout patch */
`;
    const anchor = out.indexOf('/* skins-pro sidebar layout patch */');
    if (anchor !== -1) {
      out = out.slice(0, anchor) + insert + out.slice(anchor);
      changed = true;
    }
  }

  // Stage / app overlay: let background texture show through (claude-quiet class of bugs)
  if (
    /--sp-app-overlay\s*:\s*linear-gradient\([^;]*rgba\([^)]*,\s*0\.7[5-9]/.test(out) ||
    /--sp-panel-bg\s*:\s*rgba\(\s*29\s*,\s*29\s*,\s*29\s*,\s*0\.8/.test(out)
  ) {
    out = out.replace(
      /--sp-app-overlay\s*:\s*linear-gradient\(([^)]+)\)[^;]*;/,
      '--sp-app-overlay:linear-gradient(135deg,rgba(12,15,24,.42),rgba(20,24,36,.38),rgba(15,19,30,.44));',
    );
    out = out.replace(
      /--sp-panel-bg\s*:\s*rgba\(\s*29\s*,\s*29\s*,\s*29\s*,\s*0\.82\s*\)\s*;/,
      '--sp-panel-bg: rgba(29, 29, 29, 0.38);',
    );
    if (!/--sp-stage-overlay\s*:/.test(out.split(':host')[1]?.split('}')[0] ?? '')) {
      out = out.replace(/(--sp-stage-texture:[^;]+;)/, '$1\n  --sp-stage-overlay:linear-gradient(180deg,rgba(8,10,16,.18),rgba(8,10,16,.32));');
    }
    changed = true;
  }

  // Ensure .stage shows texture (not opaque panel color)
  if (/\.stage\s*\{[^}]*background\s*:\s*var\(--sp-panel-bg\)/.test(out)) {
    out = out.replace(
      /(\.stage\s*\{[^}]*?)background\s*:\s*var\(--sp-panel-bg\)\s*;/,
      '$1background-color:transparent;',
    );
    changed = true;
  }

  // Global home quote hide (outside media queries)
  if (!/\.welcome-group\s+\.welcome\s+\.quote[^}]*display\s*:\s*none/.test(out) && !/\.welcome-group\s*\.welcome\s*\.quote[^}]*display\s*:\s*none/.test(out)) {
    const quoteRule = '.welcome-group .welcome .quote { display:none; }\n';
    if (out.includes('/* skins-pro weather layout patch */') && !out.includes('.welcome-group .welcome .quote { display:none')) {
      out = out.replace(
        /(\/\* skins-pro weather layout patch \*\/)/,
        `/* skins-pro weather layout patch */${quoteRule}`,
      );
    } else if (out.includes('/* skins-pro sidebar layout patch */')) {
      out = out.replace(
        /(\/\* skins-pro sidebar layout patch \*\/)/,
        `/* skins-pro weather layout patch */${quoteRule}/* end skins-pro weather layout patch */\n\n$1`,
      );
    } else {
      out += `\n/* skins-pro weather layout patch */${quoteRule}/* end skins-pro weather layout patch */\n`;
    }
    changed = true;
  }

  return { css: out, changed };
}

async function ensureBackgroundPng(dir, slug) {
  const pngPath = path.join(dir, 'background.png');
  if (fs.existsSync(pngPath) && fs.statSync(pngPath).size > 10000) {
    return { action: 'ok', slug };
  }
  for (const name of BG_SRC_NAMES) {
    const src = path.join(dir, name);
    if (!fs.existsSync(src)) continue;
    const buf = fs.readFileSync(src);
    if (buf.length < 1000) continue;
    await sharp(buf).png().toFile(pngPath);
    return { action: `from-${name}`, slug };
  }
  return { action: 'missing', slug };
}

async function main() {
  const slugs = fs.readdirSync(SKINS_DIR).filter((s) => {
    const p = path.join(SKINS_DIR, s);
    return fs.statSync(p).isDirectory() && !SKIP.has(s);
  });

  const report = { css: 0, bg: 0, missingBg: [] };

  for (const slug of slugs.sort()) {
    const dir = path.join(SKINS_DIR, slug);
    const cssPath = path.join(dir, 'theme.css');
    if (fs.existsSync(cssPath)) {
      const raw = fs.readFileSync(cssPath, 'utf8');
      const { css, changed } = fixCss(raw, slug);
      if (changed) {
        fs.writeFileSync(cssPath, css, 'utf8');
        report.css++;
      }
    }
    const bg = await ensureBackgroundPng(dir, slug);
    if (bg.action.startsWith('from-')) report.bg++;
    if (bg.action === 'missing') report.missingBg.push(slug);
  }

  console.log(JSON.stringify(report, null, 2));
  if (report.missingBg.length) {
    console.error('Still missing background.png:', report.missingBg.join(', '));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
