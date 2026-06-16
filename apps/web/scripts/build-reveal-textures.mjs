/**
 * build-reveal-textures.mjs — derive the PBR map set for the Save-the-Date rigid
 * reveal (0024 §1a TRUE TEXTURE · PR3b). One-time author step, re-runnable.
 *
 * Input: `<surface>_albedo_src.webp` (a flat, neutral, tileable scan generated
 * once via Recraft — prompts below). Output, per surface, into the same folder:
 *   <surface>_albedo.webp     (sRGB colour — recoloured live from the moodboard)
 *   <surface>_normal.webp     (LINEAR — fibre relief, wrap-around Sobel)
 *   <surface>_rough.webp      (LINEAR — inverted-luminance roughness)
 *
 * Recraft source prompts (style realistic_image, 1024², neutral, seamless):
 *   paper: "premium cotton rag wedding invitation paper, fine natural linen
 *           fibre weave, soft cold-pressed grain, subtle deckle tooth …"
 *   liner: "kraft envelope liner paper, fine speckled recycled fibre grain,
 *           smooth matte surface …"
 *
 * Determinism: pure pixel math (no randomness), so re-running yields the same
 * maps. Run: `node apps/web/scripts/build-reveal-textures.mjs` from repo root or
 * apps/web. Requires `sharp` (already a dep).
 */

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SIZE = 1024;
const HERE = dirname(fileURLToPath(import.meta.url));
const TEX = join(HERE, '..', 'public', 'reveal', 'textures');

const SURFACES = [
  { key: 'paper', dir: join(TEX, 'paper'), normalStrength: 3.2 },
  { key: 'liner', dir: join(TEX, 'liner'), normalStrength: 3.6 },
];

/** Grayscale height field (wrap-safe), slightly blurred to kill sensor noise. */
async function heightField(src) {
  const { data } = await sharp(src)
    .resize(SIZE, SIZE)
    .grayscale()
    .blur(0.6)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data; // Uint8, length SIZE*SIZE
}

/** Tangent-space normal map from a height field via wrap-around Sobel. */
function normalFromHeight(h, strength) {
  const out = Buffer.alloc(SIZE * SIZE * 3);
  const at = (x, y) => h[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const gx = ((at(x + 1, y) - at(x - 1, y)) / 255) * strength;
      const gy = ((at(x, y + 1) - at(x, y - 1)) / 255) * strength;
      let nx = -gx;
      let ny = -gy;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * SIZE + x) * 3;
      out[i] = Math.round((nx * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    }
  }
  return out;
}

for (const s of SURFACES) {
  const src = join(s.dir, `${s.key}_albedo_src.webp`);

  // albedo — optimised final (sRGB; recoloured live at mount)
  await sharp(src).resize(SIZE, SIZE).webp({ quality: 82 }).toFile(join(s.dir, `${s.key}_albedo.webp`));

  // normal — fibre relief (linear data)
  const h = await heightField(src);
  const normal = normalFromHeight(h, s.normalStrength);
  await sharp(normal, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .webp({ quality: 88 })
    .toFile(join(s.dir, `${s.key}_normal.webp`));

  // roughness — inverted luminance, leveled into a sane matte band (linear data)
  await sharp(src)
    .resize(SIZE, SIZE)
    .grayscale()
    .negate()
    .linear(0.55, 105) // → ~0.41..0.86 roughness band
    .webp({ quality: 82 })
    .toFile(join(s.dir, `${s.key}_rough.webp`));

  console.log(`built ${s.key}: albedo + normal + rough`);
}
