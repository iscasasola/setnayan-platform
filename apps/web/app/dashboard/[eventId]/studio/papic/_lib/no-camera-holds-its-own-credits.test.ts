/**
 * THE COUPLE'S HAND-OUT IS GONE — AND THE FREE CAMERA IS NOT.
 *
 * ⚖ Owner 2026-09-16: *"no dedicated shots individually."* Re-confirmed
 * 2026-09-22 against a question that names the CONTROL rather than the
 * category — *"that control is still live today — should it come off, or did
 * 'should stay' mean it stays too?"* → off.
 *
 * 🔑 THE FIRST ASKING COULD NOT SEPARATE TWO THINGS. It said "dedicated camera
 * credits", which names the couple's hand-out AND the free Papic One camera
 * grant at once; the answer ("should stay") was about the free camera, and was
 * nearly read as cancelling the whole retirement. **They share no machinery** —
 * `papic_grant_camera_points` references neither `papic_dedicate_shots` nor
 * `papic_seat_allocations` (checked against `pg_get_functiondef` in prod, both
 * false). This guard therefore asserts BOTH halves, because a guard that only
 * proved the removal would be just as happy if the free camera went with it.
 *
 * ⚠ AND IT ASSERTS THE PROMISE THE REMOVAL EXISTS TO MAKE TRUE. The page used
 * to say two things at once: the Crew-cameras sheet reads *"Every shot draws
 * from your shared credits"* while the card four blocks below handed credits to
 * a single QR. Deleting the card while also deleting that sentence would leave
 * nothing saying which model is in force.
 *
 * Run: cd apps/web && npx tsx --test "app/**\/no-camera-holds-its-own-credits.test.ts"
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const PAPIC = dirname(dirname(fileURLToPath(import.meta.url)));
const APP = join(PAPIC, '..', '..', '..', '..');
const ROOT = join(APP, '..', '..', '..');
const WEB = join(APP, '..');
const PAGE = readFileSync(join(PAPIC, 'page.tsx'), 'utf8');

/**
 * Every source file under `app/`, `lib/` and `tests/` — INCLUDING tests.
 *
 * 🪤 THE FIRST CUT WALKED `app/` ONLY, AND EXCLUDED TESTS, AND BOTH EXCLUSIONS
 * HID THE SAME FILE. `tests/db/seat-capture-is-atomic.db.test.ts` seeded a row
 * into `papic_seat_allocations` and never named `papic_dedicate_shots` — so a
 * function-shaped sweep could not see it either. Two blind spots pointing the
 * same way, and it took a peer reading the failure list to find it.
 *
 * ⚠ A FIXTURE IS A CALLER. A test that INSERTs into a dropped table fails at
 * run time exactly as production code would; excluding tests from a
 * "nothing references this" guard is excluding the files most likely to.
 */
function scannedSources(): string[] {
  const SKIP = new Set(['node_modules', '.next', '.git']);
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (SKIP.has(name)) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name)) out.push(p);
    }
  };
  walk(APP);
  walk(join(WEB, 'lib'));
  walk(join(WEB, 'tests'));
  return out;
}

test('the hand-out control is not mounted', () => {
  const page = stripComments(PAGE);
  assert.ok(
    !/<PapicCamerasCard\b/.test(page),
    'PapicCamerasCard is mounted again — it hands credits to one QR, which the owner retired twice',
  );
  assert.ok(!/papic-cameras-card/.test(page), 'the retired card is imported again');
});

test('the promise it contradicted is still on the page', () => {
  assert.match(
    PAGE,
    /Every shot draws from your shared credits/,
    'the Crew-cameras sheet must still say every shot comes from the shared pot — that is the model the retirement chose',
  );
});

test('NOTHING UNDER app/, lib/ OR tests/ NAMES THE DROPPED RPC OR TABLE', () => {
  /*
    ⚠ EVERY MATCH IS COUNTED AND THE COUNT IS PRINTED. A guard anchored on the
    first hit faces the wrong cell, and a zero from a harness that searched the
    wrong tree reads exactly like a pass.

    These are DROPPED in the database now, so a surviving reference is not a
    style question — it is a runtime failure waiting for a caller.
  */
  const files = scannedSources();
  assert.ok(files.length > 800, `searched only ${files.length} files — the walk is wrong`);

  /*
    ⚠ FOUR FILES NAME THESE OBJECTS ON PURPOSE, AND EACH CARRIES ITS REASON.
    They assert the objects are GONE — `to_regclass(...) IS NULL`,
    `proname = 'papic_dedicate_shots'`, or an `assert.rejects` around the exact
    call that used to work. A guard cannot tell "calls it" from "proves it
    cannot be called" by matching a name, so the distinction is written down
    rather than guessed.

    🔑 THIS LIST MAY ONLY SHRINK. A new entry needs the same kind of reason
    beside it, not a path — and if one of these stops asserting the absence, it
    belongs back under the guard.
  */
  const ALLOWED = new Map([
    [
      'lib/a-guest-release-uses-the-right-primitive.test.ts',
      'the pre-existing BAN test: it names the RPC to assert the guest surface never reaches for it',
    ],
    [
      'tests/db/papic-a-grant-cannot-be-released.db.test.ts',
      "the #5028 autopsy: asserts the function is gone and that the exact call now rejects",
    ],
    [
      'tests/db/papic-a-guest-can-give-her-credits-back.db.test.ts',
      'asserts structurally that only her own credits can be on a camera — the table and function are absent',
    ],
    [
      'tests/db/papic-one-product-hand-out.db.test.ts',
      'asserts the hand-out machinery is gone, and gone together',
    ],
  ]);

  const hits: string[] = [];
  for (const f of files) {
    // This guard names both objects as DATA.
    if (f.endsWith('no-camera-holds-its-own-credits.test.ts')) continue;
    if ([...ALLOWED.keys()].some((k) => f.endsWith(k))) continue;
    const src = stripComments(readFileSync(f, 'utf8'));
    for (const gone of ['papic_dedicate_shots', 'papic_seat_allocations']) {
      const n = (src.match(new RegExp(gone, 'g')) ?? []).length;
      if (n > 0) hits.push(`${relative(APP, f)} → ${gone} (${n})`);
    }
  }
  console.log(
    `[no-camera-holds-its-own-credits] ${files.length} files under app/, lib/ and tests/ searched`,
  );
  assert.deepEqual(
    hits,
    [],
    'something still names an object this migration dropped — a fixture counts:\n  ' + hits.join('\n  '),
  );
});

test('🚨 THE FREE CAMERA GRANT SURVIVED — it is what the owner said should STAY', () => {
  /*
    The half a careless retirement takes out with the other. `paparazzi_seats`
    is the camera CLAIM (24 live rows) and `papic_event_point_grants.seat_id` is
    the free Papic One camera's own balance (4 rows, 20 points). Neither is the
    couple handing anything out.

    Asserted against the MIGRATION, because that is where they would be lost.
  */
  const sql = readFileSync(
    join(ROOT, 'supabase/migrations/20271243295861_the_handout_comes_off.sql'),
    'utf8',
  );
  for (const kept of [
    'papic_event_point_grants',
    'paparazzi_seats',
    'papic_seat_grant_releases',
  ]) {
    assert.match(
      sql,
      new RegExp(`refusing to apply[\\s\\S]{0,200}${kept}|${kept}[\\s\\S]{0,200}refusing to apply`),
      `${kept} has no apply-time guard — a retirement that takes it out would apply silently`,
    );
  }

  // And nothing may DROP them.
  for (const kept of ['papic_event_point_grants', 'paparazzi_seats', 'papic_seat_grant_releases']) {
    assert.ok(
      !new RegExp(`DROP TABLE[^;]*${kept}`, 'i').test(sql),
      `the migration drops ${kept}, which the owner said should stay`,
    );
  }
});

test('THE GIVE-BACK TERM SURVIVED THE REWRITE', () => {
  /*
    🚨 THE DEFECT THIS FILE'S SIBLING ALREADY PAID FOR. This migration restates
    three money functions, and the last time one was restated here it silently
    dropped `+ COALESCE(v_released, 0)` — credits a guest hands back out of her
    own purchase — and the shared pot stopped rising. Different direction,
    different table, and it is NOT what is being retired.

    Sabotage: delete `+ COALESCE(v_released, 0)` from the pool total.
  */
  /*
    ⚠ READ THE BODY, NOT THE PROSE. This migration's docblock spells the old and
    new totals out as `v_total := base + granted − alloc + released`, and the
    first cut of this assertion matched THAT and failed on a comment. SQL `--`
    lines are blanked first, which is not a second comment stripper — the repo's
    one stripper is a JS/TS lexer and does not know `--`.
  */
  const raw = readFileSync(
    join(ROOT, 'supabase/migrations/20271243295861_the_handout_comes_off.sql'),
    'utf8',
  );
  const sql = raw
    .split('\n')
    .map((l) => (l.indexOf('--') === -1 ? l : l.slice(0, l.indexOf('--'))))
    .join('\n');
  const total = sql.slice(sql.indexOf('v_total :='), sql.indexOf(';', sql.indexOf('v_total :=')));
  for (const term of ['v_base', 'v_granted', 'v_released']) {
    assert.ok(total.includes(term), `the pool total no longer includes ${term}`);
  }
  assert.ok(
    !total.includes('v_alloc'),
    'the pool total still subtracts the hand-out this migration removes',
  );
  // The spend attribution on a give-back is load-bearing and is kept.
  assert.match(
    sql,
    /s\.grants - s\.released - s\.spent/,
    'papic_seat_releasable_grants lost its `- spent` term — she could give back credits she already shot',
  );
});
