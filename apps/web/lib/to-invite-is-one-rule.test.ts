/**
 * to-invite-is-one-rule.test.ts — "TO INVITE" IS ONE NUMBER, EVERYWHERE.
 *
 * Owner 2026-10-08, verbatim: *"no. declined guests don't get an invitation"*.
 * Before it, the Guests list said "N to invite" by one rule (`isToInvite`: no
 * invitation sent · has not declined · not a celebrant) while Guests › Setup's
 * "Send to N", the send run's queue and Home's "Send N invitations" counted
 * every non-couple guest with nothing sent — so a guest who had already said
 * no was queued for an invitation, and the same screen could print two numbers.
 *
 * What this holds, on ONE roster that carries every guest the rules could
 * disagree about (a declined guest nothing was sent to, the celebrant, a
 * request, a guest who passed away), by RUNNING each surface's own function
 * and DRAWING the two that print the number:
 *
 *   List     `rosterStats().toInvite`            (the counts line and its door)
 *   Pick who `rosterSearchMatches('to invite')`  (`/guests?select=to-invite`)
 *   Setup    `toInviteCount()` → "Send to N"     (drawn: the real Setup rows)
 *   Run      `sendRunGuests()` → "Not sent yet (N)" and "1 of N" (drawn: the real run)
 *   Home     `homeGuestsRead().unsent` → "Send N invitations"
 *
 * …and that a refused read is `null` / said so — never 0; and that the run
 * steps over a guest who declined after it opened, and takes back one whose
 * reply changed.
 *
 * SABOTAGE (each seen red): drop the declined line from `mayBeInvited` ·
 * `toInviteCount` counts its own way · `homeGuestsRead` counts its own way ·
 * `sendRunGuests` keeps the declined · the run page filters inline · Setup's
 * panel counts inline · the run counts off its snapshot · a refused read is 0.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { REQUEST_ENTRY_SOURCE, guestDisplayName, guestFullName, type GuestRow } from '@/lib/guests';
import {
  isToInvite,
  rosterSearchMatches,
  rosterStats,
  runArrivals,
  runStanding,
  sendRunGuests,
  toInviteCount,
  type RosterFacts,
} from '@/lib/guest-roster-view';
import { homeGuestsRead, pickHomeNext } from '@/lib/home-first-screen';
import { renderSetup } from '@/app/dashboard/[eventId]/_components/guest-setup/render-setup';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const SENT = '2026-10-01T00:00:00Z';

const g = (id: string, over: Partial<GuestRow> = {}): GuestRow =>
  ({
    guest_id: id,
    first_name: id,
    last_name: 'Test',
    role: 'guest',
    extra_roles: [],
    side: 'bride',
    rsvp_status: 'pending',
    entry_source: 'host',
    passed_away: false,
    invitation_sent_at: null,
    plus_one_count: 0,
    ...over,
  }) as unknown as GuestRow;

/** Every guest the rules could disagree about. */
const ROSTER: GuestRow[] = [
  g('bride', { role: 'bride', rsvp_status: 'attending' }),
  g('groom', { role: 'groom' }),
  g('celebrant', { role: 'celebrant' as GuestRow['role'] }),
  g('ana'), // nothing sent, no answer → to invite
  g('ben', { rsvp_status: 'maybe' }), // nothing sent, "maybe" → to invite
  g('cora', { rsvp_status: 'attending' }), // said yes in person, nothing sent → to invite
  g('dan', { rsvp_status: 'declined' }), // 🔑 said no, nothing sent → NEVER to invite
  g('ella', { invitation_sent_at: SENT }), // sent, silent
  g('fe', { invitation_sent_at: SENT, rsvp_status: 'declined' }), // sent, then declined
  g('gil', { invitation_sent_at: SENT, rsvp_status: 'attending' }),
  g('req', { entry_source: REQUEST_ENTRY_SOURCE }), // a request: on the page, in no count
  g('late', { passed_away: true }),
];
/** The owner's rule, spelled out by hand — the oracle every surface is held to. */
const TO_INVITE = ['ana', 'ben', 'cora'];
/** Who may hold an invitation at all (sent or not): the run's "Everyone". */
const MAY_BE_INVITED = ['ana', 'ben', 'cora', 'ella', 'gil'];
const FACTS: RosterFacts = { hasSides: true, groupsOf: () => [], tableOf: () => null };
const ids = (rows: readonly { guest_id: string }[]) => rows.map((r) => r.guest_id);

/** The run page's own mapping (`send/page.tsx`): what `SendRun` is handed. */
const asRunGuests = (rows: readonly GuestRow[]) =>
  rows.map((r) => ({
    guestId: r.guest_id,
    formalName: guestFullName(r),
    firstName: r.first_name,
    fullName: guestDisplayName(r),
    inviteUrl: `https://setnayan.com/a-and-b/i/${r.guest_id}`,
    sentAt: r.invitation_sent_at,
  }));

/* The run imports the shipped server actions, whose modules import `server-only`
   (render-setup.ts, imported above, already stubs it for this process). */
const ROUTER = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };
async function renderRun(rows: readonly GuestRow[], opts: { measured?: boolean; picked?: string[] } = {}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { ToastProvider } = await import('@/app/_components/toast/toast-provider');
  const { SendRun } = await import('@/app/dashboard/[eventId]/guests/send/_components/send-run');
  return renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: ROUTER as never },
      React.createElement(
        ToastProvider,
        null,
        React.createElement(SendRun, {
          eventId: 'e1',
          guests: asRunGuests(sendRunGuests(rows, opts.picked ?? [])),
          measured: opts.measured ?? true,
          facts: { hostsName: 'A & B', eventWord: 'wedding' },
          template: null,
        }),
      ),
    ),
  );
}
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('the oracle is the owner\'s rule: nothing sent · has not declined · never the couple, the celebrant, a request or the late', () => {
  assert.deepEqual(ids(ROSTER.filter((r) => isToInvite(r))), TO_INVITE);
  assert.equal(isToInvite(ROSTER.find((r) => r.guest_id === 'dan')!), false, 'a guest who declined is still "to invite"');
});

test('List · Pick who · Setup · the run · Home — one number, and the declined guest in none of them (executed)', () => {
  const n = TO_INVITE.length;
  // List — the counts line and its door.
  assert.equal(rosterStats(ROSTER).toInvite, n, 'the List counts "to invite" its own way');
  // Pick who — `/guests?select=to-invite` seeds the search with "to invite".
  assert.deepEqual(ids(ROSTER.filter((r) => rosterSearchMatches('to invite', r, FACTS))), TO_INVITE, '"Pick who" selects by another rule');
  // Setup — "Send to N".
  assert.equal(toInviteCount(ROSTER, true), n, 'Setup\'s "Send to N" is not the List\'s N');
  // The run — who it holds, and who it opens with.
  const run = sendRunGuests(ROSTER);
  assert.deepEqual(ids(run), MAY_BE_INVITED, 'the run holds someone who may not be invited (or lost someone who may)');
  assert.deepEqual(ids(run.filter((r) => !r.invitation_sent_at)), TO_INVITE, 'the run opens with a different queue than the List\'s "to invite"');
  assert.ok(!ids(run).includes('dan') && !ids(run).includes('fe'), 'a declined guest is queued for an invitation');
  // "Invite N" from the List (`?ids=`): the ticked only, in tick order — and a ticked guest who declined is still left out.
  assert.deepEqual(ids(sendRunGuests(ROSTER, ['cora', 'dan', 'ana'])), ['cora', 'ana']);
  // Home — "Send N invitations".
  const home = homeGuestsRead(ROSTER, true);
  assert.equal(home?.unsent, n, 'Home counts the people to invite its own way');
  assert.equal(
    pickHomeNext({ guide: null, hasDate: true, guests: home, noun: 'wedding', papicReady: false, aiOffer: false }).title,
    `Send ${n} invitations`,
  );
});

test('the two screens that PRINT the number print that number (rendered: the real Setup rows, the real run)', async () => {
  const n = TO_INVITE.length;
  const setup = await renderSetup({ getIn: 'list', toInvite: toInviteCount(ROSTER, true) });
  assert.match(text(setup.match(/<a\b[^>]*data-testid="setup-send"[^>]*>[\s\S]*?<\/a>/)?.[0] ?? ''), new RegExp(`Send to ${n}\\b`), 'Setup\'s button names another N');
  assert.match(text(setup), new RegExp(`\\b${n} to invite\\.`));

  const run = await renderRun(ROSTER);
  assert.match(text(run), new RegExp(`Not sent yet \\(${n}\\)`), 'the run\'s "Not sent yet" is not the List\'s N');
  assert.match(text(run.match(/<p[^>]*data-send-run-position=""[^>]*>[\s\S]*?<\/p>/)?.[0] ?? ''), new RegExp(`^ ?1 of ${n} ?$`), 'the run\'s "1 of N" is not the List\'s N');
  assert.doesNotMatch(text(run), /\bdan\b|\bfe\b/, 'the run names a guest who declined');
  // Everyone invited → the run says so; it never opens on a declined guest instead.
  const done = await renderRun(ROSTER.map((r) => (TO_INVITE.includes(r.guest_id) ? { ...r, invitation_sent_at: SENT } : r)));
  assert.match(text(done), /Not sent yet \(0\)/);
  assert.match(text(done), /Everyone has their invite\./);
});

test('a refused read is unknown — never "0 to invite", never "everyone has theirs"', async () => {
  assert.equal(toInviteCount([], false), null, 'Setup reads a refused guest list as a number');
  assert.equal(toInviteCount(ROSTER, false), null);
  assert.equal(homeGuestsRead([], false), null, 'Home reads a refused guest list as a count');
  const setup = await renderSetup({ getIn: 'list', toInvite: toInviteCount([], false) });
  assert.match(text(setup), /We couldn’t count who is left to invite just now\./);
  assert.doesNotMatch(text(setup), /Everyone invited|Send to 0|\b0 to invite/, 'Setup draws a refused read as nobody to invite');
  const run = await renderRun([], { measured: false });
  assert.match(text(run), /We couldn’t load your guest list just now/);
  assert.doesNotMatch(text(run), /Everyone has their invite|Not sent yet \(0\)/, 'the run draws a refused read as all done');
});

test('declining after the run opened takes a guest out on the next read; changing back brings them in', () => {
  const opened = asRunGuests(sendRunGuests(ROSTER).filter((r) => !r.invitation_sent_at)); // ana, ben, cora
  assert.deepEqual(opened.map((x) => x.guestId), TO_INVITE);

  // ben declines while the couple is on ana. The next read no longer holds ben.
  const afterDecline = ROSTER.map((r) => (r.guest_id === 'ben' ? { ...r, rsvp_status: 'declined' as const } : r));
  assert.equal(toInviteCount(afterDecline, true), 2);
  assert.equal(rosterStats(afterDecline).toInvite, 2);
  const latest = asRunGuests(sendRunGuests(afterDecline));
  assert.ok(!latest.some((x) => x.guestId === 'ben'));
  const onAna = runStanding(opened, latest, 0);
  assert.equal(onAna.current?.guestId, 'ana');
  assert.equal(onAna.upNext?.guestId, 'cora', 'the run offers a guest who declined as "Next"');
  assert.deepEqual([onAna.position, onAna.total], [1, 2], 'the run still counts a guest who declined');
  // Next from ana lands on cora — never on ben — and says "2 of 2".
  const next = runStanding(opened, latest, onAna.index + 1);
  assert.equal(next.current?.guestId, 'cora');
  assert.deepEqual([next.position, next.total], [2, 2]);
  assert.equal(runStanding(opened, latest, next.index + 1).current, null, 'the run does not end');

  // dan (declined before the run opened) changes his reply back: the next read holds him,
  // and he joins the END of a queue that never knew him.
  const afterReturn = afterDecline.map((r) => (r.guest_id === 'dan' ? { ...r, rsvp_status: 'pending' as const } : r));
  assert.equal(toInviteCount(afterReturn, true), 3);
  const latest2 = asRunGuests(sendRunGuests(afterReturn));
  const known = new Set(asRunGuests(sendRunGuests(ROSTER)).map((x) => x.guestId));
  assert.deepEqual(runArrivals(known, latest2, 'unsent').map((x) => x.guestId), ['dan']);
  // …but someone the run already holds, or already sent to, is not "new".
  assert.deepEqual(runArrivals(new Set([...known, 'dan']), latest2, 'unsent'), []);
  assert.deepEqual(runArrivals(new Set<string>(), latest2, 'unsent').map((x) => x.guestId), ['ana', 'cora', 'dan']);
  const grown = runStanding([...opened, ...runArrivals(known, latest2, 'unsent')], latest2, 0);
  assert.deepEqual([grown.position, grown.total], [1, 3]);
});

test('every surface is WIRED to the one rule, and none keeps a count of its own', () => {
  const setup = read('app/dashboard/[eventId]/guests/invite/_components/invite-panel.tsx');
  assert.match(setup, /const toInvite = toInviteCount\(guests\.rows, guests\.measured\);/, 'Setup\'s panel does not ask the one rule');
  const page = read('app/dashboard/[eventId]/guests/send/page.tsx');
  assert.match(page, /sendRunGuests\(rows, picked\)/, 'the run page does not ask the one rule who it holds');
  const run = read('app/dashboard/[eventId]/guests/send/_components/send-run.tsx');
  assert.match(run, /runStanding\(queue, sendable, at\)/, 'the run counts off its snapshot, not the latest read');
  assert.match(run, /runArrivals\(known\.current, sendable, who\)/, 'the run never takes in a guest who came back');
  assert.match(run, /\{formatCount\(position\)\} of \{formatCount\(total\)\}/);
  const home = read('lib/home-first-screen.ts');
  assert.match(home, /unsent: rows\.filter\(\(g\) => isToInvite\(g\)\)\.length/, 'Home does not ask the one rule');
  assert.match(read('app/dashboard/[eventId]/page.tsx'), /guests: homeGuestsRead\(guests, guestsMeasured\)/);
  // The List's own "Invite N" and "Pick who" already ask it.
  const screen = read('app/dashboard/[eventId]/guests/_components/guests-screen.tsx');
  assert.match(screen, /\.filter\(\(g\): g is GuestRow => Boolean\(g\) && isToInvite\(g!\)\)/);
  // No surface spells the sent stamp or the couple's roles into a filter of its own.
  for (const [name, src] of [['Setup\'s panel', setup], ['the run page', page], ['Home', home]] as const) {
    assert.doesNotMatch(src, /!\s*\(?\s*g\.invitation_sent_at|\.filter\(\(g\) => g\.role !== 'bride' && g\.role !== 'groom'\)\s*\.filter/, `${name} decides who is to invite by a rule of its own`);
  }
});
