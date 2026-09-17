import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { marketplaceTenureLine } from '@/lib/marketplace-tenure';
import { stripComments } from '@/lib/strip-comments';

/**
 * "ON THE MARKETPLACE SINCE ⟨MONTH YEAR⟩" — and the thing it must never be
 * mistaken for.
 *
 * Two tenures exist for a shop and the product already treats them as
 * different: `in_business_since_year` is the CREDENTIAL (surfaced as the
 * experience pill, admin-verifiable), and `vendor_profiles.created_at` is only
 * how long they have been on Setnayan.
 *
 * ⚠ `lib/vendor-milestone.ts` records the house position on confusing the two:
 * "an established shop that merely joined Setnayan recently shows its real
 * '11th year in business', never '3rd month in business'." A florist of eleven
 * years who signed up last month must not be made to look new by a line we
 * added — so the wording carries the distinction, not the placement.
 */

let ran = 0;
const line = (iso: string | null | undefined, now: string) => {
  ran++;
  return marketplaceTenureLine(iso, now);
};

test('it names the month and year the shop joined', () => {
  assert.equal(
    line('2026-09-03T04:05:06Z', '2026-09-17T12:00:00Z'),
    'On the marketplace since September 2026',
  );
  assert.equal(
    line('2019-01-31T23:59:59Z', '2026-09-17T12:00:00Z'),
    'On the marketplace since January 2019',
  );
});

test('🔑 the sentence SAYS what it measures — it is not a bare date', () => {
  /*
    The whole safety argument. Beside an experience pill reading "11 yrs in
    business", a bare "Since September 2026" reads as a founding date and
    actively misleads. The label is what makes the two claims distinguishable.
  */
  const out = line('2026-09-03T00:00:00Z', '2026-09-17T00:00:00Z');
  assert.ok(out);
  assert.match(out, /^On the marketplace since /, 'the qualifier is gone — this now reads as a founding date');
  assert.ok(
    !/in business|years? old|established/i.test(out),
    `it claims business experience it has no basis for: ${out}`,
  );
});

test('⚠ a new shop is NOT hidden — absence would be a tell', () => {
  /*
    Suppressing the line for a recent joiner would make its presence a badge
    and its absence a signal, which is a worse dishonesty than the one it
    avoids. The page takes this position out loud for the experience tier too:
    "we render the tier even for 'New to Setnayan' (honest, not negative)."
  */
  assert.equal(
    line('2026-09-17T08:00:00Z', '2026-09-17T09:00:00Z'),
    'On the marketplace since September 2026',
    'a shop that joined today was hidden, making the line a badge',
  );
});

test('🔒 an unusable join date renders NOTHING, never a guess', () => {
  for (const bad of [null, undefined, '', 'not-a-date', 'yesterday']) {
    assert.equal(
      line(bad as string | null | undefined, '2026-09-17T00:00:00Z'),
      null,
      `${JSON.stringify(bad)} produced a sentence`,
    );
  }
});

test('🔒 a FUTURE join date is refused, not clamped', () => {
  /*
    Clock skew or a bad backfill would otherwise print "On the marketplace since
    March 2027" on a live shop page. Clamping would invent a date we have no
    basis for; refusing is the only honest answer.
  */
  assert.equal(line('2027-03-01T00:00:00Z', '2026-09-17T00:00:00Z'), null);
  // One second in the future still counts as the future.
  assert.equal(line('2026-09-17T00:00:01Z', '2026-09-17T00:00:00Z'), null);
});

test('month boundaries are read in UTC, consistently with the stored value', () => {
  // `created_at` is a UTC timestamp; reading it in local time would slide a
  // shop that joined on the 1st back into the previous month for half the world.
  assert.equal(
    line('2026-03-01T00:30:00Z', '2026-09-17T00:00:00Z'),
    'On the marketplace since March 2026',
  );
  assert.equal(
    line('2026-12-31T23:30:00Z', '2027-02-01T00:00:00Z'),
    'On the marketplace since December 2026',
  );
});

// ── The shop page ─────────────────────────────────────────────────────────

test('the shop page renders it, ungated, with the column it needs', () => {
  const src = stripComments(
    readFileSync(join(process.cwd(), 'app/v/[slug]/page.tsx'), 'utf8'),
  );
  assert.match(src, /marketplaceTenureLine\(/, 'the shop page never computes it');
  assert.match(src, /\{marketplaceSince \? \(/, 'it is computed but never rendered');
  /*
    ⚠ NOT INSIDE THE FLAG-GATED EXPERIENCE PROBE. `vendorExperienceEnabled()`
    guards that block, and a line behind a switch whose production value nobody
    can read is how a feature ships dark — the exact defect fixed in the
    guest-session token check on the same day.
  */
  const gate = src.indexOf('vendorExperienceEnabled()');
  const compute = src.indexOf('marketplaceTenureLine(');
  assert.ok(gate > -1 && compute > -1);
  assert.ok(
    compute < gate,
    'the tenure line moved inside the flag-gated probe and now ships dark',
  );
  // The column must be in BOTH selects — the legacy fallback must not drop it.
  const selects = (src.match(/,created_at';/g) ?? []).length;
  assert.equal(selects, 2, `created_at is in ${selects} of the 2 selects`);
});

test('case count', () => {
  console.log(`      (${ran} tenure decisions executed)`);
  assert.ok(ran >= 11, `expected >= 11 executed decisions, ran ${ran}`);
});
