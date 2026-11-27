/**
 * 🔒📐 THE ANALYTICS CAROUSEL NEVER CHANGES HEIGHT (owner 21 Nov 2026: *"the graphs when scrolled goes up and down"* ·
 * *"when i arrived here the graph size increased"*).
 *
 * Measured live on www.setnayan.com/vendor-dashboard/shop, signed in as the owner, fresh load each time:
 *   · 969 px wide — the carousel was 340 px tall until the first swipe to "The next 13 weeks", then 593 px; the Badges
 *     heading under it moved from y 1286 to y 1540.
 *   · 375 px wide — 261 → 262 → 310 → 403 px over one pass of swipes (three separate jumps), layout-shift score 0.08.
 * Cause: each graph card drew a 64-px stand-in (`WhenSeen` → `.ag-gp-wait`) until it was swiped into view, then mounted
 * its real picture. Every slide stretches to the tallest, so the first sight of a tall card grew the whole row and pushed
 * the page under it.
 *
 * The rule held here: a card's picture is drawn from the first paint at its final size; only its MOTION waits to be seen.
 *   1 · `GraphCard` puts `{g.pic}` straight inside `.ag-gp` — nothing in the card asks whether it has been seen.
 *   2 · No stand-in class exists anywhere (`ag-gp-wait`).
 *   3 · No analytics component swaps its markup on "not seen yet" (`played === false ? <…>` / `seen === false ? <…>`).
 *       Values may be held (useTween / useHeld / HeldCount keep their place); the ELEMENT may not change.
 *   4 · The two mount-time CSS motions (`.ag-pop`, `.ag-slide`) are paused inside an unplayed section, so drawing the
 *       picture early never spends its entrance off-screen.
 *
 * Source-reading, comments stripped (`stripComments`), so a docblock that MENTIONS a symbol never satisfies a pin.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..', '..', '..');
const COMPONENTS = join(WEB, 'app/vendor-dashboard/performance/_components');
const read = (abs: string) => readFileSync(abs, 'utf8');

const TILE = stripComments(read(join(COMPONENTS, 'graph-tile.tsx')));
const CSS = read(join(COMPONENTS, 'analytics-growing.css'));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== 'node_modules' && name !== '.next') walk(p, out);
    } else if (/\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('1 · GraphCard draws its picture straight away, inside .ag-gp', () => {
  const card = TILE.slice(TILE.indexOf('export function GraphCard'));
  assert.ok(card.length > 0, 'GraphCard not found in graph-tile.tsx');
  assert.match(
    card,
    // R3 (27 Nov): an EMPTY graph paints no sample picture — the box stays (same height), only `g.pic` is withheld.
    /className="ag-gp"[^>]*>\s*\{(?:g\.state === 'empty' \? null : )?g\.pic\}\s*<\/span>/,
    'the picture must sit directly in .ag-gp — wrapping it in a "when seen" gate is what made the carousel grow on swipe',
  );
  assert.doesNotMatch(TILE, /\buseReanimate\s*\(|\busePlayed\s*\(/, 'the card shape must not depend on whether it has been seen');
});

test('2 · no 64-px stand-in exists anywhere', () => {
  const hits = walk(join(WEB, 'app'))
    .filter((p) => (p.endsWith('.css') ? read(p) : stripComments(read(p))).includes('ag-gp-wait'))
    .map((p) => relative(WEB, p));
  assert.deepEqual(hits, []);
});

test('3 · no analytics component swaps its element on "not seen yet"', () => {
  const offenders: string[] = [];
  for (const p of walk(COMPONENTS).filter((f) => /\.tsx?$/.test(f))) {
    const src = stripComments(read(p));
    if (/\b(?:played|seen|useReanimate\(\)|usePlayed\(\))\s*===\s*false\s*\?\s*(?:\(\s*)?</.test(src)) offenders.push(relative(WEB, p));
  }
  assert.deepEqual(offenders, [], 'hold the VALUE until seen (useTween / useHeld / HeldCount), never swap the markup');
});

test('4 · mount-time motion is paused until the section plays', () => {
  const rule = CSS.split('\n').find((l) => l.includes('animation-play-state: paused')) ?? '';
  for (const cls of ['.ag-pop', '.ag-slide']) {
    assert.ok(
      rule.includes(`.perf-reanim:not(.perf-play) ${cls}`),
      `${cls} must be paused inside an unplayed section (else it plays off-screen now that pictures draw early)`,
    );
  }
});
