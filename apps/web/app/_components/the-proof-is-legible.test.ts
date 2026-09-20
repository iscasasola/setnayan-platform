/**
 * the-proof-is-legible.test.ts — a receipt is shown at a size a person can read,
 * on EVERY screen that shows one.
 *
 * Owner, live on the payment run, 2026-09-20: *"when i upload a photo, i cannot
 * see it. it is too small. let's make it easy to see?"*
 *
 * 🔑 THE PATTERN EXISTED AND HAD ONE CUSTOMER. `app/admin/payments` had rendered
 * a `max-h-64 object-contain` picture with "Open full size" under it since the
 * Setnayan checkout queue was built, and `/pay/[reference]` grew its own
 * 340px-tall version on 2026-08-21 after the owner said the same sentence about
 * the same class of file. Every OTHER screen that shows a payment receipt — the
 * couple's "Amount to pay", the supplier's "Confirm it reached you", the
 * deposit-dispute queue, force-majeure — offered the words "View proof" and
 * nothing else. This guard exists so that stays fixed in all of them at once.
 *
 * It COUNTS mounts per file and prints what it found. A guard that only asks
 * "does the word ProofImage appear anywhere" passes a change that deletes four
 * of five call sites — see memory "a-count-of-a-symmetric-quantity-is-not-
 * evidence" and "a-guard-window-anchored-on-the-first-match-faces-the-wrong-cell".
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { stripComments } from '../../lib/strip-comments';

const WEB = path.join(__dirname, '..', '..');

function read(rel: string): string {
  return stripComments(readFileSync(path.join(WEB, rel), 'utf8'));
}

/**
 * The size below which a receipt stops being evidence. A GCash reference number
 * is unreadable in a 48px (`h-12 w-12`) thumbnail — the filename-row box this
 * replaced — and roughly readable from about 200px of height.
 */
const MIN_LEGIBLE_PX = 200;

/** `max-h-64` → 256, `max-h-[16rem]` → 256, `max-h-[340px]` → 340. */
function tailwindMaxHeightPx(cls: string): number | null {
  const bracket = cls.match(/max-h-\[(\d+)(px|rem)\]/);
  if (bracket) return bracket[2] === 'rem' ? Number(bracket[1]) * 16 : Number(bracket[1]);
  const scale = cls.match(/max-h-(\d+)(?![\w[])/);
  // Tailwind's numeric scale is quarter-rem: 64 → 16rem → 256px.
  return scale ? (Number(scale[1]) / 4) * 16 : null;
}

test('the shared proof picture is big, uncropped, and openable full size', () => {
  const src = read('app/_components/proof-image.tsx');
  const cls = src.match(/export const PROOF_IMAGE_CLASS =\s*([\s\S]*?);/)?.[1];
  assert.ok(cls, 'PROOF_IMAGE_CLASS is gone — the one size every screen reads');

  const px = tailwindMaxHeightPx(cls);
  assert.ok(px !== null, `no max-height in PROOF_IMAGE_CLASS: ${cls}`);
  assert.ok(
    px >= MIN_LEGIBLE_PX,
    `the shared proof renders at ${px}px — a reference number needs at least ${MIN_LEGIBLE_PX}px`,
  );
  // A crop can hide the amount, and the amount is the point.
  assert.match(cls, /object-contain/, 'the proof is cropped — object-cover can cut off the total');
  assert.doesNotMatch(cls, /object-cover/);
  // A fixed h-*/w-* would defeat max-h entirely.
  // ⚠ `\bh-\d` would match inside `max-h-64` — a word boundary sits between the
  // hyphen and the `h`. The lookbehind is what makes this assertion mean
  // "a BARE h-*", which is the only thing that would defeat the max-height.
  assert.doesNotMatch(cls, /(?<![\w-])h-\d/, 'a fixed height overrides the max-height');

  // The picture is a door to the full-size file, and so is the line under it.
  const opens = src.match(/target="_blank"/g) ?? [];
  assert.equal(opens.length, 2, `expected the picture AND "Open full size" to open it, found ${opens.length}`);
  assert.match(src, /Open full size/);
  assert.match(src, /rel="noopener noreferrer"/);

  // 🔒 It must never resolve or sign anything itself: the caller hands it a
  // link it was already allowed to hand a browser.
  assert.doesNotMatch(src, /r2:\/\//, 'the shared picture must never touch a stored ref');
  assert.doesNotMatch(src, /displayUrlFor|depositProofDisplayUrl|createAdminClient/);
  assert.doesNotMatch(src, /'use client'/, 'a server page must be able to mount it');
});

/**
 * Every screen that SHOWS a payment receipt, and how many pictures it mounts.
 * The number is the point: it is what a deletion trips.
 */
const PROOF_SURFACES: ReadonlyArray<readonly [string, number, string]> = [
  ['app/admin/payments/page.tsx', 1, 'admin reconciles a Setnayan-checkout payment'],
  ['app/admin/disputes/_components/deposit-disputes-section.tsx', 1, 'admin rules on a refused deposit'],
  ['app/admin/force-majeure/[flagId]/page.tsx', 1, 'admin handles a force-majeure flag'],
  ['app/vendor-dashboard/clients/[eventId]/page.tsx', 3, 'the supplier before/after confirming'],
  [
    'app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/deposit-reservation.tsx',
    1,
    'the couple checking what they sent',
  ],
  ['app/_components/chat-message-stream.tsx', 1, 'the supplier confirming from the chat'],
];

test('every screen that shows a receipt mounts the big picture', () => {
  const counted: string[] = [];
  let total = 0;
  for (const [rel, expected, who] of PROOF_SURFACES) {
    const src = read(rel);
    const mounts = src.match(/<ProofImage\b/g) ?? [];
    counted.push(`${rel}: ${mounts.length}`);
    assert.equal(
      mounts.length,
      expected,
      `${rel} (${who}): expected ${expected} <ProofImage> mount(s), found ${mounts.length}`,
    );
    assert.match(
      src,
      /import \{ ProofImage \} from '@\/app\/_components\/proof-image'/,
      `${rel}: mounts ProofImage without importing the shared one`,
    );
    total += mounts.length;
  }
  assert.equal(total, 8, `expected 8 receipt pictures across the app, counted ${total}\n${counted.join('\n')}`);
});

test('no screen has gone back to a bare "View proof" link', () => {
  // The exact shape that was there before: the stored-or-signed value used as
  // an href with no picture beside it.
  const OFFENDERS: ReadonlyArray<readonly [string, RegExp]> = [
    ['app/vendor-dashboard/clients/[eventId]/page.tsx', /href=\{completion\.deposit_proof_url\}/g],
    ['app/admin/force-majeure/[flagId]/page.tsx', /href=\{depositProofUrl\}/g],
    [
      'app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/deposit-reservation.tsx',
      /href=\{depositProofUrl\}/g,
    ],
  ];
  for (const [rel, re] of OFFENDERS) {
    const hits = read(rel).match(re) ?? [];
    assert.equal(hits.length, 0, `${rel}: ${hits.length} receipt(s) still rendered as a link only`);
  }
});

test('the chat card shows the receipt ABOVE the confirm button, not after it', () => {
  const src = read('app/_components/chat-message-stream.tsx');
  const proofAt = src.indexOf('<ProofImage');
  const confirmAt = src.indexOf('Confirm it reached you');
  assert.ok(proofAt !== -1 && confirmAt !== -1, 'the confirm card lost one of its two halves');
  assert.ok(
    proofAt < confirmAt,
    'the receipt renders after the Confirm button — you would press it before seeing the money',
  );
  // The link must arrive signed from the page, never be built here.
  assert.match(src, /paymentProofUrl\b/);
  assert.doesNotMatch(src, /depositProofDisplayUrl/, 'a client component cannot sign a private file');
});

test('the receipt the couple PICKS is previewed at the same legible size', () => {
  const src = read('app/_components/chosen-proof-field.tsx');
  const cls = src.match(/export const CHOSEN_PROOF_IMAGE_CLASS =\s*([\s\S]*?);/)?.[1];
  assert.ok(cls, 'CHOSEN_PROOF_IMAGE_CLASS is gone');
  const px = tailwindMaxHeightPx(cls);
  assert.ok(px !== null && px >= MIN_LEGIBLE_PX, `the picked receipt renders at ${px}px`);

  // Name, size, Remove, and tap-to-open — the four things the owner asked for.
  assert.match(src, /formatFileSize\(/, 'the file size is never shown');
  assert.match(src, /\{chosen\.name\}/, 'the file name is never shown');
  assert.match(src, /Remove/, 'there is no way to drop the wrong file');
  assert.match(src, /inputRef\.current\.value = ''/, 'Remove clears the preview but not the input');
  assert.match(src, /target="_blank"/, 'the preview does not open full size');

  // The upload path is unchanged: a plain file input inside the parent form.
  assert.match(src, /type="file"/);
  assert.doesNotMatch(src, /\/api\/upload|FileUpload/, 'the picked file must not be uploaded early');

  // And it is actually mounted where the owner hit this.
  const form = read(
    'app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/deposit-reservation.tsx',
  );
  const mounts = form.match(/<ChosenProofField\b/g) ?? [];
  assert.equal(mounts.length, 1, `expected 1 ChosenProofField in the first-payment form, found ${mounts.length}`);
  assert.doesNotMatch(
    form,
    /id="proof"\s*\n\s*name="proof"\s*\n\s*ref=/,
    'the bare file input with no preview is back',
  );
});

test('a single receipt on a FileUpload evidence lane takes the field, not a 48px row', () => {
  const src = read('app/_components/file-upload.tsx');
  const gate = src.match(/const isSingleImagePreview =([\s\S]*?);\n/)?.[1];
  assert.ok(gate, 'isSingleImagePreview is gone');
  assert.match(
    gate,
    /bigPreview && variant === 'wide'/,
    'an opted-in evidence field no longer takes the big preview',
  );
  assert.match(gate, /!multiple/, 'a gallery would become N hero images');

  const box = src.match(/const previewBoxHeight = bigPreview \? '([^']+)'/)?.[1];
  assert.ok(box, 'the big-preview box height is gone');
  const px = tailwindMaxHeightPx(box.replace('min-h-', 'max-h-'));
  assert.ok(px !== null && px >= MIN_LEGIBLE_PX, `the opted-in preview box is ${px}px`);

  // The two receipt uploads opt in; counted per file.
  const OPTED_IN: ReadonlyArray<readonly [string, number]> = [
    [
      'app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/deposit-reservation.tsx',
      1,
    ],
    ['app/dashboard/[eventId]/_components/vendor-itemization-card.tsx', 1],
  ];
  for (const [rel, expected] of OPTED_IN) {
    const hits = read(rel).match(/\bbigPreview\b/g) ?? [];
    assert.equal(hits.length, expected, `${rel}: expected ${expected} bigPreview, found ${hits.length}`);
  }
});
