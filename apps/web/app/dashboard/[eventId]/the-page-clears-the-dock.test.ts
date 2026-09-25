/**
 * the-page-clears-the-dock.test.ts — 2026-09-25.
 *
 * The phone's bottom chrome is one ANCHORED box (`<BottomDock>`: the moment
 * strip, when up, attached above the bar, flush to the bottom edge with the
 * home-indicator inset inside it). Anchoring it is only half the job: the page
 * scrolling under it must END above it, or its last row is hidden for good.
 *
 * 🔑 WHAT WAS WRONG BEFORE. The event layout's content column carried a flat
 * `pb-20` (80px) that never counted the safe area, with an 8.5rem override
 * while a strip was up. On an iPhone the floating bar's top sat ~110px up, so
 * the last ~30px of every event page lived behind it. A clearance that has to
 * follow the strip, the labels and the device cannot be a number.
 *
 * WHAT THIS HOLDS — the chain from a measured height to a padded page:
 *   1 · the dock MEASURES itself and publishes `--sn-bottomdock-h`;
 *   2 · `[data-shell-main]` pads its bottom by that var (+ a breath), with a
 *       fallback that counts the safe area for the first, unmeasured paint;
 *   3 · desktop cancels it (the dock is `lg:hidden`, the rail is the offset);
 *   4 · the event layout's column carries the hook and NO padding utility of
 *       its own — a Tailwind `pb-*` on the same element would out-cascade the
 *       rule and put the flat number back;
 *   5 · no dead per-strip class survives (`subnav-docked` had no reader left).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const CSS = stripComments(readFileSync(join(WEB, 'app', 'globals.css'), 'utf8'));
const BAR = stripComments(readFileSync(join(WEB, 'app', '_components', 'nav', 'bottom-nav.tsx'), 'utf8'));
const LAYOUT = stripComments(readFileSync(join(HERE, 'layout.tsx'), 'utf8'));

/** Every rule body whose selector list is exactly `selector`, with its @media (if any). */
function rulesFor(selector: string): { media: string | null; body: string }[] {
  const out: { media: string | null; body: string }[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(CSS))) {
    const sels = m[1]!.split(',').map((s) => s.trim());
    if (!sels.includes(selector)) continue;
    // The nearest enclosing @media, found by walking back to an unclosed block.
    const before = CSS.slice(0, m.index);
    let depth = 0;
    let media: string | null = null;
    for (let i = before.length - 1; i >= 0; i--) {
      const ch = before[i];
      if (ch === '}') depth++;
      else if (ch === '{') {
        if (depth === 0) {
          const head = before.slice(before.lastIndexOf('}', i) + 1, i).trim();
          if (head.startsWith('@media')) media = head;
          break;
        }
        depth--;
      }
    }
    out.push({ media, body: m[2]! });
  }
  return out;
}

test('1 · the dock measures itself and publishes --sn-bottomdock-h', () => {
  const start = BAR.indexOf('export function BottomDock');
  assert.ok(start >= 0, 'BottomDock is gone from bottom-nav.tsx');
  const body = BAR.slice(start, BAR.indexOf('\nfunction ', start + 1));
  assert.match(body, /setProperty\(\s*'--sn-bottomdock-h'/, 'the dock no longer publishes its height');
  assert.match(body, /getBoundingClientRect\(\)\.height/, 'the published height is not a measurement');
  assert.match(body, /new ResizeObserver\(/, 'the height is measured once and never again (a strip docking changes it)');
  assert.match(body, /ref=\{dockRef\}[\s\S]*?data-bottom-dock/, 'the measured element is not the dock itself');
});

test('2 · the content column pads by the MEASURED dock, counting the safe area before it is measured', () => {
  const base = rulesFor('[data-shell-main]').filter((r) => r.media === null);
  assert.equal(base.length, 1, `expected one unconditional [data-shell-main] rule, found ${base.length}`);
  const pb = /padding-bottom\s*:\s*([^;]+);/.exec(base[0]!.body)?.[1] ?? '';
  assert.match(pb, /var\(--sn-bottomdock-h,/, `the column pads by a guess, not the dock: ${pb}`);
  assert.match(pb, /env\(safe-area-inset-bottom\)/, `the unmeasured fallback forgets the home indicator: ${pb}`);
  assert.match(pb, /\+\s*[\d.]+rem\)\s*$/, `no breathing room past the dock: ${pb}`);
});

test('3 · desktop cancels it — the dock is lg:hidden there', () => {
  const desktop = rulesFor('[data-shell-main]').filter((r) => /min-width:\s*1024px/.test(r.media ?? ''));
  assert.equal(desktop.length, 1, 'no desktop cancel for [data-shell-main] — 90px of dead space under every desktop page');
  assert.match(desktop[0]!.body, /padding-bottom\s*:\s*0\s*;/);
});

test('4 · the event column carries the hook and no padding utility of its own', () => {
  const tags = LAYOUT.match(/<div[^>]*\bdata-shell-main\b[^>]*>/g) ?? [];
  assert.equal(tags.length, 1, `expected one [data-shell-main] element, found ${tags.length}`);
  assert.doesNotMatch(
    tags[0]!,
    /\bpb-/,
    `${tags[0]} — a Tailwind pb-* here comes later in the cascade than the globals.css rule and ` +
      'puts a flat, safe-area-blind number back under the dock',
  );
});

test('5 · no per-strip clearance class survives with nothing setting it', () => {
  assert.equal(
    rulesFor('html.subnav-docked [data-shell-main]').length,
    0,
    'the strip is inside the dock now, so its height is already counted — a rule keyed on a class ' +
      'nothing sets is a gate with no handle',
  );
});
