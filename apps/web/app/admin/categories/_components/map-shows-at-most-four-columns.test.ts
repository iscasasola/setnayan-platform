/**
 * map-shows-at-most-four-columns.test.ts — 🔒 the owner's ruling "no fifth column" (2026-10-26; corpus
 * PLAN admin_taxonomy_four_levels § 7.8: "never more than four columns on screen … Option (b), a fifth
 * column after Parts, is dropped by ruling"), held against the REAL markup.
 *
 *   1 · for EVERY selection a fixture can produce (nothing · each group · each category · each service ·
 *       each part · each card), `columnsFor` answers ≤ 4 and the desktop map renders ≤ 4 `data-col`;
 *   2 · picking a service is the Finder shift: Groups leaves, Cards takes the fourth slot;
 *   3 · the map renders exactly what `columnsFor` decided (the client passes `columns={cols}` from it), and
 *       the grid's column tracks hold four columns + the one connector gap — never a fifth.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import React, { createElement } from 'react';
import { stripComments } from '@/lib/strip-comments';
import { MAX_COLUMNS, columnsFor, type Column, type MapData, type MapSel } from './four-level-model';
import { DesktopColumns } from './map-rows';
import { FIXTURE } from './four-level-fixture';

const HERE = dirname(fileURLToPath(import.meta.url));
// The rows compile with the classic JSX runtime under tsx (the-three-lists-show.test.ts does the same).
(globalThis as unknown as { React: unknown }).React = React;

function selections(d: MapData): MapSel[] {
  const out: MapSel[] = [{ g: '', c: '', sel: '' }];
  for (const g of d.groups) out.push({ g: g.id, c: '', sel: `g:${g.id}` });
  for (const c of d.categories) {
    out.push({ g: c.groupId, c: c.id, sel: `c:${c.id}` });
    for (const s of d.services.filter((x) => x.tileId === c.id)) out.push({ g: c.groupId, c: c.id, sel: `s:${s.key}` });
    for (const p of d.parts) out.push({ g: c.groupId, c: c.id, sel: `p:${p.key}` });
    for (const k of d.cards) out.push({ g: c.groupId, c: c.id, sel: `k:${k.id}` });
  }
  return out;
}

function render(cols: readonly Column[]): string {
  const slot = (name: string) => ({ head: createElement('p', null, name), body: createElement('p', null, `${name} body`) });
  return renderToStaticMarkup(
    createElement(DesktopColumns, {
      columns: cols,
      slots: { groups: slot('groups'), categories: slot('categories'), services: slot('services'), parts: slot('parts'), cards: slot('cards') },
      wire: createElement('svg'),
    }),
  );
}

test('the ruling is four', () => {
  assert.equal(MAX_COLUMNS, 4);
});

test('1 · every selection renders at most four columns', () => {
  const sels = selections(FIXTURE);
  assert.ok(sels.length > 20, `only ${sels.length} selections — the fixture is too thin to prove anything`);
  for (const s of sels) {
    const cols = columnsFor(FIXTURE, s);
    assert.ok(cols.length <= MAX_COLUMNS, `${s.sel || 'nothing'} → ${cols.join(' | ')}`);
    const html = render(cols);
    const drawn = html.match(/data-col="/g)?.length ?? 0;
    /* 🧪 SABOTAGE TARGET: return five columns from columnsFor → this fails. */
    assert.ok(drawn <= MAX_COLUMNS, `${s.sel || 'nothing'} drew ${drawn} columns`);
    assert.equal(drawn, cols.length);
    assert.equal(html.match(/data-wire=""/g)?.length ?? 0, 1, 'the connector gap must sit between Services and Parts, once');
  }
});

test('2 · a picked service is the Finder shift: Categories | Services | Parts | Cards', () => {
  const svc = FIXTURE.services.find((s) => s.tileId)!;
  const cat = FIXTURE.categories.find((c) => c.id === svc.tileId)!;
  assert.deepEqual(columnsFor(FIXTURE, { g: cat.groupId, c: cat.id, sel: `s:${svc.key}` }), ['categories', 'services', 'parts', 'cards']);
  assert.deepEqual(columnsFor(FIXTURE, { g: cat.groupId, c: cat.id, sel: `c:${cat.id}` }), ['groups', 'categories', 'services', 'parts']);
  // A service of ANOTHER category does not shift the map standing here.
  const other = FIXTURE.services.find((s) => s.tileId && s.tileId !== cat.id)!;
  assert.deepEqual(columnsFor(FIXTURE, { g: cat.groupId, c: cat.id, sel: `s:${other.key}` }), ['groups', 'categories', 'services', 'parts']);
});

test('3 · the map renders what columnsFor decided, on a grid of four columns + one gap', () => {
  const map = stripComments(readFileSync(join(HERE, 'four-level-map.tsx'), 'utf8'));
  assert.match(map, /const cols = columnsFor\(data, desk\);/);
  assert.match(map, /<DesktopColumns\s+columns=\{cols\}/);
  const rows = stripComments(readFileSync(join(HERE, 'map-rows.tsx'), 'utf8'));
  const templates = [...rows.matchAll(/grid-cols-\[([^\]]+)\]/g)].map((m) => m[1]!);
  assert.equal(templates.length, 2, 'expected exactly the two desktop templates (before and after the shift)');
  for (const t of templates) assert.equal(t.split('_').length, 5, `grid-cols-[${t}] is not four columns + one gap`);
});
