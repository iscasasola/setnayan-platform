/**
 * 👗 EVERY ROLE ROW IS ONE SHAPE, AND NO CONTROL WAS LOST ON THE WAY (owner 2026-10-22, "Yes to all" to prototype
 * `prototypes/dress_code_role_rows_tidy_2026-10-22.html` — "seems like we can make the arrangement and how to access
 * parts easier to manage and look better than how it looks now").
 *
 * The row, top to bottom: WHO (name · people · the time as ONE header chip) → WHAT THEY WEAR (one column per kind of
 * person: the figure, its labelled dots directly under it, its Wear ▾ under them — the groom's column the same shape
 * and width as a VIP column) → EVERYTHING ELSE (the note and the photos: one quiet "more" row on a phone that opens the
 * row's sheet; a right-hand column on a desk).
 *
 *   1 · the header holds the row's ONE time chip, ≥ 44 px, and nothing else pressable; the desk grid is two columns inside.
 *   2 · every column's DIRECT children are figure → dots → Wear ▾ (a nested "figure beside its dots" row is the old,
 *       mixed shape); a one-figure column stands at a pair's column width; every column has exactly its own Wear ▾.
 *   3 · no control lost — each one hidden at a width has its twin shown at that width: the note's button and the
 *       photos' ＋ · Search ideas are the desk's (`hidden lg:flex`) and the phone's "more" row (`lg:hidden`) opens a sheet
 *       that holds the SAME note field and the SAME photos line; a supplier's photo still waiting is never folded away.
 *
 * Read from the RENDER (the shipped component, server-rendered with a real dress code) — a property of what is drawn,
 * never of how the source spells it, except where the only evidence is the wiring of a sheet that opens on a tap.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    if (request === 'next/navigation') return { useRouter: () => ({ refresh() {} }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() };
    if (/(?:^|\/)(?:actions|wizard-actions|hub-draft-actions|colour-access-actions)$/.test(request)) {
      return new Proxy({}, { get: () => async () => ({}) });
    }
    return load.call(this, request, ...rest);
  };
}

const STUDIO = '../app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio';
const PHOTO = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const FIVE = ['#5C0700', '#669C35', '#F7F2EC', '#646B38', '#F3E5B9'];

/* The rows the owner named — the groom (one figure), VIP · Immediate Family (men · women), Guests — plus a row with two
   photo boards (the bearers, not yet dressed) and a row with nothing picked. */
const ROWS = [
  { tier: 'roles', key: 'groom', label: 'The groom', paletteKey: 'groom', arrives: null, people: 1 },
  { tier: 'groups', key: 'vip_family', label: 'VIP · Immediate Family', paletteKey: 'parents_immediate_family', arrives: null, people: 5 },
  { tier: 'groups', key: 'bridesmaids', label: 'Bridesmaids', paletteKey: 'bridesmaids', arrives: null, people: 8 },
  { tier: 'groups', key: 'groomsmen', label: 'Groomsmen', paletteKey: 'groomsmen', arrives: null, people: 8 },
  { tier: 'groups', key: 'bearers_flower_girl', label: 'Bearers & Flower Girl', paletteKey: 'bearers_flower_girl', arrives: null, people: 3 },
  { tier: 'roles', key: 'guest', label: 'Guests', paletteKey: 'guest', arrives: null, people: 147 },
];
const CONFIG = {
  roles: { groom: { style: 'three_piece_suit', note: 'Ivory pocket square, not white', callTime: '08:00' }, guest: { style: 'suit' } },
  groups: { vip_family: { style: 'suit' }, bridesmaids: { style: 'long_gown' } },
};

async function draw(over: Record<string, unknown> = {}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MoodBoardStudio } = await import(STUDIO);
  return renderToStaticMarkup(
    React.createElement(MoodBoardStudio as React.ComponentType<Record<string, unknown>>, {
      eventId: 'e',
      palette: { reception: FIVE },
      fallbackFive: FIVE,
      frozenDressing: [],
      changes: [],
      attire: ROWS,
      dressConfig: CONFIG,
      attireStyles: [],
      inspirations: [
        { slot_key: 'groom', slot_position: 1, image_url: PHOTO, credit: null, swatches: [] },
        { slot_key: 'groom', slot_position: 2, image_url: PHOTO, credit: null, swatches: [] },
      ],
      suggestions: [{ id: 'sg1', slotKey: 'bridesmaids', shop: 'Bloom & Co.', url: PHOTO, swatches: [] }],
      autoThemes: [],
      regions: [],
      dosLists: null,
      startTab: 'attire',
      arrival: { blocks: [], eventDate: '2026-12-12' },
      ...over,
    }),
  );
}

/* ── a small reader of server markup: an element's whole text, and its direct children ─────────────────────────── */
const VOID = new Set(['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'area', 'col', 'wbr']);
type El = { tag: string; open: string; outer: string; start: number; end: number };
/** The element whose opening tag starts at `at`. */
function elementAt(html: string, at: number): El {
  const open = /^<([a-zA-Z0-9-]+)\b[^>]*?(\/?)>/.exec(html.slice(at))!;
  const tag = open[1]!.toLowerCase();
  if (VOID.has(tag) || open[2] === '/') return { tag, open: open[0], outer: open[0], start: at, end: at + open[0].length };
  const re = /<(\/?)([a-zA-Z0-9-]+)\b[^>]*?(\/?)>/g;
  re.lastIndex = at + open[0].length;
  let depth = 1;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const t = m[2]!.toLowerCase();
    if (m[1]) depth--;
    else if (!VOID.has(t) && !m[3]) depth++;
    if (depth === 0) return { tag, open: open[0], outer: html.slice(at, m.index + m[0].length), start: at, end: m.index + m[0].length };
  }
  throw new Error(`unclosed <${tag}> at ${at}`);
}
function children(el: El): El[] {
  const out: El[] = [];
  let i = el.open.length;
  const inner = el.outer;
  const stop = inner.length - `</${el.tag}>`.length;
  while (i < stop) {
    const lt = inner.indexOf('<', i);
    if (lt < 0 || lt >= stop) break;
    const c = elementAt(inner, lt);
    out.push(c);
    i = c.end;
  }
  return out;
}
const all = (html: string, attr: string): El[] => [...html.matchAll(new RegExp(`<[a-zA-Z0-9-]+\\b[^>]*\\b${attr}`, 'g'))].map((m) => elementAt(html, m.index!));
const rowOf = (html: string, key: string): El => {
  const m = new RegExp(`<section\\b[^>]*data-mood-board-role="${key}"`).exec(html);
  assert.ok(m, `the ${key} row is not drawn`);
  return elementAt(html, m.index);
};
const cls = (el: El) => /class="([^"]*)"/.exec(el.open)?.[1]?.split(/\s+/) ?? [];

/* ── 1 ─────────────────────────────────────────────────────────────────────── */

test('1 · the header holds the row’s ONE time chip (≥ 44 px) and nothing else pressable; a desk lays the row out in two columns', async () => {
  const html = await draw();
  for (const r of ROWS) {
    const row = rowOf(html, r.key);
    assert.ok(cls(row).includes('lg:grid-cols-[minmax(0,1fr)_430px]'), `${r.key}: no desk column for the note and photos`);
    const header = elementAt(row.outer, row.outer.indexOf('<header'));
    const chips = all(header.outer, 'data-mood-board-call-time=');
    assert.equal(chips.length, 1, `${r.key}: the header does not hold exactly one time chip`);
    const buttons = header.outer.match(/<button\b[^>]*>/g) ?? [];
    assert.equal(buttons.length, 1, `${r.key}: something besides the time chip is pressable in the header`);
    assert.match(buttons[0]!, /aria-haspopup="dialog"/, `${r.key}: the chip does not open its sheet`);
    assert.match(buttons[0]!, /class="[^"]*!h-11/, `${r.key}: the chip is under 44 px`);
    assert.equal(row.outer.split('type="time"').length - 1, 0, `${r.key}: a time field still stands in the row`);
  }
  assert.match(rowOf(html, 'groom').outer, /<span class="lbl">Call time 8:00 AM<\/span>/);
  assert.match(rowOf(html, 'vip_family').outer, /<span class="lbl">Set a call time<\/span>/);
  assert.match(rowOf(html, 'groomsmen').outer, /data-waiting=""[^>]*>[\s\S]*?<span class="lbl">Call time<\/span>/, 'a row with no Wear: its chip is not waiting');
  assert.match(rowOf(html, 'guest').outer, /<span class="lbl">Set when guests arrive<\/span>/);
});

/* ── 2 ─────────────────────────────────────────────────────────────────────── */

test('2 · every column is figure → its dots → its Wear ▾, as direct children; a lone figure stands at a pair’s column width', async () => {
  const html = await draw();
  let columns = 0;
  for (const r of ROWS) {
    const row = rowOf(html, r.key);
    const picks = all(row.outer, 'data-mood-board-pick=');
    assert.ok(picks.length >= 1, `${r.key}: no column`);
    for (const pick of picks) {
      columns++;
      const who = `${r.key}/${/data-mood-board-pick="([^"]+)"/.exec(pick.open)![1]}`;
      assert.equal((pick.outer.match(/data-mood-board-wear-for=/g) ?? []).length, 1, `${who}: not exactly one Wear ▾ of its own`);
      if (r.key === 'guest') continue; // the guests' strip: each option a figure over its own dot, then the Wear ▾ (`guests-pick-styles-and-designs`)
      const kids = children(pick).filter((k) => !/uppercase/.test(k.open)); // the FOR MEN · FOR WOMEN eyebrow
      const fig = kids.findIndex((k) => /data-mood-board-figure=/.test(k.outer));
      const dots = kids.findIndex((k) => /data-mood-board-swatches=/.test(k.open));
      const wear = kids.findIndex((k) => /data-form-rows="mood-board-wear"/.test(k.open));
      assert.ok(fig >= 0 && dots >= 0 && wear >= 0, `${who}: the figure, its dots and its Wear ▾ are not each a part of the column itself (${kids.map((k) => k.open.slice(0, 60)).join(' | ')})`);
      assert.ok(fig < dots && dots < wear, `${who}: not figure → dots → Wear ▾`);
      assert.ok(!/data-mood-board-swatches=/.test(kids[fig]!.outer), `${who}: the dots stand beside the figure, not under it`);
    }
    if (picks.length === 1 && r.key !== 'guest') {
      assert.ok(cls(picks[0]!).includes('basis-[calc(50%-0.3125rem)]'), `${r.key}: a one-figure column is not a pair’s column width`);
    }
  }
  assert.ok(columns >= 8, `only ${columns} columns read — the fixture went blind`);
});

/* ── 3 ─────────────────────────────────────────────────────────────────────── */

test('3 · no control lost: what a desk shows in its right column, a phone reaches from the row’s "more" row and its sheet', async () => {
  const html = await draw();
  const { attireBoardsUnder } = await import('./inspiration-slots');
  for (const r of ROWS) {
    const row = rowOf(html, r.key).outer;
    const dressed = r.key in CONFIG.roles || r.key in CONFIG.groups;
    const boards = attireBoardsUnder(r.key);
    const more = all(row, 'data-mood-board-more=');
    if (!dressed && boards.length === 0) {
      assert.equal(more.length, 0, `${r.key}: a "more" row with nothing behind it`);
      continue;
    }
    /* the phone's ONE quiet row: shown below lg, a dialog opener, ≥ 44 px */
    assert.equal(more.length, 1, `${r.key}: no "more" row on a phone`);
    assert.ok(cls(more[0]!).includes('lg:hidden') && !cls(more[0]!).includes('hidden'), `${r.key}: the "more" row is not the phone’s alone`);
    assert.match(more[0]!.open, /aria-haspopup="dialog"/);
    assert.ok(cls(more[0]!).includes('min-h-11'), `${r.key}: the "more" row is under 44 px`);
    /* the note: the desk's line (hidden on a phone, shown at lg) with its button beside its words */
    const note = all(row, 'data-mood-board-role-note=');
    if (dressed) {
      assert.equal(note.length, 1, `${r.key}: the note lost its place`);
      assert.ok(cls(note[0]!).includes('hidden') && cls(note[0]!).includes('lg:flex'), `${r.key}: the note line is not the desk’s`);
      assert.match(note[0]!.outer, /aria-label="(?:Add|Change) the note for /, `${r.key}: the note lost its button`);
      assert.match(more[0]!.outer, /Add a note|“/, `${r.key}: the "more" row does not say the note`);
    } else {
      assert.equal(note.length, 0, `${r.key}: a note offered with no Wear to keep it on`);
    }
    /* the photos: every board's ＋ and Search ideas still drawn, on the desk's line; the "more" row counts them */
    for (const slot of boards) {
      const board = all(row, `data-mood-board-slot="${slot.slotKey}"`)[0];
      assert.ok(board, `${r.key}: the ${slot.label} board is gone`);
      assert.match(board.outer, new RegExp(`aria-label="Add a photo to ${slot.label}"`), `${r.key}: ${slot.label} lost its ＋`);
      assert.match(board.outer, new RegExp(`aria-label="Search ideas for ${slot.label}"`), `${r.key}: ${slot.label} lost Search ideas`);
      const line = children(board)[0]!;
      assert.ok(cls(line).includes('hidden') && cls(line).includes('lg:flex'), `${r.key}: ${slot.label}’s photo line is not the desk’s`);
    }
    if (boards.length > 0) assert.match(more[0]!.outer, /\d+ photos?|No photos yet/, `${r.key}: the "more" row does not say the photos`);
  }
  assert.match(all(rowOf(html, 'groom').outer, 'data-mood-board-more=')[0]!.outer, /“Ivory pocket square, not white”[\s\S]*2 photos/, 'the groom’s "more" row does not read his note and photos without opening');

  /* A supplier's photo still waiting is never folded away: it stands on the phone too (no `hidden` around it). */
  const waiting = all(rowOf(html, 'bridesmaids').outer, 'data-mood-board-suggestion="sg1"');
  assert.equal(waiting.length, 1, 'the waiting suggestion is not on the row');
  const row = rowOf(html, 'bridesmaids').outer;
  const before = row.slice(0, row.indexOf('data-mood-board-suggestion="sg1"'));
  const openers = [...before.matchAll(/<(div|span)\b[^>]*class="([^"]*)"/g)].filter((m) => m[2]!.split(/\s+/).includes('hidden'));
  for (const m of openers) {
    const el = elementAt(row, m.index!);
    assert.ok(!el.outer.includes('data-mood-board-suggestion="sg1"'), 'the waiting suggestion is hidden on a phone — the top notice would jump to nothing');
  }

  /* The sheets the two openers open hold the SAME controls (wired on a tap, so read from the source). */
  const src = readFileSync(join(__dirname, `${STUDIO}.tsx`), 'utf8');
  const sheet = src.slice(src.indexOf("{sheet?.kind === 'more'"), src.indexOf("{sheet?.kind === 'note'"));
  assert.match(sheet, /note=\{canNote \? \{ start: noteFor\(row\),[\s\S]{0,120}?onSave: \(text\) => writeNote\(row, text\)/, 'the row sheet does not hold the note, written the note’s one way');
  assert.match(sheet, /ideasRow\(slot, boards\.length > 1, undefined, 'sheet'\)/, 'the row sheet does not hold the photos line (＋ · Search ideas)');
  assert.match(src, /onOpen=\{\(\) => setSheet\(\{ kind: 'more', row \}\)\}/, 'the "more" row does not open the row sheet');
});
