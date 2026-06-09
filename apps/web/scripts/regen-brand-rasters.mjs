#!/usr/bin/env node
// Regenerate the gold-mark PNG rasters from the canonical brand SVG.
//
// SINGLE SOURCE OF TRUTH: public/brand/setnayan-mark.svg — the champagne-gold
// (#cb9e4b) Setnayan mark. Everything else is a derivative. To change the logo
// everywhere: replace that SVG, then run this script.
//
//   pnpm --filter @setnayan/web brand:icons   (or: node scripts/regen-brand-rasters.mjs)
//
// These PNGs exist because a few consumers can't take an SVG: the seat-plan PDF
// embeds a PNG, and the keynote deck <img>s one. The SVG copies
// (icon-192/512.svg, setnayan-logo/app-icon.svg) and the styled tiles
// (setnayan-app-icon-512.png = mark on a white iOS tile) + the mobile/desktop
// icon sets have their own treatments and are intentionally NOT regenerated here.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { writeFileSync, readFileSync } from 'node:fs';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(web, '..', '..');
const SRC = join(web, 'public/brand/setnayan-mark.svg');
const svg = readFileSync(SRC);

// 1) Byte-identical SVG copies — the favicon set, the Logo/share SVG, the proto
//    asset, and the desktop (Tauri) icon source (build runs `tauri icon` on it).
const svgCopies = [
  join(web, 'public/brand/setnayan-logo.svg'),
  join(web, 'public/icon-192.svg'),
  join(web, 'public/icon-512.svg'),
  join(web, 'public/proto/assets/setnayan-mark.svg'),
  join(repo, 'src-tauri/icons/icon.svg'),
];
for (const dst of svgCopies) {
  writeFileSync(dst, svg);
  console.log(`✓ svg  ${relative(repo, dst)}`);
}

// 2) Raster derivatives — consumers that can't take an SVG. Transparent ground.
//    (NOT regenerated: setnayan-app-icon-512.png = mark on a white iOS tile, and
//     the mobile splash/launcher sets — those carry their own bg treatment.)
const pngs = [
  { out: join(web, 'public/brand/setnayan-mark-512.png'), size: 512 }, // seat-plan PDF + generic raster
  { out: join(web, 'public/keynote/brand/setnayan-mark.png'), size: 483 }, // keynote deck mark
];
for (const t of pngs) {
  const buf = await sharp(SRC, { density: 384 })
    .resize(t.size, t.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  writeFileSync(t.out, buf);
  console.log(`✓ png  ${relative(repo, t.out)}  (${t.size}×${t.size}, transparent gold)`);
}

console.log('Done. Single source of truth: apps/web/public/brand/setnayan-mark.svg');
