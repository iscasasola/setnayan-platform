/**
 * the-counts-strip-is-option-a.test.ts — 🧮 THE COUNTS STRIP IS THE APPROVED OPTION A.
 *
 * Owner, 2026-10-26: "option A" — prototype `guest-counts/index.html`, frames a-390 · a-1280. Same numbers, same doors,
 * same hrefs; the layout is: "Replies ⓘ · N% replied" · the two-colour bar · THREE big counts, each still the door to
 * its filter · the +1s line · ONE action, "Invite N ›", with "⤓ Excel" beside it.
 *
 * Held on the RENDERED screen (the shipped component, server-rendered with the guest-list harness), never on source
 * words: a reword of a comment cannot turn this red, and a strip that stops drawing the shape cannot stay green.
 *
 * 🛡 SABOTAGE (seen RED, then restored — 2026-10-26, see the PR body): the Invite link's `href` pointed at
 * `/guests?gview=share` instead of `/guests/send`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guestRow, renderGuestsScreen } from './render-guests-screen';
import { rosterStats } from '@/lib/guest-roster-view';

/** The inside of the first `<div>` carrying `attr` (balanced on `<div`), or null when none was drawn. */
function div(html: string, attr: string): string | null {
  const hit = html.indexOf(attr);
  if (hit < 0) return null;
  const at = html.lastIndexOf('<div', hit);
  if (at < 0) return null;
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
const strip = (html: string) => div(html, 'data-roster-counts=""');
const words = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const GUESTS = [
  guestRow({ role: 'bride', rsvp_status: 'attending' }),
  guestRow({ role: 'groom', rsvp_status: 'attending' }),
  guestRow({ rsvp_status: 'attending' }),
  guestRow({ rsvp_status: 'declined' }),
  guestRow({ invitation_sent_at: null }),
  guestRow({ invitation_sent_at: null }),
  guestRow(),
];

test('the strip is option A: Replies ⓘ, the bar, three count doors, Invite N → /guests/send, Excel → /guests/export', async () => {
  const stats = rosterStats(GUESTS);
  assert.ok(stats.toInvite === 2 && stats.yes > 0 && stats.no > 0 && stats.none > 0, 'the fixture moved — re-aim');
  const s = strip(await renderGuestsScreen({ guests: GUESTS }));
  assert.ok(s, 'a measured list drew no counts strip');

  // Title row: "Replies" carries the app's one ⓘ (InfoTip prints its label and a button named "About Replies").
  assert.match(s, /aria-label="About Replies"/, 'the "Replies" ⓘ is gone');
  assert.match(words(s), /^Replies\b/, 'the strip does not open with "Replies"');
  assert.match(words(s), /\d+% replied/, 'the "N% replied" is gone');

  // The bar: two fills — attending then not coming — inside the one replied meter.
  const meter = div(s, 'data-replied-meter=""');
  assert.ok(meter, 'the replied meter is gone');
  const fills = [...meter.matchAll(/data-fill="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(fills, ['gs-meter-yes', 'gs-meter-no'], 'the bar is not attending-then-not-coming');

  // Three big counts — each a door to its own filter, in this order, holding its number and its word.
  const doors = [...s.matchAll(/<button[^>]*data-reply-filter="([a-z]+)"[^>]*>([\s\S]*?)<\/button>/g)];
  assert.deepEqual(doors.map((d) => d[1]), ['attending', 'declined', 'none'], 'the three counts are not the three doors');
  assert.deepEqual(
    doors.map((d) => words(d[2]!)),
    [`${stats.yes} Attending`, `${stats.no} Not coming`, `${stats.none} No reply`],
  );
  for (const d of doors) assert.match(d[0], /aria-pressed="false"/, 'a count door lost its pressed state');

  // ONE action: "Invite N ›" — the app's filled brand pill — to the one send run.
  const invite = /<a\b([^>]*data-roster-to-invite="door"[^>]*)>([\s\S]*?)<\/a>/.exec(s);
  assert.ok(invite, 'the Invite button is gone');
  assert.match(invite[1]!, /href="\/dashboard\/e1\/guests\/send"/, 'Invite does not open the send run');
  assert.match(invite[1]!, /class="[^"]*\bab\b[^"]*\bab-brand\b[^"]*\bab-main\b/, 'Invite is not the filled brand pill');
  assert.equal(words(invite[2]!), `Invite ${stats.toInvite}`);

  // "⤓ Excel": the outlined pill beside it, a download of the list.
  const excel = /<a\b([^>]*data-guests-export=""[^>]*)>([\s\S]*?)<\/a>/.exec(s);
  assert.ok(excel, 'the Excel button is gone');
  assert.match(excel[1]!, /href="\/dashboard\/e1\/guests\/export"/, 'Excel does not download the list');
  assert.match(excel[1]!, /\bdownload\b/, 'Excel is not a download');
  assert.match(excel[1]!, /class="[^"]*\bab\b[^"]*\bab-neutral\b/, 'Excel is not the outlined pill');
  assert.equal(words(excel[2]!), 'Excel');
  assert.ok(s.indexOf('data-roster-to-invite="door"') < s.indexOf('data-guests-export'), 'Excel sits before Invite');
});

test('nobody left to invite: no button and no dead link — and a list of just the couple claims nothing', async () => {
  const invited = [guestRow({ role: 'bride', rsvp_status: 'attending' }), guestRow({ rsvp_status: 'attending' }), guestRow()];
  const s = strip(await renderGuestsScreen({ guests: invited }));
  assert.ok(s);
  assert.doesNotMatch(s, /guests\/send/, 'a link to the send run with nobody to send to');
  assert.match(s, /data-roster-to-invite="words"[^>]*>[\s\S]*?Everyone invited/, 'everyone invited, and the strip does not say so');

  const couple = strip(await renderGuestsScreen({ guests: [guestRow({ role: 'bride' }), guestRow({ role: 'groom' })] }));
  assert.ok(couple);
  assert.doesNotMatch(couple, /data-roster-to-invite|Everyone invited/, 'a list of just the couple says everyone is invited');
});
