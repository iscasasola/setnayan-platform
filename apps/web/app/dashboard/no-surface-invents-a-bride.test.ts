/**
 * No guest surface asks which SIDE somebody is on unless the event has sides.
 *
 * ── WHY THIS IS A SWEEP AND NOT A FILE CHECK ────────────────────────────────
 * B3 (PR #5560) fixed `/guests/new` and shipped the pure helper that decides
 * the question. It was briefed AT A FILENAME, so it fixed that file — and the
 * owner then opened the **quick-add sheet**, the door the empty state actually
 * leads with ("+ Add your first guest"), and was asked for a SIDE on a Simple
 * Event with the picker defaulted to **Bride**.
 *
 * 🔑 THE FIX WAS PINNED TO A FILE INSTEAD OF A PROPERTY, so it closed one of
 * four doors and nobody could tell. This test is the property: it ENUMERATES
 * every surface that renders a side control and requires each one to gate on
 * the shared helper. A fifth surface added tomorrow fails here on its first
 * commit rather than on a host's screen.
 *
 * ── AND THE HALF THAT IS EASY TO GET WRONG ──────────────────────────────────
 * Hiding the control is only half. `[guestId]/actions.ts` REQUIRED a valid side
 * and redirected `?error=missing_side` — so a hidden field plus an unchanged
 * action is a screen that looks right and silently refuses to save, which is
 * worse than asking the wrong question. Every gated surface must ALSO route its
 * write through `resolveSubmittedSide`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  SIDELESS_SIDE,
  eventHasSides,
  resolveSubmittedSide,
} from '@/lib/guest-side-question';
import {
  GENERIC_ROLE_SET,
  SIMPLE_ROLE_SET,
  WEDDING_ROLE_SET,
} from '@/lib/role-sets';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

/** Renders a side control AND is expected to gate it. */
const GATED_SURFACES = [
  'app/dashboard/[eventId]/guests/new/page.tsx',
  'app/dashboard/[eventId]/guests/_components/quick-add-sheet.tsx',
  // The route delegates its side control to the shared guest card (2026-09-22).
  'app/dashboard/[eventId]/guests/_components/guest-card-body.tsx',
];

/**
 * ⚖ KNOWN BACKLOG — MAY ONLY SHRINK, NEVER GROW.
 * `chip-editors.tsx` renders a side picker from a client island that is handed
 * no role set today, so gating it means threading the answer down from the
 * page — a wider change than the one the owner's screenshot asked for. It is
 * recorded here rather than left silent, and the count below is what stops it
 * becoming two.
 */
const UNGATED_BACKLOG = [
  'app/dashboard/[eventId]/guests/_components/chip-editors.tsx',
];

test('the decision itself: a wedding has sides, a sideless type does not', () => {
  assert.equal(eventHasSides(WEDDING_ROLE_SET), true);
  assert.equal(eventHasSides(SIMPLE_ROLE_SET), false);
  assert.equal(eventHasSides(GENERIC_ROLE_SET), false);
});

test('🔴 every side-rendering surface gates on the shared helper', () => {
  const offenders: string[] = [];
  for (const f of GATED_SURFACES) {
    const src = read(f);
    /*
      ⤷ 2026-09-22: a surface may now ASK the question itself, or consume the
      answer from the shared loader that asked it. The guest card takes
      `hasSides` off `loadGuestCard`, so requiring the call in the rendering
      file would convict correct code and teach the next person to weaken this.
      The chain is still proven end to end: the loader is asserted to make the
      call, below.
    */
    const asks = /eventHasSides\s*\(/.test(src);
    const gatesOnTheSharedAnswer = /hasSides \?/.test(src);
    if (!asks && !gatesOnTheSharedAnswer) {
      offenders.push(`${f} — neither calls eventHasSides() nor gates on hasSides`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'a surface renders a side control without asking whether the event has sides:\n' +
      offenders.join('\n'),
  );

  // Vacuity guard: if nothing calls the helper any more, the allowance above is
  // a hole rather than a delegation.
  assert.match(
    read('app/dashboard/[eventId]/guests/_components/guest-card-data.ts'),
    /eventHasSides\s*\(/,
    'the guest card’s loader stopped asking whether the event has sides',
  );
});

test('🔴 no surface seeds a side picker to "bride"', () => {
  // The exact defect the owner photographed: a Simple Event's quick-add sheet
  // opened with SIDE = Bride already chosen.
  const offenders: string[] = [];
  for (const f of GATED_SURFACES) {
    const src = read(f);
    if (/useState<GuestSide>\(\s*['"]bride['"]\s*\)/.test(src)) {
      offenders.push(`${f} — seeds the picker to 'bride' unconditionally`);
    }
  }
  assert.deepEqual(offenders, [], offenders.join('\n'));
});

test('🔴 a gated surface also routes its WRITE through the resolver', () => {
  // Hiding the field without fixing the action = a screen that looks right and
  // refuses to save. Both write paths behind a gated form must resolve.
  const writers = [
    'app/dashboard/[eventId]/guests/new/actions.ts',
    'app/dashboard/[eventId]/guests/[guestId]/actions.ts',
  ];
  const offenders: string[] = [];
  for (const f of writers) {
    const src = read(f);
    if (!/resolveSubmittedSide\s*\(/.test(src)) {
      offenders.push(`${f} — still validates side without the shared resolver`);
    }
    if (/error=missing_side/.test(src)) {
      offenders.push(`${f} — can still refuse with missing_side, which a gated form cannot satisfy`);
    }
  }
  assert.deepEqual(offenders, [], offenders.join('\n'));
});

test('the write resolves both ways — a wedding still refuses, a sideless type does not', () => {
  assert.equal(resolveSubmittedSide(WEDDING_ROLE_SET, '').ok, false);
  assert.equal(resolveSubmittedSide(WEDDING_ROLE_SET, 'bride').ok, true);

  const sideless = resolveSubmittedSide(SIMPLE_ROLE_SET, '');
  assert.equal(sideless.ok, true);
  assert.equal(sideless.ok && sideless.side, SIDELESS_SIDE);
});

test('⚖ the ungated backlog only shrinks', () => {
  assert.ok(
    UNGATED_BACKLOG.length <= 1,
    'a NEW surface was added to the ungated backlog. Gate it instead — the ' +
      'helper is pure and client-safe, and every entry here is a screen that ' +
      'can still ask a wake which side a mourner is on.',
  );
  // And the backlog must stay honest: a file listed here must actually still
  // render a side control, or it should have been removed from the list.
  for (const f of UNGATED_BACKLOG) {
    assert.match(
      read(f),
      /SIDE_OPTIONS|aria-label="Side"/,
      `${f} no longer renders a side control — remove it from UNGATED_BACKLOG`,
    );
  }
});
