/**
 * the-post-event-walk-is-fixed.test.ts — THE LIVE WALK AFTER #7596 ("Post Event reads as a story"), ITEM BY ITEM.
 *
 * A phone-width walk of the just-shipped story found these; each is held here so it cannot come back quietly.
 * F-W2-43 (Reads as unreachable) has its own guard (`post-event-reads-as-is-reachable.test.ts`), F-W2-44 (the parts
 * list) is in `maker-part-groups.test.ts` and F-W2-49 (photos from before the day) in `story-day-window.test.ts`.
 *
 *   F-W2-48  an empty countdown ("0 · THE DAY") and an empty day ("No minute of this day has been written up yet")
 *   F-W2-52  raw labels to guests — "PAPIC GUEST 100" and "THE WEDDING DAY (LIVE)"
 *   F-W2-53  the pre-day invitation (its "Swipe up" cover, "Find your seat") drawn under the story after the day
 *   F-W2-45  the cover's "3 guests" beside a guest list of 4
 *   F-W2-50  the story's progress bars over the page's top bar
 *   F-W2-51  the cover's date line wrapping with the gold rule through it
 *   F-W2-54  the Camera tab reading as lit while on the Recap
 *   /recap   before the day it sent a visitor to the invitation with nothing said
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { roadCountsDown } from '../app/[slug]/_components/editorial/post-event-scene-views-3';
import { recapHref, STORY_LATER, STORY_LATER_WORDS } from '../app/[slug]/_lib/story-later';

const WEB = join(__dirname, '..');
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const read = (rel: string) => stripComments(raw(rel));
const E = 'app/[slug]/_components/editorial';

test('F-W2-48 · a road with nothing to count is no countdown — and an unwritten day is not drawn', () => {
  const day = Date.parse('2026-10-30T00:00:00+08:00');
  assert.equal(roadCountsDown([{ atMs: null }, { atMs: null }], day), false, 'year-only steps: nothing to count');
  assert.equal(roadCountsDown([{ atMs: day }], day), false, 'a step on the day itself counts nothing');
  assert.equal(roadCountsDown([{ atMs: day - 5 * 86_400_000 }], day), true);
  assert.equal(roadCountsDown([{ atMs: day - 5 * 86_400_000 }], null), false, 'no day, no countdown');
  const road = read(`${E}/post-event-scene-views-3.tsx`);
  assert.match(road, /if \(style === 'diary' \|\| \(style !== 'scrapbook' && !roadCountsDown\(entries, dayMs\)\)\)/, 'an empty countdown is drawn again');
  const spine = read('app/[slug]/_components/story/story-spine.tsx');
  assert.match(spine, /if \(entries\.length === 0 && guestOpen\) return null;/, 'an unwritten day is drawn for a reader again');
  assert.doesNotMatch(spine, /No minute of this day has been written up yet/);
});

test('F-W2-52 · a guest reads a service’s name and plain words — never a SKU, never "(Live)"', () => {
  const data = read(`${E}/data.ts`);
  assert.match(data, /if \(key\.startsWith\('PAPIC_GUEST'\)\) return SERVICE_LABELS\.PAPIC_GUEST \?\? 'Papic';/, 'a Papic pack reads as its SKU again');
  assert.match(data, /const label = serviceLabelOf\(key\);\s*if \(seen\.has\(label\)\) continue;/, 'two Papic packs are listed twice');
  assert.doesNotMatch(data, /servicesAvailed\.push\(SERVICE_LABELS\[key\] \?\? prettyServiceKey\(key\)\)/);
  const content = read(`${E}/editorial-content.tsx`);
  assert.doesNotMatch(content, /Day \(Live\)/, 'the story’s colophon says "(Live)" after the day again');
});

test('F-W2-53 · after the day the story replaces the invitation: no "Swipe up" cover, no "Find your seat" under it', () => {
  const body = read('app/[slug]/_components/site-body.tsx');
  assert.match(body, /const storyLeads = plan\.body === 'editorial';/);
  assert.match(body, /const coverHoldsDoor = !storyLeads && \(plan\.anonymousHeroBanner \|\| !hasHeroMedia\);/, 'the invitation’s cover holds the door under the story again');
  assert.match(body, /\{!hasHeroMedia && !storyLeads \? \(\s*<PahinaMasthead/, 'the invitation’s text cover is drawn under the story again');
  assert.match(body, /insideAllowed && !storyLeads && doorwayFacts\?\.seatingSurfaceEnabled && doorwayFacts\?\.seatingPublished/, '"Find your seat" is drawn under the story again');
});

test('F-W2-45 · the cover counts the replies that said yes in their own words', () => {
  const views = read(`${E}/post-event-scene-views.tsx`);
  assert.match(views, /bits\.push\(`\$\{fmt\(f\.saidYes\)\} said yes`\)/);
  assert.doesNotMatch(views, /\$\{fmt\(f\.saidYes\)\} guests/, 'the cover calls the yes-replies "guests" again');
});

test('F-W2-50 · the story’s bars stand under the page’s pinned top bar', () => {
  const css = raw('app/globals.css');
  assert.match(css, /html:has\(\[data-sticky-top\]\) \[data-story-progress\] \{\s*top: calc\(4\.5rem \+ env\(safe-area-inset-top, 0px\)\);/);
  assert.match(read(`${E}/story-progress.tsx`), /data-story-progress=""/, 'anti-vacuity: the bars no longer carry their marker');
});

test('F-W2-51 · the cover’s date line is a held span, so the eyebrow’s rule gives way', () => {
  const views = read(`${E}/post-event-scene-views.tsx`);
  assert.match(views, /<p className=\{EYEBROW_ON_PHOTO\}>\s*<span>\{say\(words, 'label', f\.dateDots \?/, 'the date line is a bare text node beside the rule again');
});

test('F-W2-54 · a page of no tabs lights its Home, so the camera never reads as the page you are on', () => {
  const bar = read('app/[slug]/_components/site-menu-bar.tsx');
  assert.match(bar, /const homeOfThisPage = !onePage && tabKeys\.length === 0 && slots\.some\(\(s\) => s\.key === 'home' && s\.state === 'live'\) \? 'home' : null;/);
  assert.match(bar, /: \(page \?\? homeOfThisPage\);/);
});

test('/recap before the day: the page says plainly the story opens after it', () => {
  assert.equal(recapHref('maria-and-jose'), `/maria-and-jose?story=${STORY_LATER}`);
  assert.match(STORY_LATER_WORDS, /after the day/);
  assert.match(read('app/[slug]/recap/page.tsx'), /redirect\(recapHref\(slug\)\)/, 'the recap route sends nowhere new again');
  assert.match(read('app/[slug]/page.tsx'), /storyAsked: search\.story === STORY_LATER,/);
  const body = read('app/[slug]/_components/site-body.tsx');
  assert.match(body, /\{storyAsked && plan\.body !== 'editorial' && !isEditorCanvas \? \(\s*<p role="status" data-story-later="">?/, 'the line is not gated to "before the story"');
  assert.match(body, /\{STORY_LATER_WORDS\}/);
});

/* ── THE RE-WALK OF /rosa-ben/recap AFTER #7628 (controller, 2026-11-13): four rows only partly fixed. ── */

test('F-W2-48 (re-walk) · the road never ends on an empty "0 · the day" stop', () => {
  const road = read(`${E}/post-event-scene-views-3.tsx`);
  assert.doesNotMatch(road, /0<span className=\{`\$\{MICRO\} ml-2`\}>the day<\/span>/, 'the empty "0 · the day" stop is drawn again');
  assert.match(road, /days before the day/, 'anti-vacuity: the countdown itself is still there');
});

test('F-W2-49 (re-walk) · one day-window count of photos, everywhere the story says "photos"', () => {
  const data = read(`${E}/data.ts`);
  assert.match(data, /photos: typeof galleryDayTotal === 'number' \? galleryDayTotal : typeof frozen\.photos === 'number'/, 'metrics.photos is not the day count — the cover, By the numbers and Powered by disagree again');
  assert.match(data, /photoWallPhotos = snap\.tiles\.filter\(\(t\) => capturedOnTheDay\(t\.sortAt, dayWindow\)\)/, 'Memory lane counts shots from before the day again');
  const content = read(`${E}/editorial-content.tsx`);
  assert.match(content, /<LivePhotoWall photos=\{data\.photoWallPhotos\} photoCount=\{data\.metrics\.photos\} \/>/, 'Powered by reads another count');
});

test('F-W2-52 (re-walk) · no bare "thank you" under the team', () => {
  const credits = read(`${E}/post-event-scene-views-2.tsx`);
  assert.doesNotMatch(credits, />thank you</, 'the credits roll ends on a bare "thank you" again');
});

test('F-W2-53 (re-walk) · a stranger’s page and the host’s own end at the story; a guest keeps their photos below it', () => {
  const body = read('app/[slug]/_components/site-body.tsx');
  const at = body.indexOf("plan.body === 'editorial' ? (");
  const end = body.indexOf("plan.body === 'save_the_date' ? (", at);
  assert.ok(at > 0 && end > at, 'anti-vacuity: the after-day branch was not found');
  const branch = body.slice(at, end);
  assert.match(branch, /\{identity\.kind === 'guest' \? \(\s*<>\s*<div aria-hidden className="mx-auto my-12 h-px w-24 max-w-full bg-ink\/15" \/>\s*\{normalBody\(\)\}/, 'the pre-day body is drawn under the story for a stranger or the host again');
  assert.equal(branch.match(/normalBody\(\)/g)?.length, 1, 'the body is drawn under the story a second way');
});

test('F-W2-53 (re-walk) · under the story a stranger keeps only the way in; the host’s "You’re the host" note is gone', () => {
  const body = read('app/[slug]/_components/site-body.tsx');
  assert.match(body, /\) : afterStory\}/, 'a non-guest page draws nothing — or the whole body — under the story');
  assert.match(body, /doorShown \? <div className="mx-auto mt-10 w-full max-w-md px-4" data-story-door="">\{strangerDoor\(false\)\}<\/div> : null\)\}/, 'a guest on a new phone has no way in to their photos after the day');
  assert.match(body, /\{group\('me', <>\{plan\.openBrowse && viewerIsHost && !storyLeads \? \(/, 'the host’s "You don’t need an invitation" note is drawn after the day again');
});
