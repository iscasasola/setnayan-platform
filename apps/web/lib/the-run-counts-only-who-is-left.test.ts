/**
 * the-run-counts-only-who-is-left.test.ts — THE SEND RUN COUNTS ONLY WHO IS LEFT TO INVITE.
 *
 * Owner 2026-10-29, live, his own event, iPhone: searched "Kat", the row read *Kat Arroyo · Attending*, and the send run
 * he landed in said **"95 sent · 105 more to invite · INVITE 104 OF 200 · Kat Arroyo"**. A guest who has already
 * answered was counted as "more to invite" and queued for an invitation.
 *
 * ROOT CAUSE: the one "to invite" rule (`isToInvite`) was *mayBeInvited + no `invitation_sent_at` stamp* — it never read
 * the reply. A guest who answered without a stamp (marked Attending by the host, replied through the one link, or sent
 * from outside the run) stayed "to invite" in the List's count, the run's queue and "more to invite"; the run's
 * "Invite k of N" counted on from EVERYONE (`before + position` of `sendable.length`). The row's own pill already knew
 * better (`isToInvite(g) && rsvp_status === 'pending'`), so the row said Attending while the count said "to invite".
 *
 * What this holds, on a roster shaped like the owner's (200 who may be invited · 95 stamped · 105 unstamped of whom 43
 * have answered — Kat Arroyo first among them):
 *   1. every count of "to invite" is 62 — the List (`rosterStats`), Setup (`toInviteCount`), the run's "more to invite";
 *   2. the run opens on the first guest still to invite — never Kat — and says "Invite 1 of 62";
 *   3. a run opened ON Kat (`?ids=`) shows her, but counts her nowhere as "to invite";
 *   4. a refused read is said so — never "0 more to invite";
 *   5. a row's Share is that guest's own share — it never navigates to the run.
 *
 * SABOTAGE (each seen red, 2026-10-29): drop `!hasReplied(g)` from `isToInvite` → 1 red (+ six in
 * to-invite-is-one-rule) · the run's `leftCount` back to `sendable.length - sentCount` → 2, 3 red · the eyebrow back to
 * "before + position" of `sendable.length` → 2 red · the queue back to "everyone unstamped" AND `inRun` back to
 * `sendable` → 2 red ("Invite 1 of 105"). Either one of those last two alone stays green, and rightly: the queue leaves
 * the answered out, and `runStanding` over `inRun` steps over any that slip in — each is enough on its own.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { guestDisplayName, guestNameAsGiven, type GuestRow } from '@/lib/guests';
import { hasReplied, isToInvite, rosterStats, sendRunGuests, toInviteCount } from '@/lib/guest-roster-view';
// Stubs `server-only` for this process (the run imports the shipped server actions).
import '@/app/dashboard/[eventId]/_components/guest-setup/render-setup';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const SENT = '2026-10-20T03:00:00Z';

const guest = (id: string, first: string, last: string, over: Partial<GuestRow> = {}): GuestRow =>
  ({
    guest_id: id,
    first_name: first,
    last_name: last,
    role: 'guest',
    extra_roles: [],
    side: 'groom',
    group_category: 'work',
    rsvp_status: 'pending',
    entry_source: 'host',
    passed_away: false,
    invitation_sent_at: null,
    plus_one_count: 0,
    mobile: null,
    qr_token: `tok-${id}`,
    created_at: '2026-09-01T00:00:00Z',
    ...over,
  }) as unknown as GuestRow;

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const KAT = uuid(1);

/** The owner's event, in shape: the couple, 95 stamped, then Kat (Attending, never stamped) first of the unstamped. */
function ownersRoster(): GuestRow[] {
  const rows: GuestRow[] = [
    guest(uuid(9001), 'Ice', 'Casasola', { role: 'groom', rsvp_status: 'attending' }),
    guest(uuid(9002), 'Claire', 'Casasola', { role: 'bride', rsvp_status: 'attending' }),
  ];
  let n = 100;
  // 95 sent — some answered since, some silent.
  for (let i = 0; i < 95; i++) rows.push(guest(uuid(n++), `Sent${i}`, 'Guest', { invitation_sent_at: SENT, rsvp_status: i % 3 === 0 ? 'attending' : 'pending' }));
  // 105 never stamped: Kat first, 39 more who said yes, 3 maybes — and 62 still to invite.
  rows.push(guest(KAT, 'Kat', 'Arroyo', { rsvp_status: 'attending', rsvp_set_by: 'host' } as Partial<GuestRow>));
  for (let i = 0; i < 39; i++) rows.push(guest(uuid(n++), `Yes${i}`, 'Guest', { rsvp_status: 'attending' }));
  for (let i = 0; i < 3; i++) rows.push(guest(uuid(n++), `Maybe${i}`, 'Guest', { rsvp_status: 'maybe' }));
  for (let i = 0; i < 62; i++) rows.push(guest(uuid(n++), `Left${i}`, 'Guest'));
  // Declined — never invited, in no count.
  for (let i = 0; i < 7; i++) rows.push(guest(uuid(n++), `No${i}`, 'Guest', { rsvp_status: 'declined' }));
  return rows;
}
const ROSTER = ownersRoster();
const LEFT = 62;

/** `send/page.tsx`'s own mapping — what `SendRun` is handed. */
const asRunGuests = (rows: readonly GuestRow[]) =>
  rows.map((r) => ({
    guestId: r.guest_id,
    formalName: guestNameAsGiven(r),
    firstName: r.first_name,
    fullName: guestDisplayName(r),
    inviteUrl: `https://setnayan.com/ice-and-claire/i/${r.qr_token}`,
    sentAt: r.invitation_sent_at,
    replied: hasReplied(r),
  }));

const ROUTER = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };
async function renderRun(rows: readonly GuestRow[], opts: { measured?: boolean; picked?: string[] } = {}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { ToastProvider } = await import('@/app/_components/toast/toast-provider');
  const { SendRun } = await import('@/app/dashboard/[eventId]/guests/send/_components/send-run');
  const picked = opts.picked ?? [];
  return renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: ROUTER as never },
      React.createElement(
        ToastProvider,
        null,
        React.createElement(SendRun, {
          eventId: 'e1',
          guests: asRunGuests(sendRunGuests(rows, picked)),
          measured: opts.measured ?? true,
          facts: { hostsName: 'Ice & Claire', eventWord: 'wedding' },
          template: null,
          picked: picked.length > 0,
        }),
      ),
    ),
  );
}
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const part = (html: string, attr: string) => text(html.match(new RegExp(`<(p|h2)\\b[^>]*${attr}[^>]*>[\\s\\S]*?</\\1>`))?.[0] ?? '').trim();

test('the roster is the owner’s shape: 200 may be invited · 95 sent · 105 unstamped, 43 of whom have answered', () => {
  const run = sendRunGuests(ROSTER);
  assert.equal(run.length, 200);
  assert.equal(run.filter((g) => g.invitation_sent_at).length, 95);
  assert.equal(run.filter((g) => !g.invitation_sent_at).length, 105, 'the bug’s "105 more to invite"');
  assert.equal(run.filter((g) => !g.invitation_sent_at && hasReplied(g)).length, 43);
});

test('1 · every "to invite" count is who is LEFT — never a guest who answered', () => {
  assert.equal(rosterStats(ROSTER).toInvite, LEFT, 'the List’s "To invite" counts guests who answered');
  assert.equal(toInviteCount(ROSTER, true), LEFT, 'Setup’s "Send to N" counts guests who answered');
  const kat = ROSTER.find((g) => g.guest_id === KAT)!;
  assert.equal(isToInvite(kat), false, 'Kat Arroyo · Attending is still "to invite"');
  assert.equal(hasReplied(kat), true);
  // A read that does not carry the reply never reads as an answer.
  assert.equal(hasReplied({}), false);
  assert.equal(hasReplied({ rsvp_status: null }), false);
});

test('2 · the run opens on the first guest still to invite — never Kat — "62 more to invite · Invite 1 of 62"', async () => {
  const html = await renderRun(ROSTER);
  assert.equal(part(html, 'data-send-run-count=""').replace(/\s*\(.*\)$/, ''), `95 sent · ${LEFT} more to invite`);
  assert.equal(part(html, 'data-send-run-position=""'), `Invite 1 of ${LEFT}`, 'the run’s total is not who is left');
  assert.equal(part(html, 'data-send-run-name=""'), 'Left0 Guest', 'the run opened on a guest who already answered');
  assert.doesNotMatch(text(html), /Kat Arroyo/, 'the run queued Kat Arroyo, who already said yes');
});

test('3 · a run opened ON Kat shows her — but counts her nowhere as "to invite"', async () => {
  const html = await renderRun(ROSTER, { picked: [KAT] });
  assert.equal(part(html, 'data-send-run-name=""'), 'Kat Arroyo', 'a guest opened deliberately is not shown');
  assert.equal(part(html, 'data-send-run-position=""'), 'Invite 1 of 1');
  assert.match(part(html, 'data-send-run-count=""'), /^0 sent · 0 more to invite/, 'a guest who answered is counted as "to invite"');
  // Ticked with others, the run walks the ticked — only the unanswered count.
  const two = await renderRun(ROSTER, { picked: [KAT, uuid(100 + 95 + 39 + 3)] });
  assert.match(part(two, 'data-send-run-count=""'), /^0 sent · 1 more to invite/);
  assert.equal(part(two, 'data-send-run-position=""'), 'Invite 1 of 2');
});

test('4 · a refused read is unknown — never "0 more to invite", never a number', async () => {
  const html = await renderRun([], { measured: false });
  assert.match(text(html), /We couldn’t load your guest list just now/);
  assert.doesNotMatch(text(html), /more to invite|Everyone has their invite|Invite \d+ of/);
});

test('5 · a row’s Share is that guest’s own share — it never opens the run', () => {
  const cell = read('app/dashboard/[eventId]/guests/_components/guest-invite-cell.tsx');
  const rowShare = cell.match(/async function rowShare\([\s\S]*?\n  \}\n/)?.[0] ?? '';
  assert.ok(rowShare, 'rowShare is gone — re-anchor this guard');
  assert.match(rowShare, /shareInvite\(null, message\)/, 'the row’s Share no longer shares this guest’s own message');
  assert.doesNotMatch(cell, /sendRunHref|guests\/send|useRouter|router\.push|location\.(href|assign)/, 'the Share cell navigates — one guest’s Share must be that guest only');
  // The list row hands the cell ONE guest — itself.
  const screen = read('app/dashboard/[eventId]/guests/_components/guests-screen.tsx');
  assert.match(screen, /<GuestInviteCell eventId=\{eventId\} layout="icon" guest=\{share\}/);
  assert.match(screen, /const share: SendInviteGuest \| null =\s*invite && token\s*\?\s*\{\s*guestId: g\.guest_id,/);
  // The only door to the run with ids is Select's "Invite N", over the to-invite selected.
  assert.equal((screen.match(/sendRunHref\(/g) ?? []).length, 1);
  assert.match(screen, /router\.push\(sendRunHref\(eventId, invitable\.map\(\(g\) => g\.guest_id\)\)\)/);
});

test('the run page hands the run who answered and whether it was opened on chosen guests', () => {
  const page = read('app/dashboard/[eventId]/guests/send/page.tsx');
  assert.match(page, /replied: hasReplied\(g\),/);
  assert.match(page, /picked=\{picked\.length > 0\}/);
  const lab = read('app/dev/guests-lab/page.tsx');
  assert.match(lab, /replied: hasReplied\(g\),/, 'the lab’s run is not the real run’s data');
});
