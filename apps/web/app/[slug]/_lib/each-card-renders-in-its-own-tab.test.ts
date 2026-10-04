/**
 * 📍 EACH CARD RENDERS ONCE, IN ITS OWN TAB — AND "EVERYTHING ELSE" IS GONE.
 *
 * Owner, 2026-10-04 (DECISION_LOG "STORY-TAB PLACEMENT CORRECTED AND
 * APPROVED", verbatim *"yes to all"*), on the guest Event Hub:
 *
 *   · "Write a column"      → Camera on the day + Recap after the event
 *   · "Walk the room in 3D" → Welcome on the day
 *   · "Your keepsake reel"  → Recap
 *   · "Everything else"     → removed (replace means remove)
 *
 * The stages' tabs come from `stage-bar.ts`: The Day = Live · Welcome · Camera ·
 * Gallery · Me (the Camera LEAVES the page for `/papic/guest`); Post Event =
 * Recap · Film · Suppliers · Gallery · Me, where Recap is the story at the top
 * of the page (`phasedBody`'s editorial branch).
 *
 * Each block below fails if a card comes back to a second place, leaves its
 * new one, or the catch-all sheet returns under any name.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (/\.(tsx?|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(abs);
  }
  return out;
}
const rel = (abs: string) => relative(WEB, abs).split('\\').join('/');
/** Every non-test source file under a directory, comment-stripped. */
const sources = (dir: string) => walk(join(WEB, dir)).map((abs) => ({ file: rel(abs), code: stripComments(readFileSync(abs, 'utf8')) }));
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

const BODY = 'app/[slug]/_components/site-body.tsx';
const CAMERA = 'app/papic/guest/page.tsx';

/** The slice of site-body that is the Recap — `phasedBody`'s editorial branch. */
function recapBranch(body: string): string {
  const start = body.indexOf("plan.body === 'editorial' ? (");
  const end = body.indexOf("plan.body === 'save_the_date' ? (", start);
  assert.ok(start > 0 && end > start, 'precondition: phasedBody’s editorial (Recap) branch');
  return body.slice(start, end);
}

// ── ✍ "Write a column" ──────────────────────────────────────────────────────

test('"Write a column" is mounted exactly twice in the app: the Camera and the Recap', () => {
  const mounts = sources('app')
    .filter((f) => !f.file.endsWith('/guest-column-card.tsx'))
    .flatMap((f) => Array.from({ length: count(f.code, /<GuestColumnCard\b/g) }, () => f.file));
  console.log(`  GuestColumnCard mounts: ${mounts.join(' · ')}`);
  assert.deepEqual(mounts.sort(), [CAMERA, BODY].sort(), 'a column card is mounted somewhere other than the Camera and the Recap');
});

test('on the Event Hub page the column card is the Recap’s (post-event only) — never a Welcome group', () => {
  const body = read(BODY);
  const at = body.indexOf('<GuestColumnCard');
  assert.ok(at > 0, 'precondition: the mount');
  // The guest tree hands it to phasedBody as the Recap's extra — built only on
  // the editorial body, so the Invitation's and The Day's pages never draw it.
  const opener = body.lastIndexOf('), recapBody ? (<>', at);
  assert.ok(opener > 0 && at - opener < 2000, 'the column card left the Recap slot (`recapBody ? (<> … </>)`)');
  const closer = body.indexOf('</>) : null)}', at);
  assert.ok(closer > at, 'the Recap slot does not close after the column card');
  // …and that slot is what phasedBody draws in the Recap, right after the story.
  assert.match(recapBranch(body), /<EditorialContent[\s\S]*\{memento\}/, 'phasedBody no longer draws its second argument in the Recap');
  // No tab group anywhere holds it.
  assert.doesNotMatch(body, /group\('[a-z]+',\s*\(?\s*<GuestColumnCard\b/, 'a tab group holds the column card again');
});

test('on The Day the column card is the Camera’s — in the open-camera render, under the camera', () => {
  const cam = read(CAMERA);
  assert.equal(count(cam, /<CameraColumn\b/g), 1, 'the Camera draws the column card more than once (or not at all)');
  const capture = cam.lastIndexOf('<PapicGuestCapture');
  const col = cam.indexOf('<CameraColumn');
  assert.ok(capture > 0 && col > capture, 'the column card is not under the camera');
  // After every refusal: the column rides with the camera a guest can shoot with.
  assert.ok(col > cam.lastIndexOf('if (blockRow)'), 'the column card renders on a refused camera');
  const helper = cam.slice(cam.indexOf('async function CameraColumn'));
  assert.match(helper, /if \(!\(await guestColumnsActive\(\)\)\) return null;/, 'the Camera’s column skipped the column gate');
  assert.match(helper, /<GuestColumnCard\b/);
});

// ── 🪑 "Walk the room in 3D" ────────────────────────────────────────────────

test('"Walk the room in 3D" is drawn by ONE Event Hub component, handed the door on The Day only', () => {
  const owners = sources('app/[slug]/_components')
    .concat(sources('app/[slug]/_lib'))
    .filter((f) => f.code.includes('Walk the room in 3D'))
    .map((f) => f.file);
  assert.deepEqual(owners, ['app/[slug]/_components/guest-doorway-strip.tsx'], 'a second Event Hub component draws the 3D room');
  const body = read(BODY);
  assert.equal(count(body, /venueWalk=\{/g), 1);
  assert.match(body, /venueWalk=\{pageStage === 'event' \? doorways\.venueWalk : null\}/, 'the 3D room left The Day (or escaped the seat rule)');
  // The strip is the Welcome's on a tabbed page.
  assert.match(body, /<GuestDoorwayStrip words=\{clientWords\}\s*tabAttrs=\{pageTabs\.attrs\('home'\)\}/, 'the strip left the Welcome tab');
});

test('the strip draws the 3D line when handed the door, and nothing when not', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { GuestDoorwayStrip } = await import('../_components/guest-doorway-strip');
  const { eventWordsFromProfile } = await import('./event-words');
  const { WEDDING_PROFILE } = await import('@/lib/event-type-profile');
  const words = eventWordsFromProfile(WEDDING_PROFILE);
  const on = renderToStaticMarkup(
    React.createElement(GuestDoorwayStrip, { words, pabuya: null, broadcast: false, venueWalk: '/maria-and-jose/venue' }),
  );
  assert.equal(count(on, /Walk the room in 3D/g), 1);
  assert.match(on, /href="\/maria-and-jose\/venue"/);
  const off = renderToStaticMarkup(
    React.createElement(GuestDoorwayStrip, { words, pabuya: null, broadcast: false, venueWalk: null }),
  );
  assert.equal(off, '', 'the strip draws a box (or the 3D line) with no door');
});

// ── 🎞 "Your keepsake reel" ─────────────────────────────────────────────────

test('"Your keepsake reel" is drawn once, in the Recap, behind the gates it always had', () => {
  const owners = sources('app/[slug]')
    .filter((f) => f.code.includes('Your keepsake reel'))
    .map((f) => f.file);
  assert.deepEqual(owners, [BODY], 'a second guest page draws the keepsake reel');
  const body = read(BODY);
  assert.equal(count(body, /Your keepsake reel/g), 1);
  assert.match(recapBranch(body), /\{recapKeepsakeHref \? \([\s\S]*?Your keepsake reel/, 'the keepsake reel left the Recap');
  assert.match(
    body,
    /const recapKeepsakeHref =\s*recapBody && recapHasPhotos && !isEditorCanvas && identity\.kind === 'anonymous' \? identity\.publicAlbumHref : null;/,
    'the keepsake door lost one of its gates (composed recap · photos · not the Maker · the ONE album door)',
  );
});

// ── ✂ "Everything else" ─────────────────────────────────────────────────────

test('"Everything else" is gone — no file, no component, no sheet, no entry point', () => {
  for (const f of ['app/[slug]/_components/everything-else-sheet.tsx', 'app/[slug]/_lib/everything-else-rows.ts']) {
    assert.ok(!existsSync(join(WEB, f)), `${f} is back`);
  }
  const hits = sources('app')
    .concat(sources('lib'))
    .filter((f) => /EverythingElse|everything-else-(?:sheet|rows)|everything-else-heading/.test(f.code))
    .map((f) => f.file);
  assert.deepEqual(hits, [], 'something still imports, mounts or names the "Everything else" sheet');
  const labels = sources('app/[slug]')
    .filter((f) => /['">]Everything else\b/.test(f.code))
    .map((f) => f.file);
  assert.deepEqual(labels, [], 'a guest page draws an "Everything else" label again');
});
