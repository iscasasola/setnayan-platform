/**
 * 🔒 EVERY GUEST PAGE WEARS THE COUPLE'S THEME — from ONE place.
 *
 * Owner, 2026-09-25: *"event hub has the different menus that are not editable.
 * but they should still adapt to their theme"* — and, on wearing the look once
 * at the top of every guest page, *"yes place it there."*
 *
 * Before this, the look was stamped on the `<main>` of three pages (the landing
 * page through InvitationShell, the recap, the money gift). Every other page of
 * the tree — `/find-seat`, `/seat`, `/find-my-table`, `/hub`, `/everyone`,
 * `/welcome`, `/venue`, `/avatar`, `/print` — wore Clean-Editorial whatever the
 * couple chose, and nothing noticed, because nothing asked.
 *
 * The property this file holds is STRUCTURAL, so it is checked structurally:
 *
 *   1 · the layout wraps EVERY child in the scope — a `{children}` rendered
 *       outside it is a page that silently stops wearing the theme;
 *   2 · the scope is the ONLY element that stamps the look — a second stamp on
 *       a page re-declares the theme BELOW the layout's inline palette and lets
 *       the theme's stylesheet beat the couple's own colours;
 *   3 · every page under `app/[slug]/` is either worn or belongs to a segment
 *       that provably dresses itself (the door) — a new page can't be exempted
 *       by adding it to a list;
 *   4 · the scope renders the look when there is one, and House renders the
 *       exact element it always did;
 *   5 · the layout never resolves the couple's reveal photo — it wraps the
 *       private landing, and must show a stranger nothing that screen hides.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const SLUG = import.meta.dirname;
const read = (...p: string[]) => readFileSync(join(SLUG, ...p), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|css)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}
const FILES = walk(SLUG);
const rel = (f: string) => relative(SLUG, f).split(sep).join('/');

test('1 · the layout wraps EVERY child in the scope, and reads the look through the cache', () => {
  const src = stripComments(read('layout.tsx'));
  const open = src.indexOf('<GuestLookScope');
  const close = src.indexOf('</GuestLookScope>');
  assert.ok(open > 0 && close > open, 'layout.tsx no longer renders <GuestLookScope> — no page wears the theme');

  const children = [...src.matchAll(/\{children\}/g)].map((m) => m.index!);
  assert.ok(children.length >= 1, 'layout.tsx renders no {children} — this guard is looking at nothing');
  for (const at of children) {
    assert.ok(
      at > open && at < close,
      'layout.tsx renders {children} OUTSIDE <GuestLookScope> — every page below it stops wearing the theme',
    );
  }
  // The return value IS the scope: nothing wraps it that could re-establish a
  // default look above the pages.
  assert.match(src, /return \(\s*<GuestLookScope\b/, 'the layout returns something other than the scope');
  assert.match(src, /loadGuestLook\(slug\)/, 'the look is not read through the cached loader');

  const loaders = stripComments(read('_lib', 'loaders.ts'));
  assert.match(
    loaders,
    /export const loadGuestLook = cache\(/,
    'loadGuestLook is not React-cache()d — the layout would add an uncached read on every page',
  );
  const body = loaders.slice(loaders.indexOf('export const loadGuestLook'));
  assert.match(
    body.slice(0, 1200),
    /await loadEventShell\(slug\)/,
    'loadGuestLook reads the event itself instead of the cached shell row — a second events read per request',
  );
});

test('2 · the scope is the ONLY element that stamps the look', () => {
  const offenders: string[] = [];
  for (const f of FILES) {
    const name = rel(f);
    if (name === '_components/guest-look-scope.tsx') continue;
    const src = stripComments(readFileSync(f, 'utf8'));
    if (/data-hub-theme=\{/.test(src)) offenders.push(`${name}: stamps data-hub-theme`);
    if (/data-art=\{/.test(src)) offenders.push(`${name}: stamps data-art`);
    // The mood-board palette as inline vars on a page element. `loaders.ts`
    // builds the look for the scope; `icon-source.ts` paints the home-screen
    // ICON (an image route, not a page) and has always read it directly.
    if (
      /buildSitePaletteVars\(/.test(src) &&
      name !== '_lib/loaders.ts' &&
      name !== '_lib/icon-source.ts'
    ) {
      offenders.push(`${name}: builds the palette vars itself`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'a page re-applies the look under the layout. Beneath the layout\'s inline palette, a re-stamped ' +
      'theme attribute lets the theme stylesheet beat the couple\'s own colours — rely on the scope',
  );

  const scope = stripComments(read('_components', 'guest-look-scope.tsx'));
  const tag = scope.slice(scope.indexOf('<div'), scope.indexOf('>', scope.indexOf('style=')));
  for (const attr of ['data-hub-theme=', 'data-art=', 'style=']) {
    assert.ok(
      tag.includes(attr),
      `the scope's own element lost ${attr} — the attribute and the inline palette must sit on ONE ` +
        'element, or `theme < palette < the couple\'s hex` inverts',
    );
  }
});

test('3 · every page is worn, or its segment provably dresses itself', async () => {
  // 🪤 A `'use client'` module lands under `.default` when imported under tsx.
  const mod = (await import('./_components/guest-look-scope')) as unknown as Record<string, unknown> & {
    default?: Record<string, unknown>;
  };
  const exempt = (mod.SEGMENTS_THAT_DRESS_THEMSELVES ??
    mod.default?.SEGMENTS_THAT_DRESS_THEMSELVES) as readonly string[];
  assert.ok(Array.isArray(exempt), 'the self-dressing list is no longer exported');

  const pages = FILES.filter((f) => /(^|\/)page\.tsx$/.test(rel(f))).map(rel);
  assert.ok(pages.length >= 12, `found ${pages.length} guest pages, expected 12+ — this walk is blind`);

  const worn: string[] = [];
  for (const page of pages) {
    const segment = page.includes('/') ? page.split('/')[0]! : null;
    if (segment && exempt.includes(segment)) {
      // An exemption is honest only if the page brings its own look — the
      // door's own look loader, or the door shell. Anything else is a page
      // quietly opted out.
      const src = stripComments(read(...page.split('/')));
      assert.match(
        src,
        /loadInviteLook\(|<DoorShell\b/,
        `${page} is exempted from the theme ("${segment}" dresses itself) but renders no door — ` +
          'exempting a page is not the same as theming it',
      );
      continue;
    }
    worn.push(page);
  }
  // The pages the owner's ruling is about, by name — a regression here is the
  // exact failure this build exists to end.
  for (const must of [
    'page.tsx',
    'everyone/page.tsx',
    'find-my-table/page.tsx',
    'find-seat/page.tsx',
    'hub/page.tsx',
    'print/page.tsx',
    'seat/page.tsx',
    'venue/page.tsx',
    'welcome/page.tsx',
    'recap/page.tsx',
    'pabuya/page.tsx',
    'avatar/page.tsx',
  ]) {
    assert.ok(worn.includes(must), `${must} does not wear the couple's theme`);
  }
  assert.deepEqual([...exempt], ['invite'], 'the self-dressing list grew — say why in guest-look-scope.tsx and here');
});

test('4 · the scope renders the look — and House renders the element it always did', async () => {
  const React = (await import('react')).default;
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const mod = (await import('./_components/guest-look-scope')) as unknown as Record<string, unknown> & {
    default?: Record<string, unknown>;
  };
  const pick = (k: string): unknown => mod[k] ?? mod.default?.[k];
  assert.equal(typeof pick('GuestLookScope'), 'function', 'the scope module lost GuestLookScope');
  assert.equal(typeof pick('lookIsWorn'), 'function', 'the scope module lost lookIsWorn');
  const GuestLookScope = pick('GuestLookScope') as React.FunctionComponent<Record<string, unknown>>;
  const lookIsWorn = pick('lookIsWorn') as (s: string | null, l: Record<string, unknown>) => boolean;

  const render = (props: Record<string, unknown>) =>
    renderToStaticMarkup(React.createElement(GuestLookScope, props, React.createElement('p', null, 'page')));

  const velvet = render({
    theme: 'velvet',
    art: null,
    fontClassName: 'font-a font-b',
    style: { '--accent': '#8a5a44', '--color-cream': '1 2 3' },
  });
  assert.match(velvet, /data-hub-theme="velvet"/, 'a themed event wears no data-hub-theme');
  assert.match(velvet, /--accent:#8a5a44/, 'the couple\'s accent did not reach the scope');
  assert.match(velvet, /--color-cream:1 2 3/, 'the palette did not reach the scope');
  assert.match(velvet, /class="sn-editorial contents text-ink font-a font-b"/, 'fonts or the theme ink are missing');
  assert.match(velvet, /data-guest-ground="true"/, 'no paper under a themed page — Velvet\'s cream ink lands on a white body');
  assert.ok(velvet.indexOf('<p>page</p>') > velvet.indexOf('data-hub-theme'), 'the page is not inside the scope');

  // THE THEME'S LOOP, when it has one: muted + inline (iPhone plays it without a
  // tap), hidden under reduced motion, with the page's own paper as the scrim.
  const looped = render({
    theme: 'velvet',
    art: null,
    fontClassName: '',
    style: null,
    ground: { loop: 'https://r2.example/luxe-loop.mp4', poster: 'https://r2.example/luxe-poster.jpg', scrim: 0.62, foil: true },
  });
  assert.match(looped, /<video[^>]*data-theme-loop/, 'the theme loop is not drawn');
  assert.match(looped, /<video[^>]*muted/, 'the loop is not muted — iPhone Safari will not autoplay it');
  assert.match(looped, /<video[^>]*playsinline/i, 'the loop is not inline — iPhone takes it full-screen');
  assert.match(looped, /<video[^>]*motion-reduce:hidden/, 'the loop still plays under reduced motion');
  assert.match(looped, /data-theme-scrim[^>]*rgb\(var\(--color-cream\) \/ 0\.62\)/, 'the scrim is not the page\'s own paper');
  assert.match(looped, /data-hub-foil=""/, 'Luxe does not shimmer its names');
  assert.doesNotMatch(velvet, /<video/, 'a theme with no ground resolved drew a video anyway');

  const candle = render({ theme: null, art: 'candlelight', fontClassName: '', style: null });
  assert.match(candle, /data-art="candlelight"/, 'the candlelight art direction is not worn');

  // ⛔ HOUSE: not "a House attribute" — the pre-existing element, byte for byte.
  const house = render({ theme: null, art: null, fontClassName: 'font-a', style: null });
  assert.equal(house, '<div class="sn-editorial contents"><p>page</p></div>', 'House is no longer byte-identical');

  // The door keeps its own composition.
  const look = { theme: 'velvet', art: null, style: { '--accent': '#000' } };
  assert.equal(lookIsWorn('invite', look), false, 'the look reaches into the invite door');
  for (const seg of [null, 'hub', 'seat', 'find-seat', 'everyone', 'welcome', 'venue', 'print']) {
    assert.equal(lookIsWorn(seg, look), true, `${seg ?? '/'} does not wear the look`);
  }
  assert.equal(lookIsWorn('hub', { theme: null, art: null, style: null }), false, 'House wears something');
});

test('5 · the layout never resolves the couple\'s reveal photo', () => {
  const layout = stripComments(read('layout.tsx'));
  assert.doesNotMatch(layout, /resolveHubLook|resolveInviteGround/, 'the layout resolves the reveal photo');
  assert.doesNotMatch(layout, /siteSkin\([^)]*photo/, 'the layout hands the site skin a photo');
  // The ground it DOES draw is the theme's own public loop — never the couple's.
  // Resolved in `lookScopeProps` (2026-09-25), the ONE translation the layout
  // and the host canvas's drafted look share.
  assert.match(layout, /lookScopeProps\(look\)/, 'the layout no longer wears the shared look translation');
  const scope = stripComments(read('_components', 'host-draft-look.tsx'));
  const props = scope.slice(scope.indexOf('export function lookScopeProps'), scope.indexOf('export function HostDraftLook'));
  assert.match(props, /resolveThemeGround\(/, 'the layout no longer draws the theme ground');
  assert.doesNotMatch(props, /resolveHubLook|resolveInviteGround|photo/, 'the shared translation resolves the reveal photo');
  const ground = stripComments(read('_lib', 'theme-ground.ts'));
  assert.doesNotMatch(
    ground,
    /resolveInviteGround|std_background|displayUrlForStoredAsset|landing_page_hero/,
    'the theme ground reads the couple\'s own media — the layout wraps the private landing',
  );
  assert.match(ground, /INVITE_THEMES\[theme\]/, 'the theme ground no longer reads the registry');

  const loaders = stripComments(read('_lib', 'loaders.ts'));
  const body = loaders.slice(loaders.indexOf('export const loadGuestLook'));
  const end = body.indexOf('\n});');
  assert.ok(end > 0, 'loadGuestLook has no closing — re-anchor this guard rather than deleting it');
  const fn = body.slice(0, end);
  assert.match(fn, /resolveHubTheme\(/, 'loadGuestLook does not go through the one theme gate');
  assert.doesNotMatch(fn, /resolveHubLook|resolveInviteGround/, 'loadGuestLook signs the reveal photo');
  // The page's own gates — a slug that is not a website-bearing event renders a
  // SUPPLIER's page at the same address, which must never wear a couple's look.
  assert.match(fn, /RESERVED_SLUGS/, 'loadGuestLook dropped the reserved-slug gate');
  assert.match(fn, /surfaceEnabled\([^)]*\), 'website'\)/, 'loadGuestLook dropped the website-surface gate');

  const hub = stripComments(read('_lib', 'hub-look.ts'));
  const themeFn = hub.slice(hub.indexOf('export async function resolveHubTheme'), hub.indexOf('export async function resolveHubLook'));
  assert.ok(themeFn.length > 50, 'resolveHubTheme is gone — re-anchor this guard');
  assert.doesNotMatch(themeFn, /resolveInviteGround/, 'resolveHubTheme presigns the reveal photo');
});
