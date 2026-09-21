import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ⚖ Owner 2026-09-20, on the desktop guest list: *"is there a better way to
 * keep this clean and remove the pill boxes? so it looks neater?"*
 *
 * Five filled capsules per row — side, role, groups, RSVP, seat — across 77
 * rows is ~385 coloured shapes and no hierarchy, so the eye reads texture
 * instead of information. The roster now spends its colour on ONE thing, the
 * role, which is the identity and (since #5755) the couple's own mood-board
 * colour.
 *
 * 🔑 THE FAILURE MODE IS CREEP, ONE PILL AT A TIME. Nobody will ever re-add
 * five capsules in one commit. Somebody will add one, reasonably, because that
 * one column "needs to stand out" — and a year later the row is back where it
 * started with no single change to point at. So this pins the roster's cells by
 * NAME and counts, rather than trusting a review to notice the fourth one.
 */

const ROW = readFileSync(
  join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', '_components', 'guest-list-multiselect.tsx'),
  'utf8',
);

/** DesktopRow's body, bounded by the next top-level component. */
function desktopRow(): string {
  const start = ROW.indexOf('function DesktopRow(');
  assert.notEqual(start, -1, 'DesktopRow is gone — this guard is blind');
  const after = ROW.slice(start);
  const end = after.indexOf('\nfunction SelfJoinDesktopRow(');
  assert.notEqual(end, -1, 'could not find the end of DesktopRow');
  return after.slice(0, end);
}

test('the roster row renders the TEXT variants, not the pills', () => {
  const body = desktopRow();
  for (const text of ['<SideText', '<RoleTexts', '<RsvpText']) {
    assert.ok(body.includes(text), `the roster row no longer renders ${text}`);
  }
  for (const pill of ['<SidePill', '<RoleChips', '<RsvpPill']) {
    assert.ok(
      !body.includes(pill),
      `${pill} is back in the roster row — the capsules are creeping back one at a time`,
    );
  }
});

test('the two SHARED components are asked for their plain presentation', () => {
  const body = desktopRow();
  // SeatChip and GroupChipList are shared with GuestCard and MobileListRow, so
  // the roster asks for `plain` rather than the component being edited — which
  // would have redesigned mobile from a note about the desktop table.
  for (const [tag, mount] of [
    ['SeatChip', '<SeatChip'],
    ['GroupChipList', '<GroupChipList'],
  ] as const) {
    const at = body.indexOf(mount);
    assert.notEqual(at, -1, `${tag} is not mounted in the roster row`);
    const props = body.slice(at, body.indexOf('/>', at));
    assert.match(props, /\bplain\b/, `${tag} in the roster row is not asking for its plain form`);
  }
});

test('🔑 the phone roster drops its pills too — one vocabulary, every width', () => {
  /*
    ⚖ Owner 2026-09-20, shown the phone after the desktop redesign shipped:
    *"why did mobile view did not adjust. there are still pills on the table"*.

    This test used to assert the OPPOSITE — that GuestCard and MobileListRow
    kept their chips — and it was right to, because scoping mobile out was a
    deliberate call I made and wrote down. The owner disagreed, so the decision
    changed and the guard changes with it. It is not weakened: it still pins a
    surface against drift, just to the answer that is now correct.
  */
  const mobileRow = ROW.slice(
    ROW.indexOf('function MobileListRow('),
    ROW.indexOf('function MobileSelfJoinCard('),
  );
  assert.ok(mobileRow.includes('<RoleTexts'), 'the phone row lost its role text');
  assert.ok(mobileRow.includes('<RsvpText'), 'the phone row lost its RSVP text');
  for (const pill of ['<SidePill', '<RoleChips', '<RsvpPill']) {
    assert.ok(!mobileRow.includes(pill), `${pill} is back on the phone row`);
  }
});

test('the capsule components are GONE, not merely unmounted', () => {
  // 🔑 A component nothing renders is a component somebody re-renders. Leaving
  // `SidePill` and friends defined beside the text variants is an invitation to
  // put one back "just for this column" — which is exactly the creep the filled
  // capsule count above exists to catch, one step earlier.
  for (const dead of ['function SidePill(', 'function RsvpPill(', 'function RoleChips(', 'function RoleChip(']) {
    assert.ok(!ROW.includes(dead), `${dead.replace('function ', '').replace('(', '')} is still defined with no caller`);
  }
});

test('⚖ there is ONE roster view — the grid is gone, not hidden', () => {
  // Owner 2026-09-20: "remove the grid view on guest list. make it same sa row
  // view only." A `?density=grid` toggle defaulted the phone to a photo-card
  // grid. Both the branch and the components it rendered are removed, so a
  // stale link renders the list rather than a view nobody can reach the toggle
  // for.
  assert.ok(!ROW.includes('mobileDensity'), 'the roster still branches on a density param');
  for (const gone of ['function GuestCard(', 'function MobileGridItem(']) {
    assert.ok(!ROW.includes(gone), `${gone} survives — the grid view is hidden, not removed`);
  }
  const carousel = readFileSync(
    join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', '_components', 'mobile-guest-carousel.tsx'),
    'utf8',
  );
  assert.ok(!carousel.includes('DensityBtn'), 'the density toggle is still on screen');
});

test('exactly one element in the row carries a filled tint', () => {
  const body = desktopRow();
  // A filled capsule is the shape being removed: a rounded-full with a bg-*.
  // The role is text now, so the row should hold NONE of them. Counted rather
  // than asserted absent by name, so a capsule spelled a new way still trips.
  const capsules = body.match(/rounded-full[^`"']*\bbg-/g) ?? [];
  assert.deepEqual(
    capsules,
    [],
    `the roster row has ${capsules.length} filled capsule(s) again: ${capsules.join(' · ')}`,
  );
});

test('the side is carried by an EDGE and still by a WORD', () => {
  const body = desktopRow();
  // The edge — for scanning a column of bride's people at a glance.
  assert.match(
    body,
    /border-l-2[^`"']*SIDE_CONTROL_BORDER\[guest\.side\]/,
    'the row lost its side edge',
  );
  // And the word — colour alone is not a label. A colour-blind reader and a
  // screen reader get nothing from a 2px rule.
  assert.ok(body.includes('<SideText'), 'the side is now colour-only, with no readable label');
});
