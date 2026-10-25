/**
 * The render hash of the Papic Filter tiles — see `papic-look-samples.ts`.
 * Node only (the render script and the currency test), never the browser.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Where the pixel maths begins in `papic-photo-styles.ts`. Everything above it
 * is the label table and the live-viewfinder `cssPreview` strings, which do not
 * move a rendered tile — so editing a label never demands a re-render.
 */
export const PIXEL_HALF_MARKER = 'export const CINE_ASPECT';

/** The source photograph (owner-supplied, 2026-09-23), relative to apps/web. */
export const PAPIC_LOOK_SOURCE = join('assets', 'papic', 'look-sample.source.webp');

/** The pixel half of the style engine, or throws if the marker moved (a silent hash of nothing would be vacuous). */
export function pixelHalfOf(stylesSource: string): string {
  const at = stylesSource.indexOf(PIXEL_HALF_MARKER);
  if (at < 0) throw new Error(`papic-photo-styles.ts no longer contains "${PIXEL_HALF_MARKER}" — move PIXEL_HALF_MARKER to where the pixel maths now begins`);
  return stylesSource.slice(at);
}

/** What shapes every tile: the engine's pixel maths and the photograph itself. */
export function papicLookHash(stylesSource: string, photo: Buffer): string {
  return createHash('sha256').update(pixelHalfOf(stylesSource)).update('\0').update(photo).digest('hex').slice(0, 16);
}

/** The hash of the tree as it is today. */
export function currentPapicLookHash(webRoot: string): string {
  return papicLookHash(
    readFileSync(join(webRoot, 'lib', 'papic-photo-styles.ts'), 'utf8'),
    readFileSync(join(webRoot, PAPIC_LOOK_SOURCE)),
  );
}
