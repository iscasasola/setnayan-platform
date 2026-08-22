/**
 * a-guest-face-is-resolved.test.ts — a stored ref is not a URL.
 *
 * `guests.photo_url` holds an `r2://…` REFERENCE. Put one in an `<img src>` and
 * the browser renders a broken-image glyph: nothing throws, nothing logs, and
 * the only symptom is an absence.
 *
 * ── WHY A GUARD AND NOT JUST THREE FIXES ───────────────────────────────────
 * The resolution block was hand-copied BYTE FOR BYTE in four loaders, and three
 * others that also hand a guest photo to a client component never wrote it at
 * all — the check-in desk, the souvenir desk, the Patiktok booth tag sheet. Two
 * of those even left an `eslint-disable … arbitrary R2/OAuth photo hosts`
 * comment beside the raw ref: the authors believed a reference would render.
 *
 * 🔑 THE OMISSION IS THE DEFECT, AND COPIES ARE HOW IT HAPPENS. With nothing to
 * import, resolving was something each author had to REMEMBER. This asserts the
 * shared helper is what every loader uses, so the eighth surface cannot forget.
 *
 * 🛡 Mutation-checked by occurrence count, each confirmed RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

/** Every loader that hands a guest photo to a client component. */
const LOADERS = [
  'app/dashboard/[eventId]/guests/page.tsx',
  'app/dashboard/[eventId]/guests/checkin/page.tsx',
  'app/dashboard/[eventId]/guests/souvenirs/page.tsx',
  'app/dashboard/[eventId]/seating/page.tsx',
  'app/dashboard/[eventId]/seating/lab/page.tsx',
  'app/dashboard/[eventId]/studio/patiktok/booth/page.tsx',
  'app/_actions/plan3d-demo-actions.ts',
];

test('the shared resolver exists and is what every loader uses', () => {
  const uploads = read('lib/uploads.ts');
  assert.ok(
    /export async function guestPhotoDisplayUrls/.test(uploads),
    'the resolver must be importable — a thing you have to remember to write is ' +
      'a thing three authors already forgot',
  );
  for (const path of LOADERS) {
    const src = read(path);
    assert.ok(
      /guestPhotoDisplayUrls\(/.test(src),
      `${path} does not resolve its guest photos. A raw r2:// ref in an <img> is ` +
        `a broken-image glyph — silent, and guaranteed for an RSVP selfie.`,
    );
  }
});

test('no loader passes the raw column straight through', () => {
  for (const path of LOADERS) {
    const src = read(path);
    // The bug's exact shape: handing the stored value to the client unresolved.
    assert.equal(
      /photoUrl: g\.photo_url(?!\s*\?[^?])/.test(src),
      false,
      `${path} assigns photoUrl straight from the stored column. It must look the ` +
        `value up in the resolved map.`,
    );
    assert.equal(
      /photo_url: g\.photo_url(?!\s*\?[^?])/.test(src),
      false,
      `${path} passes photo_url through unresolved.`,
    );
  }
});

test('the resolver drops what it cannot sign, so a miss falls back to initials', () => {
  const uploads = read('lib/uploads.ts');
  assert.ok(
    /filter\(\(e\): e is \[string, string\] => e\[1\] !== null\)/.test(uploads),
    'An unsignable ref must be absent from the map, so the caller\'s lookup misses ' +
      'and it renders initials — never a broken image.',
  );
});
