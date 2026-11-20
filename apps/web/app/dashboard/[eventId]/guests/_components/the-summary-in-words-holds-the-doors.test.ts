/**
 * the-summary-in-words-holds-the-doors.test.ts — Guests › List's ONE SUMMARY, IN WORDS (owner 20 Nov 2026, Guests
 * redesign §1, "Yes, your picks" → "Yes, build it"; drawing `prototypes/guests_redesign_2026-11-20/`). It replaces the
 * 27 Oct summary carousel (this file was `the-summary-carousel-holds-the-doors.test.ts`) and keeps every door it held:
 *   · "N guests ⓘ" — the total, counted off the drawn list;
 *   · "Send N invites" — the ONE send run (`/guests/send`), only while someone is still to invite; words otherwise;
 *   · a thin bar — coming · no reply · can't come, each its share;
 *   · "N coming · N can't come · N no reply" — each word the door to exactly those guests (`data-reply-filter`);
 *   · "+1s · N named · N no name yet" and "N asking to join ›" — one extra line, only when there are any.
 * A refused read draws none of it (guests-read-is-honest).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guestRow, renderGuestsScreen } from './render-guests-screen';
import { plusOneTally, rosterStats } from '@/lib/guest-roster-view';
import type { GuestRow } from '@/lib/guests';

/** The inside of the first `<div>` carrying `attr` (balanced on `<div`), or null when none was drawn. */
function div(html: string, attr: string): string | null {
  const hit = html.indexOf(attr);
  if (hit < 0) return null;
  const open = html.indexOf('>', hit) + 1;
  const tag = /<div\b|<\/div>/g;
  tag.lastIndex = open;
  let depth = 1;
  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0) return html.slice(open, m.index);
  }
  return null;
}
const words = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

const GUESTS: GuestRow[] = [
  guestRow({ role: 'bride', rsvp_status: 'attending' }),
  guestRow({ role: 'groom', rsvp_status: 'attending' }),
  guestRow({ guest_id: 'host1', rsvp_status: 'attending', plus_one_count: 2 }),
  guestRow({ rsvp_status: 'attending' }),
  guestRow({ rsvp_status: 'declined' }),
  guestRow({ invitation_sent_at: null }),
  guestRow({ invitation_sent_at: null }),
  guestRow(),
  // Two +1 seats of host1: one named, one with no name yet.
  guestRow({ first_name: 'Paulo', plus_one_of_guest_id: 'host1', rsvp_status: 'attending' } as Partial<GuestRow>),
  guestRow({ first_name: 'TBA', last_name: '', plus_one_of_guest_id: 'host1', rsvp_status: 'attending' } as Partial<GuestRow>),
];

test('one summary: the total, Send N invites, the bar, the three reply words — each word a door, nothing twice', async () => {
  const html = await renderGuestsScreen({ guests: GUESTS, requests: 3 });
  const sum = div(html, 'data-guests-summary=""');
  assert.ok(sum, 'no summary drawn for a measured list');
  assert.doesNotMatch(html, /data-snap-carousel|data-guests-carousel/, 'the carousel is back');
  const stats = rosterStats(GUESTS);
  assert.match(sum!, new RegExp(`data-count="gs-total"[^>]*>${stats.total}<`), 'the total is not the list’s own');
  assert.match(words(sum!), new RegExp(`^${stats.total} guests`), 'the summary does not open on "N guests"');
  for (const [f, n, w] of [['attending', stats.yes, 'coming'], ['declined', stats.no, 'can’t come'], ['none', stats.none, 'no reply']] as const) {
    const m = new RegExp(`<button[^>]*data-reply-filter="${f}"[^>]*>([\\s\\S]*?)</button>`).exec(sum!);
    assert.ok(m, `"${w}" is not a door`);
    assert.equal(words(m![1]!), `${n} ${w}`);
    assert.equal(count(html, new RegExp(`data-reply-filter="${f}"`, 'g')), 1, `"${w}" is drawn twice`);
  }
  assert.equal(count(sum!, /data-replied-bar=""/g), 1, 'the bar is missing (or doubled)');
});

test('Send N invites is the one send run, only while someone is still to invite; words when nobody is left', async () => {
  const html = await renderGuestsScreen({ guests: GUESTS });
  const sum = div(html, 'data-guests-summary=""')!;
  const n = rosterStats(GUESTS).toInvite;
  assert.ok(n > 0, 'the fixture has nobody to invite — the door is untested');
  const door = /<a\b[^>]*data-roster-to-invite="door"[^>]*>([\s\S]*?)<\/a>/.exec(sum);
  assert.ok(door, 'no "Send N invites"');
  assert.match(door![0], /href="\/dashboard\/e1\/guests\/send"/, 'Send N invites is not the send run');
  assert.equal(words(door![1]!), `Send ${n} invites`);
  const done = await renderGuestsScreen({ guests: [guestRow({ role: 'bride', rsvp_status: 'attending' }), guestRow({ rsvp_status: 'attending' })] });
  const doneSum = div(done, 'data-guests-summary=""')!;
  assert.doesNotMatch(doneSum, /guests\/send/, 'a link to the send run with nobody to send to');
});

test('the extra line: +1s and asking to join, only when there are any', async () => {
  const html = await renderGuestsScreen({ guests: GUESTS, requests: 3 });
  const extra = div(html, 'data-roster-extra=""');
  assert.ok(extra, 'no extra line with +1s and requests waiting');
  const t = plusOneTally(GUESTS);
  assert.match(words(extra!), new RegExp(`^\\+1s · ${t.named} named · ${t.unnamed} no name yet`), 'the line does not say "+1s · N named · N no name yet"');
  assert.match(extra!, /data-plus-filter="named"/);
  assert.match(extra!, /data-plus-filter="unnamed"/);
  assert.match(extra!, /<a\b(?=[^>]*data-requests-door="")[^>]*href="\/dashboard\/e1\/guests\/claims"/, 'asking to join is not a door to the requests');
  assert.match(words(extra!), /3 asking to join/);
  const plain = await renderGuestsScreen({ guests: [guestRow({ role: 'bride', rsvp_status: 'attending' }), guestRow()], requests: 0 });
  assert.equal(div(plain, 'data-roster-extra=""'), null, 'the extra line is drawn with nothing to say');
});

test('a refused read draws no summary at all', async () => {
  const html = await renderGuestsScreen({ guests: [], measured: false });
  assert.equal(div(html, 'data-guests-summary=""'), null, 'an unmeasured read printed a summary');
  assert.doesNotMatch(html, /data-reply-filter=/, 'an unmeasured read drew a count door');
});
