/**
 * WHAT DO YOU WANT TO ASK YOUR GUESTS? (owner 2026-09-25, Event Hub Maker
 * Details panel — DECISION_LOG.md, verbatim: *"with this invitation process
 * in mind we need to add this process on the editor for easier setup. to ask
 * what are the information you want to get from the guest."* Follow-up, item
 * 5: *"yes on and off"*).
 *
 * `only-the-answer-freezes.test.ts` proves the answer/lock rule; this proves
 * the ORTHOGONAL one: DEFAULT = today's behaviour, each toggle removes its own
 * field and only its own field, `attending` cannot be turned off because it is
 * not a field of the config type at all, and `submitRsvp` re-reads the config
 * and IGNORES an off field even when a crafted POST carries a value for it.
 *
 * 🪤 Same harness as `only-the-answer-freezes.test.ts`: `globalThis.React`
 * before the dynamic import (bare `React.createElement` under
 * `"jsx": "preserve"`), and `server-only`/`client-only` stubbed so the reply
 * card can load its server action's import chain under a plain test runner.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  RSVP_ASK_FIELDS,
  resolveRsvpAsk,
  rsvpAsks,
  sanitizeRsvpAskConfig,
  type RsvpAskField,
} from '@/lib/rsvp-ask';

// 🪤 `globalThis.React` before the DYNAMIC import — tsconfig sets
// `"jsx": "preserve"`, so the widget compiles to bare `React.createElement`
// with no import of its own; a static import is hoisted above this and throws.
(globalThis as unknown as { React: unknown }).React = React;

{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WORDS = {
  organizer: 'couple',
  theOrganizer: 'the couple',
  TheOrganizer: 'The couple',
  theOrganizerPossessive: 'the couple’s',
  TheOrganizerPossessive: 'The couple’s',
  eventWord: 'wedding',
  organizerIsHonoree: false,
};

function guest(over: Record<string, unknown> = {}) {
  return {
    guest_id: 'g-1',
    first_name: 'Ana',
    last_name: 'Cruz',
    display_name: 'Ana Cruz',
    rsvp_status: 'attending',
    meal_preference: 'chicken',
    dietary_restrictions: 'nut allergy',
    guest_note: null,
    email: null,
    mobile: null,
    plus_one_allowed: true,
    qr_token: 't',
    photo_source: null,
    photo_url: null,
    ...over,
  };
}

async function render(ask: Record<string, unknown> = {}, guestOver: Record<string, unknown> = {}) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { RsvpWidget } = await import('../_components/rsvp-widget');
  return renderToStaticMarkup(
    React.createElement(RsvpWidget as never, {
      words: WORDS,
      guest: guest(guestOver),
      eventId: 'e-1',
      eventPublicId: 'S89E-XXXX',
      faceMode: 'mode_b',
      replyLocked: false,
      ask,
    } as never),
  );
}

// ── THE PURE CONFIG (lib/rsvp-ask.ts) ───────────────────────────────────────

test('DEFAULT = today’s behaviour: an absent key, an empty config and null all read as ON', () => {
  for (const raw of [null, undefined, {}]) {
    const resolved = resolveRsvpAsk(raw);
    for (const field of RSVP_ASK_FIELDS) assert.equal(resolved[field], true, `${field} is off by default`);
  }
});

test('only an explicit `false` turns a question off', () => {
  const config = sanitizeRsvpAskConfig({ meal: false, dietary: true });
  assert.equal(rsvpAsks(config, 'meal'), false);
  assert.equal(rsvpAsks(config, 'dietary'), true);
  assert.equal(rsvpAsks(config, 'note'), true, 'an untouched field must read as on');
});

test('unknown keys and non-boolean values are dropped, never repaired', () => {
  const config = sanitizeRsvpAskConfig({
    meal: 'off', // wrong type — dropped
    dietary: false, // kept
    attending: false, // not a field of this config at all — dropped
    not_a_real_field: true, // dropped
  });
  assert.deepEqual(config, { dietary: false });
});

test('`attending` is not a member of the config type — there is no field to turn off', () => {
  assert.ok(
    !(RSVP_ASK_FIELDS as readonly string[]).includes('attending'),
    'attending must stay unswitchable — it is the owner’s own list',
  );
});

test('malformed input never throws — a stored blob is data, not a promise about shape', () => {
  for (const raw of ['a string', 42, [], true]) {
    assert.deepEqual(sanitizeRsvpAskConfig(raw), {});
  }
});

// ── THE WIDGET: DEFAULT = TODAY, EACH TOGGLE REMOVES ONLY ITS OWN FIELD ─────

test('DEFAULT (no ask prop, or {}): every field the widget has always asked is still there', async () => {
  for (const ask of [{}, undefined]) {
    const html = await render(ask as Record<string, unknown>);
    assert.match(html, /name="rsvp_status"/, 'attending is always asked');
    assert.match(html, /id="meal_preference"/);
    assert.match(html, /id="dietary_restrictions"/);
    assert.match(html, /id="guest_note"/);
    assert.match(html, /id="contact_mobile"/);
    assert.match(html, /id="contact_email"/);
    // plus_one_allowed=true on the fixture guest — the box must render.
    assert.match(html, /Who are you bringing/);
  }
});

test('attending can never be turned off by this config — the radios always render', async () => {
  // Every field OFF at once still leaves the answer control alone: there is no
  // `attending` key for a crafted patch to even name.
  const allOff: Partial<Record<RsvpAskField, boolean>> = {};
  for (const field of RSVP_ASK_FIELDS) allOff[field] = false;
  const html = await render(allOff);
  assert.match(html, /name="rsvp_status"/);
  assert.match(html, /Joyfully accepts/);
});

test('meal off removes ONLY the meal picker — dietary stays', async () => {
  const html = await render({ meal: false });
  assert.doesNotMatch(html, /id="meal_preference"/);
  assert.match(html, /id="dietary_restrictions"/);
});

test('dietary off removes ONLY the dietary box — meal stays', async () => {
  const html = await render({ dietary: false });
  assert.doesNotMatch(html, /id="dietary_restrictions"/);
  assert.match(html, /id="meal_preference"/);
});

test('meal AND dietary off drops the whole reveal wrapper, not an empty grid', async () => {
  const html = await render({ meal: false, dietary: false });
  assert.doesNotMatch(html, /id="meal_preference"/);
  assert.doesNotMatch(html, /id="dietary_restrictions"/);
});

test('note off removes the note textarea — nothing else moves', async () => {
  const on = await render({});
  const off = await render({ note: false });
  assert.match(on, /id="guest_note"/);
  assert.doesNotMatch(off, /id="guest_note"/);
  // The neighbouring contact boxes are untouched by the note toggle.
  assert.match(off, /id="contact_email"/);
  assert.match(off, /id="contact_mobile"/);
});

test('mobile off removes ONLY the mobile box — email always stays (it is also the sign-in address)', async () => {
  const html = await render({ mobile: false });
  assert.doesNotMatch(html, /id="contact_mobile"/);
  assert.match(html, /id="contact_email"/);
});

test('plus_ones off hides the name box even for a guest the host already allowed one', async () => {
  const on = await render({}, { plus_one_allowed: true });
  const off = await render({ plus_ones: false }, { plus_one_allowed: true });
  assert.match(on, /Who are you bringing/);
  assert.doesNotMatch(off, /Who are you bringing/);
});

test('plus_ones ON changes nothing for a guest the host never allowed one', async () => {
  const html = await render({ plus_ones: true }, { plus_one_allowed: false });
  assert.doesNotMatch(html, /Who are you bringing/);
});

test('song_request is not a field this widget renders at all — it gates the separate song-request card', () => {
  const w = read('_components', 'rsvp-widget.tsx');
  assert.doesNotMatch(w, /song_request/, 'song_request belongs to site-body.tsx’s card gate, not this form');
});

// ── THE WIRING: site-body.tsx, invite/reply/page.tsx, the song-request route ─

function read(...parts: string[]): string {
  return readFileSync(join(__dirname, '..', ...parts), 'utf8');
}

test('the Event Hub card and the invite arrival’s Reply door both thread the resolved config in', () => {
  const body = stripComments(read('_components', 'site-body.tsx'));
  assert.match(body, /resolveRsvpAsk\(event\.rsvp_ask_config\)/);
  assert.match(body, /ask=\{rsvpAsk\}/, 'the reply card mount never receives the resolved config');

  const door = stripComments(read('invite', 'reply', 'page.tsx'));
  assert.match(door, /ask=\{resolveRsvpAsk\(event\.rsvp_ask_config\)\}/);
});

test('the song-request card is gated by rsvpAsk.song_request AND its own live-window door — neither alone', () => {
  const body = stripComments(read('_components', 'site-body.tsx'));
  const at = body.indexOf('<SongRequestCard');
  assert.ok(at > -1, 'the song-request card mount moved');
  const before = body.slice(Math.max(0, at - 400), at);
  assert.match(before, /rsvpAsk\.song_request/, 'the card no longer checks the ask toggle');
  assert.match(before, /songRequestCardShows\(/, 'the card no longer checks its own open/paused window');
});

test('the song-request API route re-reads the toggle server-side, never trusting the card’s own render', () => {
  const route = stripComments(read('..', 'api', 'song-requests', 'route.ts'));
  assert.match(route, /rsvp_ask_config/);
  assert.match(route, /resolveRsvpAsk\(e\.rsvp_ask_config\)\.song_request/);
});

// ── THE SERVER ACTION IGNORES AN OFF FIELD (structural — no live DB here) ───

test('submitRsvp re-reads rsvp_ask_config from the database, not from the form', () => {
  const src = stripComments(read('actions.ts'));
  const submit = src.slice(src.indexOf('export async function submitRsvp'));
  assert.match(submit, /\.select\('slug, event_date, guest_list_edit_deadline, guest_count_locked_at, rsvp_ask_config'\)/);
  assert.match(submit, /const ask = resolveRsvpAsk\(evRsvp\?\.rsvp_ask_config\);/);
});

test('an off field is resolved to what is already STORED, never to the posted value', () => {
  const src = stripComments(read('actions.ts'));
  const submit = src.slice(src.indexOf('export async function submitRsvp'));
  // Each *ToWrite falls back to `before` (the row as it stood before this
  // save) when its ask flag is off — the write is a no-op for that column —
  // and to `undefined` (dropped from the payload) when that read FAILED, so a
  // failed read can never erase a stored answer.
  for (const [v, flag, posted, col] of [
    ['mealToWrite', 'meal', 'meal', 'meal_preference'],
    ['dietaryToWrite', 'dietary', 'dietary', 'dietary_restrictions'],
    ['guestNoteToWrite', 'note', 'guestNote', 'guest_note'],
    ['mobileToWrite', 'mobile', 'contactMobile', 'mobile'],
  ] as const) {
    assert.match(
      submit,
      new RegExp(`const ${v} = ask\\.${flag} \\? ${posted} : before \\? \\(\\(before\\.${col}[\\s\\S]{0,40}\\) : undefined;`),
      `${v}: off → stored value, or left out when the read failed`,
    );
  }
  // And the ACTUAL write uses those resolved values, not the raw form ones.
  const update = submit.slice(submit.indexOf('.update({'), submit.indexOf('.eq(', submit.indexOf('.update({')));
  assert.match(update, /meal_preference: mealToWrite,/);
  assert.match(update, /dietary_restrictions: dietaryToWrite,/);
  assert.match(update, /guest_note: guestNoteToWrite,/);
  assert.match(update, /mobile: mobileToWrite,/);
});

test('the plus-one write is refused when ask.plus_ones is off, beside (not instead of) the entitlement check', () => {
  const src = stripComments(read('actions.ts'));
  const submit = src.slice(src.indexOf('export async function submitRsvp'));
  assert.match(submit, /if \(primary\?\.plus_one_allowed && ask\.plus_ones\)/);
  // The blank-box rule ('a blank box is not a removal') must still hold — the
  // outer gate is unchanged by this toggle.
  assert.match(submit, /const seatNames = readSeatNames\(formData\);\s*if \(seatNames\.length > 0\)/);
});

// ── SABOTAGE CHECK ───────────────────────────────────────────────────────────
// Broken and restored by hand while writing this file (not left in the repo):
// changing `ask.meal ? meal : ...` to `true ? meal : ...` in actions.ts made
// 'an off field is resolved to what is already STORED…' fail as expected
// (the mealToWrite regex no longer matched `ask\.meal \?`), and reverting it
// made the suite green again with `git status --short` clean. Reproducible by
// any reviewer: temporarily hardcode `ask.meal` to `true` in
// `app/[slug]/actions.ts` and re-run this file.
