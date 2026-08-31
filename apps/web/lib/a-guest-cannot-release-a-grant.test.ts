/**
 * THE GUEST BUY SURFACE MUST NOT REACH FOR `papic_dedicate_shots`.
 *
 * ── WHAT THIS IS THE SCAR OF ──────────────────────────────────────────────
 * PR #5028 shipped a live, guest-facing *"Give the unused N to the
 * celebration"* button on that primitive. It increased her balance by her own
 * spend and took the same amount OUT of the couple's shared pot — measured in
 * `tests/db/papic-a-grant-cannot-be-released.db.test.ts`, which is the other
 * half of this guard and holds the figures.
 *
 * The primitive is not broken; it was aimed at the wrong column. A guest's
 * bought credits are a GRANT (`papic_event_point_grants`, `seat_id` SET, via
 * `papic_grant_camera_points`); `papic_dedicate_shots` reads and writes
 * `papic_seat_allocations` — the HOST's hand-out layer — and nothing else.
 * Pointing it at a grant-funded camera cannot release anything, and its
 * TARGET arithmetic silently runs the giving branch instead.
 *
 * ── WHY A SOURCE GUARD AND NOT JUST THE DB TEST ───────────────────────────
 * 🔑 The corpus told the implementing session this call was *"that call in the
 * pot direction. Nothing new."* A future session reading a stale copy of that
 * sentence — it has already been corrected once, on 2026-08-31, and prose
 * corrections do not reach a session that never opens the file — would write
 * exactly the same line again. The db test proves the primitive cannot do the
 * job; this one makes re-aiming it at the guest surface fail in CI, in the
 * same commit that does it.
 *
 * ⚠ NOT A BAN ON THE FUNCTION. `app/dashboard/[eventId]/studio/papic/actions.ts`
 * calls it correctly and must keep doing so — that is the HOST moving their own
 * pot around, which is the allocation layer's actual purpose. The rule is
 * narrow on purpose: not from the GUEST buy action.
 *
 * ⏭ If a real release primitive is ever built (an owner call, still open as of
 * 2026-08-31), it will have its own name and this guard will not stand in its
 * way — see `releasesContract` in the db test for what it must satisfy.
 *
 * Run: cd apps/web && npx tsx --test lib/a-guest-cannot-release-a-grant.test.ts
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
 * Comments stripped with the ONE shared lexer — a docblock ABOUT the banned
 * call (this repo has several, including the one above) must never satisfy or
 * trip its own guard. Hand-rolled strippers are blocked by CI's
 * `lint one comment stripper` check for exactly that reason.
 */
const BUY_ACTIONS = 'app/papic/buy/actions.ts';
const BUY_SHELL = 'app/papic/_components/papic-buy-shell.tsx';
const BUY_PANEL = 'app/papic/_components/papic-guest-buy-panel.tsx';

const codeOf = (rel: string) => stripComments(read(rel));

test('the guest buy action never calls papic_dedicate_shots', () => {
  const code = codeOf(BUY_ACTIONS);
  const hits = code.match(/papic_dedicate_shots/g) ?? [];
  assert.equal(
    hits.length,
    0,
    `${BUY_ACTIONS} calls papic_dedicate_shots ${hits.length}x. That primitive ` +
      'moves papic_seat_allocations — the HOST hand-out layer. A guest\'s bought ' +
      'credits are a GRANT, which it cannot reach: aiming it here ADDS to her ' +
      'balance and DEBITS the shared pot (see ' +
      'tests/db/papic-a-grant-cannot-be-released.db.test.ts).',
  );
});

/**
 * Anchored per FILE, not across the tree: a repo-wide count cannot say WHICH
 * component still holds the call, so sabotage in one file can be masked by a
 * removal in another and stay green. Each surface is asserted on its own, and
 * the count is in the message.
 */
test('no guest-facing buy surface renders a give-back-to-the-pool control', () => {
  for (const rel of [BUY_SHELL, BUY_PANEL]) {
    const code = codeOf(rel);
    const rpc = (code.match(/papic_dedicate_shots/g) ?? []).length;
    assert.equal(rpc, 0, `${rel} references papic_dedicate_shots ${rpc}x`);

    // The action export the #5028 button posted to. Its absence is what makes
    // the surface honest; a client component importing it is the re-add.
    const action = (code.match(/releaseGuestDedicatedShots/g) ?? []).length;
    assert.equal(
      action,
      0,
      `${rel} wires releaseGuestDedicatedShots ${action}x — the removed #5028 ` +
        'release path. Rebuilding it needs a primitive that can reach a grant.',
    );
  }
});

test('the release action is gone from the buy module, not merely unwired', () => {
  const code = codeOf(BUY_ACTIONS);
  const hits = (code.match(/releaseGuestDedicatedShots/g) ?? []).length;
  assert.equal(
    hits,
    0,
    `${BUY_ACTIONS} still exports/defines releaseGuestDedicatedShots ${hits}x. ` +
      "Every export of a 'use server' module is POST-able whether or not any UI " +
      'references it, so removing the button alone closes the button and not the door.',
  );
});
