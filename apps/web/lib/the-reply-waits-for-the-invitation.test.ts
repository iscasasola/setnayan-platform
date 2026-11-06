/**
 * UNTIL THE INVITATION HAS LAUNCHED, THE GUEST IS SHOWN "SAVE THE DATE" AND ASKED FOR NOTHING —
 * and once it has, the landing says when and where before it asks.
 *
 * A guest's walk, 2026-10-11 (faults N04 · N05 · N02), on an event with no date (so: in its Save the Date stage):
 * the landing said "You're invited… please reply" with no when or where; the film behind it said "Save the date —
 * formal invitation to follow"; the Event Hub's top button said "RSVP"; and the faint ticket had nothing saying why
 * it was faint. Owner the same day ("ok all", relayed by the controller).
 *
 * WHAT IS HELD:
 *   (1) ONE RULE, TWO READINGS THAT CANNOT DIFFER — "is a reply asked for?" is `replyAskedInStage` on the Event
 *       Hub's own phase and `replyIsAsked` on the landing's own destination; run on every input, they agree, and
 *       the only "no" is the Save the Date with the lifecycle engine on.
 *   (2) THE EVENT HUB, by its own plan: in the Save the Date stage the reply is not on the page — with open browsing
 *       too — and it is on the page in the Invitation exactly as before; and no action under the mark opens a reply
 *       that is not open ("RSVP", "You're going", "You said you can't make it"), while the day's own action stays.
 *   (3) THE KEY GATE does not send an unreplied guest to the reply while nothing is asked.
 *   (4) THE SAVE THE DATE LANDING, rendered: the couple's words WITHOUT "please reply", ONE control (the door to the
 *       Save the Date), no Reply link, no ticket and no line about one.
 *   (5) THE INVITATION'S LANDING, rendered: still ONE control (the Reply), with the when-and-where line ABOVE it when
 *       anything is set and no line when nothing is; and under the faint ticket, the one line saying why.
 *   (6) THE WHEN-AND-WHERE LINE never has a hole: every combination of date / time / place present or missing.
 *   (7) `enter/page.tsx` draws the Save the Date landing on the rule's "no", from the destination it already
 *       resolved; the ceremony's time is read only through the guests' own schedule read.
 *
 * SABOTAGE RUN 2026-10-11 (committed first, put back by `git checkout`): `replyAskedInStage` made to answer true
 * always → (1) (2) red; the page's `<LandingSaveTheDate` arm removed → (7) red; the ask put back on the Save the Date
 * message (`askToReply` ignored) → (4) red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { replyAskedInStage, type InvitationWidgetRow, type LifecyclePhase } from './invitation-widgets';
import { arrivalDestination, arrivalDestinationWords, replyIsAsked } from './invite-destination';
import { resolveSiteBodyPlan, rsvpReplyOpen } from './site-body-plan';
import { resolveArrivalAction } from './arrival-action';
import { rsvpGate } from './guest-one-path';
import { LANDING_WORDS, landingMessage, landingWhenWhere } from './guest-landing';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const PHASES: LifecyclePhase[] = ['save_the_date', 'rsvp', 'event', 'editorial'];
const rsvpRow = [{ widget_id: 'w-rsvp', widget_type: 'rsvp', is_visible: true, is_always_on: true, display_order: 0, config_json: {} } as unknown as InvitationWidgetRow];

test('(1) one rule, two readings: the hub and the landing agree on every input — and only the Save the Date says no', () => {
  for (const phasesEnabled of [true, false]) for (const lifecyclePhase of PHASES) {
    const hub = replyAskedInStage({ phasesEnabled, lifecyclePhase });
    const landing = replyIsAsked(arrivalDestination({ phasesEnabled, lifecyclePhase }));
    assert.equal(hub, landing, `phases=${phasesEnabled} ${lifecyclePhase}: the hub says ${hub}, the landing ${landing}`);
    assert.equal(hub, !(phasesEnabled && lifecyclePhase === 'save_the_date'));
  }
});

test('(2) the Event Hub: no reply on the page in the Save the Date — open browsing too — and no action that opens one', () => {
  for (const openBrowse of [true, false]) {
    assert.equal(rsvpReplyOpen({ widgets: rsvpRow, openBrowse, phasesEnabled: true, lifecyclePhase: 'save_the_date' }), false, `open browsing ${openBrowse}: the reply is on the Save the Date`);
    // The Invitation is as it was — anti-vacuity: the row really is a reply that shows.
    assert.equal(rsvpReplyOpen({ widgets: rsvpRow, openBrowse, phasesEnabled: true, lifecyclePhase: 'rsvp' }), true, `open browsing ${openBrowse}: the Invitation lost its reply`);
    const plan = (lifecyclePhase: LifecyclePhase) =>
      resolveSiteBodyPlan({ identity: 'guest', phasesEnabled: true, lifecyclePhase, stdFilm: true, isSample: false, hasHeroMedia: false, hasBgMusic: false, liveMediaPublic: false, widgets: rsvpRow, openBrowse });
    assert.equal(plan('save_the_date').rsvpShouldRender, false);
    assert.equal(plan('rsvp').rsvpShouldRender, true);
  }
  // With the lifecycle engine off there is no Save the Date: asked as before.
  assert.equal(rsvpReplyOpen({ widgets: rsvpRow, openBrowse: true, phasesEnabled: false, lifecyclePhase: 'save_the_date' }), true);

  const base = { slug: 'marco-marga', eventDate: null, today: '2026-10-11', hasPass: true } as const;
  for (const rsvpStatus of ['pending', 'maybe', 'attending', 'declined'] as const) {
    assert.ok(resolveArrivalAction({ ...base, rsvpStatus }) !== null, `anti-vacuity: ${rsvpStatus} has an action when the reply is open`);
    assert.equal(resolveArrivalAction({ ...base, rsvpStatus, replyOpen: false }), null, `${rsvpStatus}: an action opens a reply that is not open`);
  }
  // The day's own action is not about the reply, and stays.
  const day = resolveArrivalAction({ slug: 'a', rsvpStatus: 'attending', eventDate: '2026-10-11', today: '2026-10-11', hasPass: true, replyOpen: false });
  assert.equal(day?.kind, 'day-of');
  // The page hands the action its own plan's answer.
  assert.match(code('app/[slug]/_components/site-body.tsx'), /resolveArrivalAction\(\{[\s\S]{0,400}?replyOpen: replyOpenHere,/);
  // 📬 …and the couple's reply window (owner 2026-10-14): the reply is open HERE only when both are.
  assert.match(code('app/[slug]/_components/site-body.tsx'), /const replyOpenHere = plan\.rsvpShouldRender && repliesWindow\.state === 'open';/);
});

test('(3) the key gate sends nobody to the reply while nothing is asked', () => {
  // The gate's own "no reply needed" arm: with it, the gate lets every key straight in.
  const facts = { rsvpStatus: 'pending', mealPreference: null, mobile: null, askMeal: true, askMobile: true, locked: false } as const;
  assert.equal(rsvpGate({ ...facts, guestsReply: true }).kind, 'ask', 'anti-vacuity: this guest is not stopped at the reply even when one is asked');
  assert.deepEqual(rsvpGate({ ...facts, guestsReply: false }), { kind: 'inside', didntReply: false });
  // …and the page hands the gate the rule, on the phase it resolved.
  const page = code('app/[slug]/page.tsx');
  // 📬 …and on the couple's reply window (owner 2026-10-14): never sent to a form that would refuse.
  assert.match(page, /guestsReply: readGuestsReply\(event\.rsvp_ask_config\) && replyAskedInStage\(\{ phasesEnabled, lifecyclePhase \}\) &&\s*repliesNow\.state === 'open',/);
});

const MESSAGE_FACTS = { template: null, formalName: 'Mr. Bean Banlag', hostsName: 'Marco & Marga', eventWord: 'wedding', solemn: false, eventDate: null, datePrecision: null } as const;
const controls = (html: string) => html.match(/<(a|button)\b/g) ?? [];

test('(4) the Save the Date landing: the couple’s words without the ask, ONE control, no reply, no ticket', async () => {
  const asked = landingMessage({ ...MESSAGE_FACTS, reply: 'unreplied' });
  const quiet = landingMessage({ ...MESSAGE_FACTS, reply: 'unreplied', askToReply: false });
  assert.match(asked, /Please reply below/, 'anti-vacuity: the invitation’s message no longer asks');
  assert.doesNotMatch(quiet, /reply/i, `the Save the Date message still asks: ${JSON.stringify(quiet)}`);
  assert.ok(quiet.length > 20 && asked.startsWith(quiet), 'the Save the Date message is not the couple’s own words');

  const { renderToStaticMarkup } = await import('react-dom/server');
  const { LandingSaveTheDate } = await import('../app/[slug]/invite/_components/landing-pre-reply');
  const cta = arrivalDestinationWords('save_the_date').cta;
  const html = renderToStaticMarkup(
    React.createElement(LandingSaveTheDate, { message: quiet, hosts: 'Marco & Marga', whenWhere: null, openHref: '/marco-marga?from=landing', openLabel: cta, awaitingLine: null }),
  );
  assert.equal(controls(html).length, 1, `the Save the Date landing has ${controls(html).length} controls`);
  assert.match(html, new RegExp(`<a [^>]*href="/marco-marga\\?from=landing"[^>]*>${cta}</a>`));
  for (const gone of [LANDING_WORDS.reply, 'Please reply', LANDING_WORDS.ticketWaiting, 'data-landing-ticket', '<img', '/invite/reply']) {
    assert.ok(!html.includes(gone), `the Save the Date landing still has ${JSON.stringify(gone)}`);
  }
  assert.doesNotMatch(html, /data-landing-when-where/, 'a when-and-where line is drawn with nothing set');
  const dated = renderToStaticMarkup(
    React.createElement(LandingSaveTheDate, { message: quiet, hosts: 'M & M', whenWhere: 'August 2027', openHref: '/x', openLabel: cta, awaitingLine: null }),
  );
  assert.ok(dated.indexOf('August 2027') > 0 && dated.indexOf('August 2027') < dated.indexOf('<a '), 'when and where is not above the button');
});

test('(5) the invitation’s landing: ONE control, when and where above it, and the faint ticket says why', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { LandingPreReply } = await import('../app/[slug]/invite/_components/landing-pre-reply');
  const props = { message: 'Hi Fred! You’re invited.', hosts: 'Ana & Miguel', replyHref: '/ana-miguel/invite/reply', replyByLabel: null, fadedTicket: true, ticketSrc: '/api/guest/pass-card', awaitingLine: null };
  const line = 'Friday, December 18, 2026 · 2:30 PM · Seda Vertis North';
  const html = renderToStaticMarkup(React.createElement(LandingPreReply, { ...props, whenWhere: line }));
  assert.equal(controls(html).length, 1, 'the landing before the reply has more than one control');
  const at = html.indexOf(line);
  assert.ok(at > 0 && at < html.indexOf('<a '), 'when and where is not above the Reply button');
  assert.ok(at > html.indexOf('data-landing="reply"'), 'when and where is not with the reply');
  // The faint ticket: the picture is hidden from a screen reader, its reason is not.
  const ticket = html.slice(html.indexOf('data-landing-ticket="faded"'));
  assert.ok(ticket.includes(`>${LANDING_WORDS.ticketWaiting}</p>`), 'the faint ticket does not say why');
  assert.match(html, /<section class="[^"]*" data-landing="ticket" data-landing-ticket="faded"><div aria-hidden="true"/, 'the whole ticket section is hidden from a screen reader again');
  // Nothing set → no line; no faint ticket → no line about one.
  const bare = renderToStaticMarkup(React.createElement(LandingPreReply, { ...props, fadedTicket: false }));
  assert.doesNotMatch(bare, /data-landing-when-where/);
  assert.ok(!bare.includes(LANDING_WORDS.ticketWaiting));
});

test('(6) the when-and-where line never has a hole', () => {
  const HOLE = /(?:^|\s)·\s*$|^\s*·|·\s*·|\s{2,}/;
  for (const when of ['Friday, December 18, 2026', 'August 2027', '', null]) for (const realDay of [true, false])
    for (const time of ['2:30 PM', '', null]) for (const place of ['Seda Vertis North', '  ', null]) {
      const line = landingWhenWhere({ when, realDay, time, place });
      const set = [when, place].some((v) => (v ?? '').trim());
      if (!set) assert.equal(line, null, 'a line is drawn with no date and no place');
      else assert.ok(line && !HOLE.test(line), `a hole: ${JSON.stringify(line)}`);
      // A time is said only beside a real day.
      if (line && time?.trim()) assert.equal(line.includes('2:30 PM'), Boolean(when?.trim()) && realDay, `the time in ${JSON.stringify(line)} (realDay=${realDay})`);
    }
  assert.equal(landingWhenWhere({ when: 'Friday, December 18, 2026', realDay: true, time: '2:30 PM', place: 'Seda Vertis North' }), 'Friday, December 18, 2026 · 2:30 PM · Seda Vertis North');
});

test('(7) the landing page draws the Save the Date form on the rule’s "no", from the destination it already resolved', () => {
  const page = code('app/[slug]/invite/enter/page.tsx');
  assert.match(page, /const replyAsked = replyIsAsked\(destination\);/);
  assert.match(page, /const destination = arrivalDestinationFor\(\{/);
  const pre = page.slice(page.indexOf("if (unreplied && ticket !== 'full') {"));
  const block = pre.slice(0, pre.indexOf('\n  }\n'));
  // Exactly one of the two is drawn, on the rule.
  assert.match(block, /\{replyAsked \? null : \(\s*<LandingSaveTheDate\b/, 'the Save the Date landing is not drawn on the rule’s "no"');
  assert.match(block, /\{replyAsked \? \(\s*<LandingPreReply\b/, 'the invitation’s landing is drawn while nothing is asked');
  assert.match(block, /eyebrow=\{justIn \? REQUEST_WORDS\.inTitle : stageEyebrow\}/);
  assert.match(page, /const stageEyebrow = replyAsked \? undefined : PUBLIC_STAGE_LABELS\.save_the_date;/);
  assert.match(page, /const saveTheDateDoor = \{ href: `\/\$\{home\}`, label: destinationWords\.cta \};/);
  assert.match(page, /askToReply: replyAsked \|\| canvas,/);
  // No Reply button on the other pre-reply arm either (a plus-one holding a full ticket).
  // 📬 …and with the couple's window shut, the window's words stand in the button's place (owner 2026-10-14).
  assert.match(page, /\{unreplied \? \(\s*!replyAsked \? null : repliesShut \? \(\s*<div data-landing="reply" data-reply-window=\{replies\.state\}[\s\S]{0,400}?\) : \(\s*<div data-landing="reply">/);
  // The time comes through the guests' own schedule read, and only for a real day.
  assert.match(page, /if \(precision === 'day' && event\.event_date\) \{\s*try \{\s*ceremonyTime = blockTime\(\s*ceremonyBlock\(await fetchPublicScheduleBlocks\(/);
});
