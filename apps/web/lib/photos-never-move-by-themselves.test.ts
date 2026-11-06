/**
 * ✋ PHOTOS ON THE EVENT HUB NEVER MOVE BY THEMSELVES — owner 2026-10-24, verbatim: *"there shouldnt be the auto
 * scrolling photos"*. A photo moves when the guest swipes, taps a neighbour, presses ‹ › or an arrow key — never on a
 * timer. This reverses the 2026-10-15 ruling "GLIMPSE'S MOTION IS A SLOW CONTINUOUS DRIFT, NOT A STEP".
 *
 * The property, read from every photo surface a guest sees (comments stripped, so prose about the old drift does not
 * trip it):
 *   · no `setInterval` / `setTimeout` — a photo component has nothing to wait for;
 *   · no self-rescheduling frame loop (`const step = … requestAnimationFrame(step)`) — that is how the drift ran;
 *   · no `scrollLeft +=` / `-=` — nudging the scroll a little at a time IS the drift, whatever drives it.
 * A one-shot `requestAnimationFrame(measure)` after a guest's own scroll is allowed: it only reads.
 *
 * NOT here, deliberately (they are not photos moving): the Live Photo Wall's 25 s fetch of NEW photos
 * (`live-wall-block.tsx`), the Save the Date's chosen scene transition (`stage-autoplay`), a couple-chosen background
 * motion (Parallax, Ken Burns — `lib/element-style.ts` HUB_EL_DURING), and the Relive player (`story/relive.tsx`),
 * which a guest starts with its own button.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const PHOTO_COMPONENTS = [
  'app/[slug]/_components/glimpse-rail.tsx',
  'app/[slug]/_components/our-photos-styles.tsx',
  'app/[slug]/_components/our-photos-widget.tsx',
  'app/[slug]/_components/our-love-story-styles.tsx',
  'app/[slug]/_components/photo-moments-styles.tsx',
  'app/[slug]/_components/photo-moments-widget.tsx',
  'app/[slug]/_components/photos-of-you-gallery.tsx',
  'app/[slug]/_components/photos-of-you-styles.tsx',
  'app/[slug]/_components/your-shots-gallery.tsx',
  'app/[slug]/_components/your-shot-tile.tsx',
  'app/[slug]/_components/editorial/post-event-scene-views.tsx',
  'app/[slug]/_components/editorial/post-event-scene-views-2.tsx',
  'app/_components/gallery/gallery-lightbox.tsx',
  'app/_components/memories/event-memories-gallery.tsx',
];

const read = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));

/** Every reason a source can move a photo by itself. Exported for the sabotage check below. */
export function selfMovers(src: string): string[] {
  const out: string[] = [];
  if (/\bsetInterval\s*\(/.test(src)) out.push('setInterval');
  if (/\bsetTimeout\s*\(/.test(src)) out.push('setTimeout');
  for (const m of src.matchAll(/(?:const|let|function)\s+(\w+)\s*=?\s*(?:\([^)]*\)\s*=>|\()/g)) {
    const name = m[1]!;
    const from = m.index! + m[0].length;
    const body = src.slice(from, from + 1500);
    if (new RegExp(`requestAnimationFrame\\(\\s*${name}\\s*\\)`).test(body)) out.push(`frame loop "${name}"`);
  }
  if (/scrollLeft\s*[+-]=/.test(src)) out.push('scrollLeft nudged');
  return out;
}

test('no photo surface on the Hub moves a photo by itself', () => {
  const bad: string[] = [];
  for (const rel of PHOTO_COMPONENTS) {
    const found = selfMovers(read(rel));
    if (found.length) bad.push(`${rel}: ${found.join(', ')}`);
  }
  assert.deepEqual(bad, [], `photos move on a timer again (owner 2026-10-24: "there shouldnt be the auto scrolling photos"):\n${bad.join('\n')}`);
});

test('the check can see the drift it was written for', () => {
  const drift = `
    const frame = (now) => { s.pos += step; rail.scrollLeft = s.pos; s.raf = requestAnimationFrame(frame); };
    s.raf = requestAnimationFrame(frame);`;
  assert.ok(selfMovers(drift).some((r) => r.startsWith('frame loop')), 'a self-rescheduling frame loop went unseen');
  assert.deepEqual(selfMovers('const id = setInterval(() => next(), 6000);'), ['setInterval']);
  assert.deepEqual(selfMovers('rail.scrollLeft += 1;'), ['scrollLeft nudged']);
  assert.deepEqual(selfMovers('if (!st.measureRaf) st.measureRaf = requestAnimationFrame(measure);'), [], 'a one-shot read was taken for a loop');
});
