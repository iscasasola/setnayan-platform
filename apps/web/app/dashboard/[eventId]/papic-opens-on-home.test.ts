/**
 * GUARD — PAPIC OPENS ON HOME, UNDER ITS OWN CARD (owner 2026-10-23: *"does not open to a new page. just expands on
 * home"* · *"expanding opens the rest of the settings under it not open a new page"*; the guest-card ruling the same
 * day: under the card, event-wide only).
 *
 *   1. The card's head is a BUTTON that toggles the settings region — never a link to /studio/papic.
 *   2. The region grows and fades (420 ms, the house ease), is inert while folded, and reduced motion skips it.
 *   3. Home hands the card the camera settings in the 'home' seat (no Credits per guest, no per-guest face blocking —
 *      one door to the guest cards instead), and every door the old quick view held is reachable OPEN: the credits
 *      counter and Add more in the settings, the Thank-You Video door as the open card's first row.
 *   5. CLOSED, the card is the head and nothing else (owner 2026-10-26: *"the gallery should not be there"* · *"it just
 *      needs to have a quick on off button and expand for more settings for papic"*): the camera mark · "Papic" · the
 *      small "Guest photos" · the switch (shown closed too, a sibling of the head's button) · the ›. Rendered, not read.
 *
 * Sabotage (2026-10-23): the head navigates to `…/studio/papic` → 1 red; drop `inert` → 2 red; the page passes
 * `seat="page"` → 3 red. Restored → green. (2026-10-26): the latest-five strip re-added to the card → 5 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';
import { PapicHomeCard } from './_components/papic-home-card';

// `"jsx": "preserve"` compiles the card to the classic runtime — `React` must be global before it renders.
(globalThis as unknown as { React: unknown }).React = React;

const code = (f: string) => stripComments(readFileSync(join(process.cwd(), f), 'utf8'));
const CARD = 'app/dashboard/[eventId]/_components/papic-home-card.tsx';
const HOME = 'app/dashboard/[eventId]/page.tsx';
const CAMERA = 'app/dashboard/[eventId]/studio/papic/_components/papic-camera-settings.tsx';

test('1 · the head is a button that opens the settings under the card — never a door to another page', () => {
  const c = code(CARD);
  assert.match(c, /<button[\s\S]{0,200}aria-expanded=\{open\}[\s\S]{0,120}onClick=\{\(\) => setOpen/, 'the card head no longer toggles the settings');
  assert.doesNotMatch(c, /studio\/papic/, 'the card links to the Papic page again');
  assert.doesNotMatch(c, /router\.push|startViewTransition/, 'the card navigates');
});

test('2 · the region grows and fades in place, inert while folded, still under reduced motion', () => {
  const c = code(CARD);
  assert.match(c, /inert=\{!open\}/, 'the folded settings can still take focus');
  assert.match(c, /duration-\[420ms\]/, 'not the house 420 ms');
  assert.match(c, /grid-rows-\[1fr\][\s\S]{0,40}grid-rows-\[0fr\]/, 'the region does not grow from its own height');
  assert.match(c, /motion-reduce:transition-none/, 'reduced motion still animates');
});

test('3 · Home hands over the event-wide settings, and every door the old quick view held is reachable open', () => {
  const h = code(HOME);
  assert.match(h, /<PapicCameraSettings\s+eventId=\{eventId\}\s+seat="home"/, 'Home opens the page seat (with per-guest rows)');
  const cam = code(CAMERA);
  assert.doesNotMatch(cam, /<FaceBlockingList/, 'a per-guest face list is back under the card');
  assert.match(cam, /<GuestAllotmentsChoice eventId=\{eventId\} variant="row" eventWide returnTo=\{seat === 'home' \? 'home' : null\}/, 'the event-wide limit is not under Home’s card, or does not land back on Home');
  assert.match(cam, /href=\{`\/dashboard\/\$\{eventId\}\/guests`\}[\s\S]{0,400}guest card/, 'no door to the guest cards');
  // The credits and Add more moved off the closed card — they must live in the open settings Home hands over.
  assert.match(cam, /data-papic-counter=""/, 'the credits counter is not in the open settings');
  assert.match(cam, /\{buy \? <div className="flex" data-papic-add-more="">\{buy\}<\/div> : null\}/, 'Add more is not in the open settings');
  assert.match(h, /<PapicCameraSettings[\s\S]{0,240}credits=\{\{ total: papicNow\.total, left: papicNow\.count \}\}[\s\S]{0,40}buy=\{<PapicBuySheet/, 'Home does not hand the open settings the credits and Add more');
  // After the day the Thank-You Video door leads the OPEN card (it lived on the closed one until 2026-10-26).
  const open = rendered({ open: true, phase: 'after' });
  assert.match(open, /data-papic-thank-you=""[\s\S]*Thank-You Video[\s\S]*data-sentinel-settings/, 'the Thank-You Video door is lost, or not the open card’s first row');
});

test('4 · the controller page is retired for the couple on the web — an old link opens the card on Home (owner 2026-10-24)', () => {
  const page = code('app/dashboard/[eventId]/studio/papic/page.tsx');
  assert.match(page, /if \(!storeShell && [\s\S]{0,120}member_type === 'couple'\) \{\s*redirect\(`\/dashboard\/\$\{eventId\}\?papic=open`\);/, 'a plain visit still draws the separate Papic page for the couple');
  const c = code(CARD);
  assert.match(c, /searchParams\.get\('papic'\) !== 'open'/, 'the card does not open itself for an old link');
  assert.match(c, /window\.history\.replaceState\(/, 'the card leaves ?papic=open in the address — Home’s own URL must come back');
  assert.match(c, /<ChevronRight[\s\S]{0,200}rotate-90/, 'the head’s › does not turn to ⌄ as the card grows');
});

/** The real card, rendered: sentinel settings and switch, so whatever else appears was drawn by the card itself. */
function rendered({ open, phase = 'live' }: { open: boolean; phase?: 'before' | 'live' | 'after' }): string {
  return renderToStaticMarkup(
    createElement(PapicHomeCard, {
      name: 'Papic',
      brand: 'Guest photos',
      icon: createElement('i', { 'data-sentinel-icon': '' }),
      phase,
      thankYouHref: '/thank-you',
      settings: createElement('i', { 'data-sentinel-settings': '' }, 'SETTINGS'),
      headControl: createElement('i', { 'data-sentinel-switch': '' }),
      defaultOpen: open,
    }),
  );
}

test('5 · closed, the card is the head only — mark · Papic · Guest photos · the switch · › (owner 2026-10-26)', () => {
  const html = rendered({ open: false, phase: 'after' });
  // Everything above the settings region is what the closed card shows.
  const cut = html.indexOf('<div id=');
  assert.ok(cut > 0 && html.slice(cut).includes('role="region"'), 'the settings region is not the last part of the card');
  const closed = html.slice(0, cut);
  assert.match(closed, /data-sentinel-switch/, 'the Papic switch is not on the closed card');
  assert.match(closed, /data-sentinel-icon/, 'the camera mark is gone');
  assert.match(closed, /lucide-chevron-right/, 'the › is gone');
  assert.equal((closed.match(/<button\b/g) ?? []).length, 1, 'the closed card draws a press beyond its head');
  assert.doesNotMatch(closed, /<button[^>]*>(?:(?!<\/button>)[\s\S])*data-sentinel-switch/, 'the switch is inside the head button (invalid HTML)');
  assert.doesNotMatch(closed, /<(?:a|img|meter|progress)\b|role="progressbar"/, 'the closed card draws a link, a photo or a meter again');
  const words = closed.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  assert.equal(words, 'Papic Guest photos', `the closed card says more than its name: "${words}"`);
  assert.doesNotMatch(html, /\bmd:hidden\b|hidden md:/, 'the phone gets its own closed face again — one card, everywhere');

  // The card takes nothing it could draw closed: its props are the head, the switch and what opens under it.
  const c = code(CARD);
  const props = c.match(/export function PapicHomeCard\(\{([\s\S]*?)\}: \{/)?.[1] ?? '';
  const names = props.split(',').map((p) => p.trim().split(/\s|=/)[0]).filter(Boolean).sort();
  assert.deepEqual(names, ['brand', 'defaultOpen', 'headControl', 'icon', 'marker', 'name', 'phase', 'settings', 'thankYouHref'], 'the card takes a prop beyond the head and its settings (a strip, a meter, an action row?)');
});
