/**
 * GUARD — PAPIC OPENS ON HOME, UNDER ITS OWN CARD (owner 2026-10-23: *"does not open to a new page. just expands on
 * home"* · *"expanding opens the rest of the settings under it not open a new page"*; the guest-card ruling the same
 * day: under the card, event-wide only).
 *
 *   1. The card's head is a BUTTON that toggles the settings region — never a link to /studio/papic.
 *   2. The region grows and fades (420 ms, the house ease), is inert while folded, and reduced motion skips it.
 *   3. Home hands the card the camera settings in the 'home' seat (no Credits per guest, no per-guest face blocking —
 *      one door to the guest cards instead), and the latest five open MEMORIES.
 *
 * Sabotage (2026-10-23): the head navigates to `…/studio/papic` → 1 red; drop `inert` → 2 red; the page passes
 * `seat="page"` → 3 red. Restored → green.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const code = (f: string) => stripComments(readFileSync(join(process.cwd(), f), 'utf8'));
const CARD = 'app/dashboard/[eventId]/_components/papic-home-card.tsx';
const STRIP = 'app/dashboard/[eventId]/_components/papic-card-strip.tsx';
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

test('3 · Home hands over the event-wide settings, and the latest five open Memories', () => {
  const h = code(HOME);
  assert.match(h, /<PapicCameraSettings\s+eventId=\{eventId\}\s+seat="home"/, 'Home opens the page seat (with per-guest rows)');
  const cam = code(CAMERA);
  assert.doesNotMatch(cam, /<FaceBlockingList/, 'a per-guest face list is back under the card');
  assert.match(cam, /<GuestAllotmentsChoice eventId=\{eventId\} variant="row" eventWide returnTo=\{seat === 'home' \? 'home' : null\}/, 'the event-wide limit is not under Home’s card, or does not land back on Home');
  assert.match(cam, /href=\{`\/dashboard\/\$\{eventId\}\/guests`\}[\s\S]{0,400}guest card/, 'no door to the guest cards');
  const s = code(STRIP);
  assert.ok((s.match(/\/memories`/g) ?? []).length >= 1, 'the strip opens something other than Memories');
  assert.doesNotMatch(s, /studio\/papic/, 'the strip opens the Papic page');
});

test('4 · the controller page is retired for the couple on the web — an old link opens the card on Home (owner 2026-10-24)', () => {
  const page = code('app/dashboard/[eventId]/studio/papic/page.tsx');
  assert.match(page, /if \(!storeShell && [\s\S]{0,120}member_type === 'couple'\) \{\s*redirect\(`\/dashboard\/\$\{eventId\}\?papic=open`\);/, 'a plain visit still draws the separate Papic page for the couple');
  const c = code(CARD);
  assert.match(c, /searchParams\.get\('papic'\) !== 'open'/, 'the card does not open itself for an old link');
  assert.match(c, /window\.history\.replaceState\(/, 'the card leaves ?papic=open in the address — Home’s own URL must come back');
  assert.match(c, /<ChevronRight[\s\S]{0,200}rotate-90/, 'the head’s › does not turn to ⌄ as the card grows');
});
