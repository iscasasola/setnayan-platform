/**
 * the-skeleton-promises-only-what-the-page-draws.test.ts
 *
 * A loading skeleton is a PROMISE about the page that replaces it, and for
 * months the shared one promised a page header that no longer exists.
 *
 * ── The defect this pins ────────────────────────────────────────────────────
 * `<PageMasthead>` was emptied in four steps: the eyebrow went 2026-07-21, the
 * lede paragraph 08-18, the title and the back chevron 08-21, the (i) hours
 * after that. What it renders now is an `sr-only` <h1> and — on ten pages out
 * of a hundred and forty-odd — a row of actions. `HeaderSkeleton` never
 * followed. It kept drawing an eyebrow pill above a 32px title bar, so on
 * MEASURED 100 routes the shimmer reserved ~52px of chrome that never arrived
 * and the whole screen jumped upward the moment the page landed. The skeleton
 * was causing the exact layout shift it exists to prevent.
 *
 * ── Why it is here and not beside the component ────────────────────────────
 * `test:unit` globs `lib/**` and `app/**` only. A guard under
 * `components/skeletons/` would never run and would be decoration. It sits
 * beside `page-masthead.test.ts` because the masthead is the other half of the
 * pair it checks.
 *
 * ── It reads BOTH surfaces and derives every expectation ───────────────────
 * Nothing here is a hand-typed list. The bill of loaders is grepped out of the
 * app (comment-stripped — one loader mentions `GridPageSkeleton` only in a
 * docblock explaining why it deliberately renders nothing) and FLOORED, so a
 * sweep that silently stops matching fails instead of passing. Whether a route
 * really draws a big heading is answered by walking its own page.tsx and the
 * components it imports; whether it really has header actions is answered by
 * its own masthead call. Change the page and this tells you to change the
 * skeleton, which is the only way two files that are each correct alone can be
 * stopped from disagreeing at render.
 *
 * 🔑 THE ONE-DIRECTIONAL RULE IS DELIBERATE. "This route shows no heading
 * anywhere, so do not shimmer one" cannot produce a false alarm. The inverse —
 * "it shows one somewhere, so you must shimmer one" — would fire on a heading
 * that only appears in an empty state or an error branch, and a guard that
 * cries wolf teaches you to skim past the one time it is right. So the
 * negative direction is enforced and the positive one is permitted.
 *
 * 🛡 Mutation-checked by printed occurrence count, before → after.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import * as React from 'react';

// tsx compiles this repo's JSX to the classic `React.createElement` runtime,
// which expects React in scope. Setting it here lets the assertions below run
// the real components and read the real element tree, instead of grepping
// their source and hoping the string still means what it used to.
(globalThis as unknown as { React: unknown }).React = React;

import { stripComments } from '@/lib/strip-comments';
/* eslint-disable-next-line import/first */
import * as SKELETONS from '@/components/skeletons';
import { PageMasthead } from '@/app/_components/page-masthead';

const WEB_ROOT = resolve(__dirname, '..', '..');

/* ------------------------------------------------------------------ *
 * The bill — derived from the app, comment-stripped, floored.
 * ------------------------------------------------------------------ */

/** Every template that composes the shared header strip, read off the module. */
const TEMPLATES = Object.keys(SKELETONS).filter((k) => k.endsWith('PageSkeleton'));

const FLOOR = 100;

function src(file: string): string {
  return stripComments(readFileSync(file, 'utf8'));
}

/** Loaders that actually COMPOSE a shared template (not merely mention one). */
function loaders(): string[] {
  const found = execFileSync(
    'grep',
    ['-rlE', TEMPLATES.join('|'), 'app', '--include=loading.tsx'],
    { cwd: WEB_ROOT, encoding: 'utf8' },
  )
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((p) => join(WEB_ROOT, p));
  // Two shapes count: a JSX call, and the one-line
  // `export { X as default } from '@/components/skeletons'` re-export that 92
  // of them use. A docblock that merely NAMES a template does not.
  const composes = new RegExp(
    `<(?:${TEMPLATES.join('|')})\\b|export \\{ (?:${TEMPLATES.join('|')}) as default \\}`,
  );
  return found.filter((f) => composes.test(src(f)));
}

/* ------------------------------------------------------------------ *
 * What the loader promises
 * ------------------------------------------------------------------ */

/**
 * EVERY template call in the file, joined — not just the first.
 *
 * A loader with two returns (a conditional shell, an early bail) would
 * otherwise be judged on whichever call happened to appear first in the source,
 * which is a coin flip rather than a rule.
 */
function templateCall(file: string): string {
  const s = src(file);
  const all = [...s.matchAll(new RegExp(`<(?:${TEMPLATES.join('|')})\\b[\\s\\S]*?/>`, 'g'))].map(
    (m) => m[0],
  );
  return all.join('\n');
}

function promisesTitle(file: string): boolean {
  const call = templateCall(file);
  return /\stitle(\s*=\s*\{true\})?[\s/>]/.test(call);
}

function promisedActions(file: string): number {
  const m = /\sactions=\{(\d+)\}/.exec(templateCall(file));
  return m ? Number(m[1]) : 0;
}

/** Does the loader reserve its buttons only from the `lg` breakpoint up? */
function promisesActionsAtLg(file: string): boolean {
  return /\sactionsAt=(?:"lg"|\{'lg'\})/.test(templateCall(file));
}

/* ------------------------------------------------------------------ *
 * What the page actually draws
 * ------------------------------------------------------------------ */

function resolveImport(spec: string, from: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = join(WEB_ROOT, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(from), spec);
  else return null;
  for (const c of [`${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')]) {
    if (existsSync(c)) return c;
  }
  return null;
}

/** Does this route draw a heading a person can SEE, anywhere it can reach? */
function drawsAHeading(file: string, depth = 4, seen = new Set<string>()): boolean {
  if (depth < 0 || seen.has(file) || !existsSync(file)) return false;
  seen.add(file);
  const s = src(file);
  if (/<h1(?![^>]*sr-only)[^>]*>/.test(s)) return true;
  for (const m of s.matchAll(/import\s+[^;]*?from\s+'([^']+)'/g)) {
    const r = resolveImport(m[1] ?? '', file);
    // Only follow into the app tree — a design-system import is not this
    // route's heading.
    if (r && r.includes(`${WEB_ROOT}/app/`) && drawsAHeading(r, depth - 1, seen)) return true;
  }
  return false;
}

/**
 * Where a route's header buttons really live, and at which widths.
 *
 * 🔑 THIS USED TO READ `page.tsx` AND STOP, WHILE THE HEADING RULE 20 LINES
 * ABOVE FOLLOWED IMPORTS FOUR DEEP. That asymmetry inside one file is how a
 * real regression shipped green on 2026-08-25: `/admin/pricing` has no
 * `<PageMasthead>` of its own — its masthead lives in the tab surface it
 * imports — so the rule read "this page has no actions", stayed silent, and the
 * loader's reservation was allowed to vanish when a default flipped. The button
 * then dropped in out of nowhere on every plain load.
 *
 * Measured across the whole bill: 10 pages hold their own masthead actions, 4
 * delegate to a `_surfaces/*` tab surface, and ZERO delegate anywhere else. So
 * there are exactly two legal shapes, and `no page delegates its masthead
 * anywhere else` below FAILS if a third ever appears rather than skipping it.
 *
 * For a tabbed shell only the DEFAULT tab counts: one loader stands in for many
 * tabs and cannot be right about all of them, and the tab a person lands on
 * without asking is the one worth being right about.
 *
 * Returns `'always'`, `'responsive'` (the buttons sit inside a `hidden … lg:`
 * shell, so a phone never sees them) or `null`.
 */
function actionsIn(source: string): null | 'always' | 'responsive' | 'conditional' {
  let verdict: null | 'always' | 'responsive' | 'conditional' = null;
  for (const m of source.matchAll(/<PageMasthead\b/g)) {
    const seg = source.slice(m.index!, m.index! + 4000);
    const j = seg.indexOf('actions={');
    if (j < 0) continue;
    const k = j + 'actions='.length;
    let depth = 0;
    let body = '';
    for (let n = k; n < seg.length; n++) {
      if (seg[n] === '{') depth++;
      else if (seg[n] === '}') {
        depth--;
        if (depth === 0) {
          body = seg.slice(k + 1, n);
          break;
        }
      }
    }
    if (!body.trim()) continue;
    const flat = body.replace(/\s+/g, ' ').trim();
    // 🔑 AN ACTION THAT MAY NOT BE THERE IS NOT AN ACTION TO RESERVE.
    // `/admin/app-performance`'s overview tab passes
    // `actions={demoActive ? <span…/> : null}` — a badge shown only on demo
    // data. Demanding a 44px reservation for it would put phantom chrome on
    // every ordinary load, which is the defect this whole file exists to
    // remove. Conditional bodies are recorded and exempted from the MUST
    // RESERVE half; they are still not allowed to be called phantom.
    if (/:\s*null\s*$/.test(flat) || /^\{?\s*!?\w[\w.]*\s*&&/.test(flat)) {
      if (verdict === null) verdict = 'conditional';
    } else if (/^<\w+[^>]*className="[^"]*\bhidden\b/.test(flat)) {
      if (verdict === null || verdict === 'conditional') verdict = 'responsive';
    } else {
      verdict = 'always';
    }
  }
  return verdict;
}

/** The `_surfaces/<defaultTab>-surface.tsx` a tabbed shell lands on unasked. */
function defaultTabSurface(pageFile: string): string | null {
  const dir = dirname(pageFile);
  if (!existsSync(join(dir, '_surfaces'))) return null;
  const m = /includes\([^)]*\)\s*\?[^:]*:\s*'([a-z0-9-]+)'/.exec(src(pageFile));
  assert.ok(
    m,
    `${pageFile.replace(`${WEB_ROOT}/`, '')} has a _surfaces/ directory but this guard cannot work out which tab it opens on. Teach it the new shape — do not let it fall through, because a tabbed shell whose default tab has a header button is exactly the case that shipped a regression.`,
  );
  const file = join(dir, '_surfaces', `${m![1]}-surface.tsx`);
  assert.ok(
    existsSync(file),
    `${pageFile.replace(`${WEB_ROOT}/`, '')} opens on tab '${m![1]}' but ${file.replace(`${WEB_ROOT}/`, '')} does not exist. The <tab>-surface.tsx convention this rule derives from has changed; teach the guard rather than skipping the route.`,
  );
  return file;
}

function mastheadActions(pageFile: string): null | 'always' | 'responsive' | 'conditional' {
  const own = actionsIn(src(pageFile));
  if (own) return own;
  const surface = defaultTabSurface(pageFile);
  return surface ? actionsIn(src(surface)) : null;
}

/* ------------------------------------------------------------------ *
 * Reading the rendered element tree
 * ------------------------------------------------------------------ */

function classNames(node: unknown, out: string[] = []): string[] {
  if (node == null || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    node.forEach((n) => classNames(n, out));
    return out;
  }
  const el = node as { props?: { className?: unknown; children?: unknown } };
  if (el.props) {
    if (typeof el.props.className === 'string') out.push(el.props.className);
    classNames(el.props.children, out);
  }
  return out;
}

/**
 * A bar tall enough and wide enough to read as a page title.
 *
 * Deliberately NOT `w-full` or `flex-1`: a full-width 44px block is a search
 * field, and a rule that called that a title would cry wolf on every toolbar in
 * the app. A title bar is a fixed 160-316px slab.
 */
function isTitleBar(cls: string): boolean {
  return /\bh-(?:8|9|1[012])\b/.test(cls) && /\bw-(?:[4-7]\d)\b/.test(cls);
}

/* ------------------------------------------------------------------ *
 * The rules
 * ------------------------------------------------------------------ */

test('the bill of loaders is derived from the app and is not empty', () => {
  const list = loaders();
  assert.ok(
    TEMPLATES.length >= 7,
    `only ${TEMPLATES.length} page templates found in @/components/skeletons — the bill below is derived from this list, so a rename that empties it would make every rule vacuous.`,
  );
  assert.ok(
    list.length >= FLOOR,
    `only ${list.length} loading.tsx compose a shared skeleton template (floor ${FLOOR}). Either the match stopped matching or the skeletons were replaced; fix the sweep rather than lowering the floor.`,
  );
});

test('the shared strip draws NOTHING unless a page asked for something', () => {
  assert.equal(
    HeaderSkeletonOf()({}),
    null,
    'HeaderSkeleton with no props must render null. The masthead it mirrors returns early on a page with no actions, so the loading state must not reserve a strip either.',
  );
  for (const name of TEMPLATES) {
    const tpl = (SKELETONS as Record<string, (p: object) => unknown>)[name]!;
    const strip = headerElementOf(tpl({}), name);
    assert.equal(
      strip.props.title ?? false,
      false,
      `${name} asks the shared strip for a title by default. 100 of the routes that use these templates show no heading at all; the title has to be opt-in.`,
    );
    assert.equal(
      strip.props.actions ?? 0,
      0,
      `${name} reserves ${strip.props.actions} header button(s) by default, on every page that uses it. Only ten pages in the app have any.`,
    );
  }
});

test('a page that asks for a title gets one, and it is the only thing added', () => {
  for (const name of TEMPLATES) {
    const tpl = (SKELETONS as Record<string, (p: object) => unknown>)[name]!;
    assert.equal(
      headerElementOf(tpl({ title: true }), name).props.title,
      true,
      `${name} swallows \`title\` instead of passing it on, so the opt-in does nothing on that template.`,
    );
  }
  // 🔑 THE `title` HALF WAS ASSERTED AND THE `actions` HALF WAS NOT. A template
  // that dropped `actions={actions}` would read `undefined ?? 0` = 0 inside the
  // strip and stay green here while all nine reserving loaders silently
  // reserved nothing — and nothing else would catch it: tsconfig sets no
  // noUnusedLocals and eslint has no unused-vars rule.
  for (const name of TEMPLATES) {
    const tpl = (SKELETONS as Record<string, (p: object) => unknown>)[name]!;
    const strip = headerElementOf(tpl({ actions: 3, actionsAt: 'lg' }), name);
    assert.equal(
      strip.props.actions,
      3,
      `${name} swallows \`actions\` instead of passing it on, so every loader that reserves buttons through it reserves nothing.`,
    );
    assert.equal(
      strip.props.actionsAt,
      'lg',
      `${name} swallows \`actionsAt\`, so a page whose buttons are desktop-only would reserve them on a phone too.`,
    );
  }

  const titled = classNames(HeaderSkeletonOf()({ title: true })).filter(isTitleBar);
  assert.equal(
    titled.length,
    1,
    'passing `title` must draw exactly one title-sized bar — otherwise the 43 screens that really do carry a heading go back to jumping.',
  );
  const acted = classNames(HeaderSkeletonOf()({ actions: 2 }));
  assert.equal(
    acted.filter(isTitleBar).length,
    0,
    'asking for actions must not smuggle a title bar back in.',
  );
  assert.equal(
    acted.filter((c) => /\bh-11\b/.test(c) && /\bw-28\b/.test(c)).length,
    2,
    'the strip must reserve room for exactly as many action buttons as it was asked for.',
  );
  const atLg = classNames(HeaderSkeletonOf()({ actions: 1, actionsAt: 'lg' }));
  assert.ok(
    atLg.some((c) => /\bhidden\b/.test(c) && /\blg:flex\b/.test(c)),
    '`actionsAt="lg"` must actually hide the reserved buttons below lg — otherwise the prop is decoration and a phone still shimmers a row it never gets.',
  );
  assert.ok(
    !classNames(HeaderSkeletonOf()({ actions: 1 })).some((c) => /\bhidden\b/.test(c)),
    'the default must NOT hide the reserved buttons — 9 of the 10 pages with header buttons show them at every width.',
  );
});

test('the masthead really is empty without actions — the premise this rests on', () => {
  // If this ever changes, every rule above is stale and must be rewritten
  // rather than the skeletons being "fixed" back.
  const bare = PageMasthead({ title: 'Anything' }) as { type?: unknown };
  assert.equal(
    bare?.type,
    'h1',
    'PageMasthead no longer returns a lone <h1> for a page with no actions. The skeletons in this repo are shaped around that early return; re-derive them before touching this test.',
  );
});

test('no loading screen shimmers a heading its page never draws', () => {
  const offenders: string[] = [];
  for (const f of loaders()) {
    if (!promisesTitle(f)) continue;
    const page = f.replace(/loading\.tsx$/, 'page.tsx');
    if (!drawsAHeading(page)) offenders.push(f.replace(`${WEB_ROOT}/`, ''));
  }
  assert.deepEqual(
    offenders,
    [],
    `these loading screens reserve a page title that never arrives, so the screen jumps upward the moment it lands:\n  ${offenders.join('\n  ')}`,
  );
});

test('a loading screen reserves the header actions its page renders — at the widths it renders them', () => {
  const missing: string[] = [];
  const phantom: string[] = [];
  const wrongWidth: string[] = [];
  let pagesWithButtons = 0;
  let unconditional = 0;
  for (const f of loaders()) {
    const page = f.replace(/loading\.tsx$/, 'page.tsx');
    if (!existsSync(page)) continue;
    const real = mastheadActions(page);
    const promised = promisedActions(f);
    const atLg = promisesActionsAtLg(f);
    const rel = f.replace(`${WEB_ROOT}/`, '');
    if (real) pagesWithButtons += 1;
    if (real === 'always') unconditional += 1;
    if (real === 'always') {
      if (promised < 1) missing.push(rel);
      else if (atLg) wrongWidth.push(`${rel} (reserves only from lg; the page shows its buttons at every width)`);
    }
    // 🔑 NO BLANKET EXEMPTION ANY MORE. This used to skip 'responsive'
    // entirely — "one skeleton cannot be right about both widths" — which let
    // /dashboard/[eventId]/guests reserve two 44px pills on a phone that never
    // sees them. `actionsAt="lg"` makes the reservation follow the buttons, so
    // the rule can be enforced instead of waived.
    if (real === 'responsive') {
      if (promised < 1) missing.push(`${rel} (the page shows buttons from lg up)`);
      else if (!atLg) wrongWidth.push(`${rel} (reserves at every width; the page hides its buttons below lg)`);
    }
    // 'conditional' sits between the two: nothing is owed, nothing is wrong.
    if (real === null && promised > 0) phantom.push(rel);
  }
  assert.ok(
    pagesWithButtons >= 10,
    `only ${pagesWithButtons} routes were found to have header buttons at all (floor 10) — the masthead scan stopped matching, so every half of this rule was asking nothing.`,
  );
  // A SECOND FLOOR, on the unconditional ones specifically. The 'conditional'
  // class is an exemption, and an exemption that quietly grows swallows the
  // rule it lives inside: if a loosened match started filing everything as
  // conditional, the count above would still be met while MUST RESERVE asked
  // nothing at all. Measured 2026-08-25: 9 always · 1 responsive · 1 conditional.
  assert.ok(
    unconditional >= 8,
    `only ${unconditional} routes render header buttons unconditionally (floor 8) — the 'conditional' exemption has grown and swallowed the rule.`,
  );
  assert.deepEqual(
    missing,
    [],
    `these pages render header buttons and their loading screen reserves no room, so a button appears out of nowhere:\n  ${missing.join('\n  ')}`,
  );
  assert.deepEqual(
    phantom,
    [],
    `these loading screens reserve header buttons their page does not have, so the space collapses when the page lands:\n  ${phantom.join('\n  ')}`,
  );
  assert.deepEqual(
    wrongWidth,
    [],
    `these loading screens reserve their buttons at the wrong widths:\n  ${wrongWidth.join('\n  ')}`,
  );
});

test('no page hides its masthead somewhere this rule cannot follow', () => {
  // Measured 2026-08-25: 10 routes hold their masthead actions in page.tsx and
  // 4 delegate to a `_surfaces/*` tab surface. ZERO use any other shape. If a
  // third appears, the actions rule above would go quietly blind on it — which
  // is exactly how /admin/pricing's regression shipped — so this FAILS rather
  // than letting it pass unnoticed.
  const strays: string[] = [];
  for (const f of loaders()) {
    const page = f.replace(/loading\.tsx$/, 'page.tsx');
    if (!existsSync(page)) continue;
    if (actionsIn(src(page))) continue;
    // Every tab surface of this route is a shape the rule UNDERSTANDS (it
    // deliberately judges only the default tab — one loader stands in for many
    // tabs and cannot be right about all of them). What must never appear is a
    // masthead somewhere else entirely, because that is the blind spot that let
    // /admin/pricing's reservation vanish unseen.
    defaultTabSurface(page);
    const surfaceDir = join(dirname(page), '_surfaces');
    const reachable = (x: string) => x === page || x.startsWith(`${surfaceDir}/`);
    const found: string[] = [];
    collect(page, 4, new Set(), found);
    const unseen = found.filter((x) => !reachable(x));
    if (unseen.length) strays.push(`${page.replace(`${WEB_ROOT}/`, '')} -> ${unseen[0]!.replace(`${WEB_ROOT}/`, '')}`);
  }
  assert.deepEqual(
    strays,
    [],
    `these routes render masthead actions from a component the actions rule does not follow, so it is silently blind to them:\n  ${strays.join('\n  ')}\nEither teach mastheadActions() the new shape or move the masthead into page.tsx.`,
  );

  function collect(file: string, depth: number, seen: Set<string>, out: string[]) {
    if (depth < 0 || seen.has(file) || !existsSync(file)) return;
    seen.add(file);
    const body = src(file);
    if (actionsIn(body)) out.push(file);
    for (const m of body.matchAll(/import\s+[^;]*?from\s+'([^']+)'/g)) {
      const r = resolveImport(m[1] ?? '', file);
      if (r && r.includes(`${WEB_ROOT}/app/`)) collect(r, depth - 1, seen, out);
    }
  }
});

/** The `<HeaderSkeleton>` element a template renders, without executing it —
 *  the tree also holds a client component, and running that would throw. */
function headerElementOf(tree: unknown, name: string): { props: Record<string, unknown> } {
  const target = HeaderSkeletonOf();
  const found = find(tree);
  assert.ok(
    found,
    `${name} no longer renders <HeaderSkeleton>. If a template stops composing the shared strip it also stops being covered by this guard — teach it the new shape rather than deleting the rule.`,
  );
  return found as { props: Record<string, unknown> };

  function find(node: unknown): unknown {
    if (node == null || typeof node !== 'object') return null;
    if (Array.isArray(node)) {
      for (const n of node) {
        const hit = find(n);
        if (hit) return hit;
      }
      return null;
    }
    const el = node as { type?: unknown; props?: { children?: unknown } };
    if (el.type === target) return el;
    return el.props ? find(el.props.children) : null;
  }
}

/** Indirection so the import stays honest if the export is ever renamed. */
function HeaderSkeletonOf() {
  const fn = (SKELETONS as Record<string, unknown>).HeaderSkeleton;
  assert.ok(typeof fn === 'function', 'HeaderSkeleton is no longer exported from @/components/skeletons.');
  return fn as (p: object) => unknown;
}

test('no hand-rolled loading screen shimmers a heading its page never draws', () => {
  // 🔑 THE BILL ABOVE IS A BILL OF THE LOADERS THAT USE THE SHARED TEMPLATE.
  // 28 more hand-roll their own shimmer, and that is exactly where the next one
  // hides — two of them were drawing an eyebrow, a title and a subtitle for a
  // page that has drawn none of the three since 2026-08-21. So this asks every
  // loading.tsx in the app, not just the ones that were easy to enumerate.
  const files = execFileSync('grep', ['-rl', '', 'app', '--include=loading.tsx'], {
    cwd: WEB_ROOT,
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((p) => join(WEB_ROOT, p));

  assert.ok(
    files.length >= 150,
    `only ${files.length} loading.tsx found (floor 150) — the sweep stopped matching.`,
  );

  const offenders: string[] = [];
  let checked = 0;
  for (const f of files) {
    const page = f.replace(/loading\.tsx$/, 'page.tsx');
    // A boundary that covers a whole subtree is not asked this question: it is
    // a shimmer for many pages at once and cannot be right about all of them.
    if (!existsSync(page)) continue;
    checked += 1;
    const bars = [...src(f).matchAll(/className="([^"]*)"/g)]
      .map((m) => m[1] ?? '')
      .filter(isTitleBar);
    if (bars.length && !drawsAHeading(page)) {
      offenders.push(`${f.replace(`${WEB_ROOT}/`, '')} (${bars[0]})`);
    }
  }
  assert.ok(
    checked >= 100,
    `only ${checked} loading.tsx sit beside a page.tsx (floor 100) — the pairing broke, so this rule was asking nothing.`,
  );
  assert.deepEqual(
    offenders,
    [],
    `these loading screens paint a page-title bar for a page that draws no heading:\n  ${offenders.join('\n  ')}`,
  );
});
