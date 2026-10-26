/**
 * 🎟 THE THANK-YOU AFTER A YES STARTS WITH ITS HEADING — no mark, no names above it.
 *
 * Owner 2026-10-26, verbatim: *"On you're on the list part of the RSVP since the ticket has the logo alread and Event
 * Name, Just start with your on the list"*. The page after a reply (`invite/enter/page.tsx`) is a door (`DoorShell` +
 * `hubDoorSkin`): its top drew the couple's mark and their names, and the full ticket right under the heading draws
 * both again. After a Yes, with that ticket drawn, the top stands down (`landingTopStandsDown`, `DoorShell quietTop`).
 *
 *   1. THE RULE — only a Yes with the full ticket; a No ("We'll miss you.", no ticket) keeps the mark and the names,
 *      and so does everything before a reply.
 *   2. THE DOOR, RENDERED — with `quietTop`, the card draws no mark and no visible names: the first thing drawn in it is
 *      the heading the page hands it; the names stay the page's <h1> for a screen reader. Without it, as before.
 *   3. THE PAGE — the after-reply door passes the rule's answer, the "before a reply" door never does, and the couple's
 *      invitation line under the names goes with the names (a "You're in!" arrival keeps its own line).
 *
 * `invite/enter/page.tsx` reads the database, so no test renders it whole; 2 renders the real door with the real skin.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { landingTicketOf, landingTopStandsDown, type LandingReply } from '@/lib/guest-landing';

(globalThis as unknown as { React: unknown }).React = React;
const h = React.createElement;

test('1 · the top stands down after a Yes with the full ticket — and nowhere else', () => {
  for (const reply of ['unreplied', 'yes', 'no'] as LandingReply[]) {
    for (const eligibility of ['pass', 'awaiting', 'cannotCome', 'none'] as const) {
      for (const isPlusOne of [false, true]) {
        const ticket = landingTicketOf({ reply, eligibility, isPlusOne });
        assert.equal(
          landingTopStandsDown({ reply, ticket }),
          reply === 'yes' && ticket === 'full',
          `${reply} · ${eligibility}${isPlusOne ? ' · a plus-one' : ''} → ticket ${ticket}`,
        );
      }
    }
  }
  assert.equal(landingTopStandsDown({ reply: 'yes', ticket: 'full' }), true, 'anti-vacuity: the Yes page keeps its top');
  assert.equal(landingTopStandsDown({ reply: 'no', ticket: 'none' }), false, 'the No page (no ticket) loses the names it has nowhere else');
});

async function door(quietTop: boolean, extra: Record<string, unknown> = {}): Promise<string> {
  const { DoorShell } = await import('@/app/_components/door/door-shell');
  const { hubDoorSkin } = await import('../_components/hub-door-skin');
  return renderToStaticMarkup(
    h(
      DoorShell as never,
      { brand: 'foot', title: 'Maria & Jose', sub: 'invite you to celebrate', skin: hubDoorSkin({ mark: null, monogram: 'M&J' }), quietTop, ...extra } as never,
      h('p', { 'data-landing-heading': '' }, 'You’re on the list.'),
      h('img', { 'data-ticket': '', alt: 'Ana’s Digital ticket' }),
    ),
  );
}

/** The card's markup from its first child to the heading — what a guest sees above "You're on the list.". */
function aboveHeading(html: string): string {
  const card = html.indexOf('>', html.indexOf('border-t-[3px]')) + 1;
  const heading = html.lastIndexOf('<', html.indexOf('data-landing-heading'));
  assert.ok(card > 0 && heading > card, 'anti-vacuity: no card, or no heading in it');
  return html.slice(card, heading);
}

test('2 · the door with a quiet top draws no mark and no names above the heading', async () => {
  const before = await door(false);
  assert.match(aboveHeading(before), /data-door-mark=/, 'anti-vacuity: the plain door draws no mark — the check below would pass on nothing');
  assert.match(aboveHeading(before), /<h1 [^>]*class="font-serif[^"]*"[^>]*>Maria &amp; Jose<\/h1>/, 'anti-vacuity: the plain door draws no names');

  // The page passes no sub with a quiet top (the invitation line goes with the names) — rendered as the page hands it.
  const quiet = await door(true, { sub: undefined });
  const top = aboveHeading(quiet);
  assert.doesNotMatch(top, /data-door-mark=/, 'the couple’s mark is still drawn above “You’re on the list.”');
  assert.doesNotMatch(top, /M&amp;J/, 'the initials are still drawn above the heading');
  // The names: once, as the page's heading, for a screen reader only — never drawn.
  const names = [...top.matchAll(/<h1 [^>]*>Maria &amp; Jose<\/h1>/g)].map((m) => m[0]);
  assert.equal(names.length, 1, 'the page lost its heading (or drew the names twice)');
  assert.match(names[0]!, /class="sr-only"/, 'the event’s names are still DRAWN above the heading');
  assert.doesNotMatch(top, /invite you to celebrate/, 'the invitation line under the names is still drawn');
  // Nothing visible stands between the card's top and the heading: only the read-aloud title and the children's box.
  const visible = top.replace(/<h1 class="sr-only"[^>]*>[\s\S]*?<\/h1>/, '').replace(/<[^>]+>/g, '').trim();
  assert.equal(visible, '', `something is still drawn above the heading: “${visible}”`);

  // A "You're in!" arrival keeps its own line (it is news, not the names), still without the mark or the names.
  const arrived = aboveHeading(await door(true, { eyebrow: 'You’re in!', sub: 'Maria & Jose said yes to your request.' }));
  assert.match(arrived, /You’re in!/);
  assert.doesNotMatch(arrived, /data-door-mark=/);
  assert.match(arrived, /<h1 [^>]*class="sr-only"[^>]*>Maria &amp; Jose<\/h1>/);
});

test('3 · the page: the after-reply door takes the rule, the before-reply door never does', () => {
  const page = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
  assert.match(page, /const topStandsDown = landingTopStandsDown\(\{ reply, ticket \}\);/, 'the page does not ask the one rule');
  const doors = [...page.matchAll(/<DoorShell [^>]*>/g)].map((m) => m[0]);
  assert.equal(doors.length, 2, `anti-vacuity: expected the page's two doors (before a reply · after), found ${doors.length}`);
  const [beforeReply, afterReply] = doors as [string, string];
  assert.doesNotMatch(beforeReply, /quietTop/, 'the door before a reply lost its mark and names — the ticket is not drawn there');
  assert.match(afterReply, /quietTop=\{topStandsDown\}/, 'the door after a reply does not stand its top down');
  assert.match(afterReply, /sub=\{justIn \? REQUEST_WORDS\.inSub\(hosts, null\) : topStandsDown \? undefined : \(inviteLine \?\? undefined\)\}/, 'the invitation line under the names is still drawn on a quiet top');
});
