/**
 * THE TABLE, THE CARD GRID AND THE BULK BAR ARE ONE DECISION: "is this a
 * desktop?" They were written as THREE independent classNames and drifted.
 *
 * Measured on the owner's phone 2026-09-14:
 *   · the seven-column table showed from `sm` (640px)
 *   · the card grid hid from `sm`
 *   · the bulk-action bar only appeared at `lg` (1024px)
 *
 * So 640–1023px got the table AND no bulk actions at all — and the table,
 * clipped by `overflow-hidden`, printed "~Table 3" on top of a mobile number.
 * Each class was individually sensible; the SET was wrong, which is why no
 * test of any one of them could have caught it.
 *
 * The component's own directive already said phones AND TABLETS use the
 * carousel's Customize + Assign sheets, so `lg` is what that sentence always
 * meant — the table simply never followed it.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const SRC = stripComments(
  readFileSync(
    join(process.cwd(), 'app/dashboard/[eventId]/guests/_components/guest-list-multiselect.tsx'),
    'utf8',
  ),
);

test('THE REGRESSION: the desktop table starts at lg, not sm', () => {
  assert.match(SRC, /className="hidden overflow-x-auto rounded-tile border lg:block"/,
    'the roster table must appear only at lg — at sm it overlaps its own columns on a phone');
  assert.ok(
    !/rounded-tile border sm:block/.test(SRC),
    'the table must not reappear at sm',
  );
});

test('the card grid hands over at the SAME breakpoint the table takes over', () => {
  assert.match(SRC, /className="space-y-5 lg:hidden"/, 'cards must cover everything below lg');
  assert.ok(
    !/"space-y-5 sm:hidden"/.test(SRC),
    'a gap between the two would leave some width with NEITHER view, or both',
  );
});

test('the bulk bar agrees with them — ONE bar on every width', () => {
  // ⤷ 2026-09-30 (the Fable rows, frames C and G): the same four — Invite
  // selected · Set group ▾ · Set table ▾ · ⋯ — on the phone and the computer, so
  // the bar is no longer split by the breakpoint at all. One mount, no `lg:` gate.
  assert.equal((SRC.match(/<RosterBulkBar\b/g) ?? []).length, 1, 'the bulk bar is mounted more than once');
  const bar = SRC.slice(SRC.indexOf('data-roster-bulk-bar=""') - 300, SRC.indexOf('data-roster-bulk-bar=""') + 300);
  assert.doesNotMatch(bar, /hidden lg:block|lg:hidden/, 'the bulk bar is split by the breakpoint again');
});

test('the table SCROLLS rather than clipping its own columns', () => {
  // overflow-hidden is what turned "too narrow" into overlapping cells instead
  // of a scrollbar. At any width the table must scroll.
  assert.ok(
    !/overflow-hidden rounded-tile/.test(SRC),
    'overflow-hidden on the roster table stacks cells on each other when it cannot fit',
  );
});

test('the contact column left the row — the mobile stays on the card', () => {
  // ⤷ 2026-09-30 (the Fable rows' ledger): "Contact (call / email icons) is
  // dropped from the row — no email to guests; the mobile stays on the card."
  // (The owner-scoped Rule 1 exemption for these links is retired with them —
  // `no-door-out-of-the-app`'s GUEST_CONTACT_BILL is empty.)
  assert.doesNotMatch(SRC, /<Phone aria-hidden|<Mail aria-hidden|href=\{`tel:|href=\{`mailto:/, 'a contact control is back on the row');
  assert.ok(!/\{guest\.email \?\? guest\.mobile \?\? '—'\}/.test(SRC), 'the raw contact string must not come back');
});
