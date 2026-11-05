/**
 * the-cover-has-its-rsvp-button.test.ts — 📐 THE COVER: WORDS IN THE UPPER PART, AN RSVP BUTTON AND A "SWIPE UP" HINT AT
 * THE FOOT (owner 2026-10-16, DECISION_LOG of that name; verbatim: *"the cover sheet can focus the header on upper part of
 * the screen and the RSVP button and swipe up to view [the event] under it"* · *"Confirm Attendance is RSVP"*; approved
 * prototype `cover_scene_edit_animate_2026-10-16.html` v2).
 *
 *   (1) THE WORDS SIT IN THE UPPER PART — every design's header starts its column at the top (`COVER_SCENE_UPPER`:
 *       `justify-start` under ≈ 7 % of padding), never centred, never anchored at the foot; the foot is its last child.
 *   (2) THE RSVP BUTTON OPENS THE SHIPPED REPLY AND SHOWS THE THREE STATES — a real, framed `.button-primary` link to the
 *       reply door before an answer (the couple's words, default "Confirm attendance"); "You're coming ✓ · Change" /
 *       "You can't make it · Change" once answered; a shut window plain words, no link, no frame. `coverRsvpOf` reads
 *       the Reply card; the page hands a visitor without a key the reply door (which asks for the passcode first).
 *   (3) THE VEIL HIDES EVERY LINE, THE RSVP BUTTON AND THE HINT INCLUDED — both are cover lines.
 *   (4) THE HINT is "Swipe up for the event" (never "website"), not a part, and nods only where motion is allowed.
 *   (5) ONE DOORWAY — while the cover holds the button, the Welcome's own Reply card under it is not drawn again.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { COVER_LINE_ATTR, VEIL_HOLD_SCRIPT } from '@/lib/hub-veil';
import { COVER_SCENE_UPPER, COVER_SWIPE_HINT } from '@/lib/cover-scene';
import { COVER_RSVP_CLOSED, coverRsvpOf, type CoverRsvp } from '@/lib/cover-rsvp';
import { HUB_RSVP_DEFAULT_WORDS } from '@/lib/element-style';
import { replyCardOf } from '@/lib/guest-me-parts';
import { resolveArrivalAction } from '@/lib/arrival-action';
import { inviteReplyPath } from '@/lib/invite-arrival';

(globalThis as unknown as { React: unknown }).React = React;
const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const DESIGNS = ['card', 'marquee', 'crest', 'letter'] as const;
const CARD = { eyebrow: 'Together with their families', line: 'invite you to celebrate their wedding', timeLabel: 'Starts 2:30 PM', hubHref: '#hub', hubLabel: 'the day, the place' };
const REPLY = inviteReplyPath('maria-and-jose');

function header(html: string): string {
  const at = html.indexOf('<header data-pahina-first-screen=""');
  assert.ok(at >= 0, 'no masthead header in the render');
  return html.slice(at, html.indexOf('</header>', at) + '</header>'.length);
}
async function cover(props: Record<string, unknown>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PahinaMasthead } = await import('./pahina-masthead');
  return header(
    renderToStaticMarkup(
      React.createElement(PahinaMasthead, {
        displayName: 'Maria & Jose',
        eventDate: '2026-12-18',
        venueName: 'Manila Cathedral',
        monogramSlot: React.createElement('span', null, 'MJ'),
        ...props,
      } as never),
    ),
  );
}
const cardOf = (state: 'pending' | 'attending' | 'declined', window?: 'closed' | 'not_yet') =>
  replyCardOf({
    action: resolveArrivalAction({ slug: 'maria-and-jose', rsvpStatus: state, eventDate: '2026-12-12', today: '2026-10-14', hasPass: true }),
    replyBy: null,
    seats: 1,
    window: window === 'closed' ? { state: 'closed', reason: 'closed_by_couple', opensOn: null, closesOn: null } : window === 'not_yet' ? { state: 'not_yet', reason: 'opens_on_date', opensOn: '2026-11-14', closesOn: null } : undefined,
    organizer: 'the couple',
  });

test('(1) the words sit in the UPPER part on all four designs — never centred, the foot last', async () => {
  assert.match(COVER_SCENE_UPPER, /\bjustify-start\b/);
  assert.match(COVER_SCENE_UPPER, /pt-\[clamp\(36px,7svh,58px\)\]/, 'the column no longer starts under the ≈7 % top padding');
  for (const design of DESIGNS) {
    for (const withCard of [true, false]) {
      const html = await cover({ design, ...(withCard ? { card: CARD } : {}), rsvp: { kind: 'ask', href: REPLY } satisfies CoverRsvp });
      const open = /^<header[^>]*class="([^"]*)"/.exec(html)![1]!;
      const where = `${design}${withCard ? ' + card' : ''}`;
      assert.match(open, /\bjustify-start\b/, `${where}: the cover's words are not in the upper part`);
      assert.doesNotMatch(open, /\bjustify-(center|end)\b|sm:justify-center/, `${where}: the cover's words are centred or anchored at the foot`);
      assert.match(open, /pt-\[clamp\(36px,7svh,58px\)\]/, `${where}: no top padding — the words would touch the top`);
      const foot = html.lastIndexOf('<div data-cover-foot=""');
      assert.ok(foot > 0, `${where}: no foot`);
      assert.ok(html.indexOf('Maria') < foot, `${where}: the foot is not under the words`);
      assert.match(html.slice(foot), /^<div data-cover-foot=""[^>]*class="mt-auto[\s\S]*<\/div><\/header>$/, `${where}: the foot is not the last thing on the cover, pushed to the bottom`);
    }
  }
});

test('(2) the RSVP button opens the shipped reply, and shows the three states', async () => {
  // The states, from the Reply card the page already draws (the one action).
  assert.deepEqual(coverRsvpOf({ card: cardOf('pending') }), { kind: 'ask', href: REPLY });
  assert.deepEqual(coverRsvpOf({ card: cardOf('attending') }), { kind: 'going', href: REPLY });
  assert.deepEqual(coverRsvpOf({ card: cardOf('declined') }), { kind: 'declined', href: REPLY });
  assert.deepEqual(coverRsvpOf({ card: cardOf('pending', 'closed') }), { kind: 'closed', line: COVER_RSVP_CLOSED });
  assert.equal(coverRsvpOf({ card: cardOf('pending', 'not_yet') })?.kind, 'not_yet');
  assert.deepEqual(coverRsvpOf({ card: null, visitorHref: REPLY }), { kind: 'ask', href: REPLY }, 'a visitor is not handed the reply door (the passcode comes first there)');
  assert.equal(coverRsvpOf({ card: null }), null);

  const ask = await cover({ rsvp: coverRsvpOf({ card: cardOf('pending') }) });
  const a = /<a [^>]*data-cover-rsvp="ask"[^>]*>[\s\S]*?<\/a>/.exec(ask)?.[0] ?? '';
  assert.match(a, new RegExp(`href="${REPLY}"`), 'the button does not open the shipped reply');
  assert.match(a, /class="button-primary[^"]*min-h-11/, 'the button is not a real, framed, 44 px button (Look › Buttons)');
  assert.ok(a.includes(HUB_RSVP_DEFAULT_WORDS) && HUB_RSVP_DEFAULT_WORDS === 'Confirm attendance', 'the default words are not "Confirm attendance"');
  const own = await cover({ rsvp: coverRsvpOf({ card: cardOf('pending') }), elements: { rsvp: { word: 'Reply here' } } });
  assert.match(own, /data-cover-rsvp="ask"[\s\S]*Reply here/, 'the couple’s own words are not drawn');

  const going = await cover({ rsvp: coverRsvpOf({ card: cardOf('attending') }) });
  assert.match(going, /<a [^>]*data-cover-rsvp="going"[^>]*>[\s\S]*You’re coming[\s\S]*✓[\s\S]*Change[\s\S]*?<\/a>/, '"You’re coming ✓ · Change" is not drawn');
  const declined = await cover({ rsvp: coverRsvpOf({ card: cardOf('declined') }) });
  assert.match(declined, /<a [^>]*data-cover-rsvp="declined"[^>]*>[\s\S]*You can’t make it[\s\S]*Change[\s\S]*?<\/a>/, '"You can’t make it · Change" is not drawn');
  const closed = await cover({ rsvp: coverRsvpOf({ card: cardOf('pending', 'closed') }) });
  assert.match(closed, /<p [^>]*data-cover-rsvp="closed"[^>]*>Replies are closed<\/p>/, '"Replies are closed" is not plain words');
  assert.doesNotMatch(closed, /<a [^>]*data-cover-rsvp/, 'a shut window is still pressable');
  assert.doesNotMatch(closed, /data-cover-rsvp="closed"[^>]*button-primary/, 'a shut window still wears a frame');
  assert.doesNotMatch(await cover({ rsvp: null }), /data-cover-rsvp/, 'a page with no reply draws a button');
  const hidden = await cover({ rsvp: coverRsvpOf({ card: cardOf('pending') }), elements: { rsvp: { hidden: true } } });
  assert.match(hidden, /data-cover-rsvp="ask"[^>]*style="display:none"|style="display:none"[^>]*data-cover-rsvp="ask"/, 'a hidden RSVP button is still drawn for guests');

  // The page wires it: the guest's from the Reply card, the visitor's to the reply door; never on another stage.
  const body = stripComments(read('app/[slug]/_components/site-body.tsx'));
  // A visitor without a key: the stranger's ONE door stands IN the cover's foot, in the button's place (owner
  // 2026-10-17 — "Confirm your Booking", the passcode first) — never a second button beside it (owner 2026-09-26/27).
  // `the-cover-always-has-a-way-on.test.ts` holds the stranger's foot whole.
  // 🔁 2026-10-26 (owner: "make it go directly to the RSVP Page"): the button opens the Reply card's own door — the reply
  // page — never a stop at Me's Reply or the card under the cover.
  assert.match(body, /: coverRsvpOf\(\{ card: replyCard \}\);/, 'the guest’s button does not read their own Reply card');
  assert.equal((body.match(/foot=\{false\}/g) ?? []).length, 0, 'a cover draws no foot — its first screen ends in nothing');
  assert.equal((body.match(/door=\{footDoor\}/g) ?? []).length, 2, 'a stranger’s cover does not hold its door in the foot');
  assert.equal((body.match(/rsvp=\{guestRsvp\}/g) ?? []).length, 2, 'a guest’s cover has no button');
});

test('(3) the veil hides every line — the RSVP button and the hint included', async () => {
  for (const design of DESIGNS) {
    const html = await cover({ design, card: CARD, rsvp: coverRsvpOf({ card: cardOf('attending') }) });
    for (const sel of ['data-cover-rsvp="going"', 'data-cover-hint=""']) {
      const tag = new RegExp(`<\\w+ [^>]*${sel}[^>]*>`).exec(html)?.[0] ?? '';
      assert.match(tag, new RegExp(`${COVER_LINE_ATTR}="`), `${design}: ${sel} is not a cover line — it would show behind the veil`);
    }
    const outside = html
      .replace(new RegExp(`<(\\w+)[^>]*${COVER_LINE_ATTR}="\\w*"[^>]*>[\\s\\S]*?</\\1>`, 'g'), '')
      .replace(/<[^>]+>/g, '')
      .trim();
    assert.equal(outside, '', `${design}: words outside every cover line would show behind the veil: "${outside}"`);
  }
  assert.match(VEIL_HOLD_SCRIPT, new RegExp(`\\[${COVER_LINE_ATTR}\\]\\{opacity:0 !important\\}`), 'the hold no longer hides the cover’s lines');
});

test('(4) the hint says "Swipe up for the event", is no part, and nods only where motion is allowed', async () => {
  assert.equal(COVER_SWIPE_HINT, 'Swipe up for the event');
  const html = await cover({ rsvp: null, stampElements: true });
  const hint = /<p [^>]*data-cover-hint=""[^>]*>[\s\S]*?<\/p>/.exec(html)?.[0] ?? '';
  assert.ok(hint.includes(COVER_SWIPE_HINT), 'the hint is not drawn on a cover with no reply');
  assert.match(hint, /aria-hidden="true"/);
  assert.doesNotMatch(hint, /data-el=/, 'the hint became a part');
  assert.match(hint, /animate-\[cover-hint-nod[^"]*motion-reduce:animate-none/, 'the chevron nods under reduced motion');
  assert.doesNotMatch(html, /website/i, 'the cover says "website"');
  assert.match(read('app/globals.css'), /@keyframes cover-hint-nod/);
});

test('(5) the page keeps its RSVP part — the Welcome’s Reply card under the cover, or Me’s Reply (owner 2026-10-17 · 10-24)', () => {
  // Owner, on live cale-ice 2026-10-17: "it is not going to the RSVP part?" — the card is the RSVP part again. Since
  // 2026-10-26 the cover's button goes straight to the reply page (`the-cover-rsvp-reaches-its-action.test.ts`); the part
  // stays, for a reader who scrolls or goes to Me.
  const body = stripComments(read('app/[slug]/_components/site-body.tsx'));
  assert.doesNotMatch(body, /coverHoldsReply/, 'the Reply card is hidden again under a cover that holds the button — the button would lead nowhere');
  // 🔁 RE-AIMED 2026-10-24 (owner, approving the Me redraw: "we want 1 place for everything"): on a TABBED page the RSVP
  // part is Me's one Reply (`MeReply`, `#me-reply`) and the Welcome draws no card; a page that is one scroll keeps the
  // card under the cover as its RSVP part. `me-is-the-one-place.test.ts` holds the tabbed page whole.
  assert.match(body, /\{replyCard && tabs\.on \? \([\s\S]{0,300}?null\s*\) : replyCard \? \(\s*<ReplyCardRow card=\{replyCard\} partId=\{COVER_RSVP_PART\}/, 'the Reply card is not the page’s RSVP part');
  assert.match(read('app/[slug]/_components/guest-greeting.tsx'), /export const ME_REPLY_ID = 'me-reply'/, 'Me’s Reply has no id');
});
