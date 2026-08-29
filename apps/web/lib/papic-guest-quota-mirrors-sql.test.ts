/**
 * THE BROWSER WAS THE ONLY THING ENFORCING A LIMIT THAT DOES NOT EXIST.
 *
 * `papic_record_guest_capture` decides whether the per-guest ceiling binds with
 * TWO writes to `v_unlimited`. The TypeScript mirror learned only the first —
 * the pool disjunct arrived with the one-pool model and never crossed over — so
 * on every celebration (all of them arm the free 50-shot pot on render) the
 * camera counted a guest down from a hardcoded 150, hid its own shutter and
 * said "That's all 150 photos" while the database applied NO per-guest limit at
 * all and the route never pre-checked the number.
 *
 * ── WHY TEST 1 IS SHAPED THE WAY IT IS ──────────────────────────────────────
 * It DERIVES the number of disjuncts from the migration and compares it against
 * the number of entries `papicGuestCapLifts` actually returns. A guard that
 * hard-codes "there are two" would be a THIRD copy of the rule and would rot
 * exactly the way the second one did — it would still pass on the day somebody
 * adds a third condition in SQL and forgets the app.
 *
 * ⚠ AND IT COUNTS BOTH plpgsql WRITE FORMS. `v_unlimited :=` **and**
 * `SELECT … INTO v_unlimited`. Counting only `:=` reports 1, which is how the
 * first cut of this guard lied to itself: it "derived" a number that happened
 * to disagree with reality in the same direction as the bug.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { papicGuestCapLifts, papicGuestCapApplies } from './papic-guest-cap';

const REPO = join(process.cwd(), '..', '..');
const read = (...p: string[]) => readFileSync(join(...p), 'utf8');
const web = (...p: string[]) => read(process.cwd(), ...p);

/** A guard must read the CODE, not the docblock that quotes the defect. Every
 *  file touched by this fix repeats the old expression verbatim in a comment. */
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/** plpgsql line comments. */
const sqlCode = (s: string) => s.replace(/--.*$/gm, '');

const MIGRATION = join(
  REPO,
  'supabase',
  'migrations',
  '20270920602517_guest_capture_restore_ugc_gates.sql',
);

// ─────────────────────────────────────────────────────────────────────────
// 1 · THE MIRROR — derived from the SQL, never restated
// ─────────────────────────────────────────────────────────────────────────

test('every write to v_unlimited in the RPC has an entry in the TS rule', () => {
  const sql = sqlCode(readFileSync(MIGRATION, 'utf8'));
  assert.match(
    sql,
    /CREATE OR REPLACE FUNCTION public\.papic_record_guest_capture/,
    'the migration this guard derives from no longer defines that function — ' +
      'point this guard at whichever migration now does, do not delete it',
  );

  // BOTH plpgsql write forms. `INTO v_unlimited` is an assignment too.
  const assigned = sql.match(/\bv_unlimited\s*:=/g) ?? [];
  const selectedInto = sql.match(/\bINTO\s+v_unlimited\b/gi) ?? [];
  const sqlDisjuncts = assigned.length + selectedInto.length;

  assert.ok(
    sqlDisjuncts > 0,
    'found ZERO writes to v_unlimited — the scan broke, it did not pass',
  );

  const tsDisjuncts = papicGuestCapLifts({
    hasUnlock: false,
    poolApplies: false,
    poolUnknown: false,
  }).length;

  assert.equal(
    tsDisjuncts,
    sqlDisjuncts,
    `The RPC writes v_unlimited ${sqlDisjuncts} time(s); papicGuestCapLifts ` +
      `returns ${tsDisjuncts} condition(s). A condition was added or removed in ` +
      'SQL and the TypeScript mirror did not learn it — which is the exact ' +
      'drift that let the browser enforce a 150 nobody chose.',
  );
});

test('the pool disjunct is really wired — the half that was missing', () => {
  // Each input alone must lift the cap, or the OR has lost a term.
  assert.equal(papicGuestCapApplies({ hasUnlock: true, poolApplies: false, poolUnknown: false }), false);
  assert.equal(papicGuestCapApplies({ hasUnlock: false, poolApplies: true, poolUnknown: false }), false);
  // Nothing true → the ceiling binds. This is the ONLY shape that still caps,
  // and a celebration in it must behave exactly as it did before.
  assert.equal(papicGuestCapApplies({ hasUnlock: false, poolApplies: false, poolUnknown: false }), true);
});

test('an unreadable pool fails OPEN — an outage is not a decision', () => {
  // Failing closed here reproduces the defect: a browser locking a guest out of
  // a celebration that still has shots. The RPC is the authoritative gate and
  // its refusal carries its own copy, so the cost of failing open is one
  // refused shot at the very end.
  assert.equal(
    papicGuestCapApplies({ hasUnlock: false, poolApplies: false, poolUnknown: true }),
    false,
  );
});

test('capApplies is the inverse of the mirrored rule, computed once', () => {
  for (const hasUnlock of [false, true])
    for (const poolApplies of [false, true])
      for (const poolUnknown of [false, true]) {
        const i = { hasUnlock, poolApplies, poolUnknown };
        assert.equal(
          papicGuestCapApplies(i),
          !papicGuestCapLifts(i).some(Boolean),
          `capApplies drifted from the lift list at ${JSON.stringify(i)}`,
        );
      }
});

test('fetchGuestQuota asks BOTH sources and publishes capApplies', () => {
  const src = code(web('lib', 'papic-guest.ts'));
  assert.match(src, /papicGuestCapLifts\(/, 'the quota read no longer uses the shared rule');
  assert.match(src, /eventHasPapicUnlock\(/, 'the Unlock disjunct is gone');
  assert.match(src, /readEventPoolStatus\(/, 'the pool disjunct is gone from the quota read');
  assert.match(src, /capApplies/, 'GuestQuota stopped publishing capApplies');
  assert.match(src, /poolRemaining/, 'GuestQuota stopped publishing poolRemaining');
  assert.match(src, /poolLow/, 'GuestQuota stopped publishing poolLow');
});

// ─────────────────────────────────────────────────────────────────────────
// 2 · THE CAMERA — the screen may only enforce what the database enforces
// ─────────────────────────────────────────────────────────────────────────

const CAMERA = ['app', 'papic', 'guest', '_components', 'papic-guest-capture.tsx'];

test('`exhausted` is gated on capApplies and is NOT the old expression', () => {
  const src = code(web(...CAMERA));
  assert.doesNotMatch(
    src,
    /!guestUnlimited\s*&&\s*remaining\s*<=\s*0/,
    'the old countdown-off-a-number-nobody-chose is back',
  );
  assert.doesNotMatch(src, /\bguestUnlimited\b/, 'the retired prop is back in the code');
  assert.match(
    src,
    /capApplies\s*&&\s*remaining\s*<=\s*0/,
    'the personal countdown is no longer gated on whether a cap applies',
  );
});

test('the personal countdown pill is NOT unconditional', () => {
  const src = code(web(...CAMERA));
  // It used to render on every celebration, printing a ceiling the database
  // does not apply. It must now sit behind capApplies.
  assert.doesNotMatch(
    src,
    /\{guestUnlimited \? 'Unlimited' : `\$\{remaining\} left`\}/,
    'the unconditional pill is back',
  );
  assert.match(
    src,
    /capApplies \?[\s\S]{0,600}?\$\{remaining\} left/,
    'the "N left" pill is no longer behind capApplies',
  );
});

test('BOTH 409 handlers separate the two refusals — a fix to one is not a fix', () => {
  const src = code(web(...CAMERA));
  // Photo and clip are two copies of one handler.
  const capBranches = src.match(/json\.status === 'quota_exhausted'\)\s*\{/g) ?? [];
  const poolBranches = src.match(/json\.status === 'camera_points_exhausted'\)\s*\{/g) ?? [];
  assert.equal(capBranches.length, 2, 'a per-guest refusal branch went missing (photo + clip)');
  assert.equal(poolBranches.length, 2, 'a pool-empty refusal branch went missing (photo + clip)');
  assert.equal(
    (src.match(/setCapReached\(true\)/g) ?? []).length,
    2,
    'one of the two handlers stopped latching the per-guest ceiling',
  );
  assert.equal(
    (src.match(/setPoolEmpty\(true\)/g) ?? []).length,
    2,
    'one of the two handlers stopped latching the empty pot',
  );
  // The collapse that caused the bug: a bare 409 falling into the per-guest arm.
  assert.doesNotMatch(
    src,
    /res\.status === 409 \|\| json\.status === 'quota_exhausted'/,
    'a bare 409 is being read as the per-guest ceiling again — that is the ' +
      'collapse that told a guest three photos in "That\'s all 150 photos"',
  );
});

test('the empty pot has its own sentence, and the per-guest one survives', () => {
  const src = web(...CAMERA); // rendered copy, comments included is fine here
  assert.match(
    src,
    /has run out of shots/,
    'the celebration-is-out sentence is gone — the pool case would inherit the ' +
      'per-guest congratulation again',
  );
  assert.match(
    src,
    /That&rsquo;s all \{total\} photos, \{guestName\}!/,
    'the per-guest congratulation was lost; a celebration where the ceiling ' +
      'genuinely binds must behave byte-identically',
  );
  assert.match(src, /poolEmpty \?/, 'nothing branches on the pool refusal any more');
});

// ─────────────────────────────────────────────────────────────────────────
// 3 · THE SHAPE — one declaration, because two copies is the same disease
// ─────────────────────────────────────────────────────────────────────────

test('GuestPapicCamera is declared once and imported by the loader', () => {
  const types = code(web('app', '[slug]', '_lib', 'types.ts'));
  const loaders = code(web('app', '[slug]', '_lib', 'loaders.ts'));
  assert.match(types, /export type GuestPapicCamera = \{/);
  assert.match(loaders, /GuestPapicCamera/, 'the loader no longer references the shared type');
  assert.doesNotMatch(
    loaders,
    /let papicGuest:\s*\|\s*\{/,
    'the loader re-declared the camera shape inline again — two copies of one ' +
      'shape is the disease this fix exists to treat',
  );
  for (const field of ['capApplies', 'poolRemaining', 'poolLow']) {
    assert.match(types, new RegExp(`\\b${field}\\b`), `GuestPapicCamera lost ${field}`);
  }
});

test('both mounts hand the camera the real answer', () => {
  for (const [label, src] of [
    ['the standalone guest camera', code(web('app', 'papic', 'guest', 'page.tsx'))],
    ['the Event Hub inline camera', code(web('app', '[slug]', '_components', 'site-body.tsx'))],
  ] as const) {
    assert.match(src, /capApplies=\{/, `${label} stopped passing capApplies`);
    assert.match(src, /poolLow=\{/, `${label} stopped passing poolLow`);
  }
});
