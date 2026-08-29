/**
 * Papic COPY guardrails — the durable half of the 2026-07-20 honesty pass.
 *
 * The four surfaces below had each hand-typed a Papic promise that the charge /
 * enforcement path never made good on:
 *   • /pricing:  "Ltd ₱30 (30 photos + 10 videos) … first 5 free … (Ltd ₱9,000
 *     · Unli ₱15,000)" — wrong rung name, wrong capacity, wrong free count,
 *     wrong cap.
 *   • the /pricing estimator: `capPerDay: 15000` for BOTH tiers.
 *   • the studio guest-camera picker: "30 photos + 10 clips each, per day".
 *   • the homepage price rows: "First 5 cameras · 10 photos + 3 videos each"
 *     and `cap: 9000`.
 * Meanwhile enforcement runs on capture POINTS resolved from the admin-editable
 * `papic_tier_config` (1 photo = 1 pt · one 10-second clip = 8 pts —
 * owner-locked 2026-07-29, up from 7).
 *
 * Fixing the strings once would only buy a few weeks. THIS test is the fix: it
 * fails CI the moment a Papic display surface re-grows a literal photo count, a
 * literal clip count, a literal free-camera count, or a literal cap peso
 * figure. Every such number must be DERIVED through lib/papic-tier-copy.ts.
 *
 * It also pins lib/papic-tier-copy.ts's fallback table to the migration seed,
 * so the "last-resort" values can never quietly diverge from the DB.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  PAPIC_TIER_CONFIG_FALLBACK,
  papicCapPhrase,
  papicCapacityPhrase,
  papicFreeCameraCount,
  papicFreeGrantPoints,
  type PapicTierCode,
} from './papic-tier-copy';
import { PAPIC_FREE_CAMERA_COUNT, PAPIC_POINTS_PER_CLIP } from './papic-cameras';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');

/**
 * Every surface that RENDERS a Papic capacity / free-camera / cap claim.
 * Add a file here the moment it starts showing one — that is the whole point.
 */
const PAPIC_COPY_FILES = [
  'app/(shell)/pricing/page.tsx',
  'app/(shell)/pricing/_papic-estimator.tsx',
  'app/_components/home/pricing-data.ts',
  'app/dashboard/[eventId]/studio/papic/guest-camera-tier-picker.tsx',
  // The onboarding services step (2026-07-29) — the FIRST place most couples
  // ever read a Papic number, and the one with the least room to be wrong.
  'app/onboarding/_shared/services-step.tsx',
  // The extra-cameras picker (added 2026-07-31). It has rendered a capacity
  // claim since it shipped and was never listed — so nothing here was watching
  // when it printed "70 points a day — 70 photos, or 23 clips" off a hardcoded
  // `/ 3` while enforcement metered a clip at 8. Listing it is half the fix;
  // COMPUTED_POINTS_DIVISOR below is the other half.
  'app/dashboard/[eventId]/studio/papic/extra-cameras-picker.tsx',
  // The public Papic page and its credit dial (2026-08-29). The page replaced
  // sixteen printed price rows with a +/- dial, so it now renders a capacity
  // claim on every step of that dial — exactly the surface this list exists
  // for. The dial is listed separately because the numbers render THERE, and a
  // guard that reads only the page would miss a literal moved one file over.
  'app/(shell)/papic/page.tsx',
  'app/(shell)/papic/_papic-dial.tsx',
];

const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

// "30 photos + 10 videos" · "10 photos and 3 clips" · "30 photos + 10×5s" —
// an exact split promise is unkeepable: photos and clips share ONE points purse.
const SPLIT_PROMISE = /\d+\s*photos?\s*(?:\+|and|·|,)\s*\d+\s*(?:×\s*\d+s|videos?|clips?)/i;

// A spelled free-camera count ("first 5 free", "first 5 cameras").
const SPELLED_FREE_COUNT = /first\s+\d+\s+(?:cameras?|free)/i;

// The known Papic cap figures, spelled either way. These must come from
// papic_tier_config.wedding_day_cap_php, never a literal.
const SPELLED_CAP = /(?:₱\s*(?:6,000|9,000|10,000|15,000)\b|(?<![\d.])(?:6000|9000|10000|15000)(?![\d.]))/;

// A spelled points budget ("20 points a day", "70 points").
const SPELLED_POINTS = /\b\d+\s*(?:capture\s*)?points?\b(?!\s*=)/i;

// A points value divided by a LITERAL — `pointsPerDay / 3`, `points / 8`.
//
// ⚠ THIS IS THE ONE THE OTHER FOUR STRUCTURALLY CANNOT CATCH, and it is why
// the extra-cameras picker shipped a ~2.9× overstatement past a green suite for
// months. Every regex above scans for literal DIGITS IN THE COPY. But the copy
// was a template literal — `${pointsPerDay} photos, or ${clips} clips` — so the
// source carried no digits at all, and the wrong number was manufactured one
// line earlier by `Math.floor(rung.pointsPerDay / 3)`.
//
// A guardrail that only reads the sentence cannot see a lie that is computed.
// The clip weight has ALREADY moved once (7 → 8, owner-locked 2026-07-29), so a
// hand-written divisor is not merely wrong today, it is guaranteed to rot.
// Divide by PAPIC_POINTS_PER_CLIP / PAPIC_POINTS_PER_PHOTO, or better, render
// papicCapacityPhrase() / papicBucketPhrase() and do no arithmetic at all.
const COMPUTED_POINTS_DIVISOR = /\bpoints?[A-Za-z]*\s*\/\s*\d/i;

for (const rel of PAPIC_COPY_FILES) {
  test(`${rel} never spells a photo/clip split promise`, () => {
    const m = read(rel).match(SPLIT_PROMISE);
    assert.equal(
      m,
      null,
      `${rel} carries "${m?.[0]}". Photos and clips share ONE daily points ` +
        `purse (1 photo = 1 pt · 1 clip = ${PAPIC_POINTS_PER_CLIP} pts), so an exact ` +
        `"N photos + M clips" promise is false by construction. Render ` +
        `papicCapacityPhrase() / papicBucketPhrase() from lib/papic-tier-copy.ts.`,
    );
  });

  test(`${rel} never divides a points value by a literal`, () => {
    const m = read(rel).match(COMPUTED_POINTS_DIVISOR);
    assert.equal(
      m,
      null,
      `${rel} carries "${m?.[0]}". A hand-written divisor on a points value ` +
        `manufactures a capacity claim the copy regexes cannot see, and it rots ` +
        `the next time the currency moves (the clip weight is already on its ` +
        `second value — now ${PAPIC_POINTS_PER_CLIP}). Divide by ` +
        `PAPIC_POINTS_PER_CLIP / PAPIC_POINTS_PER_PHOTO, or render ` +
        `papicCapacityPhrase() / papicBucketPhrase() and do no arithmetic.`,
    );
  });

  test(`${rel} never spells the free-camera count`, () => {
    const m = read(rel).match(SPELLED_FREE_COUNT);
    assert.equal(
      m,
      null,
      `${rel} carries "${m?.[0]}". Read it with papicFreeCameraCount() ` +
        `(papic_tier_config.free.seats_per_event · currently ${PAPIC_FREE_CAMERA_COUNT}).`,
    );
  });

  test(`${rel} never spells a Papic cap peso figure`, () => {
    const m = read(rel).match(SPELLED_CAP);
    assert.equal(
      m,
      null,
      `${rel} carries the literal "${m?.[0]}". Papic caps are per-tier, ` +
        `WEDDINGS-ONLY, and admin-editable — read them from ` +
        `papic_tier_config.wedding_day_cap_php (papicCapPhrase).`,
    );
  });

  test(`${rel} never spells a capture-points budget`, () => {
    const m = read(rel).match(SPELLED_POINTS);
    assert.equal(
      m,
      null,
      `${rel} carries "${m?.[0]}". Point budgets live in ` +
        `papic_tier_config.points_per_day — render them via papicCapacityPhrase().`,
    );
  });
}

test('papicCapacityPhrase is derived — it tracks the budget, whatever it is', () => {
  // The owner has NOT decided whether existing ₱30 buyers get grandfathered at
  // 60 points. The copy must read correctly either way — so assert on the
  // DERIVATION, not on a specific number.
  assert.match(papicCapacityPhrase(20), /about 20 photos a day/);
  assert.match(papicCapacityPhrase(60), /about 60 photos a day/);
  assert.match(papicCapacityPhrase(70), /about 70 photos a day/);
  // and it always discloses that clips cost more.
  for (const pts of [20, 60, 70]) {
    assert.match(
      papicCapacityPhrase(pts),
      new RegExp(`clip counts as ${PAPIC_POINTS_PER_CLIP}`),
    );
  }
  assert.match(papicCapacityPhrase(null), /unlimited/i);
  // Never an exact split promise — the very thing the guard above forbids.
  assert.equal(SPLIT_PROMISE.test(papicCapacityPhrase(20)), false);
});

test('free-camera count comes from config, not a literal', () => {
  assert.equal(papicFreeCameraCount(PAPIC_TIER_CONFIG_FALLBACK), PAPIC_FREE_CAMERA_COUNT);
  const retuned = {
    ...PAPIC_TIER_CONFIG_FALLBACK,
    free: { ...PAPIC_TIER_CONFIG_FALLBACK.free, seatsPerEvent: 7 },
  };
  assert.equal(papicFreeCameraCount(retuned), 7);
});

test('free-pool points come from config, not a literal', () => {
  // Papic Free = the shared event pool capped at 50 pts (owner 2026-07-22). The
  // literal lives in ONE place (the fallback const); config overrides it.
  assert.equal(papicFreeGrantPoints(PAPIC_TIER_CONFIG_FALLBACK), 50);
  const retuned = { ...PAPIC_TIER_CONFIG_FALLBACK, freeGrantPoints: 90 };
  assert.equal(papicFreeGrantPoints(retuned as never), 90);
});

/**
 * THE HOMEPAGE PRICING PAYLOAD CARRIES NO PAPIC CLAIM AT ALL (2026-07-30).
 *
 * `pricing-data.ts` used to build a full price ladder — including two Papic rows
 * — that NOTHING has rendered since the 2026-07-04 overlay redesign made the
 * Prices popup a summary plus a link out to /pricing. Unrendered and unwatched,
 * those rows sailed straight through the two-type lock (owner 2026-07-29) still
 * advertising "First 3 cameras · unlimited shots per day — Free" and "Papic One ·
 * unlimited shots per day — ₱50/guest·day", and `/api/home-pricing` published
 * them. The rows are deleted; this pins them deleted.
 *
 * A ladder here again is not forbidden — a ladder derived from `papic_tier_config`
 * is. Build it from the RUNG tables (`papic_pass_tiers` / `papic_one_tiers` +
 * `papic_event_pool_config`) priced off the live catalog, the way
 * `app/(shell)/pricing/page.tsx` does, and phrase it through `papicPoolRungPhrase` /
 * `papicOneRungPhrase` — then move this assertion to whatever the new surface is.
 */
test('the homepage pricing payload makes no Papic claim', () => {
  const src = read('app/_components/home/pricing-data.ts');
  // Only the doc comment may NAME Papic (it explains this very deletion), so the
  // match runs over code with line + block comments stripped.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const pattern of [
    /papic/i,
    /guest·day/i,
    /unlimited shots/i,
    /papic_tier_config/i,
  ]) {
    const m = code.match(pattern);
    assert.equal(
      m,
      null,
      `app/_components/home/pricing-data.ts carries "${m?.[0]}". This payload is ` +
        `consumed for the Setnayan AI price + the vendor tiers ONLY — a Papic ` +
        `figure here renders nowhere, so nothing catches it when it goes stale. ` +
        `/pricing owns the Papic ladder; derive from papic_pass_tiers / ` +
        `papic_one_tiers if the homepage genuinely needs one.`,
    );
  }
});

test('cap copy says weddings, and follows the config', () => {
  assert.match(papicCapPhrase(6000), /₱6,000 max for a wedding/);
  assert.match(papicCapPhrase(12345), /₱12,345 max for a wedding/);
  assert.equal(papicCapPhrase(null), 'no cap');
});

test('the fallback tier table mirrors the migration seed exactly', () => {
  const sql = readFileSync(
    join(
      WEB,
      '..',
      '..',
      'supabase',
      'migrations',
      '20270821110000_papic_v3_tier_vocab_config_points.sql',
    ),
    'utf8',
  );
  // ('free', 'Free', 20, NULL, 3, NULL, 0),
  const ROW =
    /\(\s*'(free|mini|roll|ltd|unlimited)'\s*,\s*'([^']*)'\s*,\s*(\d+|NULL)\s*,\s*(?:'([^']*)'|NULL)\s*,\s*(\d+|NULL)\s*,\s*(\d+|NULL)\s*,\s*(\d+)\s*\)/g;
  const seeded: Record<string, unknown> = {};
  for (const m of sql.matchAll(ROW)) {
    const [, code, title, points, rateSku, seats, cap, sort] = m;
    if (!code) continue;
    seeded[code] = {
      displayTitle: title,
      pointsPerDay: points === 'NULL' ? null : Number(points),
      rateServiceCode: rateSku ?? null,
      seatsPerEvent: seats === 'NULL' ? null : Number(seats),
      weddingCapPhp: cap === 'NULL' ? null : Number(cap),
      sortOrder: Number(sort),
    };
  }
  assert.equal(Object.keys(seeded).length, 5, 'expected 5 seeded tier rows');
  // ⚠ THE `mini` TITLE IS A HAND-APPLIED OVERRIDE, NOT A MIRROR OF ANYTHING.
  //
  // This block used to set 'Papic One' under a comment saying *"the fallback
  // mirrors the LIVE display title"*. It did not. Read out of production
  // 2026-08-26, the live row is **'Dedicated camera (legacy)', is_active =
  // false**; the seed says 'Papic Mini'; the fallback said 'Papic One'. Three
  // different values for one row, and a comment asserting they agreed.
  //
  // 🔑 A CLAIM TO MIRROR SOMETHING IS NOT A MIRROR. Nothing here has ever read
  // the database; this line is product copy typed by hand, and calling it a
  // mirror is what let a retired name survive two owner rulings.
  //
  // Owner 2026-08-11, restated 2026-08-26: *"we do not have papic one or papic
  // pool. no 2 ways of papic service. just 1."* So the fallback may not
  // resurrect that name. It is deliberately NOT the live DB string either —
  // this title can reach a public card, and "legacy" is an operator's word.
  //
  // ⛔ EVERY OTHER FIELD STILL PINS BYTE-FOR-BYTE TO THE SEED. Only the display
  // title is product copy the owner may change; points, rate SKU, seats, cap
  // and sort order are economics and must never drift from the migration.
  if (seeded.mini) {
    (seeded.mini as { displayTitle: string }).displayTitle = 'A camera with its own credits';
  }
  for (const code of Object.keys(seeded) as PapicTierCode[]) {
    const fb = PAPIC_TIER_CONFIG_FALLBACK[code];
    assert.deepEqual(
      {
        displayTitle: fb.displayTitle,
        pointsPerDay: fb.pointsPerDay,
        rateServiceCode: fb.rateServiceCode,
        seatsPerEvent: fb.seatsPerEvent,
        weddingCapPhp: fb.weddingCapPhp,
        sortOrder: fb.sortOrder,
      },
      seeded[code],
      `PAPIC_TIER_CONFIG_FALLBACK.${code} drifted from the migration seed. ` +
        `The fallback is the ONLY place these literals may live — keep it exact.`,
    );
  }
});
