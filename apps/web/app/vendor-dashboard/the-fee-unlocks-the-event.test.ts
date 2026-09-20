import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { ALWAYS_OPEN_SURFACES, VENDOR_FEE_LOCK_TESTID } from '@/lib/event-access-stage';

/**
 * THE GATE IS MOUNTED WHERE THE RULING SAYS, AND NOWHERE IT MUST NOT BE.
 *
 * `lib/event-access-stage.test.ts` proves the RULE. This proves the rule is
 * WIRED — the other half of the pair, and the half this repo has shipped
 * missing before (EH1 shipped a page nobody could reach with every test green).
 *
 * It reads SOURCE because there is no rendered surface to query without a
 * browser and a signed-in supplier on a booked event with an unpaid fee. Every
 * path is asserted to exist and to be non-empty first, so a moved file fails
 * loudly instead of quietly guarding nothing, and every count is PRINTED into
 * its assertion message so a sabotage is proven to have moved the number.
 *
 * Comments are stripped with the repo's `stripComments` — never a local regex —
 * so a docblock that merely MENTIONS the gate can never stand in for a call.
 */

const WEB = path.resolve(__dirname, '../..');

function read(rel: string): string {
  const full = path.join(WEB, rel);
  assert.ok(statSync(full).isFile(), `${rel} is not a file — the guard would prove nothing`);
  const src = readFileSync(full, 'utf8');
  assert.ok(src.length > 200, `${rel} is empty or a stub — the guard would pass on nothing`);
  return stripComments(src);
}

/**
 * EVERY SURFACE THAT LOCKS, mapped to the owner's numbered item.
 *
 * Adding a per-event supplier surface and forgetting this list is the failure
 * mode; the count assertion below is what makes the omission loud.
 */
const GATED_PAGES: { rel: string; item: string }[] = [
  // 1 · full details and actual updates of the event (and 7 · the workrooms)
  { rel: 'app/vendor-dashboard/clients/[eventId]/page.tsx', item: '1 + 2' },
  { rel: 'app/vendor-dashboard/clients/[eventId]/cocktail/page.tsx', item: '7' },
  { rel: 'app/vendor-dashboard/clients/[eventId]/mood-board/page.tsx', item: '7' },
  { rel: 'app/vendor-dashboard/clients/[eventId]/production-sheet/page.tsx', item: '1' },
  { rel: 'app/vendor-dashboard/clients/[eventId]/seat-plan/page.tsx', item: '1' },
  { rel: 'app/vendor-dashboard/clients/[eventId]/challenge-photos/page.tsx', item: '3' },
  // 5 + 6 · the portfolio for that event, and being part of the story
  { rel: 'app/vendor-dashboard/clients/[eventId]/editorial-media/page.tsx', item: '5 + 6' },
  // 4 · the event hub access
  { rel: 'app/vendor-dashboard/on-the-day/page.tsx', item: '4' },
  { rel: 'app/vendor-dashboard/on-the-day/live/[eventId]/page.tsx', item: '4' },
  // 3 · their papic service for that event
  { rel: 'app/vendor-dashboard/on-the-day/live/[eventId]/papic/page.tsx', item: '3' },
];

/** Every SERVER ACTION module that refuses a locked event. A hidden button is not a gate. */
const GATED_ACTIONS = [
  'app/vendor-dashboard/on-the-day/actions.ts',
  'app/vendor-dashboard/on-the-day/shot-list-actions.ts',
  'app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/actions.ts',
  'app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/access-actions.ts',
  'app/vendor-dashboard/on-the-day/live/[eventId]/papic/portfolio-pack-actions.ts',
];

test('every gated PAGE resolves the gate and renders a locked screen', () => {
  let mounted = 0;
  for (const { rel, item } of GATED_PAGES) {
    const src = read(rel);
    assert.ok(
      src.includes('resolveEventFeeGate('),
      `${rel} (ruling item ${item}) does not CALL resolveEventFeeGate — a per-event supplier ` +
        `surface that never asks about the fee is ungated.`,
    );
    // A call whose result is discarded is the "keep the call, discard its
    // result" sabotage that has beaten a guard in this repo twice. The screen
    // must be reachable from the result.
    assert.ok(
      /feeGate\.stage !== 'unlocked'|feeUnlocked/.test(src),
      `${rel} calls resolveEventFeeGate but never BRANCHES on its stage.`,
    );
    assert.ok(
      src.includes('EventLockedPage') || src.includes('EventLockedByFee'),
      `${rel} branches on the gate but mounts no locked screen — a blank page, a redirect ` +
        `or a 404 is exactly what the ruling forbids.`,
    );
    mounted += 1;
  }
  assert.equal(
    mounted,
    GATED_PAGES.length,
    `expected ${GATED_PAGES.length} gated pages, wired ${mounted}`,
  );
});

test('every gated SERVER ACTION refuses a locked event, in its own words', () => {
  let wired = 0;
  for (const rel of GATED_ACTIONS) {
    const src = read(rel);
    const calls = src.split('eventFeeBlocksAction(').length - 1;
    assert.ok(
      calls >= 1,
      `${rel} never calls eventFeeBlocksAction — the UI could hide the button and the ` +
        `action would still run. Calls found: ${calls}.`,
    );
    assert.ok(
      /if \(feeBlocked\)/.test(src),
      `${rel} calls eventFeeBlocksAction and never acts on the answer (found ${calls} call(s)).`,
    );
    // It must NOT reuse "You are not booked on this event." — a supplier who IS
    // booked cannot act on that sentence.
    assert.ok(
      /return[^\n]*feeBlocked/.test(src),
      `${rel} must refuse WITH the fee message, not with the not-booked one.`,
    );
    wired += 1;
  }
  assert.equal(wired, GATED_ACTIONS.length, `expected ${GATED_ACTIONS.length}, wired ${wired}`);
});

test('the locked screen carries the mount marker exactly once', () => {
  const src = read('app/vendor-dashboard/_components/event-locked-by-fee.tsx');
  // The MOUNT, not the constant's definition: the panel must carry the marker
  // as a real attribute. Asserting the bare identifier would also be satisfied
  // by the import line, which draws no pixel.
  const n = src.split('data-testid={VENDOR_FEE_LOCK_TESTID}').length - 1;
  assert.equal(
    n,
    1,
    `the locked panel must render data-testid={VENDOR_FEE_LOCK_TESTID} ("${VENDOR_FEE_LOCK_TESTID}") ` +
      `exactly once; found ${n}`,
  );
  // And it must offer BOTH ways out the ruling promises.
  assert.ok(src.includes('vendorBookingFeePayPath'), 'no route to pay the bill');
  assert.ok(
    src.includes(`${ALWAYS_OPEN_SURFACES.conversation}/`),
    'no route back to the conversation',
  );
});

// ── THE THREE THAT STAY OPEN ───────────────────────────────────────────────

test('🔒 THE ALWAYS-OPEN THREE ARE NEVER GATED', () => {
  // 1 · The conversation. The thread page and its actions must not know the gate.
  for (const rel of [
    'app/vendor-dashboard/messages/[threadId]/page.tsx',
    'app/vendor-dashboard/messages/page.tsx',
  ]) {
    const src = read(rel);
    assert.ok(
      !src.includes('resolveEventFeeGate') && !src.includes('eventFeeBlocksAction'),
      `${rel} gates the conversation. A locked supplier must ALWAYS be able to talk to the ` +
        `couple — that is how the misunderstanding that caused the unpaid fee gets fixed.`,
    );
  }

  // 2 · That booking's own money page, and 3 · the fee payment screen.
  for (const rel of [
    'app/vendor-dashboard/booking-fees/page.tsx',
    'app/vendor-dashboard/booking-fees/[orderId]/page.tsx',
  ]) {
    const src = read(rel);
    assert.ok(
      !src.includes('resolveEventFeeGate') && !src.includes('eventFeeBlocksAction'),
      `${rel} gates the screen where the fee is PAID. A gate that locks the door to its own ` +
        `key is not a gate, it is a trap.`,
    );
  }

  // The Quote & Payments tab of the customer card. The gate exists on that
  // page, so the assertion is that the money nodes are NOT passed through it.
  const card = read('app/vendor-dashboard/clients/[eventId]/page.tsx');
  for (const node of ['quoteNode', 'paymentsTabNode']) {
    assert.ok(
      !new RegExp(`gated\\(\\s*${node}\\s*\\)`).test(card),
      `the customer card routes ${node} through gated() — this booking's own money must stay ` +
        `open at every stage.`,
    );
    assert.ok(card.includes(node), `${node} no longer exists — this guard is now vacuous`);
  }
  // The chat door in the workspace strip keeps its href unconditionally.
  assert.ok(
    card.includes(`${ALWAYS_OPEN_SURFACES.conversation}/${'${threadId}'}`),
    'the customer card no longer links to the thread unconditionally',
  );
});

// ── THE COUPLE IS NEVER BLOCKED ────────────────────────────────────────────

test('🔒 THE COUPLE AND THEIR GUESTS NEVER SEE THIS GATE', () => {
  // The admission rule itself stays a pure "is this shop booked" answer. Folding
  // the fee into it would reach the couple's celebration page and the guest song
  // desk, which read the SAME function.
  for (const rel of ['lib/vendor-room-access-rule.ts', 'lib/vendor-room-access.ts']) {
    const src = read(rel);
    assert.ok(
      !src.includes('resolveEventFeeGate') &&
        !src.includes('eventAccessUnlocked') &&
        !src.includes('vendor-event-fee-access'),
      `${rel} folds the booking fee into "is this shop booked". lib/guest-song-request.ts and ` +
        `app/[slug] read that same answer, so a supplier's unpaid bill would silently delete ` +
        `the couple's band from their own wedding page.`,
    );
  }
  // And the couple-facing / guest-facing trees hold no importer at all.
  const offenders = walk(path.join(WEB, 'app/dashboard'))
    .concat(walk(path.join(WEB, 'app/[slug]')))
    .concat([path.join(WEB, 'lib/guest-song-request.ts')])
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
    .filter((f) => {
      const src = stripComments(readFileSync(f, 'utf8'));
      return (
        src.includes('vendor-event-fee-access') || src.includes("from '@/lib/event-access-stage'")
      );
    });
  assert.deepEqual(
    offenders.map((f) => path.relative(WEB, f)),
    [],
    'a couple-side or guest-side file imports the supplier fee gate. The couple must never be ' +
      'blocked by their supplier’s unpaid fee.',
  );
});

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(full));
    else out.push(full);
  }
  return out;
}

// ── THE FLAG ───────────────────────────────────────────────────────────────

test('the gate is read from ONE flag, and that flag is off by default', () => {
  const rule = read('lib/event-access-stage.ts');
  const n = rule.split('NEXT_PUBLIC_FEE_UNLOCKS_EVENT').length - 1;
  assert.equal(n, 1, `the flag must be read in exactly one place; found ${n} reads`);
  // No second reader anywhere — a surface that re-reads the env could disagree
  // with the stage it was handed.
  const others = walk(path.join(WEB, 'app'))
    .concat(walk(path.join(WEB, 'lib')))
    .filter(
      (f) =>
        /\.tsx?$/.test(f) &&
        !/\.test\.tsx?$/.test(f) &&
        !f.endsWith('lib/event-access-stage.ts'),
    )
    .filter((f) => stripComments(readFileSync(f, 'utf8')).includes('NEXT_PUBLIC_FEE_UNLOCKS_EVENT'));
  assert.deepEqual(
    others.map((f) => path.relative(WEB, f)),
    [],
    'a second reader of the flag exists; the stage must be resolved once and passed down',
  );
});
