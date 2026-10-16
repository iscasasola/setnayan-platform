/**
 * the-guest-list-draws-what-can-be-seen.test.ts — ⚡ ROWS EXIST WHERE THEY CAN BE SEEN; EVERY COUNT STILL READS THE DATA.
 *
 * Measured 2026-10-16 (production build, the owner's 84 guests replayed, 375 px): the Guests list
 * built 1,643 of the page's 2,103 DOM nodes, and 79 of its 85 rows sat in FOLDED sections — built,
 * hydrated and fitted (three forced layouts) for nobody. Now a section draws its rows once it is
 * open (and keeps them, so a fold closes over them), and the first draw holds at most ROW_WINDOW
 * rows; the rest arrive at the first idle moment.
 *
 * The claims the counts guards make are kept, re-aimed at the rendered screen:
 *   · "List N" and each section's "· N" are the DATA's numbers, whatever is drawn;
 *   · a folded section draws its header (with its true count) and no rows;
 *   · the open section draws its rows, capped at ROW_WINDOW on the first draw;
 *   · a search opens every section with a hit and draws those hits;
 *   · "select everyone in <section>" and Remove read `sec.guests`, never the drawn rows.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { rosterSections, rosterStats, type RosterFacts } from '@/lib/guest-roster-view';
import { guestRow, renderGuestsScreen } from './_components/render-guests-screen';
import { ROW_WINDOW } from './_components/guests-screen';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCREEN = stripComments(readFileSync(join(HERE, '_components', 'guests-screen.tsx'), 'utf8'));

const row = (over: Parameters<typeof guestRow>[0]) => guestRow({ custom_tags: [], ...over } as never);
const guests = [
  row({ role: 'bride', rsvp_status: 'attending' }),
  row({ role: 'groom', side: 'groom', rsvp_status: 'attending' }),
  // The first section after the celebrants opens on arrival — make it the one past the window.
  ...Array.from({ length: 70 }, (_, i) => row({ role: 'groomsman', side: 'groom', first_name: `Groomsman${i}` })),
  ...Array.from({ length: 12 }, (_, i) => row({ role: 'principal_sponsor_ninong', first_name: `Ninong${i}` })),
  ...Array.from({ length: 8 }, (_, i) => row({ first_name: `Guest${i}` })),
];
const facts: RosterFacts = { hasSides: true, groupsOf: () => [], tableOf: () => null };

/** Each drawn section: key, open?, its "· N" and the rows drawn inside it. */
function drawnSections(html: string) {
  const out: { key: string; open: boolean; n: number; rows: number }[] = [];
  const re = /<section[^>]*data-guest-section="([^"]+)"[^>]*data-open="(true|false)"[^>]*>([\s\S]*?)<\/section>/g;
  for (const m of html.matchAll(re)) {
    const body = m[3]!;
    const n = Number(body.match(/data-count="gs-n-[^"]*">([\d,]+)</)?.[1]?.replace(/,/g, '') ?? NaN);
    out.push({ key: m[1]!, open: m[2] === 'true', n, rows: (body.match(/data-guest-row=""/g) ?? []).length });
  }
  return out;
}

test('folded sections draw their true count and no rows; the open one draws its rows, at most ROW_WINDOW', async () => {
  const want = rosterSections(guests, 'role', facts);
  const drawn = drawnSections(await renderGuestsScreen({ guests }));
  assert.equal(drawn.length, want.length, 'every section still has its header');
  assert.ok(drawn.some((d) => !d.open), 'the fixture has no folded section — it proves nothing');
  for (const sec of want) {
    const d = drawn.find((x) => x.key === sec.key)!;
    assert.equal(d.n, sec.guests.length, `${sec.key}: its "· N" is not the data's number`);
    if (d.open) assert.equal(d.rows, Math.min(sec.guests.length, ROW_WINDOW), `${sec.key}: open, but drew ${d.rows}`);
    else assert.equal(d.rows, 0, `${sec.key}: folded, yet built ${d.rows} rows nobody can see`);
  }
  const big = drawn.find((d) => d.open && d.n > ROW_WINDOW);
  assert.ok(big, 'the open section must exceed the window for the window to be tested');
});

test('"List N" is every guest, whatever is drawn', async () => {
  const html = await renderGuestsScreen({ guests });
  const seg = html.match(/data-guests-seg="list"[^>]*>[\s\S]*?data-count="gs-seg-list"[^>]*>([\d,]+)</)?.[1];
  assert.equal(Number(seg), rosterStats(guests).total);
});

test('a search opens every section with a hit and draws the hits', async () => {
  const html = await renderGuestsScreen({ guests, initialQuery: 'Ninong1' });
  const drawn = drawnSections(html);
  const rows = drawn.reduce((s, d) => s + d.rows, 0);
  assert.ok(rows >= 3 && rows <= 12, `a search for Ninong1 drew ${rows} rows (Ninong1, Ninong10, Ninong11 at least)`);
  assert.ok(drawn.every((d) => d.open));
});

test('select-all and Remove read the section data, not the drawn rows', () => {
  assert.match(SCREEN, /toggleSection\(sec\.guests\.map\(\(g\) => g\.guest_id\)\)/);
  assert.match(SCREEN, /const allSel = sec\.guests\.length > 0 && sec\.guests\.every/);
  assert.match(SCREEN, /\(drawnRows\.get\(sec\.key\) \?\? \[\]\)\.map\(\(g\) => \(\s*<GuestRowLine/);
});
