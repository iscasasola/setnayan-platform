/**
 * THE HEADING SAYS THE ROLE — so the name does not say it again.
 *
 * Owner, verbatim, 2026-09-30, looking at the invitation's Principal Sponsors
 * (each name followed by a small grey "Ninong" / "Ninang"): *"the sub text
 * Ninong can be removed"*. And, the same day, on the Secondary Sponsors: group
 * them BY ROLE — "Candle" once, the pair(s) under it — stacked by default
 * (B), with "Candle: names" (A) as an option.
 *
 * What this file holds (entourage-section.tsx · lib/entourage.ts
 * `roleBesideName` / `roleBlocks` · lib/print-layout.ts `printedEntourageLines`):
 *   1. a section whose heading names its roles draws names with no role beside
 *      them — and still SAYS the role to a screen reader (sr-only);
 *   2. a section that mixes roles the heading cannot name keeps the word beside
 *      each name (Bearers, Parents, a Matron under "Maid of Honor & Best Man");
 *   3. Secondary Sponsors draw one sub-heading per role, no "Candle Sponsor"
 *      anywhere — stacked by default (each pair two columns, owner
 *      2026-10-14), "Role: names" inline;
 *   4. the printed Entourage card groups them the same way;
 *   5. the guest's own "You are Ninong" still has its word (`roleLabel`).
 *
 * 🪤 Harness as `every-plus-one-is-named.test.ts`: `globalThis.React` before
 * the dynamic import (`"jsx": "preserve"`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { buildEntourage, roleLabel, type EntourageGuestRow } from '@/lib/entourage';
import { printedEntourageLines } from '@/lib/print-layout';

(globalThis as unknown as { React: unknown }).React = React;

let n = 0;
/* 🚶 Owner 2026-10-01: who walks with whom is a `march_walks` row — `pair` names
   the walk-mate; both get one walk number. */
const WALKS = new Map<string, number>();
const walkOf = (a: string, b: string): number => {
  const key = [a, b].sort().join('+');
  if (!WALKS.has(key)) WALKS.set(key, WALKS.size);
  return WALKS.get(key)!;
};
function p(
  role: string,
  first: string,
  last: string,
  id?: string,
  pair?: string,
  more: Partial<EntourageGuestRow> = {},
): EntourageGuestRow {
  n += 1;
  return {
    guest_id: id ?? `g${n}`,
    march: id && pair ? { walk_no: walkOf(id, pair) } : null,
    display_name: null,
    name_prefix: null,
    first_name: first,
    middle_name: null,
    last_name: last,
    name_suffix: null,
    role,
    extra_roles: null,
    ...more,
  } as EntourageGuestRow;
}

const ROWS: EntourageGuestRow[] = [
  p('groom_parents', 'Pedro', 'Abad', undefined, undefined, { name_prefix: 'Mr.' }),
  p('bride_parents', 'Rosa', 'Lim', undefined, undefined, { name_prefix: 'Mrs.' }),
  p('maid_of_honor', 'Mia', 'Uy'),
  p('matron_of_honor', 'Tess', 'Ong'),
  p('best_man', 'Ben', 'Sy'),
  // A COUPLE (a mutual partner link) with a shared surname → still both full
  // names in the march (owner 2026-10-01: "A WALK AND A COUPLE ARE INDEPENDENT").
  p('principal_sponsor_ninong', 'Ricardo', 'Villahermosa', 'n1', 'a1', { name_prefix: 'Hon.', couple_with_guest_id: 'a1' }),
  p('principal_sponsor_ninang', 'Jessica', 'Villahermosa', 'a1', 'n1', { name_prefix: 'Mrs.', couple_with_guest_id: 'n1' }),
  // Different surnames, data-paired → both full names.
  p('principal_sponsor_ninong', 'Eduardo', 'Bautista', 'n2', 'a2', { name_prefix: 'Dr.' }),
  p('principal_sponsor_ninang', 'Carmen', 'Reyes', 'a2', 'n2'),
  // Same surname but NOT paired in the data → two lines, never guessed into a pair.
  p('principal_sponsor_ninong', 'Jose', 'Abad'),
  p('principal_sponsor_ninang', 'Teresita', 'Abad'),
  // A couple with a suffix → both full names, like every walk.
  p('principal_sponsor_ninong', 'Mario', 'Lopez', 'n3', 'a3', { name_suffix: 'Jr.', couple_with_guest_id: 'a3' }),
  p('principal_sponsor_ninang', 'Nora', 'Lopez', 'a3', 'n3', { couple_with_guest_id: 'n3' }),
  p('principal_sponsor', 'Legacy', 'Sponsor'),
  // Bea is Paolo's +1 → a couple, and still both full names in the march.
  p('candle_sponsor', 'Paolo', 'Cruz', 'c1', 'c2'),
  p('candle_sponsor', 'Bea', 'Cruz', 'c2', 'c1', { plus_one_of_guest_id: 'c1' }),
  // Same surname, walking together, NOT a couple → both full names.
  p('veil_sponsor', 'Miguel', 'Reyes', 'v1', 'v2'),
  p('veil_sponsor', 'Anna', 'Reyes', 'v2', 'v1'),
  p('cord_sponsor', 'Luis', 'Santos'),
  p('bridesmaid', 'Carla', 'Mendoza', 'b1', 'm1'),
  p('groomsman', 'Dan', 'Lim', 'm1', 'b1'),
  p('ring_bearer', 'Tino', 'Go'),
  p('bible_bearer', 'Nico', 'Go'),
  p('flower_girl', 'Lia', 'Go'),
];

async function render(roleLayout?: 'stacked' | 'inline'): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { EntourageSection } = await import('./entourage-section');
  return renderToStaticMarkup(
    React.createElement(EntourageSection as never, { groups: buildEntourage(ROWS), ...(roleLayout ? { roleLayout } : {}) }),
  );
}

/** The markup of one group: from its heading to the next group's heading. */
function section(html: string, heading: string): string {
  const at = html.indexOf(`<span>${heading}</span>`);
  assert.ok(at >= 0, `the ${heading} heading renders`);
  const next = html.indexOf('<h4', at + 1);
  // From the group's own wrapper (which carries `data-role-layout`) — the
  // `<div` just before its `<h4`.
  const start = html.lastIndexOf('<div', html.lastIndexOf('<h4', at));
  return html.slice(start, next === -1 ? undefined : html.lastIndexOf('<div', next));
}

/** What a sighted guest reads — every visually-hidden span removed, tags stripped. */
function visible(html: string): string {
  return html
    .replace(/<span class="sr-only">[^<]*<\/span>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ');
}

test('Principal Sponsors: names, and no Ninong / Ninang / Principal Sponsor beside them', async () => {
  const s = section(await render(), 'Principal Sponsors');
  const seen = visible(s);
  for (const name of ['Jose Abad', 'Teresita Abad', 'Legacy Sponsor', 'Villahermosa', 'Bautista']) {
    assert.ok(seen.includes(name), `${name} prints`);
  }
  assert.doesNotMatch(seen, /Ninong|Ninang/, `no role repeats under the heading — saw: ${seen}`);
  assert.doesNotMatch(seen.replace('Principal Sponsors', ''), /Principal Sponsor\b/, 'the legacy role does not repeat either');
  // The word is not lost to a screen reader.
  assert.match(s, /<span class="sr-only">, Ninong and Ninang<\/span>/);
  assert.match(s, /<span class="sr-only">, Ninong<\/span>/);
});

/** Every `<li>` of a section, as visible text. */
function items(html: string): string[] {
  return [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => visible(m[1]!).trim());
}

/** What a screen reader hears — tags stripped, the visually-hidden words KEPT. */
function heard(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Every row of a section as the eye reads it: a PAIR row (`data-pair-row`) is
 * its two cells, `[left, right]`; any other row is its one line, `[name]`.
 */
function rows(html: string): string[][] {
  return [...html.matchAll(/<li([^>]*)>([\s\S]*?)<\/li>/g)].map((m) => {
    if (!/data-pair-row/.test(m[1]!)) return [visible(m[2]!).trim()];
    const cells = m[2]!.split(/(?=<span[^>]*data-pair-cell)/).filter((c) => /data-pair-cell/.test(c));
    return cells.map((c) => visible(c).trim());
  });
}

/** The `class` of every pair row in a section. */
function pairRowClasses(html: string): string[] {
  return [...html.matchAll(/<li class="([^"]*)"[^>]*data-pair-row/g)].map((m) => m[1]!);
}

/*
  ⚖ OWNER 2026-10-14, on the Wedding March scene's Roll call — SUPERSEDES
  2026-09-30 option 1 (a pair as ONE line, "A & B") on the page: *"The names
  feel too crowded. Maybe have their pairing show in 2 columns without the &."*
  The printed card keeps option 1 (its test is further down).
*/
test('⚖ 2026-10-14 — a walking Ninong & Ninang are TWO columns with no "&": both full names, couple or not', async () => {
  const s = section(await render(), 'Principal Sponsors');
  const lines = rows(s);
  const show = lines.map((r) => r.join(' ‖ ')).join(' | ');
  // A couple with a shared surname → both full names, titles as entered — the march never shortens.
  assert.ok(show.includes('Hon. Ricardo Villahermosa ‖ Mrs. Jessica Villahermosa'), show);
  // Different surnames → each in its own cell.
  assert.ok(show.includes('Dr. Eduardo Bautista ‖ Carmen Reyes'), show);
  // A suffix is never compressed away.
  assert.ok(show.includes('Mario Lopez Jr. ‖ Nora Lopez'), show);
  // Same surname but unpaired in the data: two rows of their own, never merged.
  assert.ok(lines.some((r) => r.length === 1 && r[0] === 'Jose Abad'), show);
  assert.ok(lines.some((r) => r.length === 1 && r[0] === 'Teresita Abad'), show);
  // One row per pair, one per single: 3 pairs + 2 unpaired + 1 legacy.
  assert.equal(lines.length, 6, show);
  assert.equal(lines.filter((r) => r.length === 2).length, 3, `three pair rows, each exactly two cells — ${show}`);
  // No "&" anywhere a sighted guest reads under this heading.
  assert.doesNotMatch(visible(s).replace('Principal Sponsors', ''), /&/, 'a pair is joined by an "&" again');
});

test('⚖ 2026-10-14 — the two columns HOLD at 375: equal, never stacking, a long name wraps in its own cell', async () => {
  const html = await render();
  for (const heading of ['Principal Sponsors', 'Secondary Sponsors', 'Bride&#x27;s Crew &amp; Groom&#x27;s Crew']) {
    const classes = pairRowClasses(section(html, heading));
    assert.ok(classes.length > 0, `${heading}: no pair row drew`);
    for (const c of classes) {
      const tokens = c.split(/\s+/);
      // `grid-cols-2` with NO breakpoint prefix is two columns on a phone; `grid-cols-1` / `sm:grid-cols-2` is the stack.
      assert.ok(tokens.includes('grid-cols-2'), `${heading}: a pair row is not two columns at every width — "${c}"`);
      assert.ok(!tokens.some((t) => /(^|:)grid-cols-1$/.test(t) || /^[a-z0-9]+:grid-cols-/.test(t)), `${heading}: a pair row stacks on a phone — "${c}"`);
      assert.ok(tokens.includes('items-baseline'), `${heading}: the two cells no longer share a baseline — "${c}"`);
    }
    // Each cell may shrink below its name's width (`min-w-0`), so a long name wraps INSIDE it.
    const cells = [...section(html, heading).matchAll(/<span class="([^"]*)" data-pair-cell/g)].map((m) => m[1]!);
    assert.ok(cells.length >= 2 && cells.every((c) => /\bmin-w-0\b/.test(c) && /\bbreak-words\b/.test(c)), `${heading}: ${cells.join(' | ')}`);
  }
});

test('⚖ 2026-10-14 — a screen reader still hears the pair as a pair: "X and Y", then the roles', async () => {
  const s = section(await render(), 'Principal Sponsors');
  const pair = [...s.matchAll(/<li[^>]*data-pair-row[^>]*>([\s\S]*?)<\/li>/g)].map((m) => heard(m[1]!));
  assert.ok(
    pair.includes('Hon. Ricardo Villahermosa and Mrs. Jessica Villahermosa, Ninong and Ninang'),
    pair.join(' | '),
  );
});

test('the couple’s march order still decides the rows — a hand-placed pair leads', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { EntourageSection } = await import('./entourage-section');
  // n3 + a3's walk goes to the front; every other walk moves behind it.
  const front = ROWS.find((r) => r.guest_id === 'n3')!.march as { walk_no: number };
  const placed = ROWS.map((r) => {
    const m = r.march as { walk_no: number } | null | undefined;
    if (!m) return r;
    return { ...r, march: { walk_no: m.walk_no === front.walk_no ? -1 : m.walk_no } };
  });
  const html = renderToStaticMarkup(React.createElement(EntourageSection as never, { groups: buildEntourage(placed) }));
  assert.deepEqual(rows(section(html, 'Principal Sponsors'))[0], ['Mario Lopez Jr.', 'Nora Lopez']);
});

test('⚖ 2026-10-14 — a walking pair in the crews is two columns too', async () => {
  const s = section(await render(), 'Bride&#x27;s Crew &amp; Groom&#x27;s Crew');
  assert.deepEqual(rows(s), [['Carla Mendoza', 'Dan Lim']]);
});

test("Bride's Crew & Groom's Crew and Flower Girls: no Bridesmaid / Groomsman / Flower Girl per name", async () => {
  const html = await render();
  const crew = visible(section(html, 'Bride&#x27;s Crew &amp; Groom&#x27;s Crew'));
  assert.ok(crew.includes('Carla Mendoza') && crew.includes('Dan Lim'));
  assert.doesNotMatch(crew, /Bridesmaid|Groomsman/);
  const girls = visible(section(html, 'Flower Girls'));
  assert.doesNotMatch(girls.replace('Flower Girls', ''), /Flower Girl/);
});

test('a section that MIXES roles the heading cannot name keeps the word beside each name', async () => {
  const html = await render();
  const bearers = visible(section(html, 'Bearers'));
  assert.match(bearers, /Tino Go Ring Bearer/);
  assert.match(bearers, /Nico Go Bible Bearer/);
  const parents = visible(section(html, 'Parents'));
  // ONE name is ONE parent — the typed title says which (audit 2026-09-30).
  assert.match(parents, /Pedro Abad Father of the Groom/);
  assert.match(parents, /Rosa Lim Mother of the Bride/);
  assert.doesNotMatch(parents.replace(/^Parents/, ''), /Parents of the/, 'a plural beside one name');
  // Under "Maid of Honor & Best Man" a Matron is NOT what the heading says — she keeps hers.
  const honour = visible(section(html, 'Maid of Honor &amp; Best Man'));
  assert.match(honour, /Tess Ong Matron of Honor/);
  assert.doesNotMatch(honour.replace('Maid of Honor & Best Man', ''), /Maid of Honor|Best Man/);
});

test('Secondary Sponsors, stacked by default: one sub-heading per role, the pair in two columns, no role per name', async () => {
  const s = section(await render(), 'Secondary Sponsors');
  assert.match(s, /data-role-layout="stacked"/, 'B is the default');
  const seen = visible(s);
  assert.doesNotMatch(seen, /Sponsor\b(?!s)/, `no "Candle Sponsor" beside a name — saw: ${seen}`);
  for (const role of ['Candle', 'Veil', 'Cord']) {
    assert.equal(seen.split(` ${role} `).length - 1, 1, `"${role}" is said exactly once`);
  }
  // Each pair is one row of two cells, no "&" (owner 2026-10-14).
  const shown = rows(s).map((r) => [...r].sort().join(' ‖ '));
  assert.ok(shown.includes('Bea Cruz ‖ Paolo Cruz'), shown.join(' | '));
  // Walking together is not being a couple: both full names.
  assert.ok(shown.includes('Anna Reyes ‖ Miguel Reyes'), shown.join(' | '));
  assert.doesNotMatch(seen, /&/, 'a stacked pair is joined by an "&" again');
  // The sub-heading already says "Candle" — no role is whispered after the names as well.
  assert.doesNotMatch(s, /class="sr-only">, /, 'a by-role pair repeats its role to a screen reader');
  // Order: the sub-heading, then its names.
  assert.ok(seen.indexOf('Candle') < seen.indexOf('Cruz') && seen.indexOf('Cruz') < seen.indexOf('Veil'));
  assert.ok(seen.indexOf('Veil') < seen.indexOf('Reyes') && seen.indexOf('Reyes') < seen.indexOf('Cord'));
});

test('Secondary Sponsors, inline (A): "Role: names" on one line', async () => {
  const s = section(await render('inline'), 'Secondary Sponsors');
  assert.match(s, /data-role-layout="inline"/);
  const seen = visible(s);
  assert.match(seen, /Candle: (Paolo Cruz & Bea Cruz|Bea Cruz & Paolo Cruz)/);
  assert.match(seen, /Veil: (Miguel Reyes & Anna Reyes|Anna Reyes & Miguel Reyes)/);
  assert.match(seen, /Cord: Luis Santos/);
  assert.doesNotMatch(seen, /Sponsor\b(?!s)/);
});

test('the printed Entourage card groups the Secondary Sponsors the same way, and repeats no role', () => {
  const groups = buildEntourage(ROWS);
  const sec = groups.find((g) => g.key === 'secondary_sponsors')!;
  for (const flow of [false, true]) {
    const lines = printedEntourageLines(sec, flow);
    assert.deepEqual(lines.filter((l) => l.sub !== undefined).map((l) => l.sub), ['Candle', 'Veil', 'Cord']);
    const text = lines.flatMap((l) => [l.l, l.r, l.c]).filter(Boolean).join(' | ');
    assert.doesNotMatch(text, /Sponsor/, `no role after a printed name — ${text}`);
    // Candle's pair sits under "Candle", before "Veil".
    const iCandle = lines.findIndex((l) => l.sub === 'Candle');
    const iVeil = lines.findIndex((l) => l.sub === 'Veil');
    assert.ok(lines.slice(iCandle + 1, iVeil).some((l) => [l.l, l.r, l.c].join(' ').includes('Cruz')));
  }
  const ps = groups.find((g) => g.key === 'principal_sponsors')!;
  const printed = printedEntourageLines(ps, false).flatMap((l) => [l.l, l.r, l.c]).join(' ');
  assert.doesNotMatch(printed, /Ninong|Ninang/);
});

test('option 1 on the printed card: a data pair is ONE centred line, in the page’s own order', async () => {
  const ps = buildEntourage(ROWS).find((g) => g.key === 'principal_sponsors')!;
  const lines = printedEntourageLines(ps, false);
  const pairs = lines.filter((l) => l.pair).map((l) => l.c);
  // The couple's march order is the builder's; the card and the page both follow it.
  // The page draws each pair as two cells (2026-10-14); read left then right, it is the card's line.
  const onPage = rows(section(await render(), 'Principal Sponsors')).filter((r) => r.length === 2).map((r) => r.join(' & '));
  assert.deepEqual(pairs, onPage);
  assert.deepEqual([...pairs].sort(), [
    'Dr. Eduardo Bautista & Carmen Reyes',
    'Hon. Ricardo Villahermosa & Mrs. Jessica Villahermosa',
    'Mario Lopez Jr. & Nora Lopez',
  ]);
  // Unpaired sponsors print alone — nobody merged by surname.
  const singles = lines.filter((l) => !l.pair).flatMap((l) => [l.l, l.r, l.c]).filter(Boolean);
  assert.deepEqual([...singles].sort(), ['Jose Abad', 'Legacy Sponsor', 'Teresita Abad']);
});

test('the guest’s own "You are …" line keeps its word — only the list stopped repeating it', () => {
  assert.equal(roleLabel('principal_sponsor_ninong'), 'Ninong');
  assert.equal(roleLabel('principal_sponsor_ninang'), 'Ninang');
  assert.equal(roleLabel('bridesmaid'), 'Bridesmaid');
});

test('a TITLE never decides order — unplaced lines sort by surname, then first name (page and card alike)', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { EntourageSection } = await import('./entourage-section');
  const rows: EntourageGuestRow[] = [
    p('principal_sponsor_ninong', 'Antonio', 'Garcia'),
    p('principal_sponsor_ninong', 'Eduardo', 'Bautista', undefined, undefined, { name_prefix: 'Dr.' }),
    // "Dr." < "Hon." alphabetically — the surname (Abad < Cruz) must win instead.
    p('principal_sponsor_ninong', 'Ana', 'Cruz', undefined, undefined, { name_prefix: 'Dr.' }),
    p('principal_sponsor_ninong', 'Zeno', 'Abad', undefined, undefined, { name_prefix: 'Hon.' }),
    // No name parts: the printed name minus its title stands in ("Mendez…").
    p('principal_sponsor_ninong', '', '', undefined, undefined, { display_name: 'Atty. Mendez Carlos', first_name: null, last_name: null }),
    p('principal_sponsor_ninong', 'Luis', 'Navarro', undefined, undefined, { name_suffix: 'Jr.' }),
  ];
  const expected = ['Hon. Zeno Abad', 'Dr. Eduardo Bautista', 'Dr. Ana Cruz', 'Antonio Garcia', 'Atty. Mendez Carlos', 'Luis Navarro Jr.'];
  const html = renderToStaticMarkup(React.createElement(EntourageSection as never, { groups: buildEntourage(rows) }));
  assert.deepEqual(items(section(html, 'Principal Sponsors')), expected);
  const ps = buildEntourage(rows).find((g) => g.key === 'principal_sponsors')!;
  const card = printedEntourageLines(ps, false).flatMap((l) => [l.l, l.c, l.r]).filter(Boolean);
  // The card may flow unpaired names into columns; its reading order is still the page's.
  assert.deepEqual([...card].sort(), [...expected].sort());
  assert.deepEqual(ps.rows.map((r) => (r[0] ?? r[1])!.name), expected, 'the one builder both surfaces read');
});
