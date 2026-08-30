/**
 * S4 · THE GUEST SEES THEIR REAL NUMBER, AND AN HONEST "NO".
 *
 * Guards the display half of the per-guest ceiling (S2, migration
 * 20271184624871): `fetchGuestQuota` must fold the couple's own ceiling into
 * `total`/`remaining`/`unlimited`/`capApplies` so the pill and the exhausted
 * copy show the REAL number that binds — not always the platform's flat 150 —
 * and the camera must show a "running low" state before zero, which it had
 * none of before this session.
 *
 * ── WHY papicGuestCapAppliesWithCeiling IS A SEPARATE, IMPORT-FREE FUNCTION ──
 * Same reasoning as papic-guest-cap.ts's own charter: it has to be able to
 * EXECUTE the rule under node:test, and `fetchGuestQuota` reaches a Supabase
 * client that cannot load there. So the SQL-mirrored boolean logic lives here,
 * pure, and `fetchGuestQuota`'s use of it is checked by source-presence below
 * — the same split S1's own guard already uses for the client component.
 *
 * ⚠ THIS BRANCH IS BUILT BEFORE S2 MERGES (session register: S4 "may run
 * beside" S3, and both were built against `main` the same way S3 was — see
 * WHATS_NEXT_Shots_Per_Guest_SESSIONS_2026-08-28.md). So this file must NOT
 * read S2's migration off disk; it isn't in this tree yet. Every assertion
 * here is either a pure-function truth table or a source-presence check on
 * files this branch actually owns.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  papicGuestCapApplies,
  papicGuestCapAppliesWithCeiling,
} from './papic-guest-cap';

const web = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ─────────────────────────────────────────────────────────────────────────
// 1 · THE RULE — a ceiling always overrides, in every combination
// ─────────────────────────────────────────────────────────────────────────

test('a set ceiling ALWAYS caps — even under Unlock, even under a pool', () => {
  for (const hasUnlock of [false, true])
    for (const poolApplies of [false, true])
      for (const poolUnknown of [false, true]) {
        assert.equal(
          papicGuestCapAppliesWithCeiling({
            hasUnlock,
            poolApplies,
            poolUnknown,
            guestCeiling: 14,
          }),
          true,
          `a ceiling of 14 stopped binding at ${JSON.stringify({ hasUnlock, poolApplies, poolUnknown })} — ` +
            'a bought Unlock pass is not permission to walk through a limit the couple set on one guest',
        );
      }
});

test('no ceiling (null) collapses back to the pre-S2 rule exactly', () => {
  for (const hasUnlock of [false, true])
    for (const poolApplies of [false, true])
      for (const poolUnknown of [false, true]) {
        const i = { hasUnlock, poolApplies, poolUnknown };
        assert.equal(
          papicGuestCapAppliesWithCeiling({ ...i, guestCeiling: null }),
          papicGuestCapApplies(i),
          `a null ceiling changed the pre-S2 answer at ${JSON.stringify(i)} — a database ` +
            'that predates the migration must behave byte-identically',
        );
      }
});

test('a ceiling of exactly 0 still caps — 0 is a real number, not "unset"', () => {
  assert.equal(
    papicGuestCapAppliesWithCeiling({
      hasUnlock: true,
      poolApplies: true,
      poolUnknown: false,
      guestCeiling: 0,
    }),
    true,
    '0 !== null must not be read as "no ceiling"',
  );
});

// ─────────────────────────────────────────────────────────────────────────
// 2 · THE READ SIDE — fetchGuestQuota actually asks for the ceiling
// ─────────────────────────────────────────────────────────────────────────

test('fetchGuestQuota reads the ceiling RPC and folds it through the shared rule', () => {
  const src = code(web('lib', 'papic-guest.ts'));
  assert.match(
    src,
    /papic_guest_spend_ceiling/,
    'fetchGuestQuota stopped reading the couple’s ceiling',
  );
  assert.match(
    src,
    /papicGuestCapAppliesWithCeiling|guestCeiling === null/,
    'the ceiling override is no longer wired into capApplies/unlimited',
  );
  assert.match(
    src,
    /points_cost/,
    'the ceiling display stopped metering in credits (points_cost) and is back to counting rows',
  );
  // A read failure (including 42883 function-not-found, pre-S2) must degrade,
  // never throw — this surface renders on every guest page load.
  assert.match(
    src,
    /function readGuestSpendCeiling[\s\S]{0,600}?return null/,
    'readGuestSpendCeiling lost its graceful-degrade to null',
  );
  // A READ ERROR AND AN EMPTY RESULT MUST NOT LOOK THE SAME (the guard's own
  // rule, lib/security/select-column-scan.test.ts). The EXPECTED pre-S2 shape
  // (isMissingRelationError) degrades quietly; anything else must be logged,
  // or a genuine outage is indistinguishable from "no ceiling set".
  assert.match(
    src,
    /isMissingRelationError/,
    'the ceiling/points_cost reads stopped telling an expected pre-S2 miss apart from a real outage',
  );
  assert.match(
    src,
    /logQueryError\(\s*['"]readGuestSpendCeiling['"]/,
    'an unexpected ceiling-read failure is no longer logged — it would look identical to "no ceiling set"',
  );
});

// ─────────────────────────────────────────────────────────────────────────
// 3 · THE LOW STATE — the camera had none before this session
// ─────────────────────────────────────────────────────────────────────────

const CAMERA = ['app', 'papic', 'guest', '_components', 'papic-guest-capture.tsx'];

test('a "running low" state exists, gated on capApplies, and is not unconditional', () => {
  const src = code(web(...CAMERA));
  assert.match(src, /\bconst low =/, 'the low-state derivation is gone');
  assert.match(
    src,
    /const low =[\s\S]{0,200}?capApplies/,
    'low is no longer gated on capApplies — it would fire on a pool celebration with no personal number',
  );
  assert.match(
    src,
    /Running low/,
    'the low-state copy is gone from the pill',
  );
});

test('the low threshold reuses the pool’s own soft-stop constant, not an invented number', () => {
  const src = code(web(...CAMERA));
  assert.match(
    src,
    /DEFAULT_EVENT_POOL_CONFIG\.softStopPct/,
    'a new arbitrary threshold was invented instead of reusing DEFAULT_EVENT_POOL_CONFIG.softStopPct',
  );
});

test('points_cost stays a LITERAL .select() argument — not hidden behind a constant', () => {
  // points_cost was added to papic_guest_captures by S2's migration
  // (20271184624871, merged as #5017) — this select is now simply correct
  // against `main`'s own schema, and T1 passes on its own with no change here.
  //
  // A named-constant indirection was tried during the hold before S2 merged,
  // to dodge T1's then-correct red, and reverted: `lib/papic-guest-allotments.
  // ts` (S3) was mistaken for precedent because it uses the same NAMING
  // pattern, but it never hands its constants to a `.from().select()` at all —
  // this site does, and that is the difference that matters. Even after
  // #5020 (which wired `extractSelectConstants` into the phantom path so a
  // `.select(CONST)` is now resolved and checked, not skipped) this guard
  // stays: it is what stops the NEXT session reaching for the same
  // indirection reflexively, on a column that might genuinely be missing next
  // time.
  const src = code(web('lib', 'papic-guest.ts'));
  assert.match(
    src,
    /\.select\(\s*['"]points_cost['"]/,
    "the literal .select('points_cost') is gone",
  );
  assert.doesNotMatch(
    src,
    /GUEST_CAPTURE_POINTS_COST_COLUMN/,
    'the reverted named-constant indirection is back',
  );
});

// ─────────────────────────────────────────────────────────────────────────
// 4 · THE HONEST "NO" — a ceiling refusal names its remedy, the flat 150 does not
// ─────────────────────────────────────────────────────────────────────────

test('capReason is read from the server, wired in BOTH handlers, never inferred client-side', () => {
  const src = code(web(...CAMERA));
  assert.match(src, /\bconst \[capReason, setCapReason\] = useState/, 'capReason state is gone');
  const wired = src.match(/setCapReason\(json\.reason \?\? null\)/g) ?? [];
  assert.equal(
    wired.length,
    2,
    'capReason is no longer set from json.reason in both the photo and clip handlers',
  );
});

test('the remedy sentence is scoped to guest_spend_ceiling only, and stays honest', () => {
  const src = web(...CAMERA); // rendered copy
  assert.match(
    src,
    /capReason === 'guest_spend_ceiling'/,
    'the remedy sentence is no longer gated on the server-reported reason',
  );
  // Isolate just the RENDERED sentence (not the whole file, whose comments —
  // including the one directly above it — legitimately use words like "lost"
  // to describe this very rule).
  const match = src.match(
    /<p className="text-sm text-cream\/70">\s*([\s\S]{0,200}?)<\/p>\s*\) : null}/,
  );
  assert.ok(match?.[1], 'could not isolate the rendered remedy sentence');
  const sentence: string = match[1] as string;
  assert.match(sentence, /they can open\s+up more at any time/, 'the one-sentence remedy copy is gone');
  // Must NOT promise the remedy happens, imply the shot is lost, or send her
  // to go ask the host directly.
  assert.doesNotMatch(sentence, /will (raise|open|add)/i, 'copy promises the remedy will happen');
  assert.doesNotMatch(sentence, /\blost\b|\bgone\b|\bdiscarded\b/i, 'copy implies a shot was lost');
  assert.doesNotMatch(sentence, /\bask (the )?(host|couple)\b/i, 'copy sends the guest to go ask the host');
});

test('the exhausted congratulation still reads the dynamic total, not a hardcoded 150', () => {
  const src = web(...CAMERA); // rendered copy, comments fine here
  assert.match(
    src,
    /That&rsquo;s all \{total\} photos, \{guestName\}!/,
    'the per-guest congratulation must keep reading the `total` PROP — that is what makes it ' +
      'honest once fetchGuestQuota starts returning the couple’s own ceiling instead of 150',
  );
});
