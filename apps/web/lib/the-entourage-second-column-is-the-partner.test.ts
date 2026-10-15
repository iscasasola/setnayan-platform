/**
 * 👫 IN EVERY ENTOURAGE STYLE, THE SECOND COLUMN IS THE FIRST COLUMN'S PARTNER.
 *
 * ⚖ Owner 2026-10-15 (DECISION_LOG "ENTOURAGE: TWO SIDES IS DROPPED"), on the five styles drawn with his own cast:
 * *"two sides feels messy. the counter column must have significance to the first column."* Two sides put a Ninong
 * beside an unrelated name. Then (same day, "ENTOURAGE STYLES 4 AND 5 APPROVED"): *"and 4 and 5 looks good. apply
 * these styles to the maker"* — On the axis (`roll-call`) · Lines (`lines`) · The march (`march`).
 *
 * THE RULE, for each style, on the real cast (the owner's production export, every name replaced by a stand-in —
 * `the-entourage-second-column-is-the-partner.cast.json`, made by
 * `controller-2026-10-12/entourage-styles/scripts/make-stand-in.py`; roles, walks and name shapes are his):
 *   · a TWO-CELL row is exactly one row `buildEntourage` paired — left cell its left person, right cell its right;
 *   · a person ALONE is a row `buildEntourage` left alone, drawn with the partner cell BLANK in the cell the pairing
 *     gave him (On the axis) or centred across both (Lines) — never filled with someone unrelated;
 *   · every built row is drawn exactly once, and nobody is drawn who is not in one.
 * The march draws each built row as one numbered line, in order.
 *
 * Sabotage (2026-10-15): flowing two consecutive solos into one row (what the prototype drew for the Bearers) → red,
 * "a two-cell row that buildEntourage never paired".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { buildEntourage, lineNames, type EntourageGroup, type EntourageGuestRow } from './entourage';

/* 🪤 The components are `"jsx": "preserve"` — React must be global before their dynamic import. */
(globalThis as unknown as { React: unknown }).React = React;

const CAST = JSON.parse(
  readFileSync(join(__dirname, 'the-entourage-second-column-is-the-partner.cast.json'), 'utf8'),
) as EntourageGuestRow[];

const decode = (s: string) =>
  s.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

async function render(groups: readonly EntourageGroup[], sceneStyle: string | null): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { EntourageSection } = await import('../app/[slug]/_components/entourage-section');
  return decode(renderToStaticMarkup(React.createElement(EntourageSection as never, { groups, sceneStyle })));
}

type Drawn = { kind: 'pair' | 'left' | 'right' | 'centre' | 'other'; cells: Array<string | null> };

/** Every `<li>` of the section: which kind of row it is, and the names in its cells (null = a blank cell). */
function drawnRows(html: string): Drawn[] {
  return [...html.matchAll(/<li([^>]*)>([\s\S]*?)<\/li>/g)].map((m) => {
    const attrs = m[1]!;
    const names = (s: string) => [...s.matchAll(/<span[^>]*data-person=""[^>]*>([^<]*)<\/span>/g)].map((x) => x[1]!.trim());
    if (/data-pair-row/.test(attrs)) {
      const cells = m[2]!.split(/(?=<span[^>]*data-pair-cell)/).filter((c) => /data-pair-cell/.test(c));
      return { kind: 'pair', cells: cells.map((c) => names(c)[0] ?? null) };
    }
    const solo = /data-solo-row="(left|right|centre)"/.exec(attrs)?.[1] as Drawn['kind'] | undefined;
    if (!solo) return { kind: 'other', cells: names(m[2]!) };
    const who = names(m[2]!);
    if (solo === 'centre') return { kind: 'centre', cells: who };
    /* The blank partner cell is really there — an empty cell holding the column, not a missing one. */
    const blanks = (m[2]!.match(/<span aria-hidden="true"><\/span>/g) ?? []).length;
    assert.equal(blanks, 1, `a solo row has no blank partner cell: ${m[0]}`);
    return { kind: solo, cells: solo === 'left' ? [who[0] ?? null, null] : [null, who[0] ?? null] };
  });
}

const key = (cells: ReadonlyArray<string | null>) => cells.map((c) => c ?? '∅').join(' ‖ ');

test('the stand-in cast is the real one in shape — 83 printed, 17 Ninong–Ninang pairs, 4 Ninongs alone', () => {
  assert.equal(CAST.length, 85);
  const groups = buildEntourage(CAST);
  const people = groups.flatMap((g) => g.rows.flatMap((r) => r.filter(Boolean)));
  assert.equal(people.length, 83, 'the couple are the masthead, not a line');
  const ps = groups.find((g) => g.key === 'principal_sponsors')!;
  assert.equal(ps.rows.filter(([l, r]) => l && r).length, 17);
  assert.equal(ps.rows.filter(([l, r]) => l && !r).length, 4);
  assert.deepEqual(ps.sideWords, ['Ninong', 'Ninang'], 'the column words come from the builder');
});

for (const style of ['roll-call', 'lines', null, 'two-sides'] as const) {
  test(`${style ?? 'no pick'} · every two-cell row is a pair buildEntourage made; every solo keeps a blank or is centred`, async () => {
    const groups = buildEntourage(CAST);
    const html = await render(groups, style);
    const lines = style === 'lines';
    const drawn = drawnRows(html);
    assert.ok(drawn.length > 0, 'no rows drew');
    assert.deepEqual(drawn.filter((d) => d.kind === 'other'), [], 'a row that is neither a pair nor a solo');

    const built = new Map<string, number>();
    for (const g of groups) for (const [l, r] of g.rows) {
      const k = key([l?.name ?? null, r?.name ?? null]);
      built.set(k, (built.get(k) ?? 0) + 1);
    }
    const seen = new Map<string, number>();
    for (const d of drawn) {
      let k: string;
      if (d.kind === 'pair') {
        assert.equal(d.cells.length, 2, `a pair row of ${d.cells.length} cells`);
        assert.ok(d.cells.every(Boolean), `a pair row with an empty cell: ${key(d.cells)}`);
        k = key(d.cells);
        assert.ok(built.has(k), `a two-cell row that buildEntourage never paired: ${k}`);
      } else if (d.kind === 'centre') {
        assert.ok(lines, `${style}: a centred solo outside Lines`);
        assert.equal(d.cells.length, 1, `a centred row holds ${d.cells.length} names`);
        const one = d.cells[0]!;
        k = built.has(key([one, null])) ? key([one, null]) : key([null, one]);
        assert.ok(built.has(k), `a centred name buildEntourage did not leave alone: ${one}`);
      } else {
        assert.ok(!lines, `Lines drew a sided solo: ${key(d.cells)}`);
        k = key(d.cells);
        assert.ok(built.has(k), `a solo in a cell the pairing did not give him: ${k}`);
      }
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    assert.deepEqual([...seen.entries()].sort(), [...built.entries()].sort(), 'every built row is drawn exactly once');

    /* The facts the owner looked at, drawn: a Ninong beside HIS Ninang; the Best Woman right of the axis. */
    const ps = groups.find((g) => g.key === 'principal_sponsors')!;
    const [n, w] = ps.rows[0]!;
    assert.ok(drawn.some((d) => d.kind === 'pair' && d.cells[0] === n!.name && d.cells[1] === w!.name));
    const bw = groups.find((g) => g.key === 'honour')!.rows.find(([, r]) => r?.role === 'best_woman')![1]!;
    assert.ok(drawn.some((d) => d.kind === (lines ? 'centre' : 'right') && d.cells.includes(bw.name)), 'the Best Woman');
  });
}

test('the march · each built row is one numbered line, in order — pairs as built, never re-paired', async () => {
  const groups = buildEntourage(CAST);
  const html = await render(groups, 'march');
  const shown = [...html.matchAll(/<li[^>]*data-march-line[^>]*>[\s\S]*?<p class="font-pahina[^"]*">([^<]*)<\/p>/g)].map((m) => m[1]!);
  const built = groups.flatMap((g) => g.rows.map(lineNames)).filter(Boolean);
  assert.equal(shown.length, built.length);
  assert.deepEqual(shown, built);
});
