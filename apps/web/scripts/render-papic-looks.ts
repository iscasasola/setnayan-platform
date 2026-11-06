/**
 * render-papic-looks.ts — develop the owner's sample photograph through each
 * of the five Papic looks, for the Filter tiles (owner 2026-10-25). See
 * `lib/papic-look-samples.ts`.
 *
 *   pnpm render:papic-looks        (from apps/web)
 *
 * Writes `public/papic/looks/<STYLE>.webp` and `lib/papic-look-samples.manifest.json`.
 *
 * Geometry. The source is the 880×254 band the owner supplied; the tile is a
 * square, so the square around the two faces is taken (centre x = 440). It is
 * upscaled to 1440 px — the height of a real Papic frame (`HI_RES`,
 * lib/use-papic-camera.ts) — BEFORE the look runs, because grain, the unsharp
 * mask and the chromatic aberration are sized in PIXELS: run on 254 px they
 * would read ~6× heavier than on a real photo seen as a thumbnail. Then it is
 * stored at 240 px (a tile draws it at ≤ ~120 CSS px, so 2× is sharp).
 *
 * A square frame gets no CINE letterbox — the engine bars only LANDSCAPE frames
 * (see `applyCine`), exactly as it treats a portrait candid. That is the real
 * behaviour, not an omission.
 *
 * RETRO's grain is random (Box–Muller over `Math.random`), so re-running
 * changes RETRO's bytes but never its hash — the hash is of the code and photo.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

import { PAPIC_STYLES, applyPapicStylePixels } from '../lib/papic-photo-styles';
import { PAPIC_LOOK_SOURCE, currentPapicLookHash } from '../lib/papic-look-samples-hash';
import type { PapicLookSampleManifest } from '../lib/papic-look-samples';

const WEB = join(__dirname, '..');
const OUT = join(WEB, 'public', 'papic', 'looks');
const MANIFEST = join(WEB, 'lib', 'papic-look-samples.manifest.json');
const FACES_CENTRE_X = 440;
const WORK = 1440;
const STORED = 240;

async function main() {
  const src = join(WEB, PAPIC_LOOK_SOURCE);
  const meta = await sharp(src).metadata();
  const side = Math.min(meta.width!, meta.height!);
  const left = Math.max(0, Math.min(meta.width! - side, FACES_CENTRE_X - Math.floor(side / 2)));

  const { data, info } = await sharp(src)
    .extract({ left, top: 0, width: side, height: side })
    .resize(WORK, WORK, { kernel: 'lanczos3' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  mkdirSync(OUT, { recursive: true });
  for (const s of PAPIC_STYLES) {
    const px = new Uint8ClampedArray(data); // a fresh copy per look — the engine mutates in place
    applyPapicStylePixels(px, info.width, info.height, s.id);
    const out = join(OUT, `${s.id}.webp`);
    await sharp(Buffer.from(px.buffer), { raw: { width: info.width, height: info.height, channels: 4 } })
      .removeAlpha()
      .resize(STORED, STORED, { kernel: 'lanczos3' })
      .webp({ quality: 78, effort: 6 })
      .toFile(out);
    console.log(`[papic looks] ${s.id} → ${out}`);
  }

  const manifest: PapicLookSampleManifest = {
    look: currentPapicLookHash(WEB),
    renderedAt: new Date().toISOString().slice(0, 10),
    styles: PAPIC_STYLES.map((s) => s.id),
  };
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[papic looks] manifest → ${MANIFEST} (look ${manifest.look}); source ${readFileSync(src).length} bytes`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
