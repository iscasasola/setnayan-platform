/**
 * the-logo-step-says-one-thing.test.ts — /open-shop's logo step does not contradict itself, and its
 * formats line breaks only between its two facts.
 *
 * ── THE DEFECT (2026-10-23, /open-shop at 375 px) ───────────────────────────
 *   1. The label said "Shop logo optional" and the line under it said "Needed before your shop is approved".
 *      The rule is neither "optional" nor "needed now": it is not needed to OPEN the shop and is needed
 *      before VERIFICATION (owner decision 4, 2026-07-21 — pinned by lib/open-shop-logo-gate.test.ts).
 *   2. "PNG · JPEG · WEBP · HEIC · HEIF · UP TO 10 MB" wrapped mid-phrase: "… HEIF · UP TO" / "10 MB".
 *
 * ── THE PROPERTY ────────────────────────────────────────────────────────────
 *   1. While OPEN_SHOP_LOGO_REQUIRED is off, the step's label and hint are the one shared LOGO_LATER pair;
 *      neither says "optional" (it is not — verification needs it), and the hint names the step that
 *      really requires it (verification), not one that does not ("approved", "publish").
 *   2. The round upload's limits line is two blocks — the formats, then the size — and the size is kept
 *      whole, so a narrow phone can only break between the two.
 * Comments stripped before matching.
 *
 * SABOTAGE: put the literal "optional" back as the label → RED.
 * SABOTAGE: set LOGO_LATER.hint to "Needed before your shop is approved…" → RED.
 * SABOTAGE: put `· up to {formatCount(maxSizeMB)} MB` back inline after the formats → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { LOGO_LATER, OPEN_SHOP_LOGO_REQUIRED } from '@/lib/open-shop-validation';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the logo step says one true thing: not needed to open, needed to get verified', () => {
  assert.equal(OPEN_SHOP_LOGO_REQUIRED, false, 'the logo is required at registration again — this test describes the other rule');
  const words = `${LOGO_LATER.label} ${LOGO_LATER.hint}`;
  assert.doesNotMatch(words, /\boptional\b/i, 'the logo is not optional — verification needs it');
  assert.match(LOGO_LATER.hint, /\bverif/i, 'the hint must name the step that needs the logo: verification');
  assert.doesNotMatch(LOGO_LATER.hint, /\bapprov|\bpublish/i, 'approval / publishing do not read the logo — verification does');

  const wizard = read('app/open-shop/_components/open-shop-wizard.tsx');
  const step = wizard.slice(wizard.indexOf('Shop logo'), wizard.indexOf('<label', wizard.indexOf('Shop logo')));
  assert.ok(step.length > 0, 'the logo step moved — this guard is pointed at nothing');
  assert.match(step, /\{LOGO_LATER\.label\}/, 'the label must be the shared LOGO_LATER.label');
  assert.match(step, /\{LOGO_LATER\.hint\}/, 'the hint must be the shared LOGO_LATER.hint');
  assert.doesNotMatch(step, />\s*optional\s*</i, 'a typed "optional" is back beside the logo');
  assert.doesNotMatch(step, /approved/i, 'a typed "approved" sentence is back under the logo');
});

test('the round upload’s limits line breaks only between the formats and the size', () => {
  const src = read('app/_components/file-upload.tsx');
  const at = src.indexOf('data-upload-limits');
  assert.ok(at > 0, 'the round limits line lost its marker — this guard is pointed at nothing');
  const line = src.slice(at, src.indexOf(') : null}', at));
  const blocks = [...line.matchAll(/<span className="([^"]*)">/g)].map((m) => m[1]!);
  assert.equal(blocks.length, 2, `the limits line must be exactly two parts (formats · size); found ${blocks.length}`);
  for (const cls of blocks) assert.match(cls, /(?:^|\s)block(?:\s|$)/, 'each part is its own line');
  assert.match(blocks[1]!, /whitespace-nowrap/, 'the size limit must never split ("UP TO" / "10 MB")');
  const sizeAt = line.indexOf('up to {formatCount(maxSizeMB)} MB');
  const secondSpan = line.lastIndexOf('<span className=');
  assert.ok(sizeAt > secondSpan, 'the size must sit inside the second (unbreakable) part, not run on after the formats');
});
