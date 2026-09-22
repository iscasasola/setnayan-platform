/**
 * NO CAMERA HOLDS CREDITS OF ITS OWN — and the page stops saying two things.
 *
 * ── THE RULING, AND THE ONE IT OVERTURNED ─────────────────────────────────
 * Two of the owner's own rulings were in direct conflict and the shipped code
 * followed the older one.
 *
 *   2026-08-11 — *"the host can dedicated a specific number of shots for a
 *                specific QR code. and the rest can be distributed to the
 *                rest"* — quoted in `PapicCamerasCard`'s own docblock, which is
 *                why that card existed and shipped.
 *   2026-09-16 — *"no dedicated shots individually."*
 *
 * Asked directly which stands, the owner chose 2026-09-16. So the card is a
 * RETIREMENT, not a feature.
 *
 * 🔑 THE PAGE WAS SAYING BOTH THINGS AT ONCE, four blocks apart. The Crew-
 * cameras sheet reads *"Every shot draws from your shared credits"* while the
 * card below it handed credits to a single QR. A guard that only checked the
 * card was gone would let the contradiction come back the moment somebody
 * re-added it "for symmetry", so this asserts BOTH halves: the control is not
 * mounted, AND the promise it contradicted is still on the page.
 *
 * ── ⚠ WHAT THIS DELIBERATELY DOES *NOT* ASSERT ───────────────────────────
 * That `papic_dedicate_shots` is gone from the database. It is not, on purpose:
 * five db tests exercise it, and it shares machinery with the per-seat GRANT
 * layer that STAYS. Measured in prod 2026-09-22 — `papic_seat_allocations` 0
 * rows, but `papic_event_point_grants` 4 rows carrying a `seat_id`, every one
 * `source = 'camera_grant'` (the free Papic One camera), which is not the
 * couple dedicating anything. Dropping the RPC is its own change.
 *
 * ⚠ AND `paparazzi_seats` STAYS — 24 live rows. A seat is the camera CLAIM, not
 * an allowance; `app/api/upload/route.ts` resolves a seatGate per seat. Only
 * the DEDICATION went, and a guard that conflated the two would take the
 * cameras out with it.
 *
 * Run: cd apps/web && npx tsx --test "app/dashboard/[eventId]/studio/papic/_lib/no-camera-holds-its-own-credits.test.ts"
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const PAPIC = dirname(dirname(fileURLToPath(import.meta.url)));
const APP = join(PAPIC, '..', '..', '..', '..');
const PAGE = readFileSync(join(PAPIC, 'page.tsx'), 'utf8');

test('the dedicated-credits control is not mounted', () => {
  const page = stripComments(PAGE);
  assert.ok(
    !/<PapicCamerasCard\b/.test(page),
    'PapicCamerasCard is mounted again — it hands credits to one QR, which the owner retired on 2026-09-16',
  );
  assert.ok(
    !/papic-cameras-card/.test(page),
    'the retired card is imported again',
  );
});

test('the promise it contradicted is still on the page', () => {
  /*
    🔑 HALF A GUARD IS WORSE THAN NONE HERE. Deleting the card while also
    deleting the sentence it contradicted would leave nothing saying which model
    is in force, and the next session would have no way to tell that a hand-out
    control was ever wrong.
  */
  assert.match(
    PAGE,
    /Every shot draws from your shared credits/,
    'the Crew-cameras sheet must still say every shot comes from the shared pot — that is the model the retirement chose',
  );
});

test('NO SURFACE UNDER app/ REACHES papic_dedicate_shots', () => {
  /*
    The retirement as a MECHANISM rather than a deleted file. The RPC is still
    in the database and still has its own db tests; what must never come back is
    a couple-facing door to it.

    ⚠ EVERY MATCH IS COUNTED AND THE COUNT IS PRINTED. A guard anchored on the
    first hit faces the wrong cell, and a zero from a harness that searched the
    wrong tree reads exactly like a pass.
  */
  const SKIP = new Set(['node_modules', '.next', '.git']);
  const files: string[] = [];
  (function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      if (SKIP.has(name)) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(p);
    }
  })(APP);

  assert.ok(files.length > 500, `searched only ${files.length} files — the walk is wrong`);

  const hits: string[] = [];
  for (const f of files) {
    const src = stripComments(readFileSync(f, 'utf8'));
    const n = (src.match(/papic_dedicate_shots/g) ?? []).length;
    if (n > 0) hits.push(`${relative(APP, f)} (${n})`);
  }
  console.log(`[no-camera-holds-its-own-credits] ${files.length} files under app/ searched`);
  assert.deepEqual(
    hits,
    [],
    'a surface under app/ calls papic_dedicate_shots — no camera holds credits of its own:\n  ' +
      hits.join('\n  '),
  );
});
