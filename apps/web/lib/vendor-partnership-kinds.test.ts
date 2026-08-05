/**
 * The four partnership kinds — one rank order, one set of words, and the
 * consent rule for changing between them.
 *
 * Every test here exists because two files disagreed about the same four
 * values, or because a couple was shown a word that told them nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PARTNERSHIP_KINDS,
  PARTNERSHIP_PUBLIC_LABEL,
  PARTNERSHIP_RANK,
  claimsPartnerPricing,
  isPartnershipKind,
  strongestPartnershipKind,
} from './vendor-partnership-kinds';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => readFileSync(join(HERE, ...p), 'utf8');

// ── One rank order, everywhere ──────────────────────────────────────────────

test('the strongest kind is what the couple gets most from', () => {
  // Free beats cheaper beats certified beats "we work together".
  assert.equal(strongestPartnershipKind(['general', 'sponsored_included']), 'sponsored_included');
  assert.equal(strongestPartnershipKind(['accredited', 'sponsored_discounted']), 'sponsored_discounted');
  assert.equal(strongestPartnershipKind(['general', 'accredited']), 'accredited');
});

test('a vendor holding BOTH kinds shows the stronger one — this was the bug', () => {
  // The public page picked alphabetically, so `accredited` beat
  // `sponsored_included` and a vendor included free in a package was shown as
  // merely accredited — while Explore ranked them by the stronger kind. Same
  // four values, two files, opposite orders.
  assert.equal(
    strongestPartnershipKind(['accredited', 'sponsored_included']),
    'sponsored_included',
  );
});

test('unknown values are ignored, not ranked', () => {
  assert.equal(strongestPartnershipKind(['nonsense', 'general']), 'general');
  assert.equal(strongestPartnershipKind(['nonsense']), null);
  assert.equal(strongestPartnershipKind([]), null);
});

test('every kind has a rank, a public label and a hint', () => {
  for (const k of PARTNERSHIP_KINDS) {
    assert.ok(PARTNERSHIP_RANK[k] > 0, `${k} has no rank`);
    assert.ok(PARTNERSHIP_PUBLIC_LABEL[k]?.length > 0, `${k} has no public label`);
  }
  // Ranks must be distinct, or "strongest" is a coin flip.
  const ranks = PARTNERSHIP_KINDS.map((k) => PARTNERSHIP_RANK[k]);
  assert.equal(new Set(ranks).size, ranks.length, 'two kinds share a rank');
});

// ── What a couple is told ───────────────────────────────────────────────────

test('the two bundle kinds no longer collapse into one meaningless phrase', () => {
  // Both used to render as "Preferred partner" — one phrase for two different
  // offers, hiding the only part a couple cares about.
  assert.notEqual(
    PARTNERSHIP_PUBLIC_LABEL.sponsored_included,
    PARTNERSHIP_PUBLIC_LABEL.sponsored_discounted,
  );
  const labels = Object.values(PARTNERSHIP_PUBLIC_LABEL);
  assert.equal(new Set(labels).size, labels.length, 'two kinds share a public label');
});

test('no couple-facing label implies money changed hands with Setnayan', () => {
  // Nobody pays for any of these (owner, 2026-08-05). A label that hints at
  // sponsorship would be untrue in the other direction.
  for (const label of Object.values(PARTNERSHIP_PUBLIC_LABEL)) {
    assert.ok(
      !/sponsor|paid|promoted|advert/i.test(label),
      `"${label}" implies a paid placement; none of these are paid`,
    );
  }
});

// ── The consent rule ────────────────────────────────────────────────────────

test('a claim about the partner’s pricing needs their consent', () => {
  assert.equal(claimsPartnerPricing('sponsored_included'), true);
  assert.equal(claimsPartnerPricing('sponsored_discounted'), true);
  assert.equal(claimsPartnerPricing('accredited'), false);
  assert.equal(claimsPartnerPricing('general'), false);
});

test('changing INTO a pricing claim un-publishes the badge and re-asks', () => {
  const src = read('..', 'app', 'vendor-dashboard', 'partnerships', 'actions.ts');
  const fn = src.slice(src.indexOf('export async function changePartnershipKind'));
  assert.match(fn, /claimsPartnerPricing\(next\)/);
  const branch = fn.slice(fn.indexOf('if (claimsPartnerPricing(next))'));
  assert.match(branch, /patch\.status = 'proposed'/, 'must go back for acceptance');
  assert.match(
    branch,
    /patch\.accepted_at = null/,
    'and must drop the acceptance stamp — leaving it would keep an unagreed pricing claim public',
  );
});

test('only the vendor who made the recommendation can restate it', () => {
  const src = read('..', 'app', 'vendor-dashboard', 'partnerships', 'actions.ts');
  const fn = src.slice(src.indexOf('export async function changePartnershipKind'));
  assert.match(fn, /\.eq\('recommending_vendor_id', vendorProfileId\)/);
});

// ── The two surfaces must not drift apart again ─────────────────────────────

test('neither surface keeps its own copy of the rank order', () => {
  const explore = read('..', 'app', 'explore', 'page.tsx');
  const trusted = read('vendor-trusted-by.ts');
  assert.match(explore, /PARTNERSHIP_RANK/, 'Explore must read the shared rank');
  // ⚠ A NAME APPEARING IS NOT A NAME BEING USED. The first version of this
  // assertion matched the file for `strongestPartnershipKind` — and passed
  // happily when the call site was replaced with `[...kinds].sort()[0]`,
  // because the IMPORT line still contained the word. Match the CALL.
  assert.match(
    trusted,
    /strongestPartnershipKind\(/,
    'the badge must CALL the shared rank, not merely import it',
  );
  assert.ok(
    !/\.sort\(\)/.test(trusted),
    'an alphabetical sort is back in the badge dedupe — that is the original bug',
  );
  // A re-typed literal ladder is how they diverged the first time.
  assert.ok(
    !/sponsored_included:\s*4/.test(explore),
    'Explore has re-typed the rank order instead of importing it',
  );
});

test('the public page reads the shared labels, not its own map', () => {
  const profile = read('..', 'app', 'v', '[slug]', 'page.tsx');
  assert.match(profile, /PARTNERSHIP_PUBLIC_LABEL\[/);
  assert.ok(
    !/TRUSTED_BY_RELATIONSHIP_LABEL\s*:/.test(profile),
    'the old local label map is back',
  );
});

test('isPartnershipKind refuses anything that is not one of the four', () => {
  for (const k of PARTNERSHIP_KINDS) assert.equal(isPartnershipKind(k), true);
  for (const junk of ['', 'sponsored', 'Accredited', null, undefined, 7]) {
    assert.equal(isPartnershipKind(junk), false);
  }
});
