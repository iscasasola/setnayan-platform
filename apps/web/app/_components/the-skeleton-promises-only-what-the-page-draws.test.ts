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

function templateCall(file: string): string {
  const s = src(file);
  const m = new RegExp(`<(?:${TEMPLATES.join('|')})\\b[\\s\\S]*?/>`).exec(s);
  return m ? m[0] : '';
}

function promisesTitle(file: string): boolean {
  const call = templateCall(file);
  return /\stitle(\s*=\s*\{true\})?[\s/>]/.test(call);
}

function promisedActions(file: string): number {
  const m = /\sactions=\{(\d+)\}/.exec(templateCall(file));
  return m ? Number(m[1]) : 0;
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
 * `null` — the masthead draws no actions.
 * `'always'` — it draws them at every width.
 * `'responsive'` — the actions are inside a `hidden … lg:flex` shell, so a
 *   phone never sees them and the skeleton is free to reserve nothing.
 */
function mastheadActions(pageFile: string): null | 'always' | 'responsive' {
  const s = src(pageFile);
  let verdict: null | 'always' | 'responsive' = null;
  for (const m of s.matchAll(/<PageMasthead\b/g)) {
    const seg = s.slice(m.index!, m.index! + 4000);
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
    if (/^<\w+[^>]*className="[^"]*\bhidden\b/.test(flat)) {
      if (verdict === null) verdict = 'responsive';
    } else {
      verdict = 'always';
    }
  }
  return verdict;
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

test('a loading screen reserves the header actions its page renders — and no others', () => {
  const missing: string[] = [];
  const phantom: string[] = [];
  for (const f of loaders()) {
    const page = f.replace(/loading\.tsx$/, 'page.tsx');
    if (!existsSync(page)) continue;
    const real = mastheadActions(page);
    const promised = promisedActions(f);
    const rel = f.replace(`${WEB_ROOT}/`, '');
    if (real === 'always' && promised < 1) missing.push(rel);
    // 'responsive' is exempt in both directions: the buttons exist on a laptop
    // and not on a phone, and one skeleton cannot be right about both.
    if (real === null && promised > 0) phantom.push(rel);
  }
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
