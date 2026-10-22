/**
 * shell-search.test.ts — a search started in the signed-in shell is answered
 * IN the shell.
 *
 * ── WHAT THE OWNER SAW (22 Oct 2026, iPhone, signed in) ─────────────────────
 * He searched "seda" from the shell's search and landed on `/explore?q=seda`:
 * the old top bar with "+ Create event", a second big search box, an
 * "Off-season savings" pill, "No suppliers match exactly… Clear all filters",
 * and no account bar. *"I tried to search for seda and brought me here away
 * from our shell."* Two hops took him out: the palette's row opened the public
 * front door (`/?q=`), and its results handed the words to the marketplace.
 *
 * ── THE PROPERTY ────────────────────────────────────────────────────────────
 *   1. Every search hop the shell offers — the palette's step-out row, in every
 *      scope — resolves, the way the router resolves it, to a page whose
 *      layouts draw the ACCOUNT BAR and the app top bar (never a doorway).
 *   2. The shell's results page renders the shared results view in its shell
 *      form, and the shell form draws no link to `/explore` or back to `/?q=`
 *      (rendered, not grepped — the defect was a link).
 *   3. A member's `/?q=` (old link, paste) is sent to the shell's results.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { SEARCH_SCOPES } from './search-scope';
import { SHELL_SEARCH_PATH, shellSearchHref } from './shell-search';
import { marketplaceEscapeItem } from '@/app/_components/frontdoor/command-escape';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(WEB, 'app');
const code = (abs: string) => stripComments(readFileSync(abs, 'utf8'));

/**
 * Resolve a URL path to its `page.tsx` the way the App Router does: a literal
 * folder, else a route group `( )` holding it, else a dynamic `[ ]` segment.
 * Returns the page and every directory on the way (for the layout chain).
 */
function resolvePage(urlPath: string): { page: string; dirs: string[] } | null {
  const segs = urlPath.split('?')[0]!.split('#')[0]!.split('/').filter(Boolean);
  const walk = (dir: string, rest: string[], trail: string[]): { page: string; dirs: string[] } | null => {
    const here = [...trail, dir];
    if (rest.length === 0) {
      const page = join(dir, 'page.tsx');
      if (existsSync(page)) return { page, dirs: here };
    }
    const kids = readdirSync(dir).filter((k) => statSync(join(dir, k)).isDirectory() && !k.startsWith('_') && !k.startsWith('@'));
    if (rest.length > 0 && kids.includes(rest[0]!)) {
      const hit = walk(join(dir, rest[0]!), rest.slice(1), here);
      if (hit) return hit;
    }
    for (const g of kids.filter((k) => k.startsWith('(') && k.endsWith(')'))) {
      const hit = walk(join(dir, g), rest, here);
      if (hit) return hit;
    }
    if (rest.length > 0) {
      for (const d of kids.filter((k) => k.startsWith('[') && !k.startsWith('[['))) {
        const hit = walk(join(dir, d), rest.slice(1), here);
        if (hit) return hit;
      }
    }
    return null;
  };
  return walk(APP, segs, []);
}

/** The layouts a page renders inside, outermost first. */
function layoutsOf(dirs: string[]): string[] {
  return dirs.map((d) => join(d, 'layout.tsx')).filter((f) => existsSync(f));
}

/** Does this address land inside the account shell — the account bar and the app top bar? */
function landsInShell(href: string): { ok: boolean; why: string } {
  const hit = resolvePage(href);
  if (!hit) return { ok: false, why: `${href} resolves to no page` };
  const layouts = layoutsOf(hit.dirs).map((f) => ({ f, src: code(f) }));
  const doorway = layouts.find((l) => /variant="doorway"/.test(l.src));
  if (doorway) return { ok: false, why: `${href} renders inside a doorway layout (${doorway.f.slice(WEB.length)})` };
  const bar = layouts.find((l) => /<AccountBarSlot\b/.test(l.src) && /<AppRailShell\b/.test(l.src));
  if (!bar) return { ok: false, why: `${href} → ${hit.page.slice(WEB.length)}: no layout draws the account bar and the app top bar` };
  return { ok: true, why: '' };
}

test('premise: the resolver finds the doorway and the shell where they are', () => {
  // A resolver that resolved nothing would make every assertion below vacuous.
  assert.equal(landsInShell('/explore').ok, false, '/explore should resolve into the (shell) doorway layout');
  assert.match(landsInShell('/explore').why, /doorway/);
  assert.equal(landsInShell('/').ok, false, '/ is the public front door, not the account shell');
  assert.equal(landsInShell('/dashboard/people').ok, true, landsInShell('/dashboard/people').why);
});

test('1 · the shell results page is a page of the account shell', () => {
  const r = landsInShell(SHELL_SEARCH_PATH);
  assert.ok(r.ok, r.why);
});

test('1 · the palette step-out row lands in the shell — every scope, every query', () => {
  let n = 0;
  for (const scope of Object.values(SEARCH_SCOPES)) {
    for (const q of ['seda', 'Seda Vertis North', 'doves & lilies', 'kasal?']) {
      const row = marketplaceEscapeItem(q, scope);
      assert.ok(row, `${scope.key}: no step-out row for "${q}"`);
      const r = landsInShell(row.href);
      assert.ok(r.ok, `${scope.key} "${q}": ${r.why}`);
      assert.equal(row.href, shellSearchHref(q), `${scope.key}: the row stopped carrying the words`);
      n += 1;
    }
  }
  assert.equal(n, Object.keys(SEARCH_SCOPES).length * 4);
});

test('2 · the results page renders the shared results view, in its shell form', () => {
  const page = resolvePage(SHELL_SEARCH_PATH)!.page;
  const src = code(page);
  assert.match(src, /<FrontDoorResults[\s\S]*?place="shell"/, 'the shell page stopped drawing the shared results view in shell form');
});

test('2 · the shell form draws no door out of the shell — rendered', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ShellOnward } = await import('@/app/_components/frontdoor/shell-search-onward');
  const find = { href: '/dashboard/S89E-TESTEVENT1/vendors', eventName: 'Cale & Ice' };
  let drawn = 0;
  for (const total of [0, 3]) {
    for (const findSuppliers of [null, find]) {
      const html = renderToStaticMarkup(React.createElement(ShellOnward, { query: 'seda', total, findSuppliers }));
      for (const href of [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]!)) {
        assert.doesNotMatch(href, /^\/explore\b/, `total=${total}: the shell results link to the marketplace`);
        assert.doesNotMatch(href, /^\/(\?|$)/, `total=${total}: the shell results link back to the front door`);
      }
      if (total === 0) {
        // 4 · the empty state names what was searched and where.
        assert.match(html, /Nothing matches “seda”/, 'the empty state no longer names the words');
        assert.match(html, /your events, the suppliers on your events/, 'the empty state no longer says where it looked');
        assert.doesNotMatch(html, /filter|Off-season/i, 'the empty state talks about filters nobody set');
      }
      if (html) drawn += 1;
    }
  }
  assert.ok(drawn >= 3, 'premise: the onward block rendered nothing to judge');
  const r = landsInShell(find.href);
  assert.ok(r.ok || /\[eventId\]/.test(resolvePage(find.href)?.page ?? ''), 'the find row left the shell');
});

test('2 · in the shared view, the marketplace row lives only in the front-door branch', () => {
  const src = code(join(APP, '_components', 'frontdoor', 'front-door-results.tsx'));
  const branch = src.indexOf("place === 'shell' ?");
  assert.ok(branch > 0, 'the shell/front-door branch is gone — re-anchor');
  const shellSide = src.slice(branch, src.indexOf(') : (', branch));
  assert.match(shellSide, /<ShellOnward\b/, 'the shell side no longer draws ShellOnward');
  assert.doesNotMatch(shellSide, /\/explore/, 'the shell side links to the marketplace');
  const explore = [...src.matchAll(/\/explore\?q=/g)].map((m) => m.index!);
  assert.equal(explore.length, 1, 'expected exactly one marketplace link, in the front-door branch');
  assert.ok(explore[0]! > branch + shellSide.length, 'the marketplace link moved into the shell branch');
});

test('3 · a member’s /?q= goes to the shell; a stranger’s stays on the front door', () => {
  const src = code(join(APP, 'page.tsx'));
  const flat = src.replace(/\s+/g, ' ');
  assert.ok(
    flat.includes('if (q?.trim() && (await getCurrentUser().catch(() => null))) { redirect(shellSearchHref(q)); }'),
    'app/page.tsx no longer sends a signed-in search to the shell',
  );
  assert.match(src, /<FrontDoor[^>]*\bq=\{q\}/, 'the signed-out front door lost its query');
});
