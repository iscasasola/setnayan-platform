#!/usr/bin/env node
/**
 * The demo shop's PLACEHOLDER pictures — one file per stable key, so the owner's Higgsfield photos replace them by
 * file name (drop `sp-hero.jpg` into scripts/demo-shop/images/ and re-run the shots; nothing else changes).
 *
 * A placeholder SAYS it is one (its key and size are printed on it), so a contact sheet can never pass a stand-in off
 * as a photograph. Never overwrites a file that is already there — a real photo, once dropped in, stays.
 *
 *   pnpm -F @setnayan/web exec tsx scripts/demo-shop/make-placeholder-images.mjs
 */
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { SP_IMAGE_SLOTS } from './setnayan-productions.fixture';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'images');
mkdirSync(OUT, { recursive: true });

for (const slot of SP_IMAGE_SLOTS) {
  const file = join(OUT, `${slot.key}.jpg`);
  if (existsSync(file) && !process.argv.includes('--force')) {
    console.log(`kept   ${slot.key}.jpg (already there)`);
    continue;
  }
  const { w, h } = slot;
  // The label sits small in the bottom-left corner, so a page that lays words over a photo (the Ultra hero) still
  // reads, and the picture's own centre stays clear — as a photograph's would.
  const small = Math.round(Math.min(w, h) / 22);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${slot.from}"/><stop offset="1" stop-color="${slot.to}"/>
  </linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <text x="${small}" y="${h - small * 2.2}" font-family="Hanken Grotesk, Helvetica, Arial, sans-serif" font-size="${small}" font-weight="600" fill="#ffffff" fill-opacity="0.8">${slot.label}</text>
  <text x="${small}" y="${h - small}" font-family="Space Mono, Menlo, monospace" font-size="${Math.round(small * 0.6)}" fill="#ffffff" fill-opacity="0.6">${slot.key}.jpg · placeholder · ${w}×${h}</text>
</svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toFile(file);
  console.log(`made   ${slot.key}.jpg`);
}
