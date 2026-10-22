/**
 * ONE THUMB ROW (owner 2026-10-22, "Yes to all", prototype
 * `one_thumb_row_2026-10-22.html`). Properties, not phrasings:
 *
 *  1. The row draws its seats in ONE order — left rounds · field · right rounds/≡ · the main verb LAST — and never two
 *     main verbs (rendered, then read off the markup).
 *  2. Every adopting list screen mounts the shared row exactly once per mode, and no adopter draws its own band.
 *  3. Every placeholder handed to the row names the place in ≤ 3 words — the one exception is a field ALONE in its row
 *     (Discover), which has the whole width. (Fit at 320 is MEASURED in the walk; this keeps the words short enough.)
 *  4. The signed-in top bar carries NO search: the shells hand `false`, the shell draws nothing for `false`, and no
 *     file mounts the old top-bar palette.
 *  5. The account rows' Enter goes where the palette's step-out row goes, and never to a marketplace path or a path
 *     the iPhone app refuses.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ChevronsUpDown, ListFilter, Plus, SquareCheck } from 'lucide-react';
import type * as RowMod from '@/components/thumb-row';
import type * as FindMod from '@/app/dashboard/[eventId]/vendors/_components/find-thumb-row';
import type * as ShellMod from '@/app/_components/frontdoor/shell-thumb-rows';
import { isStoreShellWebOnlyPath } from '@/lib/store-shell';
import { stripComments } from '@/lib/strip-comments';

/* The components compile to classic `React.createElement` under this runner, and a CSS module is its class names
   (the Discover card's test does the same) — set BEFORE the components are required. */
(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  Mod._extensions['.css'] = (m: { exports: unknown }) => {
    m.exports = new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : String(k)) });
  };
}
const { ThumbRow } = require('@/components/thumb-row') as typeof RowMod;
const { findPlaceholder } = require('@/app/dashboard/[eventId]/vendors/_components/find-thumb-row') as typeof FindMod;
const { searchRowHref } = require('@/app/_components/frontdoor/shell-thumb-rows') as typeof ShellMod;

/** A small `expect` over node:assert — this runner is `tsx --test`. */
function expect(v: unknown, msg?: string) {
  const s = () => String(v);
  return {
    toBe: (x: unknown) => assert.equal(v, x, msg),
    toBeTruthy: () => assert.ok(v, msg),
    toBeNull: () => assert.equal(v, null, msg),
    toContain: (x: string) => assert.ok(s().includes(x), msg ?? `expected to contain ${x}`),
    toMatch: (re: RegExp) => assert.match(s(), re, msg),
    toBeLessThan: (n: number) => assert.ok((v as number) < n, msg ?? `${v} < ${n}`),
    toBeLessThanOrEqual: (n: number) => assert.ok((v as number) <= n, msg ?? `${v} <= ${n}`),
    not: {
      toContain: (x: string) => assert.ok(!s().includes(x), msg ?? `expected not to contain ${x}`),
      toMatch: (re: RegExp) => assert.doesNotMatch(s(), re, msg),
    },
  };
}

const WEB = process.cwd();
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const ADOPTERS: Record<string, { file: string; mounts: RegExp; count: number }> = {
  find: { file: 'app/dashboard/[eventId]/vendors/_components/find-thumb-row.tsx', mounts: /<ThumbRow\b/g, count: 1 },
  guests: { file: 'app/dashboard/[eventId]/guests/_components/guests-screen.tsx', mounts: /<ThumbRow\b/g, count: 2 },
  events: { file: 'app/dashboard/(launcher)/page.tsx', mounts: /<EventsThumbRow\b/g, count: 1 },
  discover: { file: 'app/_components/frontdoor/front-door.tsx', mounts: /<DiscoverThumbRow\b/g, count: 1 },
  // The supplier (PR2): People · Dates (with a schedule) · a day — one per screen, three screens in one file.
  customers: { file: 'app/vendor-dashboard/customers/page.tsx', mounts: /<ThumbRow\b/g, count: 3 },
  money: { file: 'app/vendor-dashboard/customers/_components/money-segment.tsx', mounts: /<ThumbRow\b/g, count: 1 },
  page: { file: 'app/vendor-dashboard/website/_components/page-parts.tsx', mounts: /<ThumbRow\b/g, count: 1 },
  // People (and Memories, once it lands on the same component): the account row draws through the shared one.
  account: { file: 'app/dashboard/(account)/_components/account-thumb-row.tsx', mounts: /<ThumbRow\b/g, count: 1 },
};

function seats(html: string): string[] {
  return [...html.matchAll(/data-thumb-seat="([a-z]+)"/g)].map((m) => m[1]!);
}

describe('the row draws one order', () => {
  it('left · field · right · action — the main verb last, only one', () => {
    const html = renderToStaticMarkup(
      createElement(ThumbRow, {
        name: 'probe',
        // given out of order on purpose: the component owns the order, not the caller
        action: { icon: Plus, label: 'Add' },
        right: [{ menu: [{ key: 'a', label: 'A', icon: createElement(ListFilter) }], label: 'Sort', value: 'a', onPick: () => {} }],
        field: { placeholder: 'Search guests' },
        left: [
          { icon: ChevronsUpDown, label: 'Expand all' },
          { icon: SquareCheck, label: 'Select' },
          { icon: SquareCheck, label: 'A third left round is never drawn' },
        ],
      }),
    );
    assert.deepEqual(seats(html), ['round', 'round', 'field', 'menu', 'action']);
    expect(html.match(/data-thumb-seat="action"/g)?.length).toBe(1);
    expect(html).not.toContain('A third left round');
  });

  it('a lone verb sits at the right, after an empty seat', () => {
    const html = renderToStaticMarkup(createElement(ThumbRow, { name: 'money', action: { icon: Plus, label: 'Log a payment' } }));
    assert.deepEqual(seats(html), ['action']);
    expect(html.indexOf('aria-hidden')).toBeLessThan(html.indexOf('data-thumb-seat="action"'));
  });

  it('the row itself has no band — no glass on the row element', () => {
    const html = renderToStaticMarkup(createElement(ThumbRow, { name: 'probe', field: { placeholder: 'Search events' } }));
    const row = html.match(/<div[^>]*data-thumb-row="probe"[^>]*>/)![0];
    expect(row).not.toContain('sn-glass-row');
    expect(html).toContain('sn-glass-row'); // …the field carries it
  });
});

describe('every adopter mounts the one row', () => {
  for (const [name, a] of Object.entries(ADOPTERS)) {
    it(`${name} mounts it ${a.count}×`, () => {
      expect(read(a.file).match(a.mounts)?.length ?? 0).toBe(a.count);
    });
  }
  it('Find and Guests (List / Map) draw no band of their own', () => {
    // No glass of its own anywhere in Find's row file — the shared row draws every glass piece.
    expect(stripComments(read(ADOPTERS.find!.file))).not.toMatch(/sn-glass-row/);
    // Guests keeps the band only for the Select mode's pills (named in the PR as the remaining delta).
    expect(read(ADOPTERS.guests!.file)).toMatch(/selectMode && gview === 'list' \? `\$\{styles\.lower\} sn-glass-row` : styles\.lower/);
  });
});

describe('the supplier rows carry the one row, with no band', () => {
  for (const key of ['customers', 'money', 'page'] as const) {
    it(`${key}: every SupplierThumbRow hands in a row`, () => {
      const src = stripComments(read(ADOPTERS[key]!.file));
      const opens = [...src.matchAll(/<SupplierThumbRow\b/g)].length;
      expect(opens > 0, 'premise: no SupplierThumbRow').toBeTruthy();
      expect([...src.matchAll(/<SupplierThumbRow\b[^>]*?\brow=\{/g)].length).toBe(opens);
    });
  }
  it('a row-carrying SupplierThumbRow draws no band', () => {
    const src = stripComments(read('app/vendor-dashboard/_components/supplier-thumb-row.tsx'));
    const branch = src.slice(src.indexOf('if (row) {'), src.indexOf('}', src.indexOf('document.body', src.indexOf('if (row) {'))));
    expect(branch).toMatch(/className=\{styles\.lower\}/);
    expect(branch).not.toMatch(/sn-glass-row/);
  });
});

describe('placeholders name the place, short', () => {
  const files = [...Object.values(ADOPTERS).map((a) => a.file), 'app/_components/frontdoor/shell-thumb-rows.tsx'];
  const found: { file: string; words: string; alone: boolean }[] = [];
  for (const f of files) {
    const src = read(f);
    for (const m of src.matchAll(/placeholder(?:: '|=")([^'"]+)['"]/g)) {
      if (src.lastIndexOf('<ThumbRow', m.index) === -1 && !/placeholder: '/.test(m[0])) continue;
      // A field alone in its row: the row literal around it has no `action`, `left` or `right`.
      const start = src.lastIndexOf('<ThumbRow', m.index);
      const end = src.indexOf('/>', m.index);
      const block = src.slice(start, end);
      found.push({ file: f, words: m[1]!, alone: start !== -1 && !/\b(action|left|right)=/.test(block) });
    }
  }
  it('finds every placeholder (premise)', () => {
    assert.deepEqual(found.map((p) => p.words).sort(), 
      ['Search customers', 'Search events', 'Search events, people, suppliers', 'Search guests'].sort(),
    );
  });
  it('≤ 3 words unless the field is alone in its row', () => {
    for (const p of found) {
      if (p.alone) continue;
      expect(p.words.split(/\s+/).length, `${p.file}: "${p.words}"`).toBeLessThanOrEqual(3);
    }
  });
  it('People says the owner’s words, short', () => {
    const src = read('app/dashboard/(account)/people/_components/find-or-invite.tsx');
    expect(src).toMatch(/placeholder="Find or invite"/);
  });
  it('Find names the open category only while it stays short', () => {
    expect(findPlaceholder('all suppliers')).toBe('Search suppliers');
    for (const scope of ['Florists', 'Photo & video', 'Hair and makeup artists', 'Lights, sound and effects']) {
      expect(findPlaceholder(scope).split(/\s+/).length, scope).toBeLessThanOrEqual(3);
      expect(findPlaceholder(scope).length, scope).toBeLessThanOrEqual(21);
    }
    expect(read(ADOPTERS.find!.file)).toMatch(/placeholder: findPlaceholder\(scope\)/);
  });
});

describe('the signed-in top bar has no search', () => {
  it('the app shell and the front door hand `false` when signed in', () => {
    expect(read('app/_components/frontdoor/app-rail-shell.tsx')).toMatch(/search=\{searchSlot \?\? \(account\.signedIn \? false : undefined\)\}/);
    expect(read('app/_components/frontdoor/front-door.tsx')).toMatch(/search=\{account\.signedIn \? false : undefined\}/);
  });
  it('the shell draws neither search row for `false`', () => {
    const src = read('app/_components/frontdoor/front-door-shell.tsx');
    expect(src).toMatch(/search === false \? null : \(\s*<div className="fd-searchwrap">/);
    expect(src).toMatch(/inApp \|\| search === false \? null : \(\s*<div className="fd-searchrow">/);
  });
  it('nothing mounts the old top-bar palette', () => {
    for (const f of ['app/_components/frontdoor/app-rail-shell.tsx', 'app/_components/frontdoor/front-door.tsx', 'app/_components/frontdoor/front-door-shell.tsx']) {
      expect(read(f), f).not.toMatch(/<HomeCommandBar\b/);
    }
  });
});

describe('the account rows search inside', () => {
  const REFUSED = /^\/(explore|marketplace|vendors|suppliers)(\/|$|\?)/;
  for (const scope of ['events', 'discover'] as const) {
    for (const q of ['seda', 'Cale & Ice', '  reyes  ']) {
      it(`${scope} "${q}" → the step-out destination, never a marketplace or a web-only path`, () => {
        const href = searchRowHref(q, scope);
        expect(href).toBeTruthy();
        const path = new URL(href!, 'https://x.test').pathname;
        expect(href).not.toMatch(REFUSED);
        expect(isStoreShellWebOnlyPath(path)).toBe(false);
        expect(new URL(href!, 'https://x.test').searchParams.get('q')).toBe(q.trim());
      });
    }
  }
  it('an empty field goes nowhere', () => {
    expect(searchRowHref('   ', 'events')).toBeNull();
  });
  it('the rows build no destination of their own', () => {
    const src = read('app/_components/frontdoor/shell-thumb-rows.tsx');
    expect(src).not.toMatch(/['`]\/(explore|\?q=|dashboard\/search)/);
    expect(src).toMatch(/marketplaceEscapeItem\(q, SEARCH_SCOPES\[scope\]\)/);
  });
});
