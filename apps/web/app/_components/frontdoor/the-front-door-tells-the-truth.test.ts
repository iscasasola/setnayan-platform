/**
 * the-front-door-tells-the-truth.test.ts — the signed-out hero says only what is true,
 * and its one button reaches the event-type choice.
 *
 * Owner, 2026-10-25, approving Option B of
 * `prototypes/ceremo_deltas_2026-10-25/01_front_door.html` and correcting it before it
 * shipped: *"don't they pay for papic?"* · *"unlimited camera but papic credits is
 * used"* · *"free 50 credits is only on their first event"* · *"DO NOT INVENT … we want
 * to tell the truth"* — and, on the button: *"for setnayan use our template"*.
 *
 * WHAT IT HOLDS, read from the RENDERED hero (renderToStaticMarkup — the HTML a stranger
 * and a crawler get), not from the source text:
 *   1. the headline is the 20 Nov front page's (prototypes/front_page_home_2026-11-19 v5, approved 20 Nov,
 *      specs ef5df0b5) — "Setnayan" over "The home of every Filipino celebration." — and the photo promise
 *      under it is still ONE ALBUM, not free photos;
 *   2. neither the hero nor the home <title>/description says "never lose a photo" or
 *      "keep every photo" (both overpromise: photos use Papic credits);
 *   3. the Papic line is there (it moved from the hero to Live it · Papic with the 20 Nov page) and carries NO
 *      number (free credits are first-event only; an amount on the front door reads as per event);
 *   4. every way in opens the public type picker before sign-up (owner 2026-10-25): "All N kinds", the close and
 *      the thumb-zone bar open `/start` — which draws the SHIPPED create-event grid and routes each type by the
 *      same rule as the signed-in picker — and each tile goes straight to its own onboarding by that rule.
 *      (The 4 Nov "How it works" link left with the 4 Nov hero; the 20 Nov drawing has none — Plan it's
 *      "See all →" opens /features.)
 *      There is no sample or demo button, open or closed (owner, CLOUD_BOARD 5 Nov: "just do
 *      not add buttons") — 4e;
 *   5. the buttons wear the house terracotta token (`--m-mulberry`), not the gold.
 *
 * 🛡 Comments are stripped before any source match (`lib/strip-comments.ts`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = import.meta.dirname;
const APP = path.join(HERE, '..', '..');

function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&rsquo;|&#x27;|&#39;/g, '’')
    .replace(/&[a-z]+;|&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function hero(): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { FrontDoorAnchor } = await import('./front-door-anchor');
  return renderToStaticMarkup(React.createElement(FrontDoorAnchor));
}

async function landing(): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { FrontDoorLanding } = await import('./front-door-landing');
  return renderToStaticMarkup(
    React.createElement(FrontDoorLanding, {
      planPrices: { plus: null, pro: null, ultra: null },
      planFacts: { plusCredits: null, proCredits: null, freePapic: null },
    }),
  );
}

const OVERPROMISE = /never lose (a|any|every)? ?photos?|keep every photo/i;

test('1 · the headline is the approved one', async () => {
  const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/.exec(await hero());
  assert.ok(h1, 'the hero has no <h1>');
  const text = textOf(h1[1] ?? '');
  assert.match(
    text,
    /^Setnayan The home of every Filipino celebration\.$/,
    `The front-door headline reads "${text}". The 20 Nov front page (prototypes/front_page_home_2026-11-19 v5): ` +
      '"The home of every Filipino celebration.", with the name "Setnayan" as its small line (Google matches the name).',
  );
  assert.match(
    textOf(await hero()),
    /One link for your whole event: your guests, your suppliers, your photos — from the first idea to the memories\./,
    'The hero line is not the v6 one (owner "Approve v6", 20 Nov). The one-album promise now sits on Papic. Owner 2026-10-25: the promise is one album ' +
      '(not "Keep every photo" — photos use Papic credits).',
  );
  const page = textOf(await landing());
  assert.match(page, /Every guest’s phone is a camera\. Every photo they take lands in one album\./, 'Papic lost the one-album line (v6)');
  assert.match(
    page,
    /Plan it · Suppliers Suppliers you can trust\. No fake reviews\. No paid stars\. Ever\./,
    'the v6 "Suppliers you can trust" part is gone or reworded',
  );
  // The gift row says only what is live (the card's Setnayan gift) — never "every booking" (#7823 is on hold).
  assert.match(page, /A Setnayan gift\. Some bookings come with free Papic photos for your event\./, 'the v6 gift row is gone');
  assert.doesNotMatch(page, /every booking (comes|carries) (with )?a gift/i, 'the page promises a gift on every booking, which is not built');
  assert.doesNotMatch(page, /Many bookings come with/, '"many" is not measured — the gift row says "Some"');
  // Badges are earned three ways (lib/card-badges.ts): bookings, inquiries (Quick Responder, Trending Now count
  // inquiries) and checked papers (Setnayan Verified) — never "only from real bookings".
  assert.match(page, /Badges are earned\. Every badge and seal is earned: real bookings, real inquiries, checked papers\./, 'the badges row is not the corrected wording');
  assert.doesNotMatch(page, /comes only from real bookings/, 'the badges row says bookings only — Quick Responder, Trending Now and Verified are not booking-earned');
});

test('2 · no "never lose a photo" / "keep every photo" on the hero or the home <title>', async () => {
  assert.doesNotMatch(textOf(await hero()), OVERPROMISE, 'the hero overpromises the photos again');
  assert.doesNotMatch(textOf(await landing()), OVERPROMISE, 'the front page overpromises the photos again');
  const home = stripComments(readFileSync(path.join(APP, '(hub)', 'page.tsx'), 'utf8'));
  for (const name of ['HOME_TITLE', 'HOME_DESCRIPTION']) {
    const m = new RegExp(`const ${name}\\s*=\\s*'([^']+)'`).exec(home);
    assert.ok(m, `${name} is gone from app/(hub)/page.tsx — find it before changing this guard`);
    assert.doesNotMatch(m[1] ?? '', OVERPROMISE, `${name} overpromises the photos: ${JSON.stringify(m[1])}`);
  }
});

test('3 · the Papic line is there, and states no number', async () => {
  const page = await landing();
  assert.match(textOf(page), /Unlimited cameras · photos use Papic credits/, 'the front page lost "Unlimited cameras · photos use Papic credits"');
  assert.doesNotMatch(
    textOf(await hero()),
    /\d+\s*(free\s*)?credits?/i,
    'the hero states a credit amount — free credits are first-event only (owner 2026-10-25); say no number here',
  );
  const papic = /<section\b[^>]*class="[^"]*fl-papic[^"]*"[^>]*>([\s\S]*?)<\/section>/.exec(page);
  assert.ok(papic, 'the Papic section is gone');
  assert.doesNotMatch(textOf(papic[1] ?? ''), /\d+\s*(free\s*)?credits?/i, 'the Papic section states a credit amount');
});

function buttonsTo(html: string, cls: RegExp): { href: string; cls: string }[] {
  return [...html.matchAll(/<a\b(?=[^>]*\bclass="([^"]*)")(?=[^>]*\bhref="([^"]*)")[^>]*>/g)]
    .map((m) => ({ cls: m[1] ?? '', href: (m[2] ?? '').replace(/&amp;/g, '&') }))
    .filter((a) => cls.test(a.cls));
}

test('4 · every way in opens the public type picker, which is the shipped grid and routes by the shared rule', async () => {
  const kinds = /<a\b[^>]*\bhref="([^"]*)"[^>]*>All 19 kinds/.exec(
    (await (async () => {
      const { renderToStaticMarkup } = await import('react-dom/server');
      const { FrontDoorAnchor } = await import('./front-door-anchor');
      return renderToStaticMarkup(React.createElement(FrontDoorAnchor, { tiles: [], kinds: 19 }));
    })()).replace(/<!-- -->/g, ''),
  );
  assert.ok(kinds, 'the picker lost its "All N kinds" link');
  assert.equal(kinds[1], '/start', `"All N kinds" goes to ${kinds[1]} — it opens the public picker, /start`);
  const pills = buttonsTo(await landing(), /\bfd-btn-terra\b/);
  assert.ok(pills.length >= 2, `the close and the thumb-zone bar lost their buttons (${pills.length} found)`);
  for (const p of pills) {
    assert.equal(p.href, '/start', `a front-page button goes to ${p.href}. Owner 2026-10-25: it opens the public event-type picker (/start) BEFORE sign-up`);
  }
  const page = stripComments(readFileSync(path.join(APP, '(shell)/start/page.tsx'), 'utf8'));
  const grid = stripComments(readFileSync(path.join(APP, '(shell)/start/_components/start-type-grid.tsx'), 'utf8'));
  assert.match(page, /getCreatableEventTypes\(\)/, '/start must read the same roster as /dashboard/create-event');
  assert.match(page, /startHrefFor\(/, '/start must route each type by the shared rule (startHrefFor → onboardingRouteFor)');
  assert.doesNotMatch(page, /\/signup|\/login/, '/start must not put sign-up or sign-in in front of a type');
  assert.match(grid, /<EventTypePhotoPicker\b/, "/start must draw the shipped create-event grid, not a redrawn one");
  const picker = stripComments(
    readFileSync(path.join(APP, 'dashboard/(account)/create-event/_components/event-type-picker.tsx'), 'utf8'),
  );
  assert.match(picker, /onboardingRouteFor\(/, 'the signed-in picker stopped using the shared route rule');
  const { frontPageTiles } = await import('./front-door-landing');
  const tiles = frontPageTiles(
    [
      { key: 'wedding', label: 'Wedding', heroPhotoUrl: null, onboardingHref: '/onboarding/wedding' },
      { key: 'debut', label: 'Debut', heroPhotoUrl: null, onboardingHref: null },
    ],
    true,
  );
  assert.deepEqual(tiles.map((t) => t.href), ['/onboarding/wedding', '/onboarding/debut'], 'a front-page tile must go straight to its own onboarding');
});

test('4b · a type goes straight to its own onboarding (the shared rule, executed)', async () => {
  const { onboardingRouteFor } = await import('@/app/dashboard/(account)/create-event/_components/event-types');
  assert.equal(onboardingRouteFor({ key: 'wedding', onboardingHref: '/onboarding/wedding' }, true), '/onboarding/wedding');
  assert.equal(onboardingRouteFor({ key: 'debut', onboardingHref: null }, true), '/onboarding/debut');
  assert.equal(onboardingRouteFor({ key: 'simple_event', onboardingHref: '/onboarding/simple' }, true), '/onboarding/simple');
  assert.equal(onboardingRouteFor({ key: 'debut', onboardingHref: null }, false), null);
  assert.equal(onboardingRouteFor({ key: 'wedding', onboardingHref: null }, true), null);
});

test('4d · every public picker tile goes straight to /onboarding/<type> — no sign-up in front', async () => {
  // Owner 2026-10-25: "Yes they can create an event. But saving an event must link by logging in."
  const { startHrefFor, EVENT_TYPES_FALLBACK } = await import(
    '@/app/dashboard/(account)/create-event/_components/event-types'
  );
  const roster = [...EVENT_TYPES_FALLBACK, { key: 'simple_event', onboardingHref: '/onboarding/simple' }, { key: 'wake', onboardingHref: null }];
  for (const quizOn of [true, false]) {
    for (const t of roster) {
      const href = startHrefFor(t, quizOn);
      assert.match(href, /^\/onboarding\/[a-z_]+$/, `/start sends ${t.key} to ${href} — it must be its own /onboarding/<type>`);
    }
  }
  assert.equal(startHrefFor({ key: 'debut', onboardingHref: null }, true), '/onboarding/debut');
});

test('4e · no sample or demo button anywhere on the front page', async () => {
  // Owner, CLOUD_BOARD 5 Nov: the marketing pages carry no demo or sample buttons — "just do not add buttons" —
  // not hidden behind a switch either. Rendered hero, and every source file the signed-out page is built from.
  assert.doesNotMatch(await hero(), /href="\/sample/, 'the hero links into /sample');
  for (const f of ['front-door-anchor.tsx', 'front-door-landing.tsx', 'front-door-landing-data.ts', 'front-door.tsx']) {
    const src = stripComments(readFileSync(path.join(HERE, f), 'utf8'));
    assert.doesNotMatch(src, /['"`]\/sample(\/|['"`#?])/, `${f} links into /sample — no sample or demo buttons on the marketing pages`);
    assert.doesNotMatch(src, /sampleOpensHere/, `${f} gates a sample door behind the switch — the owner said no buttons at all`);
  }
});

test('5 · the buttons are terracotta (the house token), not the gold', async () => {
  for (const { cls } of buttonsTo(await landing(), /\bfl-btn\b/)) {
    assert.match(cls, /\bfd-btn-terra\b/, `a front-page button's class is "${cls}" — it must be .fd-btn-terra`);
    assert.doesNotMatch(cls, /\bfd-btn-gold\b/, 'a front-page button still wears the gold');
  }
  const css = readFileSync(path.join(HERE, 'front-door.css'), 'utf8');
  const rule = /^\.fd-btn-terra\s*\{([^}]*)\}/m.exec(css);
  assert.ok(rule, '.fd-btn-terra is gone from front-door.css');
  assert.match(rule[1] ?? '', /background:\s*var\(--m-mulberry\)/, '.fd-btn-terra must paint var(--m-mulberry)');
});
