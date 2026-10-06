/**
 * AN UNREPLIED GUEST IS ASKED TO REPLY FIRST — Me leads with the reply; the
 * ticket appears after a Yes.
 *
 * Found live by the controller, 2026-10-05, on maria-and-jose at 375 px (See as ›
 * "Guest who hasn't replied"): the Me tab showed the ticket, "Show this at the
 * door" and "Save my ticket", and nothing asking the guest to reply — while the
 * invitation message itself says *"Please reply below — your ticket is ready
 * once you do"* (`landingMessage`, lib/guest-landing.ts).
 *
 * What this file holds:
 *   1. the rule (`meLeadsWithReply`) for every guest state, on maria-and-jose's
 *      real shape — not replied → reply first; Yes / declined → not; on the day
 *      → the ticket stays (the door must work); a plus-one → the ticket stays;
 *      no reply sheet on the page → never a button to nowhere;
 *   2. the RENDER: `GuestTicket` given a reply href draws the one "Reply to the
 *      invitation" button and NO ticket, "Show this at the door" or "Save my
 *      ticket"; without one, the ticket as before; declined, the declined line;
 *   3. the wiring: SiteBody asks the rule from its own plan and hands the answer
 *      to page.tsx's Me — for a real guest AND for the host's See as sample.
 *
 * 🪤 Harness as `every-plus-one-is-named.test.ts`: `globalThis.React` before
 * the dynamic import, `server-only` / `client-only` stubbed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { meLeadsWithReply, resolveArrivalAction, REPLY_SHEET_ANCHOR } from '@/lib/arrival-action';
import { passCardEligibility } from '@/lib/pass-card';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const read = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));

/** maria-and-jose, as prod holds it (read 2026-10-05): a wedding on 2026-12-12,
 *  Manila; every guest `host_seeded`, with a QR, not a plus-one. */
const MJ = { slug: 'maria-and-jose', eventDate: '2026-12-12', eventId: '947e7bab-893d-454d-b4c5-0a6e23f36009' };
const BEFORE = '2026-10-05';
const seat = (rsvp_status: string, extra: Record<string, unknown> = {}) => ({
  guest_id: 'g-1',
  event_id: MJ.eventId,
  rsvp_status,
  entry_source: 'host_seeded',
  qr_token: 'qr-1',
  plus_one_of_guest_id: null,
  ...extra,
});
const action = (rsvpStatus: 'pending' | 'maybe' | 'attending' | 'declined', today = BEFORE) =>
  resolveArrivalAction({ slug: MJ.slug, rsvpStatus, eventDate: MJ.eventDate, today, hasPass: true });

test('1 · the rule, every guest state on maria-and-jose’s shape', () => {
  // Not replied (and "maybe" — still owes an answer): Me leads with the reply.
  assert.equal(meLeadsWithReply({ action: action('pending'), replyOpen: true }), true);
  assert.equal(meLeadsWithReply({ action: action('maybe'), replyOpen: true }), true);
  // Replied Yes / declined: the ticket (or the declined line), never a second reply button.
  assert.equal(meLeadsWithReply({ action: action('attending'), replyOpen: true }), false);
  assert.equal(meLeadsWithReply({ action: action('declined'), replyOpen: true }), false);
  // Signed out: no guest, no action — nothing to lead with.
  assert.equal(meLeadsWithReply({ action: null, replyOpen: true }), false);
  // On the day an unreplied guest keeps the ticket — the door must still work.
  assert.equal(meLeadsWithReply({ action: action('pending', MJ.eventDate), replyOpen: true }), false);
  // No reply sheet on the page → never a button that opens nothing.
  assert.equal(meLeadsWithReply({ action: action('pending'), replyOpen: false }), false);
  // A plus-one's seat is held by their bringer — the landing shows it full; so does Me.
  assert.equal(meLeadsWithReply({ action: action('pending'), replyOpen: true, isPlusOne: true }), false);
});

async function ticketHtml(props: Record<string, unknown>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { GuestTicket } = await import('./_components/guest-ticket');
  return renderToStaticMarkup(
    React.createElement(GuestTicket as React.FC<Record<string, unknown>>, {
      name: 'Daniel Ramos',
      invitationUrl: 'https://www.setnayan.com/maria-and-jose/invite/abc',
      ...props,
    }),
  );
}

test('2 · the render: not replied → the reply button and NO ticket; Yes → the ticket; declined → the line', async () => {
  // Not replied: maria-and-jose's seat with no answer yet is ticket-eligible (`pass`) —
  // which is exactly why the ticket used to show.
  const unreplied = passCardEligibility(seat('pending') as never);
  assert.equal(unreplied, 'pass');
  const ask = await ticketHtml({ state: unreplied, replyHref: `#${REPLY_SHEET_ANCHOR}` });
  assert.match(ask, /Reply to the invitation/);
  assert.match(ask, new RegExp(`href="#${REPLY_SHEET_ANCHOR}"`));
  assert.doesNotMatch(ask, /<img/, 'an unreplied guest sees no ticket picture');
  assert.doesNotMatch(ask, /Show this at the door/);
  assert.doesNotMatch(ask, /Save my ticket/);
  // The anchor stays, so "My QR" does not open a side door to the same code.
  assert.match(ask, /id="site-pass"/);

  // Replied Yes: the ticket, as before.
  const yes = await ticketHtml({ state: passCardEligibility(seat('attending') as never), replyHref: null });
  assert.match(yes, /Show this at the door/);
  assert.doesNotMatch(yes, /Reply to the invitation/);

  // Declined: the one declined line, no ticket, no reply-first button.
  const no = await ticketHtml({ state: passCardEligibility(seat('declined') as never), replyHref: null });
  assert.match(no, /data-guest-ticket="cannotCome"/);
  assert.doesNotMatch(no, /Reply to the invitation/);
});

test('3 · the wiring: SiteBody decides from its plan; page.tsx hands it to both Me mounts', () => {
  const body = read('app/[slug]/_components/site-body.tsx');
  assert.match(
    body,
    /typeof meSection === 'function'\s*\?\s*meSection\(\{\s*replyHref: meLeadsWithReply\(\{\s*action: arrivalAction,\s*replyOpen: plan\.rsvpShouldRender,/,
    'Me must ask meLeadsWithReply with the page’s own action and reply-sheet gate',
  );
  const page = read('app/[slug]/page.tsx');
  const mounts = page.match(/<GuestTicket\b[\s\S]*?\/>/g) ?? [];
  assert.equal(mounts.length, 2, `expected the real guest's and the See as sample's GuestTicket, found ${mounts.length}`);
  for (const m of mounts) assert.match(m, /replyHref=\{replyHref\}/, `a Me ticket mount ignores the reply rule:\n${m}`);
  // Both Me sections are the function form, so the answer reaches them.
  assert.equal((page.match(/\(\{ replyHref \}: \{ replyHref: string \| null \}\) => \(/g) ?? []).length, 2);
});

test('4 · a page WITHOUT tabs asks the same rule for the Me it hands GuestHubBar', async () => {
  const page = read('app/[slug]/page.tsx');
  const slot = /const meSlot = meSlotFor\(([\s\S]*?)\n  \);/.exec(page)?.[1] ?? '';
  assert.match(slot, /^\s*meLeadsWithReply\(\{/, 'the non-tabbed Me ignores the reply rule (it used to be meSlotFor(null))');
  assert.match(slot, /replyOpen: rsvpReplyOpen\(\{/, 'the non-tabbed Me must ask the plan’s own reply-sheet gate');
  assert.match(slot, /resolveArrivalAction\(\{/);
  // The same inputs SiteBody's plan reads.
  assert.match(slot, /openBrowse: Boolean\(\(event as \{ website_open_browse\?: boolean \| null \}\)\.website_open_browse\)/);
  assert.match(slot, /widgets,\s*openBrowse:[\s\S]*?phasesEnabled,\s*lifecyclePhase,/);
  assert.match(slot, /rsvpStatus: guest\.rsvp_status/);
  assert.match(page, /meSlot=\{guestPageTabbed \? null : meSlot\}/);
  // …and that gate IS the plan's — both branches of resolveSiteBodyPlan ask it.
  const plan = read('lib/site-body-plan.ts');
  assert.equal(
    (plan.match(/rsvpShouldRender = rsvpReplyOpen\(\{ widgets, openBrowse, phasesEnabled, lifecyclePhase \}\);/g) ?? []).length,
    2,
    'plan.rsvpShouldRender and the non-tabbed Me must be one rule',
  );
  const { rsvpReplyOpen } = await import('@/lib/site-body-plan');
  const rsvp = { widget_type: 'rsvp', is_visible: true, is_always_on: true } as never;
  // maria-and-jose: RSVP row visible + always on, open-browse on, the Invitation stage.
  assert.equal(rsvpReplyOpen({ widgets: [rsvp], openBrowse: true, phasesEnabled: true, lifecyclePhase: 'rsvp' }), true);
});
