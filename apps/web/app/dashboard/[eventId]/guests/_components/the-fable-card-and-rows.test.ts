/**
 * the-fable-card-and-rows.test.ts — the approved Fable designs for the guest
 * card and the Guest list rows, held as rules (owner 2026-09-30, DECISION_LOG
 * "APPROVED — THE FABLE DESIGNS FOR THE GUEST CARD, THE GUEST LIST ROWS AND THE
 * GUEST LANDING PAGE" and "WALKING TOGETHER IS NOT BEING A COUPLE";
 * `Setnayan-specs/prototypes/guest_card_invite_simple_2026-09-30_fable.html`,
 * `guest_card_details_2026-09-30_fable.html`, `guest_list_rows_2026-09-30_fable.html`).
 *
 * Each rule below is a thing the owner ruled that a later edit could quietly
 * undo while every other test stays green.
 *
 * 🛡 Sabotaged once each, all RED (2026-09-30):
 *  · a native <select> put back on the card                    → RED
 *  · the email field shown again on the card                   → RED
 *  · "Maybe" offered to a guest who never said it              → RED
 *  · "walks with" drawn on a row                               → RED
 *  · a +1 left where the sort dropped it (helper returns input)→ RED
 *  · the Groups marker dropped from the card                   → RED
 *  · updateGuest writing groups without the marker             → RED
 *  · the RSVP pill cycling again on a tap                      → RED
 *  · a request drawn as a row between guests                   → RED
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { plusOnesUnderBringers } from '@/lib/plus-ones-under-bringers';
import {
  defaultRosterColumns,
  pickRosterColumn,
  resolveRosterColumns,
  ROSTER_COLUMNS,
  rosterSlotCount,
} from '@/lib/roster-columns';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => stripComments(readFileSync(join(HERE, ...p), 'utf8'));
const CARD = read('guest-card-body.tsx');
const PARTS = read('guest-ticket-parts.tsx');
const CELL = read('guest-invite-cell.tsx');
const ROWS = read('guest-list-multiselect.tsx');
const CHIPS = read('chip-editors.tsx');
const PHONE = read('mobile-guest-carousel.tsx');
const PAGE = read('..', 'page.tsx');
const COLS = ['invite', 'rsvp', 'access', 'checkin', 'seat', 'side', 'role', 'groups', 'plus', 'account', 'contact'] as const;

/** A function's source from its name to the next top-level function. */
function bodyOfFn(src: string, name: string): string {
  const a = src.indexOf(`function ${name}(`);
  assert.notEqual(a, -1, `${name} is gone — this guard is blind`);
  const b = src.indexOf('\nfunction ', a + 10);
  return src.slice(a, b === -1 ? undefined : b);
}

const ACTIONS = stripComments(readFileSync(resolve(HERE, '..', '[guestId]', 'actions.ts'), 'utf8'));

// ── THE CARD ────────────────────────────────────────────────────────────────

test('card top: the ticket (tap → full view + Save ticket), ONE Invite, ⋯, the status line — no QR look', () => {
  assert.match(CARD, /<TicketThumb guestId=\{guest\.guest_id\}/, 'the ticket thumbnail is gone');
  // The Guest list and the standalone card hand in the real ticket view and ⋯.
  for (const page of [PAGE, stripComments(readFileSync(resolve(HERE, '..', '[guestId]', 'page.tsx'), 'utf8'))]) {
    assert.match(page, /TicketThumb=\{GuestTicketThumb\}\s*MoreMenu=\{GuestMoreMenu\}/, 'a guest page draws the card without its ticket view or ⋯');
  }
  assert.equal((CARD.match(/<SendInvite\b/g) ?? []).length, 1, 'the card draws more than one Invite');
  assert.match(CARD, /more=\{more\}/, 'the ⋯ is not beside Invite');
  assert.doesNotMatch(CARD, /Customize guest QRs|launch\?tool=details&item=qr|Copy message|Download QR/, 'the old QR tools are back on the card');
  // ⋯ = Write to NFC · New QR · Unlink account, one list; New QR asks first.
  assert.match(PARTS, /<NfcWriteButton url=\{nfcUrl\}/);
  assert.match(PARTS, /Make a new QR for \{guestName\}\?/);
  assert.match(PARTS, /name="new_qr" value="1"/);
  assert.match(ACTIONS, /if \(formData\.get\('new_qr'\) === '1'\) return newGuestQr\(/, 'New QR does not ride the release door');
  // New QR rotates the key ONLY — it must not detach the account (that is Unlink / Take back).
  const nq = ACTIONS.slice(ACTIONS.indexOf('async function newGuestQr('), ACTIONS.indexOf('async function unlinkSeatAccount('));
  assert.match(nq, /rpc\('rotate_guest_qr_token'/);
  assert.doesNotMatch(nq, /person_id|event_members/, 'New QR unlinks the guest');
  assert.match(nq, /setGuestInvitationSent\(eventId, guestId, false\)/, 'the status does not go back to Not sent');
  // The status line says "Not sent · Not linked" / "✓ Sent … · Linked".
  assert.match(CELL, /'Not sent'/);
  assert.match(CELL, /linked \? 'Linked' : 'Not linked'/);
});

test('card body: every choice is ONE shipped PickMenu — never a native select, never a pill row', () => {
  assert.doesNotMatch(CARD, /<select\b|type="radio"/, 'a native select or a radio pill row is back on the card');
  for (const name of ['name_prefix', 'side', 'group_category', 'role', 'extra_roles', 'group_ids', 'rsvp_status', 'plus_one_count', 'meal_preference', 'table_id', 'attire']) {
    assert.match(CARD, new RegExp(`<FormPick\\s+name="${name}"`), `${name} is not a dropdown on the card`);
  }
  // The two "several choices" are checkmark dropdowns.
  assert.match(CARD, /name="extra_roles"[\s\S]{0,200}\bmulti\b/);
  assert.match(CARD, /name="group_ids"[\s\S]{0,400}\bmulti\b/);
  const fields = read('card-fields.tsx');
  assert.match(fields, /<PickMenu\b/, 'FormPick is not the shipped PickMenu');
});

test('card body: the name is open; the rest fold, one open at a time', () => {
  const nameAt = CARD.indexOf('data-guest-card-name=""');
  const firstFold = CARD.indexOf('<Fold summary=');
  assert.ok(nameAt > 0 && firstFold > nameAt, 'the name is not open above the rows');
  for (const s of ['Details', 'RSVP', 'Seat', 'Photos', 'Private note', 'Access']) {
    assert.match(CARD, new RegExp(`<Fold summary="${s}"`), `the ${s} row is gone`);
  }
  assert.match(CARD, /<details name="guest-card-row"/, 'the rows are not one exclusive accordion');
  assert.match(CARD, /data-guest-card-tags=""/, 'Tags is gone');
});

test('card: RSVP is Attending · No reply · Not coming — Maybe only for a guest who said it', () => {
  assert.match(CARD, /RSVP_OPTIONS\.filter\(\(v\) => v !== 'maybe' \|\| guest\.rsvp_status === 'maybe'\)/);
  assert.match(CARD, /pending: 'No reply'/);
  assert.match(CARD, /declined: 'Not coming'/);
});

test('card: no email anywhere a couple can see — the address is only CARRIED for guests', () => {
  assert.match(CARD, /<input type="hidden" name="email" value=\{guest\.email \?\? ''\} \/>/, 'the email is not carried (every autosave would erase it)');
  assert.doesNotMatch(CARD, /id="email"|label="Email"|Email & mobile/, 'the email is shown on the card again');
  // The one email left is the couple row's own sign-in link (a partner's seat).
  const signIn = CARD.indexOf('data-partner-sign-in=""');
  const coupleBranch = CARD.lastIndexOf('{isCouple ? (', signIn);
  assert.ok(signIn > 0 && coupleBranch > 0 && signIn - coupleBranch < 1200, 'the sign-in email is offered outside the couple rows');
});

test('card: "walks with" is not on the card — the Maker’s Wedding March owns it', () => {
  assert.doesNotMatch(CARD, /walks with|pair_with_guest_id/i);
});

test('card: Groups, Also serves as and Table are written ONLY when the card posted them', () => {
  for (const marker of ['extra_roles_posted', 'groups_posted', 'table_posted']) {
    assert.match(CARD, new RegExp(`name="${marker}" value="1"`), `the card no longer marks ${marker}`);
    assert.match(ACTIONS, new RegExp(`formData\\.get\\('${marker}'\\)\\) === '1'`), `updateGuest no longer reads ${marker}`);
  }
  assert.match(ACTIONS, /if \(groupsPosted\) \{\s*await syncCardGroups\(/, 'groups are written without the marker');
  assert.match(ACTIONS, /\.\.\.\(extraRolesPosted \? \{ extra_roles \} : \{\}\)/, 'extra roles are written without the marker');
  assert.match(ACTIONS, /if \(tablePosted && !passed_away && effectiveRsvp !== 'declined'\)/, 'a table is set for someone who is not coming');
  // A seat is written only when the table CHANGED (autosave must not reset the chair).
  const seat = ACTIONS.slice(ACTIONS.indexOf('async function syncCardTable('));
  assert.match(seat, /if \(now === tableId\) return \{ ok: true \};/);
});

// ── THE ROWS ────────────────────────────────────────────────────────────────

test('rows: the reply pill opens ONE dropdown — no tap-to-cycle', () => {
  assert.doesNotMatch(CHIPS, /RSVP_CYCLE|mobileCycle/, 'the tap-to-cycle is back');
  assert.doesNotMatch(ROWS, /mobileCycle/);
  assert.match(CHIPS, /const RSVP_OPTIONS: RsvpStatus\[\] = \['attending', 'pending', 'declined'\];/);
});

test('rows: "walks with" and Pair are gone from the list', () => {
  assert.doesNotMatch(ROWS, /walks with|<PartnerLine|pairSelectedGuests|unpairGuestAction|Pair these 2/);
});

test('rows: the eye left; every column is a slot whose header is ONE dropdown — Name first', () => {
  // ⤷ 2026-09-30, the full-width list (DECISION_LOG "THE GUEST LIST USES THE
  // FULL WIDTH…"): Name first, then as many slots as fit, each header a
  // PickMenu choosing Invite · RSVP · Access · Check-in · Seat · Side · Role ·
  // Groups · +N · Account · Contact.
  const head = ROWS.slice(ROWS.indexOf('<thead'), ROWS.indexOf('</thead>'));
  assert.ok(head.includes('>Name<'), 'Name is no longer the first column');
  assert.match(head, /desk\.columns\.map\(\(column, slot\) =>[\s\S]*?<ColumnPick\b/, 'a slot header is not a dropdown');
  assert.doesNotMatch(head, /ArrangeTh/, 'the old sort/group header is back');
  assert.match(bodyOfFn(ROWS, 'ColumnPick'), /<PickMenu\b/, 'the slot header is not the shipped PickMenu');
  assert.doesNotMatch(ROWS, /QuickViewButton|mailto:/);
  assert.match(ROWS, /<GuestMoreMenu\b/, 'a row has no ⋯');
  // One switch draws every column, on both widths.
  const cell = bodyOfFn(ROWS, 'RosterCell');
  for (const c of COLS) assert.match(cell, new RegExp(`case '${c}':`), `RosterCell cannot draw ${c}`);
  assert.match(cell, /<GuestAccessCell|<RowAccess\b/, 'Access is not the #6191 cell');
  assert.match(cell, /<GuestCheckinCell\b/, 'Check-in is not the desk’s cell');
  assert.match(read('guest-checkin-cell.tsx'), /import \{ checkInGuest, undoCheckIn \} from '\.\.\/checkin\/actions';/, 'Check-in grew its own writer');
  assert.match(bodyOfFn(ROWS, 'MobileListRow'), /<RosterCell column=\{column\}/, 'the phone does not draw its ONE slot through the same cell');
  assert.match(ROWS, /fixedSlots: 1/, 'the phone shows more than one slot');
});

test('columns: no column twice, Invite leads while anyone is unsent, Check-in only from the day (executed)', () => {
  assert.deepEqual([...ROSTER_COLUMNS], [...COLS], 'the column vocabulary changed');
  const plan = defaultRosterColumns({ anyUnsent: true, checkinOpen: false, hasSides: true });
  assert.equal(plan[0], 'invite');
  assert.equal(plan[1], 'rsvp');
  assert.ok(!plan.includes('checkin'), 'Check-in is offered before the event day');
  const sent = defaultRosterColumns({ anyUnsent: false, checkinOpen: false, hasSides: true });
  assert.deepEqual(sent.slice(0, 2), ['rsvp', 'invite'], 'once everyone is sent, the answers lead');
  const day = defaultRosterColumns({ anyUnsent: true, checkinOpen: true, hasSides: true });
  assert.equal(day[0], 'checkin', 'Check-in does not come forward on the day');
  assert.ok(!defaultRosterColumns({ anyUnsent: true, checkinOpen: false, hasSides: false }).includes('side'), 'a birthday is offered Side');
  // Picking a column already shown SWAPS — never two of one.
  const shown = resolveRosterColumns(null, plan, 4);
  assert.deepEqual(shown, ['invite', 'rsvp', 'access', 'seat']);
  const swapped = pickRosterColumn(shown, 0, 'seat');
  assert.deepEqual(swapped, ['seat', 'rsvp', 'access', 'invite']);
  assert.equal(new Set(swapped).size, swapped.length);
  // A remembered list is cleaned: unknown, unavailable and doubled entries go.
  assert.deepEqual(resolveRosterColumns(['checkin', 'rsvp', 'rsvp', 'nope', 7], plan, 3), ['rsvp', 'invite', 'access']);
  // More width, more slots: about 4 · 6 · 8+.
  assert.equal(rosterSlotCount(960, COLS.length), 4);
  assert.equal(rosterSlotCount(1300, COLS.length), 6);
  assert.ok(rosterSlotCount(1700, COLS.length) >= 8);
  assert.equal(rosterSlotCount(200, COLS.length), 1, 'a squeezed list still shows one column');
});

test('columns: remembered per device — every storage touch is inside try/catch', () => {
  const hook = read('use-roster-columns.ts');
  const touches = hook.match(/window\.localStorage\.\w+\(/g) ?? [];
  assert.equal(touches.length, 2, 'the hook reads/writes storage more or less than once each');
  for (const t of ['window.localStorage.getItem(', 'window.localStorage.setItem(']) {
    const at = hook.indexOf(t);
    const tryAt = hook.lastIndexOf('try {', at);
    const catchAt = hook.indexOf('catch', tryAt);
    assert.ok(tryAt !== -1 && catchAt > at, `${t} is not inside try/catch`);
  }
  assert.match(hook, /new ResizeObserver\(/, 'the slot count no longer follows the width');
  assert.match(PAGE, /data-roster-full-width=""/, 'the Guest list no longer spans the full width');
  assert.match(PAGE, /sn-col max-w-none/, 'the Guest list is narrowed to the reading column again');
});

test('rows: requests are never rows between guests — one strip leads to the Requests page', () => {
  assert.doesNotMatch(ROWS, /SelfJoinDesktopRow|MobileSelfJoinCard/);
  assert.match(ROWS, /\.filter\(\(g\) => !selfJoinIds\.includes\(g\.guest_id\)\)/, 'requests are drawn as rows');
  assert.match(PAGE, /data-requests-strip=""/);
  assert.match(PAGE, /'request' : 'requests'\} to join/);
});

test('rows: a +1 sits right under the guest who brings them (executed)', () => {
  const rows = [
    { guest_id: 'bea', plus_one_of_guest_id: 'manuel' },
    { guest_id: 'ana', plus_one_of_guest_id: null },
    { guest_id: 'manuel', plus_one_of_guest_id: null },
    { guest_id: 'x', plus_one_of_guest_id: 'gone' }, // bringer filtered out — stays put
  ];
  assert.deepEqual(plusOnesUnderBringers(rows).map((r) => r.guest_id), ['ana', 'manuel', 'bea', 'x']);
  // Nobody is dropped or doubled.
  assert.equal(new Set(plusOnesUnderBringers(rows).map((r) => r.guest_id)).size, rows.length);
  assert.match(ROWS, /plusOnesUnderBringers\(/, 'the roster no longer orders a +1 under its bringer');
});

test('rows: long-press selects on a phone, and ONE bulk bar holds the four', () => {
  assert.match(ROWS, /guestSelection\.enter\(\);/, 'a long press no longer starts selecting');
  const bar = ROWS.slice(ROWS.indexOf('function RosterBulkBar('));
  for (const w of ['Invite selected', 'label="Set group"', 'label="Set table"', 'label="More for the selected guests"']) {
    assert.ok(bar.includes(w), `the bulk bar lost ${w}`);
  }
  // Bride and groom are never sent to.
  assert.match(bar, /g\.role !== 'bride' && g\.role !== 'groom'/);
});

test('list head: Sort ▾ and four dropdowns — RSVP · Side · Role · Group — on both widths', () => {
  const controls = read('roster-controls.tsx');
  for (const d of ['data-roster-filter-rsvp', 'data-roster-filter-side', 'data-roster-filter-role', 'data-roster-filter-group', 'data-roster-sort']) {
    assert.ok(controls.includes(d), `${d} is gone`);
  }
  assert.match(PHONE, /<RosterFilters\b/);
  assert.match(PHONE, /<RosterSort\b/);
  assert.match(PAGE, /<RosterFilters\b/);
  assert.match(PAGE, /<RosterSort\b/);
  // "Share the link" — Invite means one guest's ticket everywhere.
  assert.match(PHONE, /'Share the link'/);
});
