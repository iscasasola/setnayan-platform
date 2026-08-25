/**
 * Guard: a loading screen must not promise a page header that the arriving page
 * does not paint.
 *
 * WHY THIS EXISTS. On 2026-08-21 the owner removed the page header outright from
 * the three authenticated trees — no back chevron, no visible title, no (i)
 * (PRs #4664 + #4669). `<PageMasthead>` has rendered an `sr-only` <h1> and
 * nothing else ever since. The skeletons were never told. Measured on
 * `origin/main` a8f8601: 129 `loading.tsx` files reached `HeaderSkeleton`
 * through a shared page template, and 2 more hand-rolled the same block — every
 * one of them drew an eyebrow bar and a 32px title bar, and then the content
 * arrived and jumped up by the height of a header that no longer exists.
 *
 * A skeleton is a promise about the shape that is coming. This asks that the
 * promise be true, in both directions.
 *
 * THE SUBJECT LIST IS DERIVED, NOT ENUMERATED. Every `loading.tsx` under `app/`
 * is walked, and whether a route is ALLOWED to draw a title is answered from the
 * route's own code — does anything beside it paint a visible `.sn-h1`, a
 * `<DoorShell>` (which carries an eyebrow + title inside its card) or an `<h1>`?
 * A hand-written allowlist here would have been a list of the routes I happened
 * to think of; two dashboard roots (`[eventId]` and `vendor-dashboard`) DO paint
 * a real hero title and are admitted by that rule without being named.
 *
 * Each assertion is floored, so a sweep that silently matches nothing cannot
 * pass as a clean result.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const APP = 'app';
const AUTH_TREES = ['app/dashboard', 'app/vendor-dashboard', 'app/admin'];

const TEMPLATES = [
  'ListPageSkeleton',
  'GridPageSkeleton',
  'FormPageSkeleton',
  'DetailPageSkeleton',
  'TablePageSkeleton',
  'FeedPageSkeleton',
  'BoardPageSkeleton',
  'PageSkeleton',
  'HeaderSkeleton',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry === 'loading.tsx') out.push(full);
  }
  return out;
}

/** Comments describe the retirement; they must never satisfy or trip a match. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const LOADERS = walk(APP);

/**
 * Does the PAGE at this route paint a heading a person can actually see?
 *
 * Deliberately narrow: `page.tsx` and the route's own `_components/`, and
 * nothing else. An earlier cut read every `.tsx` beside the loader and was
 * DECORATIVE because of it — `app/admin/error.tsx` carries an <h1>, so the admin
 * root exempted itself and a restored header block passed green. An error screen
 * is a different render from the page; it cannot vouch for the page's shape.
 */
function routePaintsAVisibleTitle(loadingFile: string): boolean {
  const dir = loadingFile.slice(0, loadingFile.lastIndexOf('/'));
  const candidates: string[] = [];
  const page = join(dir, 'page.tsx');
  if (existsSync(page)) candidates.push(page);
  const comps = join(dir, '_components');
  if (existsSync(comps)) {
    const stack = [comps];
    while (stack.length) {
      const cur = stack.pop() as string;
      for (const name of readdirSync(cur)) {
        const full = join(cur, name);
        if (statSync(full).isDirectory()) stack.push(full);
        else if (name.endsWith('.tsx') && !name.endsWith('.test.tsx')) candidates.push(full);
      }
    }
  }
  return candidates.some((f) => {
    const src = stripComments(readFileSync(f, 'utf8'));
    return /sn-h1|<DoorShell|<h1[\s>]/.test(src);
  });
}

const usesTemplate = (src: string) => TEMPLATES.some((t) => new RegExp(`\\b${t}\\b`).test(src));
const drawsTitle = (src: string) =>
  /\btitle\b(\s*=\s*\{?\s*true|\s*\/>|\s*\}|\s+)/.test(src) || /<header[\s>]/.test(src);

test('no authenticated-tree loading screen draws the retired page header', () => {
  const inAuth = LOADERS.filter((f) => AUTH_TREES.some((r) => f.startsWith(`${r}/`)));
  assert.ok(
    inAuth.length >= 120,
    `floor: expected the auth trees to still hold 120+ loading screens, found ${inAuth.length}. ` +
      'If they genuinely moved, re-measure — do not lower this number to go green.',
  );

  const offenders = inAuth.filter((f) => {
    const src = stripComments(readFileSync(f, 'utf8'));
    /* A <header> block, or `title` handed to a shared template, is a promise of
       the retired row. Either is fine ONLY where the route paints a real one. */
    const promises = /<header[\s>]/.test(src) || (usesTemplate(src) && /\btitle\b/.test(src));
    return promises && !routePaintsAVisibleTitle(f);
  });

  assert.deepEqual(
    offenders,
    [],
    'These loading screens promise a page header that the retirement of 2026-08-21 deleted. ' +
      'The content will jump up by its height when the page arrives.',
  );
});

test('the shared header skeleton defaults to NO title', () => {
  const src = readFileSync('components/skeletons/index.tsx', 'utf8');
  assert.match(
    stripComments(src),
    /export function HeaderSkeleton\(\{[\s\S]{0,120}?title = false/,
    'HeaderSkeleton must default `title` to false — the retired header is the majority case, ' +
      'so the safe default is to draw nothing and let the 13 titled routes opt in.',
  );
});

test('the doors and guest doorways still draw their title', () => {
  const outside = LOADERS.filter((f) => !AUTH_TREES.some((r) => f.startsWith(`${r}/`)));
  const shouldOptIn = outside.filter((f) => {
    const src = stripComments(readFileSync(f, 'utf8'));
    return usesTemplate(src) && routePaintsAVisibleTitle(f);
  });

  assert.ok(
    shouldOptIn.length >= 13,
    `floor: expected 13+ titled non-dashboard loading screens, found ${shouldOptIn.length}`,
  );

  const missing = shouldOptIn.filter((f) => !/\btitle\b/.test(stripComments(readFileSync(f, 'utf8'))));
  assert.deepEqual(
    missing,
    [],
    'These routes paint a real eyebrow + title, so their loading screen must pass `title` — ' +
      'otherwise the header appears out of nowhere once the page lands.',
  );
});
