/**
 * A CAMERA'S ADVERTISED CAPACITY MUST COME FROM THE TABLE THE GRANT READS.
 *
 * The extra-cameras picker advertised **"No limit · archived to your Drive"** on
 * a ₱50 camera. It is not unlimited. On approval,
 * `papic_grant_camera_points()` — branch (B), the legacy multi-camera
 * `PAPIC_CAMERAS` order the picker mints — does:
 *
 *     SELECT t.points FROM papic_one_tiers t
 *      WHERE t.service_code = 'PAPIC_CAMERA_MINI_DAY' AND t.is_active;
 *     v_per := COALESCE(v_per, 50);
 *     INSERT ... points = v_per ... WHERE ps.tier = 'mini';
 *
 * — a **50-point bucket** on prod, after which the fail-closed reserve stops the
 * shutter. So the couple paid ₱50 for "unlimited" and got 50 shots, on the SAME
 * screen where the Papic One card correctly said "50 credits, that camera's own".
 *
 * The cause was reading `papic_tier_config.points_per_day`: the RETIRED
 * per-camera-per-DAY meter, whose `mini` row is NULL on prod — and NULL means
 * "unlimited" to every copy helper. `lib/papic-tier-config-read.ts` documents
 * this exact trap in its own header; the picker was the surface still falling
 * into it.
 *
 * The invariant, stated once: a DISPLAY surface may never decide capacity for
 * itself. It reads what the ENFORCEMENT path reads.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { papicBucketPhrase } from './papic-tier-copy';
import { PAPIC_POINTS_PER_CLIP, PAPIC_CAMERA_MINI_SKU } from './papic-cameras';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const PICKER = 'app/dashboard/[eventId]/studio/papic/extra-cameras-picker.tsx';
const PAPIC_PAGE = 'app/dashboard/[eventId]/studio/papic/page.tsx';

test('the picker takes a lifetime BUCKET, not a per-day meter', () => {
  const src = read(PICKER);
  assert.match(
    src,
    /points:\s*number\s*\|\s*null/,
    `${PICKER} must expose \`points\` (a lifetime bucket).`,
  );
  assert.doesNotMatch(
    src,
    /\bpointsPerDay\b/,
    `${PICKER} must not carry \`pointsPerDay\` — that is the RETIRED per-camera-` +
      `per-DAY meter whose 'mini' row is NULL on prod, which every copy helper ` +
      `reads as "unlimited". It is what made a 50-shot camera advertise "No limit".`,
  );
});

test('the picker never claims a camera is unlimited', () => {
  assert.doesNotMatch(
    read(PICKER),
    /No limit/i,
    `${PICKER} must not print "No limit". Every rung it can still show is a ` +
      `fixed bucket granted by papic_grant_camera_points(); an unbounded claim ` +
      `there is unbacked by the enforcement path.`,
  );
});

test('the page resolves the bucket from papic_one_tiers, keyed by the rung SKU', () => {
  const src = read(PAPIC_PAGE);
  assert.match(
    src,
    /fetchPapicOneTiers\(/,
    `${PAPIC_PAGE} must read papic_one_tiers — the same table the grant reads.`,
  );
  assert.match(
    src,
    /papicOneTiers\.find\(\(t\) => t\.serviceCode === papicRungSku\(rung\)\)/,
    'the bucket must be keyed by the rung SKU so a rung with no tier row goes ' +
      'silent rather than inheriting another rung’s number',
  );
  // The mini rung is the one that actually ships today; pin the SKU it keys on
  // so a rename cannot silently detach the lookup from the grant function.
  assert.equal(PAPIC_CAMERA_MINI_SKU, 'PAPIC_CAMERA_MINI_DAY');
});

test('papicBucketPhrase discloses the one-purse trade-off, derived', () => {
  const phrase = papicBucketPhrase(50);
  assert.match(phrase, /about 50 photographs/);
  assert.match(
    phrase,
    new RegExp(`Snippet counts as ${PAPIC_POINTS_PER_CLIP}`),
    'the clip weight must interpolate the constant so a reprice moves the copy',
  );
  // Never an exact split promise — photos and clips share ONE bucket.
  assert.doesNotMatch(phrase, /\d+\s*photos?\s*(?:\+|and|,)\s*\d+\s*clips?/i);
});
