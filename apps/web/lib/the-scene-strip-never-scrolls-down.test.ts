/**
 * the-scene-strip-never-scrolls-down.test.ts — owner, iPhone, 2026-10-05: under
 * the Invitation canvas, the Event Bar row's thumbnails (Guest's ticket · RSVP ·
 * Guest's look · Reminders) were every one cut at the TOP — "ticket" and "RSVP"
 * sliced in half inside the black tiles — and "Guest's look" / "Reminders" were
 * bare white boxes.
 *
 * TWO CAUSES, BOTH MEASURED ON THE LIVE MAKER (maria-and-jose, 375 and 430 px):
 *
 *   1. THE STRIP COULD SCROLL DOWN. The strip `<ol>` is `overflow-x: auto`, which
 *      makes its Y overflow `auto` too; it was 185 px tall and 295 px deep — the
 *      extra 110 px were the CLOSED `(i)` bubbles under the tile labels
 *      (`.sn-tip`, always in the DOM, `visibility: hidden`, hanging below the
 *      label). A diagonal swipe, or Page ▾'s `scrollIntoView({ block: 'start' })`
 *      of the group header, slid every tile up under the strip's top edge.
 *   2. THE COPY HAD NO GROUND. A tile is a static copy of its section
 *      (`maker-tile-preview.ts`), and the theme's backdrop is the page's
 *      `[data-guest-ground]` — a fixed layer BESIDE the page, never an ancestor
 *      of a section — so every scene that floats over the backdrop was copied
 *      onto bare white.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { MAKER_STRIP_PHONE } from './maker-phone-room';
import { tipPlacement } from '../app/_components/info-tip';
import { buildTileDocument, type TileHead, type TileSnapshot } from './maker-tile-preview';

const read = (p: string) => stripComments(readFileSync(join(import.meta.dirname, '..', p), 'utf8'));
const SHELL = read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
const SNAPSHOT = read('app/dashboard/[eventId]/website/editor/_components/scene-snapshot.ts');
const TIP = read('app/_components/info-tip.tsx');

test('1 · on a phone the strip has no vertical scroll range: closed bubbles take no room', () => {
  const classes = MAKER_STRIP_PHONE.split(/\s+/);
  assert.ok(classes.includes('max-lg:overflow-y-hidden'), 'the strip must not scroll on Y on a phone');
  assert.ok(
    classes.includes('max-lg:[&_.sn-tip:not([data-open=true])]:hidden'),
    'a CLOSED (i) bubble must take no room — it was 110 px of scroll range under the tiles',
  );
});

test('1b · an OPEN bubble floats on the viewport — the strip, which cannot scroll, never clips it', () => {
  // MEASURED at 375 × 812, the Maker in Desktop view: a tile label 81 px below the
  // strip's top (strip at y 695, 116 px tall), the longest real note 132 px.
  const strip = { top: 695, height: 116 };
  const trigger = { top: strip.top + 81, bottom: strip.top + 81 + 16, left: 250 };
  const at = tipPlacement(trigger, 132, { width: 375, height: 812 });
  console.log(`  132 px note from a label at y ${trigger.top}: placed at y ${at.top}…${at.top + 132}, x ${at.left}…${at.left + at.width}`);
  assert.ok(at.top >= 8 && at.top + 132 <= 812 - 8, 'the whole note is on screen');
  assert.ok(at.left >= 16 && at.left + at.width <= 375 - 16, 'never off the side of a 375 px phone');
  assert.ok(at.top + 132 <= trigger.top || at.top >= trigger.bottom, 'it never covers its own (i)');
  // Inside the strip it could not have fit — which is why it floats.
  assert.ok(132 > 81 && 132 > strip.height - 81 - 16);
  // Every (i) in the navigator floats on a phone.
  const nav = SHELL.slice(SHELL.indexOf('aria-label="Scenes"'), SHELL.indexOf('</nav>'));
  const tips = nav.match(/<InfoTip\b[^>]*>/g) ?? [];
  console.log(`  navigator (i)s: ${tips.length}`);
  assert.ok(tips.length > 0, 'no (i) found in the navigator — this scan is blind, not clean');
  assert.deepEqual(tips.filter((t) => !/\bfloatOnPhone\b/.test(t)), [], 'a strip (i) that does not float is clipped by the strip');
  assert.match(TIP, /tip\.style\.position = 'fixed'/, 'the floating bubble is placed against the viewport');
  assert.match(TIP, /window\.innerWidth >= 1024/, 'only on a phone — the desktop column keeps its own bubbles');
});

test('2 · SOURCE: the navigator strip wears the phone rule, and Page ▾ never scrolls it to block start on a phone', () => {
  const ol = SHELL.match(/<ol ref=\{setNavList\} className=\{`([^`]*)`\}>/);
  assert.ok(ol, 'the navigator <ol> was not found — this scan is blind, not clean');
  assert.match(ol![1]!, /^\$\{MAKER_STRIP_PHONE\} /, 'the strip must carry MAKER_STRIP_PHONE');
  const jump = SHELL.slice(SHELL.indexOf('const jumpToPage = '), SHELL.indexOf('const setGuestPagesCtx'));
  assert.ok(jump.length > 100, 'jumpToPage was not found — this scan is blind, not clean');
  const calls = [...jump.matchAll(/scrollIntoView\(\{([^}]*)\}\)/g)].map((m) => m[1]!);
  console.log(`  jumpToPage scrollIntoView calls: ${calls.length}`);
  assert.ok(calls.length >= 1, 'the strip jump was not found');
  for (const c of calls) {
    assert.doesNotMatch(c, /block:\s*'start'/, `a phone strip must never be scrolled to block start: {${c}}`);
    assert.match(c, /block:\s*window\.innerWidth < 1024 \? 'nearest'/, `the phone strip scrolls only sideways: {${c}}`);
  }
});

const HEAD: TileHead = {
  htmlAttrs: [['lang', 'en']],
  bodyAttrs: [['class', 'bg-white']],
  styles: [],
  grounds: [
    {
      chain: [{ tag: 'div', attrs: [['class', 'sn-editorial contents'], ['data-hub-theme', 'cyber']] }],
      html: '<div aria-hidden="true" data-guest-ground="true" class="fixed inset-0 -z-10 bg-cream"><div data-theme-poster="true" style="background-image:url(/p.jpg)"></div></div>',
    },
  ],
};
const SNAP: TileSnapshot = {
  key: 'f:look',
  section: '<section data-snm-root="">Your guest’s role, colors and outfit</section>',
  chain: [{ tag: 'main', attrs: [['class', 'relative']] }],
  frameWidth: 375,
};

test('3 · a tile carries the page’s ground — the theme backdrop — under its section, in its own theme scope', () => {
  const doc = buildTileDocument(HEAD, SNAP);
  const ground = doc.indexOf('data-guest-ground');
  const section = doc.indexOf(SNAP.section);
  assert.ok(ground > 0, 'the backdrop must be in the tile — without it a floating scene is copied onto bare white');
  assert.ok(ground < section, 'the ground is drawn first, under the section');
  assert.match(doc, /<div class="sn-editorial contents" data-hub-theme="cyber"><div aria-hidden="true" data-guest-ground/);
  assert.ok(doc.includes('background-image:url(/p.jpg)'), 'the poster photo travels');
  // A page that draws no ground keeps the old document exactly.
  const bare = buildTileDocument({ ...HEAD, grounds: undefined }, SNAP);
  assert.doesNotMatch(bare, /data-guest-ground/);
});

test('4 · SOURCE: the canvas head reads every ground, made static, never as the tile’s scroll root', () => {
  const head = SNAPSHOT.slice(SNAPSHOT.indexOf('export function readTileHead'), SNAPSHOT.indexOf('function staticCopy'));
  assert.ok(head.length > 100, 'readTileHead was not found — this scan is blind, not clean');
  assert.match(head, /grounds: readGrounds\(doc\)/);
  assert.match(head, /querySelectorAll<HTMLElement>\('\[data-guest-ground\]'\)/);
  assert.match(head, /staticCopy\(g\)/, 'the ground is copied static (no autoplay, no scripts)');
  assert.match(head, /removeAttribute\('data-snm-root'\)/, 'the tile scrolls to its SECTION, never to the ground');
  // A backdrop loop is drawn as its still: a <video> in a script-less document wears forced ▶ controls.
  const grounds = head.slice(head.indexOf('function readGrounds'));
  assert.match(grounds, /querySelectorAll\('video'\)\.forEach/);
  assert.match(grounds, /v\.replaceWith\(still\)/);
  // The tile head is re-taken when the ground changes (a new theme), not only the stylesheets.
  assert.match(SHELL, /prev\.grounds\]\) === JSON\.stringify\(\[head\.htmlAttrs, head\.bodyAttrs, head\.grounds\]\)/);
});
