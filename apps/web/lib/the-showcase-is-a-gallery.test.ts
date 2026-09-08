/**
 * The showcase uploader shows PICTURES, and only the showcase does.
 *
 * ── WHY (owner, 2026-09-08) ────────────────────────────────────────────────
 * *"we want gallery type icon and same to video."* Three uploaded showcase
 * photos rendered as filename rows — `IMG_4329.jpg · UPLOADED · ×` — which
 * cannot answer either question a supplier is actually asking at that moment:
 * did the right shot go up, and does the crop work.
 *
 * ⚠ THIS REVERSES A RECORDED DECISION, and the reversal is the owner's. The
 * `isSingleImagePreview` docblock in `file-upload.tsx` says *"`!multiple`
 * because a gallery needs a scannable list, not N hero images"* — true while
 * every multi-file field was an evidence lane, where the filename IS the
 * subject. A vendor's own showcase is the case that reasoning did not cover.
 *
 * ── THE HALF THAT MATTERS MORE ─────────────────────────────────────────────
 * `FileUpload` is shared by ~20 surfaces — profile logo, pay panel, disputes,
 * seating walkthrough, admin taxonomy, government-ID evidence. A layout change
 * applied to the component instead of to one field would silently restyle all
 * of them, including the evidence lanes where a filename is the point and a
 * square crop would hide the corner of a document that carries the seal.
 *
 * So this asserts BOTH directions: the showcase opted in, and nothing else did.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '../app');

const showcase = stripComments(
  readFileSync(
    resolve(APP, 'vendor-dashboard/services/_components/showcase-media-fields.tsx'),
    'utf8',
  ),
);
const uploader = stripComments(
  readFileSync(resolve(APP, '_components/file-upload.tsx'), 'utf8'),
);

function everyTsx(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) everyTsx(full, out);
    else if (name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

test('both showcase fields — photos AND video — ask for the gallery', () => {
  const uses = showcase.match(/variant="gallery"/g) ?? [];
  assert.equal(
    uses.length,
    2,
    `expected exactly 2 gallery fields (photos + video), found ${uses.length}. ` +
      'The owner asked for both: "we want gallery type icon and same to video."',
  );
  assert.ok(
    !/variant="wide"/.test(showcase),
    'a showcase field is still on the filename-row variant',
  );
});

test('🔑 NOTHING ELSE opted in — the other uploader surfaces are untouched', () => {
  const offenders = everyTsx(APP)
    .filter((f) => !f.endsWith('showcase-media-fields.tsx'))
    .filter((f) => /variant="gallery"/.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => f.slice(APP.length + 1));
  assert.deepEqual(
    offenders,
    [],
    'these surfaces also took the gallery layout:\n  ' +
      offenders.join('\n  ') +
      '\nFileUpload is shared by ~20 fields including government-ID and dispute ' +
      'evidence, where the filename is the subject and a square crop hides the ' +
      'corner of a document.',
  );
});

test('the gallery branch renders the picture, not a glyph', () => {
  const i = uploader.indexOf('isGallery && (inFlight.length > 0 || items.length > 0)');
  assert.ok(i > -1, 'the gallery branch is gone — re-point this guard');
  const branch = uploader.slice(i, uploader.indexOf('{!isGallery &&', i));
  assert.ok(branch.length > 0, 'could not bound the gallery branch');
  assert.match(branch, /<img/, 'the gallery does not render an <img>');
  assert.match(branch, /<video/, 'the gallery does not render a <video> — "same to video"');
  assert.match(branch, /object-cover/, 'the tile does not fill its box');
});

test('the row layout SURVIVES for every other variant', () => {
  // The regression that would hurt most is deleting the filename rows outright.
  assert.match(
    uploader,
    /\{!isGallery && \(inFlight\.length > 0 \|\| \(items\.length > 0 && !isSingleImagePreview\)\)/,
    'the non-gallery row list is gone — every evidence lane just lost its filenames',
  );
});

test('the remove control is reachable without hover', () => {
  // Phones have no hover. A delete that only appears on :hover is unreachable
  // there, and this field is used on phones.
  const i = uploader.indexOf('isGallery && (inFlight.length > 0 || items.length > 0)');
  const branch = uploader.slice(i, uploader.indexOf('{!isGallery &&', i));
  const removeIdx = branch.indexOf('aria-label={`Remove ${item.filename}`}');
  assert.ok(removeIdx > -1, 'the gallery tile has no remove control');
  const button = branch.slice(branch.lastIndexOf('<button', removeIdx), removeIdx);
  assert.ok(
    !/opacity-0|group-hover:/.test(button),
    'the remove control is hover-revealed, so it cannot be reached on a phone',
  );
});
