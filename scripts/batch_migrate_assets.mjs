#!/usr/bin/env node
/**
 * Migrate legacy skin assets to visionOS 31-file contract.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SKINS_DIR = path.join(ROOT, 'skins-pro');
const REF = path.join(SKINS_DIR, 'animal-crossing');
const SKIP = new Set(['AEON', 'AEON_glass', 'minecraft', 'modern', 'visionOS', 'ios-27', 'default']);

const VISION = [
  'avatar.jpg', 'background.png', 'decoration.png',
  'icon-ac.png', 'icon-automation.png', 'icon-binary_sensor.png', 'icon-button.png',
  'icon-camera.png', 'icon-cover.png', 'icon-device_tracker.png', 'icon-fan.png',
  'icon-humidifier.png', 'icon-light.png', 'icon-lock.png', 'icon-media_player.png',
  'icon-person.png', 'icon-remote.png', 'icon-sensor.png', 'icon-speaker.png',
  'icon-switch.png', 'icon-update.png', 'icon-vacuum.png', 'icon-valve.png',
  'icon-water_heater.png',
  'room-bedroom.png', 'room-dining.png', 'room-garage.png', 'room-garden.png',
  'room-kitchen.png', 'room-living.png', 'room-office.png',
];

const DEPRECATED = [
  'base-texture.jpg', 'base-texture.png', 'background.jpg', 'stage-background.jpg',
  'icon-garden-light.jpg', 'icon-garden-light.png', 'icon-weather.jpg', 'icon-weather.png',
  'icon-climate.png', 'icon-climate.jpg', 'avatar.png',
  'room-bathroom.jpg', 'room-study.jpg',
];

const ALIASES = {
  'icon-ac.png': ['icon-climate.png', 'icon-climate.jpg', 'icon-ac.jpg'],
  'decoration.png': ['decoration.jpg'],
};

const ROOMS = ['room-bedroom', 'room-dining', 'room-garage', 'room-garden', 'room-kitchen', 'room-living', 'room-office'];

async function toPng(src, dest) {
  await sharp(src).png().toFile(dest);
}

async function toJpg(src, dest) {
  await sharp(src).jpeg({ quality: 92 }).toFile(dest);
}

async function ensureFile(dir, name, report) {
  const dest = path.join(dir, name);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 500) return;

  const base = name.replace(/\.(png|jpg)$/, '');
  const exts = ['.png', '.jpg', '.jpeg', '.webp'];
  for (const ext of exts) {
    const p = path.join(dir, base + ext);
    if (fs.existsSync(p) && fs.statSync(p).size > 500) {
      if (name.endsWith('.png')) await toPng(p, dest);
      else await toJpg(p, dest);
      report.push(`converted ${base}${ext} -> ${name}`);
      return;
    }
  }
  for (const alt of ALIASES[name] || []) {
    const p = path.join(dir, alt);
    if (fs.existsSync(p)) {
      if (name.endsWith('.png')) await toPng(p, dest);
      else await toJpg(p, dest);
      report.push(`aliased ${alt} -> ${name}`);
      return;
    }
  }
  const ref = path.join(REF, name);
  if (fs.existsSync(ref)) {
    fs.copyFileSync(ref, dest);
    report.push(`copied ref -> ${name}`);
  }
}

function fixStrings(dir) {
  const p = path.join(dir, 'strings.json');
  if (!fs.existsSync(p)) return;
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  let changed = false;
  if (data.icon_map) {
    for (const [k, v] of Object.entries(data.icon_map)) {
      if (v === 'garden' || v === 'garage' || v === 'ac') {
        data.icon_map[k] = v === 'ac' ? 'climate' : 'light';
        changed = true;
      }
    }
    if (data.icon_map.climate === 'ac') {
      data.icon_map.climate = 'climate';
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

async function migrateSlug(slug) {
  const dir = path.join(SKINS_DIR, slug);
  const report = [];
  for (const room of ROOMS) {
    await ensureFile(dir, `${room}.png`, report);
  }
  await ensureFile(dir, 'avatar.jpg', report);
  await ensureFile(dir, 'background.png', report);
  await ensureFile(dir, 'decoration.png', report);
  for (const f of VISION) {
    if (f.startsWith('icon-')) await ensureFile(dir, f, report);
  }
  // icon-person from avatar
  const av = path.join(dir, 'avatar.jpg');
  if (fs.existsSync(av)) {
    const person = path.join(dir, 'icon-person.png');
    if (!fs.existsSync(person) || fs.statSync(person).size < 500) {
      await sharp(av).resize(300, 300, { fit: 'cover' }).png().toFile(person);
      report.push('icon-person from avatar.jpg');
    }
  }
  fixStrings(dir);
  for (const d of DEPRECATED) {
    const fp = path.join(dir, d);
    if (fs.existsSync(fp)) {
      fs.unlinkSync(fp);
      report.push(`deleted ${d}`);
    }
  }
  // remove extra images not in contract
  const allowed = new Set(VISION);
  for (const f of fs.readdirSync(dir)) {
    if (!/\.(png|jpg|jpeg|webp)$/i.test(f)) continue;
    if (!allowed.has(f)) {
      fs.unlinkSync(path.join(dir, f));
      report.push(`removed extra ${f}`);
    }
  }
  return report;
}

async function main() {
  const slugs = fs.readdirSync(SKINS_DIR).filter((s) => !SKIP.has(s) && fs.statSync(path.join(SKINS_DIR, s)).isDirectory());
  let touched = 0;
  for (const slug of slugs.sort()) {
    const r = await migrateSlug(slug);
    if (r.length) {
      touched++;
      console.log(slug, r.length, 'actions');
    }
  }
  console.log(JSON.stringify({ migrated: touched, total: slugs.length }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
