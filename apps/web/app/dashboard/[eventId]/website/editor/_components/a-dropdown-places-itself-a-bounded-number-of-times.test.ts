/**
 * 🔴 A DROPDOWN PLACES ITSELF A BOUNDED NUMBER OF TIMES (live crash, owner's phone, 21 + 23 Nov 2026).
 *
 * Guests › tap a guest › Reply › tap the Reply ▾ dropdown → the whole page fell to "Something on our end didn't work."
 * `app_telemetry_logs` (PAGE_CRASH, page `/dashboard/[id]/guests`, builds a68d08d and 976c106) holds the stack: React
 * error #185, "Maximum update depth exceeded", thrown by a state setter that a LAYOUT EFFECT called. In the shipped
 * bundle that setter (`setAt`, inside `place`) sits exactly 173 characters before the `place()` call in PickMenu's
 * layout effect, the same gap as the two stack columns (8434 → 8607).
 *
 * The effect had NO dependency list, so it measured and placed after EVERY render — including the render its own
 * `setAt` caused. `place` returns early only when the new placement equals the old one. On the owner's iPhone something
 * it measured changed each time it placed the list, so the answer never repeated, and React stopped the page after 50
 * nested updates. A desktop Chromium or WebKit never showed it, which is why the guard below models the loop instead of
 * driving a browser:
 *
 *   1. SOURCE — the placing effect carries `[open, unplaced, options.length]` (`unplaced` = `at === null`): it runs when the list opens and once more when
 *      the list exists (its real height), never after an arbitrary render. Scroll and resize still re-place, from event
 *      listeners — each its own task, so they cannot nest inside one commit.
 *   2. BEHAVIOUR — React's rule for a layout effect, executed against the real `placePickList`, on the Reply dropdown's
 *      shape (three answers, a button low on a 375 × 812 phone) and a screen whose clear floor moves with where the list
 *      was last drawn — a placement that can never agree with itself. With no deps it reaches React's limit (#185);
 *      with the shipped deps it stops after the two passes the design always meant (pick-menu-types.ts notes).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { placePickList, type PickListPlacement } from './pick-menu-place';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, 'pick-menu.tsx'), 'utf8');

/** The deps the layout effect that calls `place()` closes with, or null when it has none (runs after every render). */
function placingEffectDeps(src: string): string | null {
  const start = src.indexOf('useLayoutEffect(() => {');
  assert.ok(start >= 0, 'PickMenu has no layout effect — the placement moved; re-point this guard');
  // The effect's body: from its opening brace to the matching close.
  let depth = 0;
  let i = src.indexOf('{', start);
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) break;
  }
  const body = src.slice(start, i);
  assert.match(body, /\bplace\(\);/, 'the first layout effect no longer calls place() — re-point this guard');
  const tail = src.slice(i + 1, i + 80);
  const deps = /^\s*,\s*(\[[^\]]*\])\s*\)/.exec(tail);
  return deps?.[1] ? deps[1].replace(/\s+/g, ' ') : null;
}

test('the placing layout effect has a dependency list — it never runs after every render', () => {
  const deps = placingEffectDeps(SRC);
  assert.notEqual(deps, null, 'PickMenu’s placing useLayoutEffect has no deps: it re-places after every render and can loop (React #185)');
  assert.equal(deps, '[open, unplaced, options.length]');
});

test('every other layout effect in PickMenu has deps too (none can set state after every render)', () => {
  const effects = SRC.split('useLayoutEffect(').length - 1;
  assert.equal(effects, 1, 'a second layout effect appeared in pick-menu.tsx — give it deps and extend this guard');
});

/* ── the loop, executed ─────────────────────────────────────────────────────────────────────────────────────────── */

const REACT_NESTED_UPDATE_LIMIT = 50; // react-dom: NESTED_UPDATE_LIMIT, the line where it throws #185

/** The Reply ▾ button low on a phone, three answers in its list (Coming · No reply · Can't come, plus padding). */
const BUTTON = { top: 500, bottom: 540, left: 167, width: 200 };
const LIST_HEIGHT = 150;
const SCREEN = { width: 375, height: 812 };

/** A screen that never agrees with the list: drawn below, the clear floor rises (no room below); drawn above, it falls back. */
function floorFor(drawn: PickListPlacement | null): number {
  return drawn?.side === 'below' ? 650 : 720;
}

const same = (a: PickListPlacement | null, b: PickListPlacement) =>
  Boolean(a) && a!.top === b.top && a!.left === b.left && a!.minWidth === b.minWidth && a!.maxHeight === b.maxHeight;

/**
 * React's commit loop for PickMenu while it is open: after each commit the layout effect runs if its deps changed (or
 * always, with no deps); `place()` measures (the list exists once `at` is set) and calls `setAt` only when the answer
 * differs, which commits again. Returns how many nested updates one tap caused.
 */
function tapOpen(deps: ((at: PickListPlacement | null) => unknown[]) | null): number {
  let at: PickListPlacement | null = null;
  let prev: unknown[] | null = null;
  let updates = 0;
  while (updates <= REACT_NESTED_UPDATE_LIMIT) {
    const now = deps ? deps(at) : null;
    const runs = now === null || prev === null || now.some((d, k) => d !== prev![k]);
    prev = now;
    if (!runs) break;
    const next = placePickList({
      button: BUTTON,
      listHeight: at ? LIST_HEIGHT : 0,
      viewport: { ...SCREEN, floor: floorFor(at) },
    });
    if (same(at, next)) break;
    at = next;
    updates++;
  }
  return updates;
}

test('the model reproduces the crash: placing after every render never settles and passes React’s limit', () => {
  assert.ok(tapOpen(null) > REACT_NESTED_UPDATE_LIMIT, 'the no-deps model settled — it no longer shows the live crash');
});

test('with the shipped deps one tap places the list at most twice, on the same screen', () => {
  const open = true;
  const n = tapOpen((at) => [open, !at, 3]);
  assert.ok(n <= 2, `one tap placed the list ${n} times`);
  assert.ok(n >= 1, 'the list was never placed');
});
