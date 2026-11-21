/**
 * GUARD — PAPIC OPENS IN PLACE, UNDER ITS OWN CARD — in Memories since 2026-11-08 (THE ONE BUILD: *"Papic + Thank You
 * into Memories"*; renamed from `papic-opens-on-home.test.ts`, the card itself unchanged) (owner 2026-10-23: *"does not open to a new page. just expands on
 * home"* · *"expanding opens the rest of the settings under it not open a new page"*; the guest-card ruling the same
 * day: under the card, event-wide only).
 *
 *   1. The card's head is a BUTTON that toggles the settings region — never a link to /studio/papic.
 *   2. The region grows and fades (420 ms, the house ease), is inert while folded, and reduced motion skips it.
 *   3. Memories hands the card the camera settings in the 'memories' seat (no Credits per guest, no per-guest face blocking —
 *      one door to the guest cards instead), and every door the old quick view held is reachable OPEN: the credits
 *      counter and Add more in the settings, the Thank-You Video door as the open card's first row.
 *   5. CLOSED, the card is the head and nothing else (owner 2026-10-26: *"the gallery should not be there"* · *"it just
 *      needs to have a quick on off button and expand for more settings for papic"*): the camera mark · "Papic" · the
 *      small "Guest photos" · the switch (shown closed too, a sibling of the head's button) · the ›. Rendered, not read.
 *
 * Sabotage (2026-10-23): the head navigates to `…/studio/papic` → 1 red; drop `inert` → 2 red; the page passes
 * `seat="page"` → 3 red. Restored → green. (2026-10-26): the latest-five strip re-added to the card → 5 red.
 *
 * 🔁 UPDATED ON PURPOSE 2026-11-20 (owner, "memories approved" — `prototypes/memories_redesign_2026-11-20/`, DECISION_LOG
 * "EVENT › MEMORIES — PAPIC ON TOP + FIVE OPENED PAGES, APPROVED" (3): *"Tapping the block or that row opens every Papic
 * setting as a full-screen rising sheet … no longer unfolding in place"*). What changed is HOW it opens — the shared
 * `RiseScreen` instead of the inline region — so 1, 2, 4 and 5 now hold the rise; what they held is still held: never
 * another page, every setting reachable, the switch outside the head's button, nothing extra on the face.
 * Sabotage (2026-11-20): the head's press → `router.push` → 1 red; the settings drawn inline again (no RiseScreen) → 2
 * red; the chapter row after the settings → 2 red; a meter on the face → 5 red. Restored → green.
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
const MEMORIES = 'app/dashboard/[eventId]/memories/page.tsx';
const CAMERA = 'app/dashboard/[eventId]/studio/papic/_components/papic-camera-settings.tsx';

test('1 · the head and the "All Papic settings" row are buttons that RISE the settings — never a door to another page', () => {
  const c = code(CARD);
  assert.match(c, /<button\s+type="button"\s+aria-haspopup="dialog"\s+aria-expanded=\{open\}\s+onClick=\{\(\) => setOpen\(true\)\}[^>]*data-papic-card-head=""/, 'the card head no longer opens the settings');
  assert.match(c, /onClick=\{\(\) => setOpen\(true\)\}[^>]*data-papic-all-settings=""/, 'the "All Papic settings" row does not open them');
  assert.match(c, /All \{name\} settings/, 'the row is not "All Papic settings"');
  assert.doesNotMatch(c, /studio\/papic/, 'the card links to the Papic page again');
  assert.doesNotMatch(c, /router\.push|startViewTransition/, 'the card navigates');
  // The block's body opens them too — but never a tap on one of its own presses, or a click bubbling out of a portal.
  assert.match(c, /if \(!e\.currentTarget\.contains\(t\) \|\| t\.closest\(OWN_PRESS\)\) return;\s*setOpen\(true\);/, 'a tap on the block body is not guarded');
});

test('2 · every setting RISES as one full screen — the shared RiseScreen, "Shooting into" first, drawn only while open', () => {
  const c = code(CARD);
  assert.match(c, /import \{ RiseScreen \} from '@\/app\/_components\/rise\/rise-screen';/, 'not the shared rise-full-screen part');
  const rise = /\{open \? \(\s*<RiseScreen\b[\s\S]*?<\/RiseScreen>\s*\) : null\}/.exec(c)?.[0] ?? '';
  assert.ok(rise, 'the settings are not risen, or are drawn while closed');
  assert.match(rise, /onClose=\{\(\) => setOpen\(false\)\}/, 'the ✕ / Back does not close it');
  assert.ok(rise.indexOf('{chapter}') > 0 && rise.indexOf('{chapter}') < rise.indexOf('{settings}'), '"Shooting into" is not the first row of the risen settings');
  // The inline unfold is gone — no second way to show the same settings.
  assert.doesNotMatch(c, /grid-rows-\[0fr\]|inert=\{!open\}/, 'the settings still unfold in place under the card');
  // Rendered: closed, no settings; open, they are there.
  assert.doesNotMatch(rendered({ open: false }), /data-sentinel-settings/, 'the closed block draws the settings');
  assert.match(rendered({ open: true }), /data-rise-screen="papic-settings"[\s\S]*data-sentinel-settings/, 'opened, the settings are not in the risen screen');
});

test('3 · Memories hands over the event-wide settings, and every door the old quick view held is reachable open', () => {
  const h = code(MEMORIES);
  assert.match(h, /<PapicCameraSettings\s+eventId=\{eventId\}\s+seat="memories"/, 'Memories opens the page seat (with per-guest rows)');
  const cam = code(CAMERA);
  assert.doesNotMatch(cam, /<FaceBlockingList/, 'a per-guest face list is back under the card');
  assert.match(cam, /<GuestAllotmentsChoice eventId=\{eventId\} variant="row" eventWide returnTo=\{seat === 'page' \? null : seat\}/, 'the event-wide limit is not under the card, or does not land back on the card’s seat');
  assert.match(cam, /href=\{`\/dashboard\/\$\{eventId\}\/guests`\}[\s\S]{0,400}guest card/, 'no door to the guest cards');
  // 🔢 The counts and Add more are on the card's FACE (owner 2026-10-26: "the count of the total, taken, remaining and
  // a button to add more") — Memories hands them to the card, not to the open settings.
  assert.match(h, /counts: \{ total: now\.total, left: now\.count \},\s*buy: cardBuy,/, 'Memories does not hand the card its counts and Add more');
  assert.doesNotMatch(h, /<PapicCameraSettings[^>]*credits=/, 'the open settings draw a second counter under the face');
  // After the day the Thank-You Video door leads the OPENED settings where a seat hands one (it lived on the closed card
  // until 2026-10-26; Memories hands none — its keepsake row is Thank You's one home).
  const open = rendered({ open: true, phase: 'after' });
  assert.match(open, /data-papic-thank-you=""[\s\S]*Thank-You Video[\s\S]*data-sentinel-settings/, 'the Thank-You Video door is lost, or not the open card’s first row');
});

test('4 · the controller page is gone — an old link opens the card in Memories (owner 2026-10-24 · removed 2026-10-26 · moved 2026-11-08)', () => {
  // The page itself is deleted; the old address is forwarded by the middleware's legacy map (`lib/legacy-redirects.ts`,
  // `papic-lives-in-memories.test.ts` holds the targets) to `/memories?papic=open#papic`.
  const legacy = code('lib/legacy-redirects.ts');
  assert.match(legacy, /PAPIC_PAGE_RE = \/\^\\\/dashboard\\\/\(\[\^\/\]\+\)\\\/studio\\\/papic\$\//, 'the old Papic address is not forwarded');
  const c = code(CARD);
  assert.match(c, /searchParams\.get\('papic'\) !== 'open'/, 'the card does not open itself for an old link');
  assert.match(c, /window\.history\.replaceState\(/, 'the card leaves ?papic=open in the address — the page’s own URL must come back');
  // The › that unfolded the card is now the "All Papic settings ›" row (2026-11-20).
  assert.match(c, /data-papic-all-settings=""[\s\S]{0,200}<ChevronRight\b/, 'the "All Papic settings" row lost its ›');
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

test('5 · the block is the mark · Papic · the switch · its line · the › row — nothing else of its own (owner 2026-10-26 → 2026-11-20)', () => {
  const closed = rendered({ open: false, phase: 'after' });
  assert.doesNotMatch(closed, /role="region"|data-rise-screen/, 'the closed block draws its settings');
  assert.match(closed, /data-sentinel-switch/, 'the Papic switch is not on the block');
  assert.match(closed, /data-sentinel-icon/, 'the camera mark is gone');
  assert.match(closed, /lucide-chevron-right/, 'the › is gone');
  // Its own presses: the head and the "All Papic settings" row (the switch, Add photos and Add more are handed in).
  assert.equal((closed.match(/<button\b/g) ?? []).length, 2, 'the block draws a press beyond its head and its › row');
  assert.doesNotMatch(closed, /<button[^>]*>(?:(?!<\/button>)[\s\S])*data-sentinel-switch/, 'the switch is inside the head button (invalid HTML)');
  assert.doesNotMatch(closed, /<(?:a|img|meter|progress)\b|role="progressbar"/, 'the block draws a link, a photo or a meter again');
  const words = closed.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  assert.equal(words, 'Papic Guest photos All Papic settings', `the block says more than its name, its line and its row: "${words}"`);
  assert.doesNotMatch(closed, /\bmd:hidden\b|hidden md:/, 'the phone gets its own closed face again — one card, everywhere');

  // The card takes nothing it could draw closed: its props are the head, the switch and what opens under it.
  const c = code(CARD);
  const props = c.match(/export function PapicHomeCard\(\{([\s\S]*?)\}: \{/)?.[1] ?? '';
  const names = props.split(',').map((p) => p.trim().split(/\s|=/)[0]).filter(Boolean).sort();
  // 🔢 + `counts` and `buy` (owner 2026-10-26: "the count of the total, taken, remaining and a button to add more") —
  // the face's one line and Add more; nothing else (no strip, no meter, no photos). 📷 + `headLine` (owner 2026-10-30):
  // the line under the title that says what "Let everybody shoot now" has saved — a word in the head, not a face part.
  // 📷 + `chapter` (owner 2026-11-01, "THE PAPIC CARD ON HOME SHOOTS INTO A CHAPTER"): the one added row under the
  // counts — which chapter it shoots into and "This chapter: N photos". Drawn on the face, never on the closed head.
  // ＋ `add` and `lineFor` (owner 2026-11-20, "memories approved"): the main "Add photos" beside Add more, and the state
  // line for each line the head's switch says — the two things the approved block added. Nothing else.
  assert.deepEqual(names, ['add', 'brand', 'buy', 'chapter', 'counts', 'defaultOpen', 'headControl', 'headLine', 'icon', 'lineFor', 'marker', 'name', 'phase', 'settings', 'thankYouHref'], 'the card takes a prop beyond the head, its face and its settings (a strip, a meter, an action row?)');
});
