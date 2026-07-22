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
 * `papic_tier_config` (1 photo = 1 pt · one 5-second clip = 3 pts).
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
  papicCapLadderPhrase,
  papicCapPhrase,
  papicCapacityPhrase,
  papicCapacityShort,
  papicFreeCameraCount,
  papicFreeGrantPoints,
  publicPapicLadder,
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
  'app/pricing/page.tsx',
  'app/pricing/_papic-estimator.tsx',
  'app/_components/home/pricing-data.ts',
  'app/dashboard/[eventId]/studio/papic/guest-camera-tier-picker.tsx',
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

for (const rel of PAPIC_COPY_FILES) {
  test(`${rel} never spells a photo/clip split promise`, () => {
    const m = read(rel).match(SPLIT_PROMISE);
    assert.equal(
      m,
      null,
      `${rel} carries "${m?.[0]}". Photos and clips share ONE daily points ` +
        `purse (1 photo = 1 pt · 1 clip = ${PAPIC_POINTS_PER_CLIP} pts), so an exact ` +
        `"N photos + M clips" promise is false by construction. Render ` +
        `papicCapacityPhrase() / papicCapacityShort() from lib/papic-tier-copy.ts.`,
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
        `papic_tier_config.wedding_day_cap_php (papicCapPhrase / papicCapLadderPhrase).`,
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
  assert.equal(SPLIT_PROMISE.test(papicCapacityShort(20)), false);
});

test('papicCapacityShort states the honest clip equivalent', () => {
  // 20 points = 20 photos OR 6 clips (3 pts each), not "20 photos + 6 clips".
  assert.match(papicCapacityShort(20), /~20 photos\/day/);
  assert.match(papicCapacityShort(20), /~6 five-second clips/);
  assert.match(papicCapacityShort(null), /unlimited/i);
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

test('the public ladder drops retired rungs — Papic One is the live camera', () => {
  const ladder = publicPapicLadder(PAPIC_TIER_CONFIG_FALLBACK);
  // free is not purchasable; roll is the LEGACY alias of mini; unlimited
  // ("Papic Max") was RETIRED by the 2026-07-22 naming lock (migration
  // 20270830568357 · isActive=false in the fallback). Papic One (mini) + Ltd
  // are the rungs that survive.
  assert.deepEqual(
    ladder.map((r) => r.tierCode),
    ['mini', 'ltd'],
  );
  // Deactivating a tier removes it from every surface at once.
  const off = {
    ...PAPIC_TIER_CONFIG_FALLBACK,
    ltd: { ...PAPIC_TIER_CONFIG_FALLBACK.ltd, isActive: false },
  };
  assert.deepEqual(
    publicPapicLadder(off).map((r) => r.tierCode),
    ['mini'],
  );
});

test('cap copy says weddings, and follows the config', () => {
  assert.match(papicCapPhrase(6000), /₱6,000 max for a wedding/);
  assert.match(papicCapPhrase(12345), /₱12,345 max for a wedding/);
  assert.equal(papicCapPhrase(null), 'no cap');
  // 'Papic Unli' (unlimited) is retired → dropped from the live ladder; 'Papic
  // Mini' is now 'Papic One' (2026-07-22 rename).
  assert.equal(
    papicCapLadderPhrase(PAPIC_TIER_CONFIG_FALLBACK),
    'Papic One ₱6,000 · Papic Ltd ₱10,000',
  );
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
  // The 2026-07-22 naming lock (migration 20270830568357) retitled the mini
  // rung 'Papic Mini' → 'Papic One' AFTER this seed. The fallback mirrors the
  // LIVE display title, so apply that one post-seed rename before comparing;
  // every other field still pins byte-for-byte to the seed.
  if (seeded.mini) {
    (seeded.mini as { displayTitle: string }).displayTitle = 'Papic One';
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
