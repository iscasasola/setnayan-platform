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
  assert.equal(strongestPartnershipKind(['general', 'included_in_package']), 'included_in_package');
  assert.equal(strongestPartnershipKind(['accredited', 'discounted_together']), 'discounted_together');
  assert.equal(strongestPartnershipKind(['general', 'accredited']), 'accredited');
});

test('a vendor holding BOTH kinds shows the stronger one — this was the bug', () => {
  // The public page picked alphabetically, so `accredited` beat
  // `included_in_package` and a vendor included free in a package was shown as
  // merely accredited — while Explore ranked them by the stronger kind. Same
  // four values, two files, opposite orders.
  assert.equal(
    strongestPartnershipKind(['accredited', 'included_in_package']),
    'included_in_package',
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
    PARTNERSHIP_PUBLIC_LABEL.included_in_package,
    PARTNERSHIP_PUBLIC_LABEL.discounted_together,
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
  assert.equal(claimsPartnerPricing('included_in_package'), true);
  assert.equal(claimsPartnerPricing('discounted_together'), true);
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
    !/included_in_package:\s*4/.test(explore),
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

// ── The names must not drift back toward "sponsored" ────────────────────────
// Renamed 2026-08-05 (migration 20271108090000) because the old word sent two
// independent readers to the same wrong conclusion: that the marketplace was
// being reordered by paid advertising. It never was.

test('no kind is named in a way that implies paid placement', () => {
  for (const k of PARTNERSHIP_KINDS) {
    assert.ok(
      !/sponsor|paid|promoted|advert|boost/i.test(k),
      `"${k}" reads as advertising — nobody pays for a partnership`,
    );
  }
});

test('the code and the database allow exactly the same four values', () => {
  // A CHECK constraint that disagrees with the code is a 23514 at write time,
  // and the only place it shows up is a vendor's failed proposal.
  const sql = readFileSync(
    join(HERE, '..', '..', '..', 'supabase', 'migrations',
         '20271108090000_partnership_kinds_say_what_they_mean.sql'),
    'utf8',
  );
  const allowed = [...sql.matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1]);
  for (const k of PARTNERSHIP_KINDS) {
    assert.ok(allowed.includes(k), `the CHECK does not allow "${k}"`);
  }
  // And nothing the CHECK allows is missing from the code.
  for (const a of new Set(allowed)) {
    assert.ok(
      (PARTNERSHIP_KINDS as readonly string[]).includes(a!),
      `the CHECK allows "${a}" but the code does not know it`,
    );
  }
});

test('the migration drops the old CHECK before moving the values', () => {
  // Wrong order and every row update fails against the old allowlist.
  const sql = readFileSync(
    join(HERE, '..', '..', '..', 'supabase', 'migrations',
         '20271108090000_partnership_kinds_say_what_they_mean.sql'),
    'utf8',
  );
  assert.ok(
    sql.indexOf('DROP CONSTRAINT') < sql.indexOf('UPDATE public.vendor_partnerships'),
    'the CHECK must come off before the values move',
  );
  assert.ok(
    sql.indexOf('UPDATE public.vendor_partnerships') < sql.lastIndexOf('ADD CONSTRAINT'),
    'and go back on after',
  );
});
