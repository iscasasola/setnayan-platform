/**
 * the-summary-carousel-holds-the-doors.test.ts — 🎠 THE GUESTS SUMMARY IS THE APPROVED CAROUSEL, STYLE A (THE RING).
 *
 * Owner, 2026-10-27 (DECISION_LOG "APPROVED — GUESTS CAROUSEL STYLE A (THE RING), COMPACT", verbatim *"ring looks
 * good."*; prototype `prototypes/guests_summary_carousel_2026-10-27/`, frames rest · oneqr · attention): the counts strip
 * ("option A", 2026-10-26) and the "N requests to join · Review" strip fold into ONE carousel of three grouped cards —
 *   ① Total guests: the ring (attending · not coming as shares of the whole), "N% replied", "● N requests to join ›" or
 *      "No requests waiting"; the WHOLE card opens the Requests page;
 *   ② Attending · Not coming · No reply · To invite — four counts, each the door to exactly its filter — and
 *      `Invite N ›`, the ONE send run (`/guests/send`); "Everyone invited" when nobody is left; on a one-link event with no
 *      list to walk, "One link for everyone · Share";
 *   ③ +1s · named / no name yet — a two-part bar, each half the door to its filter; no card at all with no +1s;
 *   and every card carries its ⓘ in the same spot (DECISION_LOG "EVERY THUMB ROW IS FROSTED GLASS…", last sentence).
 * It replaces `the-counts-strip-is-option-a.test.ts` and holds the SAME doors: the same filters, counts and hrefs.
 *
 * Held on the RENDERED screen (the shipped component, server-rendered with the guest-list harness), never on source
 * words. The server's HTML holds each card ONCE (the loop's copies are added after hydration — `snap-carousel.tsx`), so
 * every door here is counted exactly.
 *
 * 🛡 SABOTAGE (seen RED, then restored — 2026-10-28, see the PR body): the Invite link's `href` → `/guests?gview=share`;
 * the To invite door's filter key → 'none'; card ①'s door → `/access-requests`; the ⓘ dropped from card ③.
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

test('the carousel draws three cards in order, each ONCE, each with its ⓘ in the same spot', async () => {
  const html = await renderGuestsScreen({ guests: GUESTS, requests: 3 });
  const c = div(html, 'data-roster-counts=""');
  assert.ok(c, 'a measured list drew no summary');
  assert.match(c, /data-snap-carousel=""/, 'the summary is not the shared carousel');
  const cards = [...c.matchAll(/data-guests-card="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(cards, ['total', 'replies', 'plus'], 'the three cards are not ① total · ② replies · ③ +1s, each once');
  assert.equal(count(c, /data-snap-copy/g), 0, 'the server drew loop copies — every door would be in the page twice');
  for (const k of cards) {
    const card = div(c, `data-guests-card="${k}"`)!;
    // The ⓘ is the app's one InfoTip (a button "About …"), the card's LAST child — positioned top-right by `.cardTip`.
    assert.match(card, /<span class="[^"]*\bcardTip\b[^"]*"[^>]*>(?:(?!data-guests-card).)*aria-label="About [^"]+"/s, `card ${k} has no ⓘ`);
    assert.equal(count(card, /aria-label="About /g), 1, `card ${k} has more than one ⓘ`);
  }
});

test('① Total guests: the ring, "% replied", the requests line — and the WHOLE card opens the Requests page', async () => {
  const stats = rosterStats(GUESTS);
  const html = await renderGuestsScreen({ guests: GUESTS, requests: 3 });
  const card = div(html, 'data-guests-card="total"')!;
  assert.ok(card, 'no Total guests card');
  // The ring's arcs are the shares of the whole: attending, then not coming after it.
  const style = /data-guests-card="total"[^>]*style="([^"]*)"/.exec(html)?.[1] ?? '';
  const yes = Number(/--gs-yes:\s*([\d.]+)/.exec(style)?.[1]);
  const no = Number(/--gs-no:\s*([\d.]+)/.exec(style)?.[1]);
  assert.ok(Math.abs(yes - (stats.yes / stats.total) * 100) < 0.01, `the green arc is ${yes}, not attending's share`);
  assert.ok(Math.abs(no - (stats.no / stats.total) * 100) < 0.01, `the red arc is ${no}, not not-coming's share`);
  assert.deepEqual([...card.matchAll(/data-arc="(\w+)"/g)].map((m) => m[1]), ['yes', 'no']);
  const replied = Math.round(((stats.yes + stats.no) / stats.total) * 100);
  assert.match(words(card), new RegExp(`^${stats.total} Total guests ${replied}% replied 3 requests to join\\b`));
  // ONE door: a link over the card to the page the old "Review" strip opened (the requests the count counts).
  const doors = [...card.matchAll(/<a\b([^>]*)>/g)];
  assert.equal(doors.length, 1, 'card ① is not ONE door');
  assert.match(doors[0]![1]!, /href="\/dashboard\/e1\/guests\/claims"/, 'card ① does not open the Requests page');
  assert.match(doors[0]![1]!, /data-requests-door=""/);
  const totalTag = (h: string) => /<div\b[^>]*data-guests-card="total"[^>]*>/.exec(h)?.[0] ?? '';
  assert.match(totalTag(html), /class="[^"]*\bcardAttn\b/, 'waiting requests do not mark the card');

  const calmHtml = await renderGuestsScreen({ guests: GUESTS, requests: 0 });
  const calm = div(calmHtml, 'data-guests-card="total"')!;
  assert.match(words(calm), /No requests waiting/, 'no requests, and the card does not say so');
  assert.doesNotMatch(calm, /data-requests-waiting/);
  assert.doesNotMatch(totalTag(calmHtml), /cardAttn/);
  // The old strip above the list is gone — card ① is the one place.
  assert.doesNotMatch(await renderGuestsScreen({ guests: GUESTS, requests: 3 }), /data-requests-strip/);
});

test('② the four counts are the four doors; Invite N › is the ONE send run', async () => {
  const stats = rosterStats(GUESTS);
  assert.ok(stats.toInvite === 2 && stats.yes > 0 && stats.no > 0 && stats.none > 0, 'the fixture moved — re-aim');
  const card = div(await renderGuestsScreen({ guests: GUESTS }), 'data-guests-card="replies"')!;
  const doors = [...card.matchAll(/<button[^>]*data-reply-filter="([a-z]+)"[^>]*>([\s\S]*?)<\/button>/g)];
  assert.deepEqual(doors.map((d) => d[1]), ['attending', 'declined', 'none', 'toinvite'], 'the four counts are not the four doors');
  assert.deepEqual(
    doors.map((d) => words(d[2]!)),
    [`${stats.yes} Attending`, `${stats.no} Not coming`, `${stats.none} No reply`, `${stats.toInvite} To invite`],
  );
  for (const d of doors) assert.match(d[0], /aria-pressed="false"/, 'a count door lost its pressed state');
  const invite = /<a\b([^>]*data-roster-to-invite="door"[^>]*)>([\s\S]*?)<\/a>/.exec(card);
  assert.ok(invite, 'the Invite button is gone');
  assert.match(invite[1]!, /href="\/dashboard\/e1\/guests\/send"/, 'Invite does not open the send run');
  assert.match(invite[1]!, /class="[^"]*\bab\b[^"]*\bab-brand\b[^"]*\bab-main\b/, 'Invite is not the filled brand pill');
  assert.equal(words(invite[2]!), `Invite ${stats.toInvite}`);
  assert.equal(count(card, /<a\b/g), 1, 'card ② holds another link besides Invite');
});

test('② nobody left: "Everyone invited", no dead link — a list of just the couple claims nothing — one link: Share', async () => {
  const invited = [guestRow({ role: 'bride', rsvp_status: 'attending' }), guestRow({ rsvp_status: 'attending' }), guestRow()];
  const s = div(await renderGuestsScreen({ guests: invited }), 'data-guests-card="replies"')!;
  assert.doesNotMatch(s, /guests\/send/, 'a link to the send run with nobody to send to');
  assert.match(s, /data-roster-to-invite="words"[^>]*>[\s\S]*?Everyone invited/, 'everyone invited, and the card does not say so');

  const couple = [guestRow({ role: 'bride' }), guestRow({ role: 'groom' })];
  const c = div(await renderGuestsScreen({ guests: couple }), 'data-guests-card="replies"')!;
  assert.doesNotMatch(c, /data-roster-to-invite|Everyone invited|One link/, 'a list of just the couple says everyone is invited');

  // A one-link event with no list to walk: "One link for everyone · Share" — Share is the couple's (it opens their ⚙
  // sheet on "Your one link"); a viewer without the settings sees the words only.
  const one = div(await renderGuestsScreen({ guests: couple, oneQr: true, setup: 'rows' }), 'data-guests-card="replies"')!;
  assert.match(one, /data-roster-to-invite="one-link"[^>]*>\s*One link for everyone/);
  assert.match(one, /<button[^>]*data-roster-share-link=""[^>]*>[\s\S]*?Share<\/span><\/button>/, 'no Share on a one-link event');
  const viewer = div(await renderGuestsScreen({ guests: couple, oneQr: true }), 'data-guests-card="replies"')!;
  assert.doesNotMatch(viewer, /data-roster-share-link/, 'Share drawn for a viewer who has no settings sheet');
  // With a list to walk, the run is the door even on a one-link event ("THE SEND RUN ALSO SERVES A ONE-QR EVENT").
  const walk = div(await renderGuestsScreen({ guests: GUESTS, oneQr: true, setup: 'rows' }), 'data-guests-card="replies"')!;
  assert.match(walk, /data-roster-to-invite="door"/);
  assert.doesNotMatch(walk, /One link for everyone/);
});

test('③ +1s: the two halves are the two +1 doors, each holding its number — and no card with no +1s', async () => {
  const t = plusOneTally(GUESTS);
  assert.ok(t.named > 0 && t.unnamed > 0, 'the fixture moved — re-aim');
  const card = div(await renderGuestsScreen({ guests: GUESTS }), 'data-guests-card="plus"')!;
  assert.match(card, /data-roster-plus-ones=""[^>]*>\s*\+1s ·/, 'the card does not say "+1s ·"');
  const halves = [...card.matchAll(/<button[^>]*data-plus-filter="(\w+)"[^>]*>([\s\S]*?)<\/button>/g)];
  assert.deepEqual(halves.map((h) => h[1]), ['named', 'unnamed']);
  assert.deepEqual(halves.map((h) => words(h[2]!)), [`${t.named} named`, `${t.unnamed} no name yet`]);
  for (const h of halves) assert.match(h[0], /data-half="\w+"/, 'a +1 door is not a half of the bar');
  const none = await renderGuestsScreen({ guests: [guestRow({ first_name: 'Ana' }), guestRow({ first_name: 'Bert' })] });
  assert.doesNotMatch(none, /data-guests-card="plus"|data-plus-filter/, 'a list with no +1s draws a +1 card');
});
