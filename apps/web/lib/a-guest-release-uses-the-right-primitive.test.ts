/**
 * THE GUEST GIVE-BACK MUST USE THE PRIMITIVE THAT CAN REACH A GRANT — and must
 * never compute the amount itself.
 *
 * ── WHAT THIS IS THE SCAR OF ──────────────────────────────────────────────
 * PR #5028 shipped a live, guest-facing *"Give the unused N to the
 * celebration"* button on `papic_dedicate_shots`. It increased her balance by
 * her own spend and took the same amount OUT of the couple's shared pot. PR
 * #5038 removed it and left this guard behind; the feature was rebuilt on
 * 2026-08-31, at the owner's request, on `papic_release_seat_grants`
 * (migration `20271185813837`).
 *
 * ⚠ THIS FILE WAS RE-AIMED, NOT RELAXED. Its predecessor asserted the release
 * path was ABSENT, which was right while it was absent and is wrong now. Two of
 * its three tests would have gone red on the rebuild, and the honest response
 * to that is to assert the properties that make the rebuild correct — not to
 * delete the ones that went red. Every rule below is narrower and harder than
 * what it replaced. The one rule that carried over unchanged is the first,
 * because it is the one that was never about absence:
 *
 *   THE GUEST BUY SURFACE MUST NOT REACH FOR `papic_dedicate_shots`.
 *
 * ── THE TWO DEFECT SHAPES BEING FENCED OUT ────────────────────────────────
 * 1. WRONG COLUMN. `papic_dedicate_shots` reads and writes
 *    `papic_seat_allocations` — the HOST's hand-out layer. A guest's bought
 *    credits are a GRANT (`papic_event_point_grants`, `seat_id` SET). Aiming
 *    the host's primitive at a guest's money is #5028, exactly.
 *    Measured in `tests/db/papic-a-grant-cannot-be-released.db.test.ts`.
 * 2. TWO PLACES COMPUTING ONE NUMBER. #5028's button said 96 because the page
 *    did its own `dedicated - spent`; the call did different arithmetic and
 *    moved 41 the other way. The figure now has ONE definition —
 *    `papic_seat_releasable_grants` — which the panel DISPLAYS and the mover
 *    RE-EVALUATES under its row lock. A number shown by one implementation and
 *    moved by another is not one number, and no test of either half alone can
 *    see the gap between them.
 *
 * ⚠ NOT A BAN ON `papic_dedicate_shots`.
 * `app/dashboard/[eventId]/studio/papic/actions.ts` calls it correctly and must
 * keep doing so — that is the HOST moving the couple's own pot around, which is
 * the allocation layer's actual purpose. The rule is narrow on purpose: not
 * from the GUEST surface.
 *
 * Run: cd apps/web && npx tsx --test lib/a-guest-release-uses-the-right-primitive.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/**
 * Comments stripped with the ONE shared lexer — this file's own docblocks name
 * every banned construct, and prose about a rule must never satisfy or trip it.
 * Hand-rolled strippers are blocked by CI's `lint one comment stripper` check
 * for exactly that reason.
 */
const BUY_ACTIONS = 'app/papic/buy/actions.ts';
const BUY_SHELL = 'app/papic/_components/papic-buy-shell.tsx';
const BUY_PANEL = 'app/papic/_components/papic-guest-buy-panel.tsx';
const STANDING_READ = 'lib/papic-guest-own-camera.ts';
const PURE_LIB = 'lib/papic-guest-buy.ts';

const codeOf = (rel: string) => stripComments(read(rel));
const count = (code: string, re: RegExp) => (code.match(re) ?? []).length;

// ── 1 · the rule that carried over unchanged ───────────────────────────────

test('the guest buy action never calls papic_dedicate_shots', () => {
  const hits = count(codeOf(BUY_ACTIONS), /papic_dedicate_shots/g);
  assert.equal(
    hits,
    0,
    `${BUY_ACTIONS} calls papic_dedicate_shots ${hits}x. That primitive moves ` +
      "papic_seat_allocations — the HOST hand-out layer. A guest's bought credits " +
      'are a GRANT, which it cannot reach: aiming it here ADDS to her balance and ' +
      'DEBITS the shared pot (tests/db/papic-a-grant-cannot-be-released.db.test.ts).',
  );
});

/**
 * Anchored per FILE, not across the tree: a repo-wide count cannot say WHICH
 * component holds the call, so sabotage in one file can be masked by a removal
 * in another and stay green.
 */
test('no guest-facing buy surface reaches for papic_dedicate_shots either', () => {
  for (const rel of [BUY_SHELL, BUY_PANEL, STANDING_READ]) {
    const hits = count(codeOf(rel), /papic_dedicate_shots/g);
    assert.equal(hits, 0, `${rel} references papic_dedicate_shots ${hits}x`);
  }
});

// ── 2 · the release goes through the primitive that can reach a grant ──────

test('the release action calls papic_release_seat_grants', () => {
  const code = codeOf(BUY_ACTIONS);
  assert.ok(
    /releaseGuestDedicatedShots/.test(code),
    `${BUY_ACTIONS} no longer defines releaseGuestDedicatedShots — if the feature ` +
      'was removed again, remove this test with it deliberately rather than leaving ' +
      'a guard asserting a call that no longer has to happen.',
  );
  const hits = count(code, /papic_release_seat_grants/g);
  assert.equal(
    hits,
    1,
    `${BUY_ACTIONS} calls papic_release_seat_grants ${hits}x, expected exactly 1`,
  );
});

// ── 3 · nobody names an amount ─────────────────────────────────────────────

test('the release action posts no amount and passes none to the RPC', () => {
  const code = codeOf(BUY_ACTIONS);
  const action = code.slice(code.indexOf('export async function releaseGuestDedicatedShots'));
  assert.ok(action.length > 0, 'release action not found');

  // The RPC takes (p_event_id, p_seat_id, p_actor) and NOTHING else. A points
  // argument would put the figure back in the browser's hands, which is the
  // shape #5028 died of.
  const points = count(action, /p_points/g);
  assert.equal(points, 0, `the release call passes p_points ${points}x — it must take no amount`);

  // And nothing amount-shaped may be read off the form. `return_to` and
  // `seat_token` are the only two fields this form carries.
  const fields = [...action.matchAll(/formData\.get\(\s*'([^']+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(
    fields,
    ['return_to', 'seat_token'],
    `the release form reads ${JSON.stringify(fields)} — an amount read from the ` +
      'browser is a number a stale page or a hostile POST can choose',
  );
});

test('the release form renders no amount input', () => {
  const code = codeOf(BUY_SHELL);
  const section = code.slice(code.indexOf('function ReleaseSection'));
  assert.ok(section.length > 0, 'ReleaseSection not found');
  const names = [...section.matchAll(/<input[^>]*name="([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(
    names,
    ['return_to', 'seat_token'],
    `the release form posts ${JSON.stringify(names)} — one button, no amount`,
  );
});

// ── 4 · ONE definition of how many credits can move ────────────────────────

test('the displayed number is READ from the database, not computed in TypeScript', () => {
  const hits = count(codeOf(STANDING_READ), /papic_seat_releasable_grants/g);
  assert.equal(
    hits,
    1,
    `${STANDING_READ} reads papic_seat_releasable_grants ${hits}x, expected exactly 1. ` +
      'That function is the ONE definition of how many credits can move; the mover ' +
      're-evaluates it under a row lock. Computing it here instead is #5028 restated.',
  );
});

test('no surface derives "releasable" by subtracting spend', () => {
  // The literal shape of the #5028 defect: releasable := dedicated - spent.
  // Checked on every file that holds a standing, because the arithmetic only
  // has to appear ONCE, anywhere, to start disagreeing with the database.
  const derived = /releasable\s*[:=][^;,\n]*[-−]/;
  for (const rel of [PURE_LIB, STANDING_READ, BUY_SHELL, BUY_PANEL]) {
    const code = codeOf(rel);
    assert.ok(
      !derived.test(code),
      `${rel} computes "releasable" with a subtraction: ${derived.exec(code)?.[0]?.trim()}. ` +
        'It must be read from papic_seat_releasable_grants — credits the HOST handed ' +
        "the camera are the couple's money, so it is NOT dedicated minus spent.",
    );
  }
});
