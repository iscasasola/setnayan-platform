/**
 * one-shell-mount.test.ts — the shell is mounted ONCE, and it is mounted where
 * navigation cannot destroy it.
 *
 * ─── THE DEFECT THIS EXISTS FOR ──────────────────────────────────────────
 * Owner, 2026-08-15: *"navigation should not reload. it should only load the
 * screen that changes."*
 *
 * Measured on the live site before the fix — stamp the document, tag
 * `.fd-topbar` and `.fd-rail`, click a rail link from /explore to /alaala:
 *   documentSurvived: true    ← not a browser reload; client nav was fine
 *   barSurvived:      false   ← the bar was torn down and rebuilt
 *   railSurvived:     false   ← so was the rail
 * Twenty public pages each mounted `<AppRailShell>` inside `page.tsx`, so the
 * shell sat in the subtree Next swaps on navigation.
 *
 * 🔑 IN APP ROUTER ONLY A LAYOUT PERSISTS ACROSS NAVIGATION. This file exists
 * because that is invisible in a code review: a page that mounts the shell and
 * a layout that mounts the shell render the SAME HTML. The difference only
 * shows up as a flicker on a real click, which is exactly the kind of defect
 * that ships.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const GROUP = import.meta.dirname;
const read = (p: string) => readFileSync(p, 'utf8');

/** Source with comments stripped — a mount named in prose is not a mount, and
 *  several files here discuss the mount at length. */
function code(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/** Every `page.tsx` directly under a segment of this group. */
function groupPages(): { seg: string; file: string }[] {
  const out: { seg: string; file: string }[] = [];
  const walk = (dir: string, seg: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const full = path.join(dir, e.name);
      const s = seg || e.name;
      if (existsSync(path.join(full, 'page.tsx'))) {
        out.push({ seg: s, file: path.join(full, 'page.tsx') });
      }
      walk(full, s);
    }
  };
  walk(GROUP, '');
  return out;
}

test('exactly one file in the group mounts the shell, and it is the layout', () => {
  const layout = path.join(GROUP, 'layout.tsx');
  assert.ok(existsSync(layout), 'app/(shell)/layout.tsx is missing.');
  assert.match(
    code(read(layout)),
    /<AppRailShell\b/,
    'The group layout no longer mounts the shell, so twenty public routes ' +
      'render with no chrome at all — they also left NAV_ROUTES.',
  );

  const mounters: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
        continue;
      }
      if (!e.name.endsWith('.tsx')) continue;
      if (full === layout) continue;
      if (code(read(full)).includes('<AppRailShell')) {
        mounters.push(path.relative(GROUP, full));
      }
    }
  };
  walk(GROUP);

  assert.deepEqual(
    mounters,
    [],
    'These files mount the shell a SECOND time beneath the group layout:\n' +
      mounters.map((m) => `  - ${m}`).join('\n') +
      '\nThat is two bars and two rails — and it puts the shell back inside ' +
      'the subtree Next swaps, so it stops surviving navigation, which is the ' +
      'whole reason it moved to a layout.',
  );
});

test('no page in the group re-declares a route directive', () => {
  /*
    The group layout declares `force-dynamic` once. A page re-declaring it is
    not harmless duplication — twenty copies of a rule is twenty places for it
    to disagree with itself, which is precisely how /privacy ended up the one
    shelled page carrying `revalidate = 3600` under a session-reading shell.

    🛑 AND THE REASON THEY USED TO CARRY IT WAS A FALSE BELIEF, written into
    eleven files in one day: "a layout cannot set `dynamic`". MEASURED in a
    scratch Next 15.5.21 build from this repo's own node_modules — with the
    pages declaring nothing and `force-dynamic` on the group layout alone, both
    child routes moved from `○ (Static)` to `ƒ (Dynamic)` in the build table.
  */
  const layoutSrc = code(read(path.join(GROUP, 'layout.tsx')));
  assert.match(
    layoutSrc,
    /^export const dynamic = 'force-dynamic';/m,
    'app/(shell)/layout.tsx lost force-dynamic. Every route in this group ' +
      'mounts a session-reading shell, and a session read on a static page ' +
      'receives an EMPTY cookie jar without throwing — so they would cache ' +
      'permanently signed-out. The only symptom is an absence.',
  );

  for (const { seg, file } of groupPages()) {
    const src = code(read(file));
    assert.doesNotMatch(
      src,
      /^export const (dynamic|revalidate)\b/m,
      `/${seg} (${path.relative(GROUP, file)}) re-declares a route directive. ` +
        'The group layout owns it.',
    );
  }
});

test('the group holds no nested layout that could remount the shell', () => {
  /*
    A `layout.tsx` deeper in the group would be fine on its own — but a
    `template.tsx` REMOUNTS on every navigation by design, and either one is a
    place a future edit could put a second shell. Assert the group root is the
    only layout, so "where does the chrome come from" has exactly one answer.
  */
  const extras: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
        continue;
      }
      if (e.name === 'template.tsx') extras.push(path.relative(GROUP, full));
      if (e.name === 'layout.tsx' && path.dirname(full) !== GROUP) {
        extras.push(path.relative(GROUP, full));
      }
    }
  };
  walk(GROUP);
  assert.deepEqual(
    extras,
    [],
    'Nested layout/template inside app/(shell)/:\n' +
      extras.map((x) => `  - ${x}`).join('\n') +
      '\nA template.tsx remounts on every navigation, which would undo the ' +
      'persistence this group exists to provide.',
  );
});

test('every bleed path resolves to a real page in this group', () => {
  /*
    `DOORWAY_BLEED_PATHS` is how the one full-bleed route tells the
    layout-rendered shell to drop its gutters and cap. It is a list, and this
    repo has been bitten repeatedly by lists that silently stop matching
    anything — a route list resolving to nothing, a word list fifteen entries
    stale, a lint whose targets arrived as an empty array.

    🔑 A LIST IS ACCEPTABLE ONLY BECAUSE IT IS CHECKABLE: every entry maps to a
    directory under `app/(shell)/`, so it can be proven to exist on disk.
  */
  const src = read(
    path.join(GROUP, '..', '_components', 'frontdoor', 'shell-bleed.ts'),
  );
  const m = /DOORWAY_BLEED_PATHS = \[([^\]]*)\]/.exec(src);
  assert.ok(m, 'DOORWAY_BLEED_PATHS not found — this guard would be vacuous.');
  const paths = [...(m[1] ?? '').matchAll(/'([^']+)'/g)].map((x) => x[1]);

  assert.ok(
    paths.length > 0,
    'DOORWAY_BLEED_PATHS is empty. If no route is full-bleed any more, delete ' +
      'the mechanism deliberately rather than leaving an empty list that reads ' +
      'as protection.',
  );
  for (const p of paths) {
    assert.ok(
      p!.startsWith('/'),
      `'${p}' is not a path. These are matched against usePathname() EXACTLY — ` +
        'a bare segment would never match and the route would silently lose ' +
        'its full width.',
    );
    assert.ok(
      existsSync(path.join(GROUP, p!.slice(1), 'page.tsx')),
      `'${p}' is listed as full-bleed but app/(shell)${p}/page.tsx does not ` +
        'exist. The marketplace would silently lose its full width.',
    );
  }

  /*
    🪤 AND THE CHILD MUST NOT INHERIT IT. The first cut used
    `useSelectedLayoutSegment()`, which returns 'explore' for BOTH `/explore`
    and `/explore/compare` — so the compare page silently became full-bleed
    against its own stated design (a side-by-side table is not a browse grid).
    Exact-path matching is what fixes that, so assert the distinction directly.
  */
  assert.ok(
    !paths.includes('/explore/compare'),
    '/explore/compare is listed as full-bleed. It deliberately keeps its ' +
      'narrower reading width.',
  );
});

test('the group really holds the public routes — this file is not vacuous', () => {
  /*
    A positive control, not a count floor. Every guard above walks the group;
    if the group were emptied or renamed they would all pass while asserting
    nothing. Named routes with a reason to be here beat a number tuned to today.
  */
  const segs = new Set(groupPages().map((p) => p.seg));
  for (const expected of ['explore', 'help', 'alaala', 'pricing', 'privacy']) {
    assert.ok(
      segs.has(expected),
      `/${expected} is not in app/(shell)/. Either it lost its shared chrome ` +
        '(it has also left NAV_ROUTES, so it would render bare), or this ' +
        'guard is now walking the wrong directory.',
    );
  }
});
