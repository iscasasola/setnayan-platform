/**
 * one-setting-two-doors.test.ts — "WHAT THE REPLY ASKS" IS ONE SETTING WITH TWO DOORS (owner
 * 2026-10-07, *"make sure to make the adjustments and mapping on event hub maker as well"*;
 * studio round 3, 2026-10-08: *"Test 'one setting, two doors'"*).
 *
 * Studio › RSVP "What the reply asks" (`maker-rsvp-ask.tsx`, fed by `launch/page.tsx`) and
 * Guests › Setup (`guests/invite/_components/invite-panel.tsx` → `guest-setup-rows.tsx`, built on
 * `rd/guests-setup-with-the-maker`) must:
 *
 *   A · READ draft-over-live `events.rsvp_ask_config` through the ONE sanitizer
 *       (`sanitizeRsvpAskConfig`) — the draft's value when the draft holds the key, else live;
 *   B · DRAW the same answer from one draft fixture (each of the six asks on/off alike);
 *   C · WRITE the WHOLE object through the ONE draft door (`hubDraftAction`, intent save,
 *       `{ events: { rsvp_ask_config: next } }`, `next` = everything shown + the change).
 *
 * ⚠ THE GUESTS DOOR IS NOT ON THIS BRANCH. `rd/studio-round-3` is built on `rd/studio-followups`;
 * Guests › Setup lives on `rd/guests-setup-with-the-maker`. Each Guests assertion is therefore BY
 * PATH: when its files are in the tree (after both branches merge) it is read and drawn exactly
 * like the Studio door; until then that half is reported as a `todo` naming the missing path —
 * never a silent pass. The Studio half always runs.
 *
 * 🛡 Sabotaged once each (2026-10-08), each red alone: the Studio save sending `{ ...patch }`
 * instead of `{ ...latest.current, ...patch }` → C; the page reading the draft's
 * `rsvp_ask_config` raw (no sanitizer) → A; every Studio ask switch drawn `on={true}` → B. The
 * Guests half was run against `rd/guests-setup-with-the-maker`'s tree: 6/6 green.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { RSVP_ASK_FIELDS, RSVP_ASK_LABEL, rsvpAsks, sanitizeRsvpAskConfig, type RsvpAskConfig } from './rsvp-ask';

(globalThis as unknown as { React: unknown }).React = React;
/* The doors import the shipped server actions, whose modules import `server-only` — stubbed, as the repo's other render tests do. */
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const D = 'app/dashboard/[eventId]';
const STUDIO_DOOR = `${D}/launch/_components/maker-rsvp-ask.tsx`;
const STUDIO_READ = `${D}/launch/page.tsx`;
const GUESTS_READ = `${D}/guests/invite/_components/invite-panel.tsx`;
const GUESTS_DOOR = `${D}/_components/guest-setup/guest-setup-rows.tsx`;
const has = (rel: string) => existsSync(join(WEB, rel));
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const missing = (rel: string) => `Guests › Setup is not on this branch (${rel} is absent — it lives on rd/guests-setup-with-the-maker); asserted by path once merged`;

/** ONE draft fixture: live asks nothing extra off; the draft turns Meal and Mobile off and keeps the rest. */
const LIVE = { meal: true, dietary: false, whoCanRsvp: 'anyone' } as const;
const DRAFT_EVENTS: Record<string, unknown> = { rsvp_ask_config: { meal: false, mobile: false, song_request: true, junk: 7 } };
/** The rule both doors spell: the draft's value when the draft holds the key, else live — through the sanitizer. */
const draftOverLive = (live: unknown, draft: Record<string, unknown> | null): RsvpAskConfig =>
  sanitizeRsvpAskConfig(draft && 'rsvp_ask_config' in draft ? draft.rsvp_ask_config : live);
const CONFIG = draftOverLive(LIVE, DRAFT_EVENTS);
const EXPECTED = Object.fromEntries(RSVP_ASK_FIELDS.map((f) => [f, rsvpAsks(CONFIG, f)]));

/** Every ask's on/off as a door drew it — a switch (`aria-checked`/`checked`) or a toggle button (`aria-pressed`) carrying its word. */
function drawnAsks(html: string): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const f of RSVP_ASK_FIELDS) {
    const word = RSVP_ASK_LABEL[f].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const control = new RegExp(`<(?:button|input)[^>]*(?:role="switch"|aria-pressed)[^>]*>(?:(?!<(?:button|input)\\b)[\\s\\S]){0,400}?${word}|${word}(?:(?!<(?:button|input)\\b)[\\s\\S]){0,400}?<(?:button|input)[^>]*(?:role="switch"|aria-pressed)[^>]*>`);
    const m = control.exec(html);
    assert.ok(m, `the door does not draw the “${RSVP_ASK_LABEL[f]}” ask as a control`);
    const tag = /<(?:button|input)[^>]*(?:role="switch"|aria-pressed)[^>]*>/.exec(m[0])![0];
    out[f] = /aria-checked="true"|aria-pressed="true"|\schecked=""/.test(tag);
  }
  return out;
}

const GUESTS_HERE = has(GUESTS_DOOR);
/** The Guests half: runs when its files are here; a `todo` naming the missing path when they are not. */
const guestsTest = (name: string, fn: () => void | Promise<void>) =>
  test(name, GUESTS_HERE ? {} : { todo: missing(GUESTS_DOOR) }, async () => {
    if (GUESTS_HERE) await fn();
  });

test('A · Studio › RSVP reads draft-over-live rsvp_ask_config through the one sanitizer', () => {
  assert.deepEqual(CONFIG, { meal: false, mobile: false, song_request: true }, 'the sanitizer kept a stray key or dropped an ask');
  assert.deepEqual(draftOverLive(LIVE, {}), { meal: true, dietary: false, whoCanRsvp: 'anyone' }, 'with nothing drafted the live config is not read');

  const page = read(STUDIO_READ);
  assert.match(page, /let rsvpAsk: RsvpAskConfig = sanitizeRsvpAskConfig\(printEvent\.rsvp_ask_config\);/, 'Studio: live is not read through the sanitizer');
  assert.match(page, /if \(d && 'rsvp_ask_config' in d\.events\) \{\s*rsvpAsk = sanitizeRsvpAskConfig\(d\.events\.rsvp_ask_config\);/, 'Studio: the draft does not win when it holds the key');

});

/* `invite-panel.tsx` exists on both branches — only the Setup rows say it is the Setup door. */
guestsTest('A · Guests › Setup reads it the same way', () => {
  const panel = read(GUESTS_READ);
  assert.match(panel, /const drafted = Boolean\(draft && 'rsvp_ask_config' in draft\.events\);/, 'Guests: “drafted” is not “the draft holds the key”');
  assert.match(panel, /sanitizeRsvpAskConfig\(drafted \? draft!\.events\.rsvp_ask_config : row\.rsvp_ask_config\)/, 'Guests: not draft-over-live through the sanitizer');
});

let drawnStudio: Record<string, boolean> | null = null;
test('B · one draft fixture: Studio › RSVP draws the six asks the draft holds', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerRsvpSettings } = await import(`../${STUDIO_DOOR.replace(/\.tsx$/, '')}`);
  const studio = renderToStaticMarkup(
    React.createElement(MakerRsvpSettings, {
      eventId: 'e1',
      studio: true,
      current: CONFIG,
      drafted: true,
      replyBy: { date: 'January 14, 2027', isDefault: false },
      replyByOwn: { deadline: '2027-01-14', pricingMode: 'realtime' },
      requests: { count: 0, list: null },
    }),
  );
  /* The asks' block, by its made-once mark (its heading reads "What the reply asks" here and "RSVP asks" once the shared part lands). */
  assert.match(studio, /data-made-once="rsvp-ask"/, 'Studio › RSVP no longer draws its asks block');
  drawnStudio = drawnAsks(studio);
  console.log(`studio door: ${JSON.stringify(drawnStudio)}`);
  assert.deepEqual(drawnStudio, EXPECTED, 'Studio › RSVP draws a different answer from the draft');
});

guestsTest('B · the same draft fixture: Guests › Setup draws what Studio › RSVP draws', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { GuestSetupRows } = await import(`../${GUESTS_DOOR.replace(/\.tsx$/, '')}`);
  const ROUTER = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };
  const guests = renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: ROUTER as never },
      React.createElement(GuestSetupRows, {
        eventId: 'e1',
        config: CONFIG,
        drafted: true,
        reply: { own: '2027-01-14', pricingMode: 'realtime', fallback: null },
        toInvite: 4,
        passSrc: '/api/hub-print/pass?event=e1&mode=screen&pass_guest=first',
        oneLink: { url: 'https://setnayan.com/e1/invite', qrSvg: '<svg data-qr=""></svg>', notice: null },
        headcount: { locked: false, attending: 3, heads: 3 },
      }),
    ),
  );
  assert.deepEqual(drawnAsks(guests), EXPECTED, 'Guests › Setup draws a different answer from the draft');
  if (drawnStudio) assert.deepEqual(drawnAsks(guests), drawnStudio, 'Guests › Setup and Studio › RSVP draw the same draft differently');
});

test('C · Studio › RSVP writes the WHOLE object through the one draft door', () => {
  const door = read(STUDIO_DOOR);
  assert.match(door, /const next: RsvpAskConfig = \{ \.\.\.latest\.current, \.\.\.patch \};/, 'Studio: a save sends only the change, not the whole object');
  assert.match(door, /fd\.set\('intent', 'save'\);\s*fd\.set\('patch', JSON\.stringify\(\{ events: \{ rsvp_ask_config: next \} \}\)\);[\s\S]{0,700}?hubDraftAction\(eventId, fd\)/, 'Studio: the save leaves the draft door');
  assert.doesNotMatch(door, /updateRsvpAsk|rsvp_ask_config:\s*\{\s*\[/, 'Studio: an ask is written on its own');

});

guestsTest('C · Guests › Setup writes it the same way', () => {
  const rows = read(GUESTS_DOOR);
  assert.match(rows, /fd\.set\('patch', JSON\.stringify\(\{ events: \{ rsvp_ask_config: next \} \}\)\)/, 'Guests: the save is not the whole rsvp_ask_config');
  assert.match(rows, /hubDraftAction/, 'Guests: the save leaves the draft door');
});
