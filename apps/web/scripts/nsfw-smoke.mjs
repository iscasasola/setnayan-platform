// NSFW screening smoke test — proves the committed model files, the custom
// node:fs IOHandler, and the sharp decode pipeline all work together in plain
// Node (the same pure-JS path the Vercel lambda runs).
//
// Generates a tiny neutral test image IN-MEMORY with sharp (a flat sage-green
// "landscape" — nothing is committed), classifies it through the committed
// quantized MobileNetV2-mid graph model, and prints the class scores + the
// decideNsfw verdict. Exits non-zero if the verdict is not 'clean'.
//
// Run from apps/web:  node scripts/nsfw-smoke.mjs

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const webRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(webRoot); // nsfw-screen resolves the model dir off process.cwd()

const { classifyImageBytes, decideNsfw } = await import('../lib/nsfw-screen.ts');

// A neutral synthetic "landscape": sage-green field under a pale-blue sky.
const sky = { r: 173, g: 206, b: 230 };
const field = { r: 122, g: 156, b: 110 };
const top = await sharp({
  create: { width: 640, height: 200, channels: 3, background: sky },
})
  .jpeg()
  .toBuffer();
const testImage = await sharp({
  create: { width: 640, height: 480, channels: 3, background: field },
})
  .composite([{ input: top, top: 0, left: 0 }])
  .jpeg({ quality: 85 })
  .toBuffer();

console.log(`[nsfw-smoke] test image: ${testImage.byteLength} bytes (synthetic neutral JPEG)`);

const startedAt = Date.now();
const scores = await classifyImageBytes(new Uint8Array(testImage));
const decision = decideNsfw(scores);
const elapsedMs = Date.now() - startedAt;

console.log('[nsfw-smoke] scores:');
for (const [name, p] of Object.entries(scores).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${name.padEnd(8)} ${(p * 100).toFixed(2)}%`);
}
console.log(`[nsfw-smoke] decision: ${decision} (model load + classify: ${elapsedMs}ms)`);

if (decision !== 'clean') {
  console.error('[nsfw-smoke] FAIL — neutral image was not classified clean');
  process.exit(1);
}
console.log('[nsfw-smoke] OK');
