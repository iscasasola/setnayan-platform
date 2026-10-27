/**
 * counts-equal-the-rows.test.ts — "List N" AND "N attending" EQUAL THE ROWS
 * DRAWN BELOW THEM (controller, measured on the combined preview 2026-10-07:
 * maria-and-jose read "List 0 · 0 attending · 0% replied" above rows that said
 * "Maria Santos ✓ Attending" — a real figure rendered as a zero).
 *
 * Two causes, both held here:
 *   1. ONE SOURCE. The counts come from `rosterStats(roster)` — the very list
 *      `rosterSections` draws the rows from — never a second read.
 *   2. A FIGURE NEVER STICKS ON ITS START. `Count` / `Fill` showed `from` (0 on
 *      load) BEFORE the first animation frame; a document-hidden page (a
 *      background tab, a preview pane) never runs that frame, so 0 stayed.
 *      Now `from` is shown only by a frame, and a hidden page gets the value.
 *
 * SABOTAGE (seen red): put `setDisplay(from);` back before the timer.
 *
 * 🚪 "N TO INVITE" IS A DOOR (controller, measured on the preview 2026-10-08:
 * maria-and-jose's List read "30 to invite" as plain text — from the tab people
 * land on there was no way to start sending). The last three tests DRAW the real
 * screen and the real Setup rows:
 *   · N > 0 → the count and its words are ONE link into the send run;
 *   · N = 0 → plain words, no link (never a dead door);
 *   · a refused read → no counts line at all (never "0 to invite");
 *   · the List's door and Setup's "Send to N" open the SAME place.
 * SABOTAGE (each seen red): draw the plain span for every N · point the List's
 * link at `/guests/invite` · drop the `measured` gate around the counts line.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import type { GuestRow } from '@/lib/guests';
import { rosterSections, rosterStats, type RosterFacts, hasNotAnswered } from '@/lib/guest-roster-view';
import { guestRow, renderGuestsScreen } from './render-guests-screen';
import { renderSetup } from '../../_components/guest-setup/render-setup';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCREEN = stripComments(readFileSync(join(HERE, 'guests-screen.tsx'), 'utf8'));
const COUNT = stripComments(readFileSync(join(HERE, '..', '..', '..', '..', '..', 'components', 'count.tsx'), 'utf8'));

const g = (id: string, p: Partial<GuestRow>): GuestRow =>
  ({ guest_id: id, first_name: id, last_name: 'X', role: 'guest', side: 'bride', rsvp_status: 'pending', extra_roles: [], invitation_sent_at: '2026-09-01', entry_source: null, passed_away: false, ...p }) as GuestRow;

// maria-and-jose's shape: the couple attending, sponsors, guests.
const ROSTER: GuestRow[] = [
  g('maria', { role: 'bride', rsvp_status: 'attending' }),
  g('jose', { role: 'groom', side: 'groom', rsvp_status: 'attending' }),
  g('ninong', { role: 'principal_sponsor_ninong', rsvp_status: 'attending' }),
  g('ana', { rsvp_status: 'declined' }),
  g('ben', { rsvp_status: 'pending' }),
  g('cita', { rsvp_status: 'pending', invitation_sent_at: null }),
  g('dan', { rsvp_status: 'maybe' }),
];
const facts: RosterFacts = { hasSides: true, groupsOf: () => [], tableOf: () => null };

test('the List count and the attending count equal the rendered rows (executed)', () => {
  const rows = rosterSections(ROSTER, 'role', facts).flatMap((s) => s.guests);
  const stats = rosterStats(ROSTER);
  assert.equal(stats.total, rows.length, 'List N is not the number of rows drawn');
  assert.equal(stats.yes, rows.filter((r) => r.rsvp_status === 'attending').length, 'N attending is not the attending rows');
  assert.equal(stats.yes, 3);
  // The replies partition everyone; "to invite" OVERLAPS "no reply" (owner 2026-10-07: no reply =
  // every guest who has not answered, invited or not), so it is not part of the sum.
  assert.equal(
    stats.no + stats.none + stats.yes + rows.filter((r) => r.rsvp_status === 'maybe').length + rows.filter((r) => r.rsvp_status === 'pending' && !hasNotAnswered(r)).length,
    rows.length,
  );
  assert.ok(stats.total > 0 && stats.yes > 0, 'a fixture with attending rows counts zero');
});

test('the screen reads its counts off the same list as its rows', () => {
  assert.match(SCREEN, /const stats = rosterStats\(roster\);/);
  // (A search's hits may bring their +1s with them — `withTheirPlusOnes`, still over the same `roster`.)
  // (…and the count doors' filters narrow THAT same list — `found`, never a second read.)
  assert.match(SCREEN, /const visible = useMemo\(\s*\(\) => \(q \? (withTheirPlusOnes\(q, )?roster\.filter\([^;]*\), roster\)|const visible = useMemo\(\(\) => \(q \? roster\.filter|const visible = useMemo\(\(\) => \{\s*const found = q \? withTheirPlusOnes\(q, roster\.filter\([^;]*\), roster\) : roster;/, 'the rows are not drawn from the same `roster`');
  assert.match(SCREEN, /\{measured \? \(/, 'an unmeasured read prints counts instead of saying nothing');
});

test('Count and Fill never sit on their start value when no frame runs', () => {
  const engine = COUNT.slice(COUNT.indexOf('export function useCountTo('), COUNT.indexOf('export type CountFormat'));
  const timerAt = engine.indexOf('const timer = window.setTimeout(');
  assert.ok(timerAt > 0, 'the count engine moved — re-aim');
  assert.doesNotMatch(engine.slice(0, timerAt), /setDisplay\(from\)/, '`from` is shown before a frame has run — a hidden page keeps it');
  assert.match(engine, /document\.visibilityState === 'hidden'/, 'a hidden page animates (and never finishes) instead of showing the value');
  const fill = COUNT.slice(COUNT.indexOf('export function Fill('));
  assert.match(fill, /document\.visibilityState === 'hidden'/, 'a hidden page leaves the bar at its start');
});

/* ─── "N to invite" is a door ───────────────────────────────────────────── */

/** The counts strip as drawn (its whole element — the strip nests its own divs since option A, 2026-10-26), or null
 *  when the screen drew none. Balanced on `<div`/`</div>`, so a nested block can never end it early. */
function countsLine(html: string): string | null {
  const at = html.search(/<div[^>]*data-roster-counts=""/);
  if (at < 0) return null;
  const open = html.indexOf('>', at) + 1;
  const tag = /<div\b|<\/div>/g;
  tag.lastIndex = open;
  let depth = 1;
  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0) return html.slice(open, m.index);
  }
  return null;
}
/** The link whose text is "Invite N" (option A's button; it read "N to invite" before), if the strip draws one. */
function toInviteDoor(line: string): { href: string; words: string } | null {
  for (const a of line.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
    const words = a[2]!.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (/^Invite [\d,]+$/.test(words)) return { href: a[1]!.match(/href="([^"]*)"/)?.[1] ?? '', words };
  }
  return null;
}
const plain = (line: string) => line.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');

test('"N to invite" on the List is a door into the send run when N > 0 (rendered)', async () => {
  const guests = [
    guestRow({ role: 'bride', rsvp_status: 'attending' }),
    guestRow({ role: 'groom', rsvp_status: 'attending' }),
    guestRow({ invitation_sent_at: null }),
    guestRow({ invitation_sent_at: null }),
    guestRow({ rsvp_status: 'attending' }),
  ];
  assert.equal(rosterStats(guests).toInvite, 2, 'the fixture moved — two guests are still to invite');
  for (const gview of ['list', 'map'] as const) { // ⚙ 'share' is Guests ⚙ now, not a view (2026-10-27)
    const line = countsLine(await renderGuestsScreen({ guests, gview }));
    assert.ok(line, `Guests › ${gview} drew no counts line for a measured list`);
    const door = toInviteDoor(line);
    assert.ok(door, `Guests › ${gview}: "Invite 2" is not a link — there is no door to sending from here`);
    assert.equal(door.words, 'Invite 2', 'the door\'s number is not the counts line\'s own');
    assert.equal(door.href, '/dashboard/e1/guests/send');
  }
});

test('with nobody to invite it is plain words, and a refused read draws no count at all (rendered)', async () => {
  const invited = [guestRow({ role: 'bride', rsvp_status: 'attending' }), guestRow({ rsvp_status: 'attending' }), guestRow()];
  assert.equal(rosterStats(invited).toInvite, 0);
  const line = countsLine(await renderGuestsScreen({ guests: invited }));
  assert.ok(line, 'a measured list with everyone invited drew no counts line');
  assert.match(plain(line), /Everyone invited/, 'the words changed');
  assert.equal(toInviteDoor(line), null, '"Invite 0" is a link — a dead door');
  assert.doesNotMatch(line, /guests\/send/, 'the counts line links to the send run with nobody to send to');

  // A REFUSED read: the rows are unknown, not empty — no "0 to invite", no door, no counts.
  const refused = await renderGuestsScreen({ guests: [], measured: false });
  assert.equal(countsLine(refused), null, 'an unmeasured read printed a counts line');
  assert.doesNotMatch(plain(refused), /to invite|Invite \d|Everyone invited/, 'an unmeasured read says something about who is left to invite');
});

test('the List\'s door and Setup\'s "Send to N" open the same place (both rendered)', async () => {
  const line = countsLine(await renderGuestsScreen({ guests: [guestRow({ invitation_sent_at: null })] }));
  const list = line ? toInviteDoor(line) : null;
  assert.ok(list, 'the List drew no door');
  const setup = (await renderSetup({ getIn: 'list' })).match(/<a\b[^>]*data-testid="setup-send"[^>]*>/)?.[0].match(/href="([^"]*)"/)?.[1];
  assert.ok(setup, 'Setup\'s "Send to N" is gone or is no longer a link — re-aim');
  assert.equal(list.href, setup, 'the List and Setup start sending from two different places');
  assert.match(list.href, /^\/dashboard\/e1\/guests\/send$/, 'the door carries its own rules (a query) instead of opening the one run');
});
