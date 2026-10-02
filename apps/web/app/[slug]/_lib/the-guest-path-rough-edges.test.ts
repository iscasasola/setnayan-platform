/**
 * THE GUEST PATH'S ROUGH EDGES — found on production by a phone walk-through,
 * 2026-10-01 (390 px). Six findings, each pinned where it can be: rendered when
 * the unit can be rendered, an executed pure function otherwise, and a source
 * read (comments stripped) only for what is a mount decision inside a 3,400-line
 * server component.
 *
 *   1. Me had no side gutter.
 *   2. Tapping Me always raised "Your reply" / "Change your reply" over the ticket.
 *   3. Mobile was a HIDDEN required field (Save succeeded, then a second screen).
 *   4. The intro tour offered "Maybe" — guests are offered yes or no.
 *   5. The camera consent card showed on Welcome 162 days before the event.
 *   6. The monogram's M lost its foot; the film's label sat behind the divider
 *      rule; the Save-to-account sub-label touched the button's edge.
 *
 * 🪤 `globalThis.React` before the DYNAMIC import (tsconfig `jsx: preserve`), and
 * `server-only` stubbed — the same two traps `the-reply-is-a-sheet.test.ts` names.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { hashOpensSheet, RSVP_SHEET_ANCHORS } from '../_components/rsvp-sheet-state';
import { resolveArrivalAction } from '@/lib/arrival-action';
import { SITE_MENU_ANCHORS } from './site-menu';
import { STAGE_BAR } from './stage-bar';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const BODY = code('app/[slug]/_components/site-body.tsx');

// ── 1 · ME HAS THE GUEST STAGES' SIDE GUTTER ────────────────────────────────

test('1 · the Me stage carries the same px-4 gutter, inside the PLATE column', () => {
  const at = BODY.indexOf("group('me'");
  assert.ok(at > -1, 'precondition: the Me group exists');
  const wrapper = BODY.slice(at, BODY.indexOf('{meSection}', at));
  assert.match(wrapper, /data-me-stage/, 'the Me wrapper moved — re-point this guard');
  assert.match(wrapper, /\bpx-4\b/, 'Me is drawn edge to edge again: the name, Switch and Save sit on the glass');
  assert.match(wrapper, /\$\{PLATE\}/, 'Me is no longer held to the page column');
});

// ── 2 · ME OPENS ON THE TICKET, SHEET CLOSED ────────────────────────────────

test('2 · the Me tab’s anchor does not open the reply sheet; the reply’s own doors still do', () => {
  assert.equal(hashOpensSheet(`#${SITE_MENU_ANCHORS.me}`), false, 'tapping Me raises the sheet over the ticket');
  assert.deepEqual([...RSVP_SHEET_ANCHORS], ['your-details']);
  for (const rsvpStatus of ['pending', 'attending', 'declined'] as const) {
    const a = resolveArrivalAction({ slug: 'w', rsvpStatus, today: '2020-01-01' });
    assert.ok(a);
    assert.equal(hashOpensSheet(a.href), true, `${rsvpStatus}: the RSVP / Change control no longer reaches the sheet`);
    // (No separate "Change" since 2026-10-03 — the status label IS the door.)
  }
});

test('2 · "Change your reply" is a button ON Me, gated like the sheet it opens', () => {
  const at = BODY.indexOf('data-me-change-reply');
  assert.ok(at > -1, 'Me has no "Change your reply" button');
  const gate = BODY.lastIndexOf('plan.rsvpShouldRender', at);
  assert.ok(gate > BODY.indexOf("group('me'"), 'the button is not gated on the sheet’s own gate — it could point at nothing');
  const tag = BODY.slice(BODY.lastIndexOf('<a', at), BODY.indexOf('</a>', at));
  assert.match(tag, /href="#your-details"/);
  assert.match(tag, /Change your reply/);
  // Only a guest who HAS replied; a pending guest is asked from the Home door.
  assert.match(BODY.slice(gate, at), /'attending'[\s\S]{0,60}'declined'/);
});

// ── 3 · MOBILE IS ASKED IN THE REPLY, MARKED, AND NEVER ON A SECOND SCREEN ──

const WORDS = {
  organizer: 'couple',
  theOrganizer: 'the couple',
  TheOrganizer: 'The couple',
  theOrganizerPossessive: 'the couple’s',
  TheOrganizerPossessive: 'The couple’s',
  eventWord: 'wedding',
  organizerIsHonoree: false,
  solemn: false,
};
function guest(over: Record<string, unknown> = {}) {
  return {
    guest_id: 'g-1',
    first_name: 'Ana',
    last_name: 'Cruz',
    display_name: 'Ana Cruz',
    rsvp_status: 'pending',
    meal_preference: 'chicken',
    dietary_restrictions: null,
    guest_note: null,
    email: null,
    mobile: null,
    qr_token: 't',
    photo_source: null,
    photo_url: null,
    ...over,
  };
}
async function renderWidget(props: Record<string, unknown> = {}, over: Record<string, unknown> = {}) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { RsvpWidget } = await import('../_components/rsvp-widget');
  return renderToStaticMarkup(
    React.createElement(RsvpWidget as never, {
      words: WORDS,
      guest: guest(over),
      eventId: 'e-1',
      eventPublicId: 'S89E-XXXX',
      faceMode: 'mode_b',
      replyLocked: false,
      ...props,
    } as never),
  );
}
const mobileLabel = (html: string) => html.match(/<label[^>]*for="contact_mobile"[^>]*>[\s\S]*?<\/label>/)?.[0] ?? '';

test('3 · the reply’s Mobile box says it is required for a yes, and a script makes the browser enforce it', async () => {
  const html = await renderWidget();
  assert.match(mobileLabel(html), /Mobile<span class="attend-mark"> \(required\)<\/span>/, 'Mobile carries no required mark');
  // The mark follows the answer: hidden until "attending" is checked (CSS :has, no client state).
  assert.match(html, /\.attend-mark\{display:none\}/);
  assert.match(html, /:has\(input\[name="rsvp_status"\]\[value="attending"\]:checked\) \.attend-mark\{display:inline\}/);
  // …and the box is made `required` while attending is picked.
  assert.match(html, /<script>[^<]*#contact_mobile[^<]*m\.required=/, 'nothing makes the mobile box required');
  assert.match(html, /type="tel"/);
});

test('3 · a couple who switched Mobile off, a closed list and the Maker’s canvas are never asked', async () => {
  const off = await renderWidget({ ask: { mobile: false } });
  assert.doesNotMatch(off, /contact_mobile/);
  assert.doesNotMatch(off, /attend-mark"/);
  const locked = await renderWidget({ replyLocked: true });
  assert.doesNotMatch(locked, /attend-mark"/, 'a closed list takes a new requirement');
  const canvas = await renderWidget({ previewEveryQuestion: true });
  assert.doesNotMatch(canvas, /attend-mark"/, 'the Maker’s sample guest is asked to type a number');
});

test('3 · the save refuses a yes without the number, with a sentence — and a decline is never asked', () => {
  const actions = code('app/[slug]/actions.ts');
  const at = actions.indexOf("status === 'attending' && ask.mobile && !contactMobile");
  assert.ok(at > -1, 'submitRsvp accepts a yes with no mobile when the couple asks for one');
  assert.match(actions.slice(Math.max(0, at - 40), at), /!replyLocked/, 'a closed list is refused a number');
  assert.match(actions.slice(at, at + 400), /rsvp=mobile/);
  // The refusal reaches a pixel on BOTH pages that can send the form.
  for (const rel of ['app/[slug]/page.tsx', 'app/[slug]/invite/reply/page.tsx']) {
    assert.match(code(rel), /search\.rsvp === 'mobile'/, `${rel} swallows the refusal`);
  }
  // A refusal is an ERROR flash, which reopens the sheet where the box is.
  assert.match(code('app/[slug]/page.tsx'), /'mobile'\s*\?\s*\{\s*tone: 'error'/);
});

// ── 4 · NO "MAYBE" IN THE GUEST'S INTRO ─────────────────────────────────────

test('4 · the intro tour and the guest help offer yes or no — there is no Maybe', () => {
  for (const rel of ['lib/tours.ts', 'lib/help.ts']) {
    const src = readFileSync(join(WEB, rel), 'utf8');
    const line = src.split('\n').find((l) => /RSVP button/.test(l) && /Yes/.test(l));
    assert.ok(line, `${rel}: the RSVP line moved — re-point this guard`);
    assert.doesNotMatch(line, /Maybe/i, `${rel} still offers a Maybe the guest is never shown`);
    assert.match(line, /Yes or No/);
  }
});

// ── 5 · THE CAMERA CONSENT CARD IS FOR THE DAY ──────────────────────────────

test('5 · the stage bar has a Camera only on The Day and after — and the card asks the bar', () => {
  assert.ok(!STAGE_BAR.save_the_date.slots.includes('camera'));
  assert.ok(!STAGE_BAR.rsvp.slots.includes('camera'), 'the Invitation stage grew a Camera slot');
  assert.ok(STAGE_BAR.event.slots.includes('camera'), 'The Day lost its Camera');
  const at = BODY.indexOf('<PapicGuestCapture');
  assert.ok(at > -1, 'precondition: the card is mounted');
  const gate = BODY.slice(BODY.lastIndexOf("group('live'", at), at);
  assert.match(
    gate,
    /papicGuest && STAGE_BAR\[pageStage\]\.slots\.includes\('camera'\)/,
    'the camera consent card is mounted before the day again',
  );
});

// ── 6 · THE MONOGRAM FITS, THE LABEL IS CLEAR OF IT, THE SUB-LABEL BREATHES ──

test('6 · every type-only lockup lets its ink finish — no svg clips the M’s foot', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MonogramMark } = await import('@/app/_components/monogram-mark');
  for (const style of ['bar', 'duo', 'script', 'infinity'] as const) {
    const html = renderToStaticMarkup(
      React.createElement(MonogramMark as never, {
        style,
        a: 'A',
        b: 'M',
        fontFamily: 'serif',
        fontStyle: 'normal',
        letterSpacing: '0',
        color: '#222',
        px: 80,
      } as never),
    );
    const svg = html.match(/<svg[^>]*>/)?.[0] ?? '';
    assert.match(svg, /overflow:visible/, `${style}: the svg clips to its tight viewBox`);
  }
});

test('6 · the film reserves the room the scaled lockup paints, so the label is not behind its rule', () => {
  const film = code('app/[slug]/_components/save-the-date-film.tsx');
  const at = film.indexOf('data-film-lockup-slot');
  assert.ok(at > -1, 'the lockup has no slot of its own — a scale transform grows the ink, not the box');
  const open = film.slice(film.lastIndexOf('<div', at), film.indexOf('>', at) + 1);
  assert.match(open, /\$\{sizeCls\}/, 'the slot is not the scaled size');
  assert.ok(film.indexOf('<HeroMonogram', at) > at && film.indexOf('<HeroMonogram', at) < film.indexOf('</div>\n    );', at), 'the lockup is not inside its slot');
});

test('6 · the Save-to-account button grows with its two-line sub-label and pads it', () => {
  const src = code('app/[slug]/_components/save-to-account.tsx');
  const at = src.indexOf('Save to my account');
  const open = src.slice(src.lastIndexOf('<SubmitButton', at), at);
  assert.match(open, /\bh-auto\b/, '.button-primary’s fixed h-11 still pins the box');
  assert.match(open, /\bpy-2\.5\b/, 'the sub-label touches the bottom edge');
});
