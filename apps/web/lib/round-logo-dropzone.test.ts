import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The empty logo slot is the shape of the result.
 *
 * Owner 2026-08-10: *"make the logo upload widget not rectangle but circle so
 * they can already imagine before uploading."*
 *
 * `roundPreview` already made the picture round AFTER upload — so the one
 * moment a vendor is choosing an image, deciding whether their wordmark fits
 * and whether the edges survive a crop, was the one moment we showed them a
 * rectangle. They found out it was a circle after committing to a file.
 */
const SRC = readFileSync(join(process.cwd(), 'app/_components/file-upload.tsx'), 'utf8');

test('a round preview means a round empty slot — one flag, not two', () => {
  // A second prop would let the two drift into disagreeing about the same
  // picture: a square slot that yields a circle, or the reverse.
  assert.match(
    SRC,
    /const roundDropzone = roundPreview && variant === 'square' && !multiple;/,
    'the empty slot no longer follows roundPreview',
  );
});

test('the circle is a fixed square footprint, not a full-width box', () => {
  // `rounded-full` on a full-width element is a lozenge, not a circle. The
  // footprint has to be square before the radius means anything.
  const block = SRC.slice(SRC.indexOf('roundDropzone\n'), SRC.indexOf('roundDropzone\n') + 600);
  assert.match(block, /aspect-square/, 'without a square aspect the radius yields a lozenge');
  assert.match(block, /rounded-full/);
  assert.match(block, /mx-auto/, 'a left-aligned circle reads as a stray bullet, not a slot');
});

test('the formats line is not left inside the circle', () => {
  // Five format names in a monospaced caps line are wider than a 160px circle
  // at every point, so inside one they wrap into a column or spill past the
  // dashed edge — and a slot whose own text does not fit reads as broken.
  assert.match(
    SRC,
    /roundDropzone \? null : \(/,
    'the formats caption still renders inside the round slot',
  );
});

test('and it is not simply dropped — it still ships, underneath', () => {
  // 🔑 Moving text out of a container and deleting it look identical in a
  // diff. The size limit is the thing people actually need before choosing a
  // file, so losing it would be a real regression hiding inside a visual tweak.
  const after = SRC.slice(SRC.indexOf('</label>'));
  assert.match(after, /roundDropzone && !atCapacity/, 'the caption was moved out and never re-rendered');
  assert.match(after, /up to \{maxSizeMB\} MB/, 'the size limit vanished with the caption');
});

test('the wide variant is untouched — this is a logo change, not a global one', () => {
  // `wide` is the evidence lane: payment screenshots and verification
  // documents, where a circle would crop exactly the corners that carry the
  // reference number.
  assert.match(SRC, /variant === 'square' \? 'min-h-\[160px\]' : 'min-h-\[120px\]'/);
  assert.match(
    SRC,
    /roundDropzone\s*\n\s*\? \/\/|roundDropzone$/m,
    'the round branch must be conditional, not the only path',
  );
  assert.match(SRC, /: `\$\{dropzoneHeight\} w-full rounded-xl px-4 py-6`/,
    'the rectangular dropzone is gone — every other upload surface uses it');
});

test('the shop wizard asks for the round treatment', () => {
  const wizard = readFileSync(
    join(process.cwd(), 'app/open-shop/_components/open-shop-wizard.tsx'),
    'utf8',
  );
  const logo = wizard.slice(wizard.indexOf('name="logo_url"'), wizard.indexOf('name="logo_url"') + 700);
  assert.match(logo, /roundPreview/, 'the logo upload stopped asking for a round preview');
  assert.match(logo, /variant="square"/);
});
