/**
 * THE RSVP PAGE FOLLOWS THE MAKER (owner 2026-09-27, looking at Maker → RSVP):
 *
 *   · *"you said one question per screen. this is not one question per screen."*
 *   · *"didn't we get passed the no boxes concept already?"*
 *   · *"the information here is good. but the slides showing doesn't seem to
 *     follow the what to add."*
 *
 *   1 · "Ask one question at a time" reaches EVERY reply-card mount, and every
 *       question on the card is its own step.
 *   2 · No boxes around the reply, the ticket, the pass or the notices.
 *   3 · The sample guest in the canvas shows no "we couldn't check" notice.
 *   4 · The canvas follows every draft switch — one read path.
 *   5 · The canvas opens on the QUESTIONS; "After they reply" is the other side.
 *   6 · The "Song request" switch asks a song on the RSVP.
 *   7 · The one-at-a-time switch's label, knob and value are one value.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { overlayHubDraftEvent } from '@/lib/hub-draft';
import { resolveRsvpAsk } from '@/lib/rsvp-ask';
import { askOneAtATime } from '@/lib/rsvp-one-at-a-time';
import { makerPageCanvasSrc } from '@/lib/maker-made-once-pages';
import { RSVP_CANVAS_GUEST } from '@/lib/simulated-guest-preview';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const APP = join(process.cwd(), 'app');
const read = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));
const BODY = read('[slug]/_components/site-body.tsx');
const REPLY = read('[slug]/invite/reply/page.tsx');
const WIDGET = read('[slug]/_components/rsvp-widget.tsx');
const ACTIONS = read('[slug]/actions.ts');

const WORDS = {
  organizer: 'couple',
  theOrganizer: 'the couple',
  TheOrganizer: 'The couple',
  theOrganizerPossessive: 'the couple’s',
  TheOrganizerPossessive: 'The couple’s',
  eventWord: 'wedding',
  organizerIsHonoree: false,
};

async function card(extra: Record<string, unknown>) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { RsvpWidget } = await import('../_components/rsvp-widget');
  return renderToStaticMarkup(
    React.createElement(RsvpWidget as never, {
      words: WORDS,
      guest: { ...RSVP_CANVAS_GUEST },
      eventId: 'e-1',
      eventPublicId: 'S89E-XXXX',
      faceMode: 'mode_b',
      doorAction: async () => {},
      offerSelfie: false,
      termsOnSend: true,
      previewEveryQuestion: true,
      ...extra,
    } as never),
  );
}

/** Every answerable control, and whether a `data-rsvp-step` holds it. */
function controlsOutsideSteps(html: string): string[] {
  const VOID = new Set(['input', 'img', 'br', 'hr', 'meta', 'link', 'source', 'path', 'circle', 'rect']);
  const stack: { tag: string; step: boolean }[] = [];
  const loose: string[] = [];
  const re = /<(\/?)([a-zA-Z0-9]+)([^>]*?)(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [, close, rawTag, attrs, selfClose] = m;
    const tag = rawTag!.toLowerCase();
    if (close) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i]!.tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }
    const inStep = stack.some((s) => s.step);
    const answerable =
      (tag === 'input' && !/type="hidden"/.test(attrs!)) ||
      tag === 'select' ||
      tag === 'textarea' ||
      (tag === 'button' && /type="submit"/.test(attrs!));
    if (answerable && !inStep) loose.push(`<${tag}${attrs}>`.slice(0, 90));
    if (VOID.has(tag) || selfClose) continue;
    stack.push({ tag, step: /data-rsvp-step/.test(attrs!) });
  }
  return loose;
}

// ═══ 1 · one question at a time, everywhere ═══════════════════════════════

test('1 · the Event Hub reply sheet passes "one question at a time" — not only the RSVP page', () => {
  const mount = BODY.slice(BODY.indexOf('<RsvpWidget'), BODY.indexOf('/>', BODY.indexOf('<RsvpWidget')));
  assert.match(mount, /oneAtATime=\{askOneAtATime\(event\.rsvp_ask_config\)\}/, 'the sheet ignores the switch again');
  assert.match(REPLY, /oneAtATime=\{askOneAtATime\(event\.rsvp_ask_config\)\}/);
  assert.equal(askOneAtATime({ oneAtATime: true }), true);
});

test('1 · every question on the card is its own step — nothing answerable sits outside one', async () => {
  for (const extra of [{}, { termsOnSend: false, keepOffer: true, doorAction: undefined }, { offerSelfie: true }]) {
    const html = await card(extra);
    assert.deepEqual(controlsOutsideSteps(html), [], `controls outside a step: ${JSON.stringify(extra)}`);
  }
  // Meal and dietary are two questions, so two steps.
  const html = await card({});
  const mealAt = html.indexOf('name="meal_preference"');
  const dietAt = html.indexOf('name="dietary_restrictions"');
  const between = html.slice(mealAt, dietAt);
  assert.ok(mealAt > -1 && dietAt > mealAt);
  assert.match(between, /data-rsvp-step/, 'meal and dietary share one step');
});

// ═══ 2 · no boxes ═════════════════════════════════════════════════════════

test('2 · no card around the reply, the ticket, the pass, the change link or the notices', () => {
  assert.doesNotMatch(WIDGET, /pahina-deckle/, 'the reply card is a card again');
  assert.doesNotMatch(read('[slug]/_components/pahina-keepsake.tsx'), /pahina-deckle/, 'the ticket is a card again');
  const pass = BODY.slice(BODY.indexOf('const passCard = '), BODY.indexOf('<GuestCodeKeepers', BODY.indexOf('const passCard = ')));
  assert.doesNotMatch(pass, /shadow-lg|rounded-2xl border|bg-mulberry px-5/, 'the pass sits in a card again');
  assert.match(pass, /rounded-xl bg-white p-3/, 'the QR itself (the object) must stay');
  assert.doesNotMatch(read('[slug]/_components/scan-trail-notice.tsx'), /rounded-xl border/);
  assert.doesNotMatch(read('[slug]/_components/face-data-notice.tsx'), /rounded-xl border/);
  const change = BODY.slice(BODY.indexOf('href="#your-details"'), BODY.indexOf('</a>', BODY.indexOf('href="#your-details"')));
  assert.doesNotMatch(change, /border border-ink/, 'the change-your-reply row is a box again');
  // The answers are pills on the ground, not bordered boxes.
  assert.doesNotMatch(WIDGET, /flex h-16 cursor-pointer items-center justify-center border/);
});

// ═══ 3 · no error about a person who does not exist ═══════════════════════

test('3 · the canvas and the sample guest never show the scan-trail notice', () => {
  assert.match(
    BODY,
    /\{isEditorCanvas \|\| guest\.guest_id === SIMULATED_GUEST_ID \? null : \(\s*<ScanTrailNotice\b/,
    'the "we couldn\'t check" line reaches the Maker preview again',
  );
});

// ═══ 4 · the canvas follows every draft switch — one read path ════════════

test('4 · flipping a DRAFT switch changes the canvas form, before Apply', async () => {
  const live = { event_id: 'e-1', rsvp_ask_config: {} as unknown };
  const withMeal = resolveRsvpAsk(overlayHubDraftEvent(live, null).rsvp_ask_config);
  const draft = { events: { rsvp_ask_config: { meal: false, song_request: false, oneAtATime: true } } } as never;
  const drafted = overlayHubDraftEvent(live, draft);
  const without = resolveRsvpAsk(drafted.rsvp_ask_config);
  const before = await card({ ask: withMeal, oneAtATime: askOneAtATime(live.rsvp_ask_config) });
  const after = await card({ ask: without, oneAtATime: askOneAtATime(drafted.rsvp_ask_config) });
  assert.match(before, /name="meal_preference"/);
  assert.doesNotMatch(after, /name="meal_preference"/, 'the meal question survives the switch being off');
  assert.match(before, /name="song_title"/);
  assert.doesNotMatch(after, /name="song_title"/, 'the song question survives the switch being off');
  assert.doesNotMatch(before, /data-rsvp-progress|Back/);
  // Both surfaces read the one value, from the overlaid (draft) event.
  assert.match(REPLY, /const event = overlayHubDraftEvent\(liveEvent as Record<string, unknown>, hostDraft\)/);
  assert.match(REPLY, /ask=\{resolveRsvpAsk\(event\.rsvp_ask_config\)\}/);
  assert.match(BODY, /const rsvpAsk = resolveRsvpAsk\(event\.rsvp_ask_config\);/);
});

test('4 · every switched-on question is shown in the canvas, none waiting on "attending"', async () => {
  const html = await card({ ask: {} });
  for (const name of ['rsvp_status', 'plus_one_first_name_1', 'meal_preference', 'dietary_restrictions', 'song_title', 'guest_note', 'contact_email', 'contact_mobile', 'terms_agreed']) {
    assert.match(html, new RegExp(`name="${name}"`), `${name} is missing from the canvas`);
  }
  const plus = html.indexOf('id="plus-ones"');
  assert.doesNotMatch(html.slice(plus, plus + 200), /attending-reveal/, 'the canvas hides the plus-one question behind a tap');
  // …in the reference order: answer · who you bring · meal · dietary · song · note · contact · Terms.
  const order = ['name="rsvp_status"', 'id="plus-ones"', 'name="meal_preference"', 'name="dietary_restrictions"', 'name="song_title"', 'name="guest_note"', 'name="contact_email"', 'name="terms_agreed"'];
  const at = order.map((k) => html.indexOf(k));
  assert.deepEqual([...at].sort((a, b) => a - b), at, `the questions are out of order: ${at.join(',')}`);
});

// ═══ 5 · the canvas opens on the questions ════════════════════════════════

test('5 · the RSVP canvas opens on the QUESTIONS, a sample who has not replied, host-verified', () => {
  assert.equal(makerPageCanvasSrc('/ana-ben', 'rsvp-page', 'rsvp'), '/ana-ben/invite/reply?editor=1');
  assert.equal(RSVP_CANVAS_GUEST.rsvp_status, 'pending');
  assert.match(REPLY, /if \(viewer && \(await loadHostMembership\(admin, liveEvent\.event_id as string, viewer\.id\)\)\) \{/, 'the canvas door is the param alone');
  assert.match(REPLY, /\? \{ data: \{ \.\.\.RSVP_CANVAS_GUEST, plus_one_name_confirmed_at: null as string \| null \}, error: null \}/);
  const LAUNCH = read('dashboard/[eventId]/launch/page.tsx');
  assert.match(LAUNCH, /<MakerRsvpCanvas questionsSrc=\{rsvpSrc\} repliedSrc=\{rsvpRepliedSrc\}/);
  const PAGE = read('dashboard/[eventId]/launch/_components/maker-page.tsx');
  assert.match(PAGE, /\['questions', 'The questions'\],\s*\['replied', 'After they reply'\],/);
  assert.match(PAGE, /const \[replied, setReplied\] = useState\(false\);/, 'the canvas must open on the questions');
  // A couple pressing Send in their own preview writes nothing.
  const DOOR = read('[slug]/invite/actions.ts');
  const guard = DOOR.indexOf('if (guestId === SIMULATED_GUEST_ID) {');
  assert.ok(guard > -1 && guard < DOOR.indexOf('jar.set(RSVP_TERMS_COOKIE'), 'the sample can set the Terms cookie');
});

// ═══ 6 · the song question ═══════════════════════════════════════════════

test('6 · "Song request" asks a song on the RSVP, saved through the existing song door', () => {
  const at = ACTIONS.indexOf("const songTitle = clean(formData.get('song_title'))");
  assert.ok(at > -1, 'the song on the RSVP is not read');
  const block = ACTIONS.slice(at, ACTIONS.indexOf("revalidatePath(`/dashboard/${eventId}/guests`);", at));
  assert.match(block, /if \(songTitle && ask\.song_request && !replyLocked && status === 'attending'\)/);
  assert.match(block, /moderateKwentoText\(/);
  assert.match(block, /admin\.rpc\('guest_submit_song_request'/);
  assert.doesNotMatch(block, /throw /, 'a song that does not take must never cost the guest their reply');
});

// ═══ 7 · one value behind the switch ══════════════════════════════════════

test('7 · the one-at-a-time switch: label, knob and value are the same value', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerRsvpSettings } = await import('../../dashboard/[eventId]/launch/_components/maker-rsvp-ask');
  const render = (oneAtATime: boolean) =>
    renderToStaticMarkup(
      React.createElement(MakerRsvpSettings, {
        eventId: 'e-1',
        current: { oneAtATime },
        drafted: false,
        replyBy: null,
        replyByHref: '#',
        requests: { count: 0, href: '#' },
      }),
    );
  for (const on of [false, true]) {
    const html = render(on);
    const block = html.slice(html.indexOf('data-rsvp-setting="one-at-a-time"'), html.indexOf('data-made-once="rsvp-ask"'));
    const input = /<input[^>]*role="switch"[^>]*>/.exec(block)?.[0] ?? '';
    assert.equal(/\schecked=""/.test(input), on, `on=${on} but the input says otherwise: ${input}`);
    assert.match(input, new RegExp(`aria-checked="${on}"`));
    assert.match(block, on ? /On · one question per screen/ : /Off · one scrolling page/);
  }
  const SRC = read('dashboard/[eventId]/launch/_components/maker-rsvp-ask.tsx');
  assert.match(SRC, /setLocal\(JSON\.parse\(currentKey\) as RsvpAskConfig\);/, 'the switch keeps a value the draft no longer holds');
});
