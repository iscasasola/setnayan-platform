/**
 * 🏠 THE INVITATION'S WELCOME PAGE IS THE GUEST'S OWN.
 *
 * Owner, 2026-09-30, verbatim: *"on invitation we can set the reminders. Home is
 * their personalization. customized mood board. reminders. also E-Gifts should
 * already show."* — and, the same day, the page's name: *"on Invitation, the
 * menu is Welcome - Details - Our Love Story - Me"*. DECISION_LOG "THE
 * INVITATION'S HOME IS THE GUEST'S OWN PAGE".
 *
 * What was there before: the guest's own dress code sat inside Details; the
 * couple's `what_to_bring` note sat inside Details under "What to bring"; and
 * the E-Gifts door ("Send a blessing") was drawn at the very FOOT of the page,
 * below the sign-out line, and never in the Maker's canvas — so the couple never
 * saw it and a guest met it last, if at all.
 *
 * This holds three things, from three directions:
 *
 *   1. DECISION — `welcomeParts` lists the guest's look · Reminders · E-Gifts,
 *      in that order, only on the Invitation, and NOTHING that has nothing in it
 *      (no reminders → no Reminders; no gift method → no E-Gifts, never a "no
 *      gifts" block). The Maker draws each place so the couple can fill it.
 *   2. RENDER   — `GuestWelcome` puts the three on the page in that order, as a
 *      phone receives it, and renders nothing at all when none is set.
 *   3. WIRING   — both trees and the Maker's navigator ask the SAME rule; the
 *      reminders leave Details; the foot strip drops its gift door when Welcome
 *      carries it (one door per page).
 *
 * Run from `apps/web`: `npx tsx --test lib/welcome-is-the-guests-own.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import { scenesLeftForDetails, welcomeCarriesGifts, welcomeParts, type WelcomeInput } from './invitation-welcome';
import { anchorOfTile } from './maker-navigator-tabs';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const SET: WelcomeInput = {
  stage: 'rsvp',
  bodyNormal: true,
  scenes: ['countdown', 'schedule', 'venue_map', 'dress_code', 'what_to_bring'],
  identified: true,
  reminders: 'Arrive by 2:30.\nBring your ticket.',
  giftHref: '/ana-and-ben/pabuya',
  maker: false,
};

/* ══ 1 · DECISION ═══════════════════════════════════════════════════════════ */

test('1 · a guest whose couple set all three meets their look, then Reminders, then E-Gifts', () => {
  assert.deepEqual(welcomeParts(SET), ['look', 'reminders', 'gifts']);
});

test('1 · nothing empty: no reminders written → no Reminders; no gift method → no E-Gifts', () => {
  assert.deepEqual(welcomeParts({ ...SET, reminders: '   ' }), ['look', 'gifts']);
  assert.deepEqual(welcomeParts({ ...SET, reminders: null, giftHref: null }), ['look']);
  // a couple who hid the dress code and the reminders scene, and set no gifts: Welcome holds nothing
  assert.deepEqual(welcomeParts({ ...SET, scenes: ['countdown'], giftHref: null }), []);
  // a stranger has no role to dress for
  assert.deepEqual(welcomeParts({ ...SET, identified: false }), ['reminders', 'gifts']);
});

test('1 · Welcome (this rule) is the Invitation’s — not the Save the Date, the Day or after it', () => {
  for (const stage of ['save_the_date', 'event', 'editorial'] as const) {
    assert.deepEqual(welcomeParts({ ...SET, stage }), [], stage);
  }
  for (const stage of ['save_the_date', 'editorial'] as const) {
    assert.equal(welcomeCarriesGifts({ ...SET, stage }), false, `${stage}: the gift door stays at the foot`);
  }
  // 📱 The Day has a Welcome of its own (owner 2026-09-30, "THE DAY'S MENU HAS
  // FIVE") — `welcomePartsOnTheDay`, `each-tab-is-its-own-page.test.ts` — and it
  // carries the gift door, so the foot strip stands down on the day too. Never
  // for the Maker's canvas, which does not draw the day's Welcome.
  assert.equal(welcomeCarriesGifts({ ...SET, stage: 'event' }), true, 'event: the day’s Welcome carries E-Gifts');
  assert.equal(welcomeCarriesGifts({ ...SET, stage: 'event', maker: true }), false, 'event: never in the Maker’s canvas');
  assert.equal(welcomeCarriesGifts({ ...SET, stage: 'event', giftHref: null }), false, 'event: no door, nothing carried');
  assert.deepEqual(welcomeParts({ ...SET, bodyNormal: false }), []);
});

test('1 · the Maker draws every place, filled or not, so the couple can fill it', () => {
  assert.deepEqual(
    welcomeParts({ ...SET, identified: false, reminders: null, giftHref: null, maker: true }),
    ['look', 'reminders', 'gifts'],
  );
});

test('1 · Reminders leave Details for Welcome; the dress code stays on Details for everyone', () => {
  const rows = SET.scenes.map((t) => ({ widget_type: t }));
  const left = scenesLeftForDetails(rows, welcomeParts(SET)).map((w) => w.widget_type);
  assert.ok(!left.includes('what_to_bring'), 'Reminders drawn twice');
  assert.ok(left.includes('dress_code'), 'everyone’s palette must stay on Details');
  // when Welcome does not carry them, Details keeps them where they were
  const kept = scenesLeftForDetails(rows, welcomeParts({ ...SET, reminders: '' })).map((w) => w.widget_type);
  assert.ok(kept.includes('what_to_bring'));
});

test('1 · the Maker’s navigator files the three under Welcome (anchor home), never under Details', () => {
  for (const k of ['f:look', 'w:what_to_bring', 'f:gifts']) assert.equal(anchorOfTile(k), 'home', k);
  assert.equal(anchorOfTile('w:dress_code'), 'details', 'everyone’s dress code stays a Details scene');
});

/* ══ 2 · RENDER ═════════════════════════════════════════════════════════════ */

const BOARD = {
  reception: ['#7A1F2B', '#C9A24B', '#F4E9DC', '#2B1D14', '#8E3B5B'],
  principal_sponsors: ['#C9A24B', '#F4E9DC'],
  touched_roles: ['principal_sponsors'],
};
const CONFIG = {
  roles: { principal_sponsor_ninang: { style: 'long_gown', note: 'in the wedding colours' } },
  dos: ['Flat shoes for the garden'],
  donts: ['White'],
};
const words = { eventWord: 'wedding', solemn: false, twoPeople: true, theOrganizer: 'the couple' } as never;

async function welcome(props: Record<string, unknown>): Promise<string> {
  const { GuestWelcome } = await import('../app/[slug]/_components/guest-welcome');
  const { WhatToBringWidget } = await import('../app/[slug]/_components/what-to-bring-widget');
  return renderToStaticMarkup(
    React.createElement(GuestWelcome as never, {
      words,
      look: {
        config: CONFIG,
        ceremonyType: null,
        genderSeparation: null,
        guestRole: 'principal_sponsor_ninang',
        march: null,
        rolePalette: BOARD,
      },
      reminders: React.createElement(WhatToBringWidget, { text: 'Arrive by 2:30.' }),
      giftHref: '/ana-and-ben/pabuya',
      ...props,
    }),
  );
}

test('2 · the page carries the three in order: their look · Reminders · E-Gifts', async () => {
  const html = await welcome({ parts: welcomeParts(SET) });
  const at = (needle: string) => {
    const i = html.indexOf(needle);
    assert.ok(i >= 0, `missing on the Welcome page: ${needle}`);
    return i;
  };
  const look = at('data-dress-code="you"');
  const reminders = at('<span>Reminders</span>');
  const gifts = at('data-welcome-gifts=""');
  assert.ok(look < reminders && reminders < gifts, 'Welcome must read: look, then Reminders, then E-Gifts');
  // their look is THEIRS: their role, and their Do's & Don'ts — not everyone's palette
  assert.match(html, /You are Ninang/);
  assert.match(html, /Flat shoes for the garden/);
  assert.doesNotMatch(html, /data-dress-code="ours"|data-dress-code="roles"/, 'everyone’s palette belongs on Details');
  assert.match(html, /href="\/ana-and-ben\/pabuya"/, 'the E-Gifts door opens the gift page');
  assert.match(html, /Arrive by 2:30\./);
});

test('2 · nothing set → nothing drawn (never an empty block)', async () => {
  assert.equal(await welcome({ parts: [] }), '');
  // listed but personal-less: a guest whose role the couple said nothing for gets no look block
  const html = await welcome({
    parts: ['look'],
    look: { config: {}, ceremonyType: null, genderSeparation: null, guestRole: 'guest', march: null, rolePalette: {} },
  });
  assert.doesNotMatch(html, /data-dress-code|What to wear|Reminders|E-Gifts/);
  // no gift method: no door, no apology
  const noGift = await welcome({ parts: welcomeParts({ ...SET, giftHref: null }), giftHref: null });
  assert.doesNotMatch(noGift, /E-Gifts|pabuya|no gifts/i);
});

test('2 · the Maker sees each place, after its navigator marker', async () => {
  const mark = (key: string) => React.createElement('span', { hidden: true, 'data-maker-section': key });
  const html = await welcome({ parts: ['look', 'reminders', 'gifts'], look: null, giftHref: null, maker: true, mark });
  const order = [...html.matchAll(/data-maker-section="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, ['f:look', 'w:what_to_bring', 'f:gifts']);
  assert.match(html, /Add a way to receive gifts\./);
});

/* ══ 3 · WIRING ═════════════════════════════════════════════════════════════ */

test('3 · both trees mount the one Welcome section and ask the one rule', () => {
  const BODY = read('app/[slug]/_components/site-body.tsx');
  // Two trees × (the Invitation's Welcome + the Day's Welcome, 📱 owner
  // 2026-09-30 "THE DAY'S MENU HAS FIVE") — one component, four mounts.
  assert.equal(BODY.match(/<GuestWelcome\b/g)?.length, 4, 'the guest tree AND the stranger’s tree (the Maker’s canvas), the Invitation and the Day');
  assert.equal(BODY.match(/const welcome = welcomeParts\(\{/g)?.length, 2);
  // Details draws what Welcome left it, in both trees
  assert.equal(BODY.match(/const detailsScenes = scenesLeftForDetails\(/g)?.length, 2);
  // (📱 each scene is drawn by one function per tree, so the love story scene
  // can take its own tab on a tabbed page — the list it draws is still
  // Welcome's leftovers: `detailsSceneList` is `detailsScenes` less that scene.)
  assert.match(BODY, /const renderScene = \(widget: \(typeof detailsScenes\)\[number\]\) => \(\s*<HideableWidgetRender/);
  assert.match(BODY, /\{detailsSceneList\.map\(renderScene\)\}/);
  assert.match(BODY, /const detailsSceneList = storyScene \? detailsScenes\.filter\(\(w\) => w !== storyScene\) : detailsScenes;/);
  assert.match(BODY, /\{list\.map\(\(widget\) => \(\s*\/\*[\s\S]*?<PublicHideableWidget|\{list\.map\(\(widget\) => \(\s*<Fragment/);
  // this guest's own look is on Welcome, so Details shows everyone's
  assert.match(BODY, /dressCodeGeneral=\{welcome\.includes\('look'\)\}/);
  // the gift door is drawn once: the foot strip stands down when Welcome carries it
  assert.match(BODY, /welcomeCarriesGifts\(\{[^}]*giftHref: doorways\.pabuya[^}]*\}\)\s*\?\s*null\s*:\s*doorways\.pabuya/);
  // the guest tree's Welcome sits after the reply and before Details
  const guest = BODY.slice(BODY.indexOf('const guestTree'));
  const reply = guest.indexOf('rsvpSheetTrigger(');
  const mount = guest.indexOf('<GuestWelcome');
  const details = guest.indexOf('SITE_MENU_ANCHORS.details');
  assert.ok(reply > 0 && reply < mount && mount < details, 'Welcome: after the reply, before Details');
});

test('3 · the navigator lists what the canvas draws, through the same rule', () => {
  const LIST = read('lib/maker-scene-list.ts');
  assert.match(LIST, /const welcome = welcomeParts\(\{/);
  const DISPATCH = read('app/[slug]/_components/hideable-widget-render.tsx');
  assert.match(DISPATCH, /guestRole=\{guestView && !dressCodeGeneral \?/);
});
