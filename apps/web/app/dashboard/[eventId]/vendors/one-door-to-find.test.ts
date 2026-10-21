/**
 * GUARD — ONE DOOR TO FIND, AND IT SHOWS THE FIND PAGE'S OWN ROWS.
 *
 * Owner, 2026-10-21, on the couple's Suppliers page: *"Why do i have this find
 * supplier button? When we have the search bar at the bottom?"* ⇒ the big
 * "Find a supplier" button is removed; the bottom search, tapped with nothing
 * typed, shows the category list the Find page shows. And, same screen:
 * *"and typing saysay did not show?"*
 *
 * The properties held here:
 *   (a) EXECUTED — the Suppliers page's Find body draws no second door to Find:
 *       no "Find a supplier" control and no link to the Find page.
 *   (b) EXECUTED — the empty search state IS the Find page's list: one
 *       component (`FindCategoryList`) draws both, from one read
 *       (`readFindList`), so the rows, their order, their "Booked ✓ / Joining
 *       soon" and where a row goes cannot differ — and the Find page draws no
 *       category row of its own.
 *   (c) a refused booked read says so, and no row then reads "Booked ✓".
 *   (d) a typed shop name reaches a NAME search on both searches, and demo
 *       shops are hidden by ONE rule (an admin in demo mode sees them — the
 *       category search always honoured that; the name search hid them from
 *       everyone, so the owner could never find Saysay by name).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { buildFindList, type FindList } from '@/lib/supplier-find';
import { demoShopsShownTo } from '@/lib/demo-vendor-exclusion';

(globalThis as unknown as { React: unknown }).React = React;

const DIR = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'vendors');
const code = (...p: string[]) => stripComments(readFileSync(join(DIR, ...p), 'utf8'));
const FIND_PAGE_LINK = /\/vendors\/categories(?![\w/-])/;

const folders = [
  {
    tiles: [
      { tile: 'reception', label: 'Reception' },
      { tile: 'catering', label: 'Catering' },
      { tile: 'photo_video', label: 'Photo & Video' },
      { tile: 'hmua', label: 'HMUA' },
      { tile: 'live_band', label: 'Live Band' },
    ],
  },
] as unknown as Parameters<typeof buildFindList>[0]['folders'];

async function renderList(list: FindList, bookedMeasured = true): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { FindCategoryList } = await import('./_components/find-category-list');
  return renderToStaticMarkup(
    React.createElement(FindCategoryList, { eventId: 'e1', list, bookedMeasured, eventType: 'wedding', solemn: false }),
  );
}

test('(a) the Find body draws no second door to Find — no button, no link to the Find page', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ServicesTakeover } = await import('./_components/services-takeover');
  const html = renderToStaticMarkup(
    React.createElement(ServicesTakeover, {
      eventId: 'e1',
      tally: { filled: 1, total: 4, knownPhp: 0, unpriced: 0 },
      bookedCount: 1,
      shortlistSlot: React.createElement('i', { 'data-bench-probe': '' }),
    }),
  );
  const find = html.slice(html.indexOf('data-suppliers-body="find"'));
  assert.ok(find.includes('data-bench-probe'), 'the Find body was not drawn — this check would pass on nothing');
  assert.doesNotMatch(find, /Find a supplier/, 'a "Find a supplier" door is back on the Find body');
  assert.doesNotMatch(find, FIND_PAGE_LINK, 'the Find body links to the Find page again — a second door');
  assert.doesNotMatch(find, /data-testid="find-supplier"/);
});

test('(a) no Suppliers-page component links to the Find page except the list that IS the Find page’s', () => {
  const comps = readdirSync(join(DIR, '_components')).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));
  // `plan-budget-accordion.tsx` is the legacy plan-group accordion — drawn only as the kill-switch fallback
  // (`BUDGET_BUILD_ENABLED=false`): its "Unlock N more categories" opens the Find page to add a category. It is
  // not on the one-screen page, which has no such row.
  const ALLOWED = ['find-category-list.tsx', 'plan-budget-accordion.tsx'];
  const linking = comps.filter((f) => FIND_PAGE_LINK.test(code('_components', f)));
  assert.deepEqual(linking, ALLOWED, `a second door to the Find page: ${linking.filter((f) => !ALLOWED.includes(f)).join(', ')}`);
  assert.doesNotMatch(code('page.tsx'), FIND_PAGE_LINK, 'the Suppliers page links to the Find page itself');
});

test('(b) the empty search state renders exactly the Find page’s rows — in order, with their states and targets', async () => {
  const list = buildFindList({
    folders,
    eventType: 'wedding',
    solemn: false,
    booked: new Set(['reception']),
    counts: new Map([['catering', 3], ['photo_video', 1]]),
  });
  const html = await renderList(list);
  const rows = [...html.matchAll(/<a\b([^>]*\bdata-find-tile="[^"]+"[^>]*)>([\s\S]*?)<\/a>/g)].map((m) => {
    const attrs = m[1] ?? '';
    return {
      href: (/\bhref="([^"]+)"/.exec(attrs)?.[1] ?? '').replace(/&amp;/g, '&'),
      tile: /\bdata-find-tile="([^"]+)"/.exec(attrs)?.[1] ?? '',
      text: (m[2] ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
    };
  });
  const expected = [...list.popular, ...list.groups.flatMap((g) => g.categories)].map((c) => c.tile);
  assert.ok(expected.length > 4, 'the fixture list is too small to say anything');
  assert.deepEqual(rows.map((r) => r.tile), expected, 'rows are not the Find list, in its order');
  for (const r of rows) {
    assert.equal(r.href, `/dashboard/e1/vendors/categories?c=${encodeURIComponent(r.tile)}`, `${r.tile} goes somewhere the Find page's row does not`);
  }
  const text = (t: string) => rows.find((r) => r.tile === t)?.text;
  assert.match(text('reception') ?? '', /Booked ✓/);
  assert.match(text('catering') ?? '', /3 suppliers/);
  assert.match(text('hmua') ?? '', /Joining soon/);
  assert.match(html, /Popular for weddings/);
});

test('(b) both readers draw the list through the ONE component, from the ONE read', () => {
  const findPage = code('categories', 'page.tsx');
  assert.match(findPage, /await readFindList\(\{/, 'the Find page builds its list some other way');
  assert.match(findPage, /<FindCategoryList\b/, 'the Find page no longer draws the shared list');
  assert.doesNotMatch(findPage, /data-find-tile=/, 'the Find page draws category rows of its own again — a second list');

  const suppliers = code('page.tsx');
  assert.match(suppliers, /startRead\(\s*taxonomyRead\.then\(\(taxonomy\) =>\s*readFindList\(\{/, 'the Suppliers page does not start the Find page’s read');
  assert.match(suppliers, /<FindCategoryList\s+eventId=\{eventId\}\s+list=\{findRead\.list\}/, 'the empty state is not the shared list');
  assert.match(suppliers, /findPanel=\{findPanel\}/, 'the list never reaches the bench');

  const bench = code('_components', 'shortlist-categories.tsx');
  assert.match(bench, /<FindThumbRow[\s\S]{0,400}?emptyPanel=\{findPanel\}/, 'the bench does not hand the list to the bottom search');

  const row = code('_components', 'find-thumb-row.tsx');
  assert.match(row, /const showPanel = open && up && emptyPanel != null && text\.trim\(\) === '';/, 'the list shows while typing, or never');
  assert.match(row, /data-find-empty=""[\s\S]{0,400}?\{emptyPanel\}/, 'the open box does not draw the list it was handed');
});

test('(c) a refused booked read says so — and no row reads "Booked ✓"', async () => {
  const list = buildFindList({ folders, eventType: 'wedding', solemn: false, booked: null, counts: null });
  const html = await renderList(list, false);
  assert.match(html, /role="alert"[^>]*>We couldn/);
  assert.doesNotMatch(html, /Booked ✓/);
  const read = stripComments(readFileSync(join(process.cwd(), 'lib', 'supplier-find-read.ts'), 'utf8'));
  assert.match(read, /const booked: Set<string> \| null = bookedMeasured \? new Set<string>\(\) : null;/);
});

test('(d) demo shops: shown only to an admin in demo mode — one rule for every couple search', () => {
  const admin = { account_type: 'admin' };
  assert.equal(demoShopsShownTo({ hasDemoCookie: true, profile: admin }), true);
  assert.equal(demoShopsShownTo({ hasDemoCookie: true, profile: { is_internal: true } }), true);
  assert.equal(demoShopsShownTo({ hasDemoCookie: false, profile: admin }), false, 'an admin without demo mode sees demo shops');
  assert.equal(demoShopsShownTo({ hasDemoCookie: true, profile: { account_type: 'couple' } }), false, 'a couple sees demo shops');
  assert.equal(demoShopsShownTo({ hasDemoCookie: true, profile: null }), false);

  const actions = readdirSync(join(DIR, '_actions')).filter((f) => /\.ts$/.test(f) && !/\.test\./.test(f));
  const searches = ['bench-marketplace-search.ts', 'category-search.ts'];
  for (const f of searches) {
    assert.match(code('_actions', f), /await demoVendorIdsHiddenFrom\(supabase, admin, user\.id\)/, `${f} hides demo shops by its own rule`);
  }
  const bare = actions.filter((f) => /\bfetchDemoVendorIds\(/.test(code('_actions', f)));
  assert.deepEqual(bare, [], `a couple search hides demo shops from everyone, admins in demo mode included: ${bare.join(', ')}`);
});

test('(d) a typed shop name reaches a name search on the Find page too', () => {
  const findPage = code('categories', 'page.tsx');
  assert.match(findPage, /const shops = q && profile\.marketplaceEnabled \? await searchMarketplaceForBench\(q\) : \[\];/);
  assert.match(findPage, /\{shops\.length > 0 \? \(/, 'the shops found by name are not drawn');
  const name = code('_actions', 'bench-marketplace-search.ts');
  assert.match(name, /business_name\.ilike\.%\$\{token\}%/, 'the name search no longer matches the shop name');
});
