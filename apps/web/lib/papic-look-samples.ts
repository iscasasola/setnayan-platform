/**
 * lib/papic-look-samples.ts — the Papic Filter tiles' PICTURES: one sample
 * photograph, developed through each of the five looks (owner 2026-10-25:
 * *"the filters should have a sample photo. which should be our photo. we
 * already have a photo already used for this before"*).
 *
 * THE PHOTO is the frame the owner supplied for exactly this on 2026-09-23
 * (*"papic look should have an actual photo for sample with a lot of colors"*,
 * commit 644592545e, `public/papic/look-sample.webp` on the unmerged branch
 * `claude/papic-drops-the-back-link`). It is restored here as the SOURCE,
 * `assets/papic/look-sample.source.webp` (880×254, kept out of `public/`).
 *
 * THE LOOK IS THE REAL ONE, NOT A CSS GUESS. `pnpm render:papic-looks` runs
 * the camera's own pixel pipeline (`applyPapicStylePixels`, the function every
 * Papic camera runs at the shutter) over the photo and writes
 * `public/papic/looks/<STYLE>.webp`. `cssPreview` is an approximation for the
 * live viewfinder; a tile you choose a look from should show what the camera
 * will actually produce.
 *
 * ── A PICTURE CANNOT ROT SILENTLY ──────────────────────────────────────────
 * The manifest stores `look`: a hash of the pixel half of
 * `papic-photo-styles.ts` and of the source photo (`papicLookHash`,
 * `papic-look-samples-hash.ts`, Node only). `papic-look-samples.test.ts`
 * recomputes it — change a look's maths without re-rendering and it is RED,
 * naming the command.
 *
 * Client-safe: no `node:` imports here.
 */
import type { PapicStyle } from '@/lib/papic-photo-styles';
import manifest from './papic-look-samples.manifest.json';

export type PapicLookSampleManifest = { look: string; renderedAt: string; styles: PapicStyle[] };

export const PAPIC_LOOK_SAMPLES: PapicLookSampleManifest = manifest as PapicLookSampleManifest;
export const PAPIC_LOOK_RENDER_COMMAND = 'pnpm render:papic-looks';

/** The tile picture of one look — its render hash in `v`, so a re-render is a new address. */
export function papicLookSampleSrc(style: PapicStyle): string {
  return `/papic/looks/${style}.webp?v=${PAPIC_LOOK_SAMPLES.look}`;
}
