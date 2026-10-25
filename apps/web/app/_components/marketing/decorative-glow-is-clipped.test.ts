/**
 * A DECORATIVE GLOW NEVER WIDENS THE PAGE.
 *
 * The live quality sweep (2026-10-13, item 3) found three public pages that
 * scrolled SIDEWAYS on a phone — `/pa3d` 479 px wide at 375 (and 1376 at 1280),
 * `/download` +20, `/alaala` +13. Nothing was laid out wrong: each page draws a
 * soft glow that is meant to bleed past its box (a `<Blob>` at a negative
 * `right`, the `AlaalaOrb`'s `inset: -22%` halo, the download hero's `-inset-10`
 * champagne wash), and nothing above it clipped the bleed, so the document grew
 * to hold it. A sideways wobble on a phone reads as a broken page.
 *
 * Rule: a page that renders one of those bleeding decorations clips its root
 * `<main>` on the x axis. `overflow-x-clip` (not `-hidden`) on purpose — `clip`
 * does not make `<main>` a scroll container, so nothing sticky inside it breaks.
 *
 * Static and narrow by design: it knows the three bleeding pieces by name. A
 * new one is added to BLEEDERS when it ships; the vacuity check fails if the
 * scan stops finding the three pages it was written for.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const APP = join(WEB, 'app');

/** Pieces that intentionally draw past their own box. */
const BLEEDERS: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: '<Blob> at a negative offset', re: /<Blob\b[^>]*\b(?:left|right)=\{-\d/ },
  { name: '<AlaalaOrb> (inset -22% halo)', re: /<AlaalaOrb\b/ },
  { name: '<AppWindowHero> (-inset-10 glow)', re: /<AppWindowHero\b/ },
];
const CLIPS = /\boverflow-(?:x-)?(?:clip|hidden)\b/;

function pages(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const a = join(dir, f);
    if (f === 'node_modules') continue;
    if (statSync(a).isDirectory()) pages(a, out);
    else if (f === 'page.tsx') out.push(a);
  }
  return out;
}

test('every page that draws a bleeding glow clips its <main> on the x axis', () => {
  const offenders: string[] = [];
  const checked: string[] = [];
  for (const abs of pages(APP)) {
    const src = stripComments(readFileSync(abs, 'utf8'));
    const hit = BLEEDERS.find((b) => b.re.test(src));
    if (!hit) continue;
    const rel = relative(WEB, abs);
    checked.push(rel);
    const main = src.match(/<main\b[^>]*\bclassName=["'`{]([^"'`}]*)/);
    if (!main) offenders.push(`${rel} draws ${hit.name} but has no <main className=…> to clip`);
    else if (!CLIPS.test(main[1]!)) offenders.push(`${rel} draws ${hit.name} but its <main> does not clip x (add overflow-x-clip)`);
  }
  for (const want of ['app/(shell)/pa3d/page.tsx', 'app/(shell)/alaala/page.tsx', 'app/download/page.tsx']) {
    assert.ok(checked.includes(want), `the scan no longer sees ${want} — did the page or BLEEDERS change shape?`);
  }
  assert.deepEqual(offenders, [], 'A decorative glow widens the page (sideways scroll on a phone):\n  ' + offenders.join('\n  '));
});
