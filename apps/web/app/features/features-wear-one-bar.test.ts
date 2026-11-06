/**
 * features-wear-one-bar.test.ts — every /features page wears ONE header, and
 * every text link on a feature page is a 44 px press (sweep 2026-10-19, rows
 * C2 and C5).
 *
 * ─── C5 · TWO HEADERS ON ONE SECTION ─────────────────────────────────────
 * Measured live 2026-10-19: /features (and /tl/features) wore the older
 * floating glass nav — "Prices · Download · Suppliers" — while every
 * /features/<slug> page below it wore the front-door bar and rail. One press
 * from the hub into a feature swapped the whole header. The hub was a member
 * of `NAV_ROUTES` in site-chrome.tsx and its page sat OUTSIDE `app/(shell)/`,
 * the only group whose layout mounts the shared shell.
 *
 * 🔑 THE PROPERTY IS WHERE THE PAGE FILE LIVES, not which words the bar shows.
 * In App Router the chrome a page wears is decided by its ancestors on disk; a
 * route group is invisible in the URL and present in the path. So: every
 * page.tsx whose URL is /features… or /tl/features… sits under app/(shell)/,
 * and no such URL is a NAV_ROUTE (which would stack the glass nav on top).
 *
 * ─── C2 · 20 PX LINKS ────────────────────────────────────────────────────
 * The breadcrumb "Features" and the foot row's "All prices" / "Features"
 * measured 20 px tall at 375. This test measures the press height of EVERY
 * <Link> in the feature-page renderer from its classes — `min-h-[Npx]`, or
 * vertical padding around a 20 px line — so a new link that is only as tall
 * as its text fails here, whatever it says.
 *
 * Sabotage-run 2026-10-19 (see the PR): drop PRESS_44 from the breadcrumb →
 * RED; put '/features' back in NAV_ROUTES → RED; move the hub page back to
 * app/features/page.tsx → RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const SHELL = join(APP, '(shell)');
const read = (p: string) => readFileSync(p, 'utf8');

/* ── C5 · one header ───────────────────────────────────────────────────── */

/** Every page.tsx under app/, with the URL it serves (route groups dropped). */
function allPages(): { file: string; url: string }[] {
  const out: { file: string; url: string }[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name === 'page.tsx') {
        const segs = relative(APP, dir)
          .split(sep)
          .filter((s) => s && !/^\(.*\)$/.test(s));
        out.push({ file: full, url: '/' + segs.join('/') });
      }
    }
  };
  walk(APP);
  return out;
}

const FEATURES_URL = /^\/(?:tl\/)?features(?:\/|$)/;

test('every /features page lives in app/(shell)/, under the one shared shell', () => {
  const pages = allPages().filter((p) => FEATURES_URL.test(p.url));

  // A positive control, not a count floor: the four routes this section is.
  const urls = new Set(pages.map((p) => p.url));
  for (const expected of ['/features', '/features/[slug]', '/tl/features', '/tl/features/[slug]']) {
    assert.ok(
      urls.has(expected),
      `No page serves ${expected}. Either the route was deleted or this walk ` +
        'is reading the wrong directory — and a walk that finds nothing passes.',
    );
  }

  const outside = pages.filter((p) => !p.file.startsWith(SHELL + sep));
  assert.deepEqual(
    outside.map((p) => `${p.url}  ←  ${relative(APP, p.file)}`),
    [],
    'These /features pages sit OUTSIDE app/(shell)/, so they do not get the ' +
      'front-door bar and rail every other feature page wears — the header ' +
      'swaps on one press (sweep C5). Move the page.tsx into app/(shell)/ and ' +
      'take it out of NAV_ROUTES in site-chrome.tsx.',
  );
});

test('no /features path is a NAV_ROUTE, so the glass nav never stacks on the shell', () => {
  const src = stripComments(read(join(APP, '_components', 'marketing', 'site-chrome.tsx')));
  const block = /const NAV_ROUTES = new Set<string>\(\[([\s\S]*?)\]\)/.exec(src);
  assert.ok(block, 'NAV_ROUTES not found in site-chrome.tsx — this check would pass vacuously.');
  const routes = [...(block[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1] ?? '');
  assert.ok(
    routes.includes('/download'),
    `NAV_ROUTES parsed without /download (a stable member) — the parser is wrong. Got: ${routes.join(', ')}`,
  );
  const stacked = routes.filter((r) => FEATURES_URL.test(r));
  assert.deepEqual(
    stacked,
    [],
    'A /features path is a NAV_ROUTE. It is also under the shared shell, so the ' +
      'fixed glass nav would render ON TOP of the front-door bar — two headers.',
  );
});

test('nothing on a /features page mounts a header of its own', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.tsx')) files.push(full);
    }
  };
  walk(HERE); // the renderer + the hub body and its sections
  for (const d of ['features', join('tl', 'features')]) {
    const p = join(SHELL, d);
    if (existsSync(p)) walk(p);
  }
  assert.ok(files.some((f) => f.endsWith('_feature-page.tsx')), 'The renderer was not walked.');

  const SECOND_HEADER = /from '@\/app\/_components\/(?:marketing\/(?:site-nav|site-chrome)|frontdoor\/app-rail-shell)'/;
  const offenders = files.filter((f) => SECOND_HEADER.test(stripComments(read(f))));
  assert.deepEqual(
    offenders.map((f) => relative(APP, f)),
    [],
    'A /features file imports a header (the glass nav, SiteChrome or the shell ' +
      'itself). The (shell) layout already mounts the one bar; a second import is ' +
      'a second header.',
  );
});

/* ── C2 · every text link is a 44 px press ─────────────────────────────── */

const RENDERER = join(HERE, '_feature-page.tsx');

/** `const NAME = '…' + '…';` → the joined string, for every such constant. */
function stringConstants(src: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of src.matchAll(/const ([A-Z][A-Z0-9_]*)\s*=\s*((?:'[^']*'\s*\+?\s*)+);/g)) {
    const parts = [...(m[2] ?? '').matchAll(/'([^']*)'/g)].map((x) => x[1] ?? '');
    out.set(m[1] ?? '', parts.join(''));
  }
  return out;
}

/** The className expression of a `<Link …>` opening tag, resolved to classes. */
function linkClasses(tag: string, consts: Map<string, string>): string | null {
  const i = tag.indexOf('className=');
  if (i < 0) return null;
  let rest = tag.slice(i + 'className='.length);
  if (rest.startsWith('"')) return rest.slice(1, rest.indexOf('"', 1));
  if (!rest.startsWith('{')) return null;
  let depth = 0;
  let end = 0;
  for (let k = 0; k < rest.length; k++) {
    if (rest[k] === '{') depth++;
    else if (rest[k] === '}' && --depth === 0) {
      end = k;
      break;
    }
  }
  rest = rest.slice(1, end).trim();
  if (/^[A-Z][A-Z0-9_]*$/.test(rest)) return consts.get(rest) ?? null;
  if (rest.startsWith('`')) {
    return rest
      .slice(1, -1)
      .replace(/\$\{([A-Z][A-Z0-9_]*)\}/g, (_, n: string) => consts.get(n) ?? '');
  }
  return null;
}

/** Press height in px from the classes: min-h, else padding around a 20 px line. */
function pressHeight(classes: string): number {
  const tokens = classes.split(/\s+/);
  let h = 20; // text-sm line — the smallest line any link here sits on
  for (const t of tokens) {
    const minH = /^min-h-\[(\d+)px\]$/.exec(t);
    if (minH) h = Math.max(h, Number(minH[1]));
    const py = /^py-(\d+(?:\.5)?)$/.exec(t);
    if (py) h = Math.max(h, 20 + 2 * 4 * Number(py[1]));
  }
  return h;
}

test('every <Link> on a feature page presses at 44 px or more', () => {
  const src = stripComments(read(RENDERER));
  const consts = stringConstants(src);
  assert.ok(consts.has('PRIMARY_CTA'), 'PRIMARY_CTA was not parsed — the constant resolver is broken.');

  const tags = [...src.matchAll(/<Link\b[\s\S]*?>/g)].map((m) => m[0]);
  const measured = tags.map((tag) => {
    const classes = linkClasses(tag, consts);
    const href = /href=\{?["`]?([^"`}\s]+)/.exec(tag)?.[1] ?? '?';
    return { href, classes, h: classes === null ? 0 : pressHeight(classes) };
  });

  // Positive control: the breadcrumb row's hub link is the row C2 was filed on.
  assert.ok(
    measured.filter((m) => m.href === 'hubHref').length >= 2,
    'The breadcrumb and foot-row "Features" links (href={hubHref}) were not ' +
      'found — this walk is reading the wrong file or the wrong tag shape.',
  );

  const short = measured.filter((m) => m.h < 44);
  assert.deepEqual(
    short.map((m) => `href=${m.href} → ${m.h}px  [${m.classes ?? 'className not resolvable'}]`),
    [],
    'These feature-page links press shorter than 44 px (sweep C2). Give a text ' +
      'link PRESS_44 (`inline-flex min-h-[44px] -my-3 items-center` — the look ' +
      'does not change), or `py-3 -my-3` where the text can wrap.',
  );
});
