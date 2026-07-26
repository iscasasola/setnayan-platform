/**
 * CALL-SITE GUARDS for the § 5 merit-first ranking
 * (Vendor_Monetization_Model_LOCKED_2026-07-25 § 5).
 *
 * `vendor-rank-boost.test.ts` proves the LIBRARY is safe. That is not the same
 * as proving the shipped surface is safe: every § 5 property in that file is a
 * property of arguments the call site chooses, so a call site can satisfy every
 * library test and still ship a pay-to-win page by feeding the wrong column,
 * hand-splicing the render order, or skipping a gate.
 *
 * These are SOURCE SCANS of `app/dashboard/[eventId]/vendors/_actions/
 * category-search.ts` — grep-shaped on purpose, the same pattern
 * `life-event-gate.test.ts` uses for insert paths. An import assertion would
 * pass on a file that imports the right function and then ignores it.
 *
 * Each test below is written so that REVERTING the corresponding call-site fix
 * turns it red. They were verified that way, not assumed.
 *
 * ⚠ SCOPE — read before flipping `NEXT_PUBLIC_VENDOR_RANK_BOOST_ENABLED`.
 * The merit model is wired into exactly ONE of the platform's five vendor
 * lists: this category-search overlay. `lib/vendor-counts.ts`, `/explore`, the
 * 3D-plan demo and `build-3state-actions.ts` still order by the unbounded
 * legacy `ad_rank`. The flag is safe ON for this surface and does not make the
 * platform § 5-compliant. See {@link OTHER_VENDOR_LISTS_STILL_AD_RANK}.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CATEGORY_SEARCH = join(
  process.cwd(),
  'app/dashboard/[eventId]/vendors/_actions/category-search.ts',
);

const SRC = readFileSync(CATEGORY_SEARCH, 'utf8');

/**
 * The four vendor lists this branch does NOT convert. Named here so the
 * limitation is a fact in the test suite rather than a sentence in a changelog
 * nobody re-reads. If one of these is converted later, drop it from this list.
 */
export const OTHER_VENDOR_LISTS_STILL_AD_RANK = [
  'lib/vendor-counts.ts',
  'app/explore',
  'the 3D-plan demo',
  'build-3state-actions.ts',
] as const;

test('the Featured gate is fed the ADMIN-VETTED state, not the display chip', () => {
  // The defect: featuring keyed on `public_visibility === 'verified'` alone —
  // the same column an admin flips to freeze a fraud suspension, and (until
  // migration 20271004444950) a column a vendor could PATCH itself. A paid
  // top-of-page slot must require the vetting DECISION and the visibility
  // state, ANDed.
  assert.match(
    SRC,
    /_adminVerified:\s*\n?\s*r\.verification_state === 'verified' && r\.public_visibility === 'verified'/,
    '_adminVerified must be verification_state AND public_visibility, both "verified"',
  );
  // …and that it is what the featured partition actually receives.
  assert.match(
    SRC,
    /adminVerified:\s*s\._adminVerified/,
    'partitionFeatured must be handed _adminVerified',
  );
  // The public `verified` display field must NOT be what gates a paid slot.
  assert.doesNotMatch(
    SRC,
    /adminVerified:\s*s\.verified\b/,
    'the Featured gate is reading the display chip again',
  );
});

test('the render order goes through composeFeaturedOrder — never hand-spliced', () => {
  // The § 5 invariant is a property of the COMPOSED list. Splicing
  // [...featured, ...organic] inline puts it back out of reach of every test,
  // which is exactly how a 10-point featured floor shipped green against a
  // 6-point boost ceiling.
  assert.match(
    SRC,
    /composeFeaturedOrder\(partition\)/,
    'category-search must compose the ranked order through composeFeaturedOrder',
  );
  assert.doesNotMatch(
    SRC,
    /\.\.\.featured\.map\(/,
    'the featured list is being hand-spliced into the render order again',
  );
});

test('responsiveness merit is gated through organicRespondsFast', () => {
  // 15 of 100 merit points are otherwise purchasable: the PAID auto-reply bot
  // posts as sender_role='vendor', which stamps the first-reply timestamp that
  // `respondsFast` is derived from.
  assert.match(
    SRC,
    /respondsFast: organicRespondsFast\(\{/,
    'meritScore must receive organicRespondsFast(...), never the raw First-Look flag',
  );
  assert.match(
    SRC,
    /botAssisted: botAssistedIds\.has\(/,
    'the bot-assisted set must feed the responsiveness gate',
  );
  // The ledger read must exist and must FAIL CLOSED: an errored read marks
  // every candidate bot-assisted rather than handing the credit out unproven.
  assert.match(SRC, /from\('vendor_bot_replies'\)/, 'the bot-reply ledger is not read');
  assert.match(
    SRC,
    /if \(botErr\) \{\s*\n\s*for \(const id of ids\) botAssistedIds\.add\(id\);/,
    'the bot-reply read must fail CLOSED (mark everyone bot-assisted on error)',
  );
});

test('every flag-gated read stays behind the flag — flag-OFF issues no new queries', () => {
  // Byte-identity on the OFF path is the standing rule for this wave. The two
  // merit stat reads and the bot-ledger read all have to be inside
  // `if (rankBoost)` or a `rankBoost ? … : null` ternary.
  //
  // Scanned over the BODY only (the import block naturally names these symbols
  // without a guard) and over EVERY occurrence, not just the first — a second,
  // unguarded call added later must fail here.
  const bodyStart = SRC.lastIndexOf("} from '@/lib/");
  assert.ok(bodyStart > 0, 'could not locate the end of the import block');
  const BODY = SRC.slice(bodyStart);

  for (const marker of [
    "from('vendor_bot_replies')",
    'fetchTrustedReviewStatsForMany(',
    'fetchCompletedBookingCounts(',
  ]) {
    let at = BODY.indexOf(marker);
    assert.ok(at > 0, `${marker} not found in the action body`);
    while (at > 0) {
      const before = BODY.slice(Math.max(0, at - 600), at);
      assert.ok(
        /rankBoost/.test(before),
        `${marker} (offset ${at}) is not guarded by the rankBoost flag`,
      );
      at = BODY.indexOf(marker, at + marker.length);
    }
  }
});

test('SCOPE: this branch converts one of five vendor lists, and says so', () => {
  // Not a behaviour assertion — a documentation assertion. The reviewer's steer
  // was "extend § 5 to all five lists or descope and SAY SO". This is the
  // saying-so, pinned where it cannot rot out of the repo.
  assert.equal(OTHER_VENDOR_LISTS_STILL_AD_RANK.length, 4);
  assert.match(
    SRC,
    /ONE of the platform's five vendor lists/,
    'category-search must carry the explicit one-of-five scope warning',
  );
});
