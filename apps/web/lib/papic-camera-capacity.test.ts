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
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { papicBucketPhrase } from './papic-tier-copy';
import { PAPIC_POINTS_PER_SNIPPET, PAPIC_CAMERA_MINI_SKU } from './papic-cameras';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const PICKER = 'app/dashboard/[eventId]/studio/papic/extra-cameras-picker.tsx';
// The Papic page is gone (2026-10-26) — its card's settings are where a camera price would reappear.
const PAPIC_PAGE = 'app/dashboard/[eventId]/studio/papic/_components/papic-camera-settings.tsx';

/*
  ⛔ 2026-10-23 — THE PICKER THESE RULES HELD IS DELETED, and with it the only couple surface that ever
  advertised a per-camera capacity. Owner, over the crew-camera tier ladder on his own page: "why do i
  have these?" Papic sells shared credits only (`lib/papic-sells-only-credits.ts`), so no camera has a
  capacity of its own to advertise — the three tests that pinned the picker's bucket became one: the
  picker stays gone, and the page asks nothing about a camera's own bucket.
*/
test('no couple surface advertises a camera’s own capacity — the picker is gone', () => {
  assert.equal(existsSync(join(WEB, PICKER)), false, `${PICKER} is back — Papic does not sell cameras`);
  const src = read(PAPIC_PAGE);
  assert.doesNotMatch(src, /fetchPapicOneTiers\(|papicRungSku\(|ExtraCamerasPicker/, 'the Papic page prices a camera again');
});

test('papicBucketPhrase discloses the one-purse trade-off, derived', () => {
  const phrase = papicBucketPhrase(50);
  assert.match(phrase, /about 50 photographs/);
  assert.match(
    phrase,
    new RegExp(`snippet counts as ${PAPIC_POINTS_PER_SNIPPET}`, 'i'),
    'the clip weight must interpolate the constant so a reprice moves the copy',
  );
  // Never an exact split promise — photos and clips share ONE bucket.
  assert.doesNotMatch(phrase, /\d+\s*photos?\s*(?:\+|and|,)\s*\d+\s*clips?/i);
});
