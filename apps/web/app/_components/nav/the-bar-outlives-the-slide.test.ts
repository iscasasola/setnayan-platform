import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * THE BAR OUTLIVES THE SLIDE.
 *
 * Owner, 2026-09-22: *"on mobile mode, when i am at the shop and press the
 * bottom nav, everything reloads. i want the bottom and top nav to persist.
 * the top nav already seems to persists"*
 *
 * Nothing was remounting. Both navs live in the doorway LAYOUT, above the
 * segment that swaps, and `<Link>` navigation never re-runs them — the defect
 * was PAINT ORDER inside the view transition `NavSlideController` starts on
 * every mobile tab press:
 *
 *   · the `::view-transition` pseudo tree paints above the live document, and
 *     its groups paint in capture order — `root` FIRST, every named group after
 *     it. `sn-page` is named, so the sliding page paints OVER everything left
 *     in `root`.
 *   · the element it names is the layout's `<main>`, whose box carries the
 *     `pb-[calc(env(safe-area-inset-bottom)+92px)]` clearance — exactly the
 *     strip the floating pill and its FAB occupy. So the bar spent all 320ms
 *     UNDERNEATH the page and reappeared after: a bar that reloads.
 *   · the top bar sits above that box at scroll-top, is never covered, and so
 *     "already seems to persist". 🔑 The asymmetry the owner reported is
 *     geometry, not lifecycle — which is why looking for a remount found
 *     nothing to fix.
 *
 * And the freeze itself was washing the chrome out. The UA sheet puts
 * `mix-blend-mode: plus-lighter` on every `::view-transition-old/new` so the
 * default cross-fade sums correctly; cancel the animations and both snapshots
 * sit at opacity 1, so plus-lighter ADDS two near-identical opaque images and
 * the whole frozen chrome brightens for the length of the slide.
 *
 * ─── WHAT THIS GUARD PINS ────────────────────────────────────────────────
 * Each of these reverts silently — a phone shows it, CI never would:
 *   1 · every frozen snapshot also cancels plus-lighter.
 *   2 · the pill and the FAB still carry names of their own…
 *   3 · …and those selectors still match a real mounted element.
 *   4 · no two elements share a name (a duplicate makes the browser skip the
 *       whole transition, so the slide just stops happening).
 *   5 · `.shell-topbar` stays UNNAMED — `view-transition-name` makes an element
 *       a containing block for `position: fixed` descendants, and that bar hosts
 *       the account panel and the command palette.
 */

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, '..', '..', '..');
const css = readFileSync(join(webRoot, 'app', 'globals.css'), 'utf8');

/** Every `::view-transition-old(x)`/`-new(x)` rule block, with its declarations. */
function snapshotRules(): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = [];
  const re = /((?:^[^{}]*::view-transition-(?:old|new)\([^)]*\)[^{}]*))\{([^}]*)\}/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) out.push({ selector: m[1]!.trim(), body: m[2]! });
  return out;
}

/** Every `view-transition-name: <value>` declared in globals.css, with its selector. */
function declaredNames(): { selector: string; name: string }[] {
  const out: { selector: string; name: string }[] = [];
  const re = /([^{}]*)\{([^}]*view-transition-name\s*:\s*([A-Za-z0-9_-]+)[^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) out.push({ selector: m[1]!.trim().split('\n').pop()!.trim(), name: m[3]! });
  return out;
}

test('a frozen snapshot cancels plus-lighter too, or it washes the chrome out', () => {
  const rules = snapshotRules();
  assert.ok(rules.length >= 3, `Found ${rules.length} ::view-transition-old/new rules — expected at least 3. The block was renamed or removed, not fixed.`);

  const frozen = rules.filter((r) => /animation\s*:\s*none/.test(r.body));
  assert.ok(
    frozen.length >= 2,
    `Found ${frozen.length} frozen (animation:none) snapshot rules — expected at least 2 (root + the bar).`,
  );

  const washed = frozen.filter((r) => !/mix-blend-mode\s*:\s*normal/.test(r.body));
  assert.deepEqual(
    washed.map((r) => r.selector),
    [],
    `${washed.length} of ${frozen.length} frozen snapshot rules cancel the animation without cancelling ` +
      `mix-blend-mode: plus-lighter. Both snapshots then sit at opacity 1 and ADD, so the chrome ` +
      `brightens for the whole slide and drops back — a full-screen flash that reads as a reload.`,
  );
});

test('the pill and the FAB each carry a name of their own', () => {
  const names = declaredNames();
  const byName = new Map(names.map((n) => [n.name, n.selector]));
  assert.ok(
    byName.has('sn-bottomnav'),
    `globals.css declares ${names.length} view-transition-name(s) — ${[...byName.keys()].join(', ')} — but none is ` +
      `sn-bottomnav. Unnamed, the floating pill falls back into \`root\`, which paints BENEATH the sliding ` +
      `sn-page group whose <main> box covers that strip. The bar vanishes for 320ms on every tab press.`,
  );
  assert.ok(
    byName.has('sn-navfab'),
    `No sn-navfab name — the broken-out FAB shares the pill's bar row, so leaving it in \`root\` makes half ` +
      `the row disappear while the other half stays.`,
  );
  // ⚓ 2026-09-25: the name sits on the anchored DOCK, which holds the bar AND
  // the moment strip above it. Naming only the <nav> would leave the strip in
  // `root`, under the sliding page, for 320ms of every tab press.
  assert.equal(byName.get('sn-bottomnav'), '[data-bottom-dock]');
  assert.equal(byName.get('sn-navfab'), '.sn-vt-fab');
});

test('each of those selectors still matches a mounted element', () => {
  const bar = readFileSync(join(webRoot, 'app', '_components', 'nav', 'bottom-nav.tsx'), 'utf8');
  // The element the name is on: ONE `data-bottom-dock` attribute in JSX. A
  // second would be two docks mounted at once — a duplicate name.
  const docks = bar.match(/^\s*data-bottom-dock\s*$/gm) ?? [];
  assert.equal(
    docks.length,
    1,
    `bottom-nav.tsx renders ${docks.length} data-bottom-dock elements — the sn-bottomnav name must reach ` +
      `exactly one. Zero leaves the whole bottom chrome under the sliding page again.`,
  );
  const marks = bar.match(/aria-label="Primary navigation"/g) ?? [];
  assert.equal(
    marks.length,
    1,
    `bottom-nav.tsx carries ${marks.length} aria-label="Primary navigation" markers — the CSS name, ` +
      `nav-slide-controller.tsx's NAV_SEL and this guard all key off exactly one. Two mounted at once is a ` +
      `duplicate view-transition-name, which makes the browser skip the transition entirely.`,
  );

  const fab = readFileSync(join(webRoot, 'app', '_components', 'nav', 'nav-fab.tsx'), 'utf8');
  const hits = fab.match(/className="[^"]*\bsn-vt-fab\b[^"]*"/g) ?? [];
  assert.equal(
    hits.length,
    1,
    `nav-fab.tsx carries ${hits.length} sn-vt-fab classNames — expected exactly 1. Zero means the CSS name ` +
      `reaches nothing and the FAB is covered by the slide again, silently.`,
  );
});

test('no two selectors share a view-transition name', () => {
  const names = declaredNames();
  const seen = new Map<string, string[]>();
  for (const { name, selector } of names) {
    seen.set(name, [...(seen.get(name) ?? []), selector]);
  }
  const dupes = [...seen.entries()].filter(([, sels]) => sels.length > 1);
  assert.deepEqual(
    dupes,
    [],
    `Duplicate view-transition-name(s) across ${names.length} declarations. Two elements holding one name ` +
      `makes the browser SKIP the transition outright — the slide simply stops happening, with no error.`,
  );
});

test('the sticky top bar stays unnamed', () => {
  const named = declaredNames().filter((n) => /shell-topbar|fd-topbar/.test(n.selector));
  assert.deepEqual(
    named,
    [],
    `The top bar was given a view-transition-name. That makes it a containing block for its ` +
      `position: fixed DESCENDANTS — it hosts the account panel and the command palette, and this repo has ` +
      `already been bitten twice (panood/program/program-surface.tsx, lib/live-studio-control.ts). ` +
      `It also does not need one: it sits above <main>'s box, so the slide never covers it.`,
  );
});
