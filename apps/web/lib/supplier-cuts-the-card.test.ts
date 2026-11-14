/**
 * supplier-cuts-the-card.test.ts — 🧰 THE SERVICE CARD, CUT 3 (owner-approved 2026-11-14 — DECISION_LOG "THE SEVEN
 * SUPPLIER CUTS ARE APPROVED"; prototype `prototypes/supplier_eleven_jobs_cuts_2026-11-14_fable.html` § 3).
 *
 *   (1) the kind picked at sign-up is never re-asked: a one-kind sign-up writes `vendor_profiles.services` and no
 *       coverage row, so the maker reads those services, lists their live leaves under "What you cover" (so a lone one
 *       is pre-picked, "From your shop"), and counts them as covered — "Add Florals to what you do?" is not asked;
 *   (2) nothing is written by it — the maker context only reads.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { coverageAskFor } from './service-card-maker';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('(1) the sign-up kind is read, listed as covered, and never asked about', () => {
  const ctx = read('lib/service-card-maker.server.ts');
  assert.match(ctx, /from\('vendor_profiles'\)\.select\('tier_state, is_founder, services'\)/, 'the sign-up services are not read');
  assert.match(ctx, /const signupLeaves = \(tierRow\?\.services \?\? \[\]\)\.filter\(/);
  assert.match(ctx, /leaves\.label\.has\(s\)/, 'a sign-up service that is no live leaf would be offered');
  assert.match(ctx, /const coveredLeafSet = new Set\(\[\.\.\.vendorCoverages\.map\(\(c\) => c\.canonical_service\), \.\.\.signupLeaves\]\);/, 'the sign-up kind is asked about again');
  assert.match(ctx, /coverageKindOptions\.push\(\.\.\.signupKindOptions\);/, 'the sign-up kind is not listed under "What you cover"');
  /* The rule that decides the question: a covered leaf is never asked. */
  const leaves = { label: new Map([['florals', 'Florals']]), folder: new Map([['florals', 'flowers']]) } as unknown as Parameters<typeof coverageAskFor>[1];
  assert.equal(coverageAskFor('florals', leaves, new Set(['florals'])), null, 'a covered kind is asked about');
  assert.ok(coverageAskFor('florals', leaves, new Set()), 'anti-vacuity: an uncovered kind is no longer asked about at all');
});

test('(2) the maker context only reads — the sign-up kind writes nothing', () => {
  const ctx = read('lib/service-card-maker.server.ts');
  const part = ctx.slice(ctx.indexOf('const signupLeaves'), ctx.indexOf('const leadWithOwnWords'));
  assert.ok(part.length > 100, 'anti-vacuity: the sign-up block was not found');
  assert.doesNotMatch(part, /\.insert\(|\.upsert\(|\.update\(|insertCoverage/, 'reading the sign-up kind writes a coverage');
});

test('(3) the short form: four things first, the rest under More options IN THE SAME FORM, so a typed price is kept', () => {
  const src = read('app/vendor-dashboard/services/_components/canvas-maker.tsx');
  const formOpen = src.indexOf('id={CARD_FORM_ID}');
  const formClose = src.indexOf('</form>', formOpen);
  const more = src.indexOf('data-maker-more-wrap=');
  assert.ok(formOpen > 0 && formClose > formOpen, 'anti-vacuity: the card form was not found');
  /* More options opens inside the one form: the price row is never unmounted or re-asked by opening it. */
  assert.ok(more > formOpen && more < formClose, 'More options left the card’s form — what was typed would be lost');
  assert.doesNotMatch(src, /hidden=\{!isEdit\} className=\{isEdit \? TOPIC/, 'More options is hidden again while a card is made');
  assert.match(src, /title=\{isEdit \? 'More settings' : 'More options'\}/);
  for (const k of ['specialties', 'extras', 'gift']) {
    const at = src.search(new RegExp(`(?<!\\[)data-maker-row="${k}"`));
    assert.ok(at > more && at < formClose, `${k} is not under More options in the card’s form`);
  }
  /* On a phone the preview is one tap away, shut by default. */
  assert.match(src, /const \[peekOpen, setPeekOpen\] = useState\(false\);/, 'the phone preview is open by default again');
});
