/**
 * studio-prints-navigation.test.ts — STUDIO › PRINTS: A PIECE BAR, ONE "ON EVERY PRINT" BLOCK, SHORT SIZE LINES (owner 2026-10-16,
 * *"so fix the prints page. so we can easily navigate."*; approved prototype `prints_page_navigation_2026-10-16.html`; DECISION_LOG
 * "STUDIO › PRINTS GETS A PIECE BAR, ONE 'ON EVERY PRINT' BLOCK AND SHORT SIZE LINES").
 *
 *   1 · the piece bar exists ONLY in the new Maker's Studio › Prints form, and only on a phone (`lg:hidden`) — one mount, through
 *       the one lazy door (`StudioTool part="prints-bar"`), under the form's scroller, never over it;
 *   2 · "Always printed" (the Event Hub QR line) is said ONCE in the Prints form — in "On every print", never under a piece;
 *   3 · the NFC sticker spot's switch lives in "On every print" — the same `inc_nfc` switch, posting the same print words form;
 *   4 · a piece's head line names the CHOSEN size only — never a list of every size (they stay in the dropdown).
 *
 * SABOTAGE (each seen RED, then restored — see the PR): the bar mounted without the Studio · Prints condition · its `lg:hidden`
 * dropped · `{qrAlways}` put back under the Event pass · the NFC switch put back under Finer Details · a head line that joins
 * every size again.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';
import { PRINT_FORMATS, formatsFor, type PrintFormat } from './print-pieces';
import { ENTRANCE_CHART_SIZES } from './print-entrance-chart';
import { chartHeadLine, printHeadLine } from './print-head-line';
import { DETAILS_ITEM_GROUPS, EVERY_PRINT_ITEM } from './maker-details-items';
import { STUDIO_FORM_HEADS, STUDIO_FORM_ITEMS, studioDetailsGroups, studioPrintsBarPieces } from './studio-details';
import { STUDIO_TILE_ITEM } from './studio-tile-defs';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** The body of one editor in `MakerDetails`' editors object — from `key: (` to the next item at the same indent. */
function editorBlock(src: string, key: string): string {
  const from = src.indexOf('const editors: Partial<Record<DetailsItemKey, ReactNode>> = {');
  assert.ok(from >= 0, 'the editors object moved — this guard must follow it');
  const start = src.indexOf(`\n    ${key}: (`, from);
  assert.ok(start >= 0, `the ${key} editor moved — this guard must follow it`);
  const rest = src.slice(start + 1);
  const end = rest.slice(1).search(/\n {4}[\w'-]+: /);
  return end < 0 ? rest : rest.slice(0, end + 1);
}

test('1 · the piece bar is mounted ONCE — only for the new Maker’s Prints form — and only on a phone', async () => {
  const ws = read(`${L}/details-workspace.tsx`);
  /* The condition: the new Maker's Studio AND the Prints form. */
  const cond = ws.match(/const studioPrints = ([^;]+);/);
  assert.ok(cond, 'the bar’s condition is gone');
  assert.match(cond[1]!, /maker\?\.stagesStudio === true/, 'the bar no longer needs the new Maker');
  assert.match(cond[1]!, /formGroup\?\.key === 'prints'/, 'the bar no longer needs the Prints form');
  const mounts = [...ws.matchAll(/part="prints-bar"/g)];
  assert.equal(mounts.length, 1, 'the bar is mounted more than once');
  const before = ws.slice(0, mounts[0]!.index);
  assert.match(before.slice(-120), /\{studioPrints && formGroup \? <StudioTool $/, 'the bar is mounted without the Studio › Prints condition');
  /* Under the form's scroller, inside the editor column — never a layer over the form. */
  /* (A comment between the two reads as `{   }` once comments are stripped.) */
  assert.match(ws, /\{editorsBody\(false\)\}\s*(?:\{\s*\}\s*)?\{studioPrints && formGroup \? <StudioTool part="prints-bar"/, 'the bar is not right under the form’s scroller');
  /* Nowhere else in the app. */
  const others = walk(join(WEB, 'app'))
    .map((p) => relative(WEB, p))
    .filter((p) => p !== `${L}/details-workspace.tsx` && p !== `${L}/studio-tools.tsx` && p !== `${L}/studio-prints-bar.tsx`)
    .filter((p) => /part="prints-bar"|<StudioPrintsBar\b/.test(read(p)));
  assert.deepEqual(others, [], 'the bar is drawn somewhere else');

  /* Rendered: phone only, the three presses, the label and its group — and padded clear of the home indicator. */
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StudioPrintsBar } = await import(`../${L}/studio-prints-bar`);
  const items = [
    { key: EVERY_PRINT_ITEM, label: 'On every print', group: 'set' as const },
    { key: 'invitation' as const, label: 'The Invitation', group: 'set' as const },
    { key: 'pass' as const, label: 'Event pass', group: 'set' as const },
    { key: 'qr-codes' as const, label: 'Guest QR codes', group: 'day' as const },
    { key: 'download' as const, label: 'Download the set', group: 'download' as const },
  ];
  const html = renderToStaticMarkup(React.createElement(StudioPrintsBar, { items, box: { current: null }, onGo: () => {}, at: 'pass' }));
  const root = html.match(/<div data-studio-prints-bar=""[^>]*class="([^"]*)"/);
  assert.ok(root, 'the bar did not render');
  assert.match(root[1]!, /(^|\s)lg:hidden(\s|$)/, 'the bar shows on a computer — its navigator already lists the pieces');
  assert.match(root[1]!, /env\(safe-area-inset-bottom\)/, 'the bar does not keep clear of the home indicator');
  assert.match(html, /aria-label="Previous piece"/);
  assert.match(html, /aria-label="Next piece"/);
  assert.match(html, /data-prints-bar-pick=""[^>]*>[\s\S]*?Event pass/, 'the dropdown does not name the piece you are on');
  assert.match(html, /data-prints-bar-caption=""[^>]*>Your invitation set</, 'the piece’s group is not said over its name');
});

test('1b · the bar’s list is the form, in the form’s order, under the form’s own group words — "On every print" first', () => {
  const shipped = DETAILS_ITEM_GROUPS.map((g) => ({ key: g.group, label: g.label, items: g.keys.map((key) => ({ key, label: key, group: g.group })), ...(g.form ? { form: true as const } : {}), ...(g.hidden ? { hidden: true as const } : {}) }));
  const prints = studioDetailsGroups(shipped).find((g) => g.key === 'prints')!;
  const pieces = studioPrintsBarPieces(prints.items);
  assert.deepEqual(pieces.map((p) => p.key), prints.items.map((i) => i.key), 'the bar lists other pieces than the form draws');
  assert.equal(pieces[0]!.key, EVERY_PRINT_ITEM, '"On every print" is not first');
  assert.equal(pieces[0]!.group, undefined, '"On every print" sits under a heading — it is the head of the form');
  assert.deepEqual([...new Set(pieces.map((p) => p.group).filter(Boolean))], ['Your invitation set', 'For the day · free for every event', 'Download the set']);
  assert.equal(STUDIO_FORM_HEADS[EVERY_PRINT_ITEM]?.title, 'On every print');
  assert.ok(STUDIO_FORM_ITEMS.includes(EVERY_PRINT_ITEM), '"On every print" does not fill the phone screen like the rest of Prints');
  /* The Prints tile opens at the head of its form — the block first, then the Invitation. */
  assert.equal(STUDIO_TILE_ITEM.prints, EVERY_PRINT_ITEM);
});

test('2 · "Always printed" is said ONCE in Studio › Prints — in "On every print", never under a piece', () => {
  const src = read(`${L}/maker-details.tsx`);
  assert.match(src, /const qrPerPiece = props\.studio \? null : qrAlways;/, 'a piece’s own QR line is drawn in the Studio again');
  const block = src.slice(src.indexOf('editors[EVERY_PRINT_ITEM] = ('));
  const every = block.slice(0, block.indexOf('\n    );') + 7);
  assert.ok(every.length > 20, 'the "On every print" editor is gone');
  assert.equal((every.match(/\{qrAlways\}/g) ?? []).length, 1, '"On every print" does not hold the QR line once');
  /* No piece of the Prints form draws the QR line itself. */
  for (const key of ['invitation', 'details', 'pass']) {
    const ed = editorBlock(src, key);
    assert.doesNotMatch(ed, /\{qrAlways\}/, `${key} draws "Always printed" again — it is said once, in "On every print"`);
  }
  /* Every other use of the line is the shipped Maker's QR editor — which the Studio replaces with its quiet rows. */
  const uses = [...src.matchAll(/\{qrAlways\}/g)].length;
  assert.equal(uses, 2, 'the QR line is drawn somewhere new');
  assert.match(editorBlock(src, 'qr'), /\{qrAlways\}/);
  assert.match(src, /editors\.qr = <StudioTool part="quiet" \/>;/, 'the Studio no longer replaces the shipped QR editor — its QR line would be drawn twice');
});

test('3 · the NFC sticker spot lives in "On every print" — the same switch, the same form, with the one Save', () => {
  const src = read(`${L}/maker-details.tsx`);
  const block = src.slice(src.indexOf('editors[EVERY_PRINT_ITEM] = ('));
  const every = block.slice(0, block.indexOf('\n    );') + 7);
  assert.match(every, /\{qrAlways\}\s*\{nfcToggle\}\s*\{save\}/, '"On every print" is not QR line · NFC switch · Save');
  assert.match(src, /const nfcToggle = \(\s*<IncludeSwitch\s+form=\{WORDS_FORM\}\s+name="inc_nfc"/, 'the NFC switch no longer posts `inc_nfc` with the print words form');
  /* Not under Finer Details any more — in the Studio block, nothing adds it to a piece. */
  assert.doesNotMatch(editorBlock(src, 'details'), /\{nfcToggle\}/, 'the NFC switch is under Finer Details again');
  assert.doesNotMatch(src, /editors\.details = \(\s*<>\s*\{editors\.details\}\s*\{nfcToggle\}/, 'the Studio puts the NFC switch back under Finer Details');
  assert.equal([...src.matchAll(/\{nfcToggle\}/g)].length, 2, 'the NFC switch is drawn somewhere new (the shipped QR editor + "On every print" only)');
});

test('4 · a head line names the CHOSEN size only — every format of every family, and the entrance chart', () => {
  const families = [...new Set(Object.values(PRINT_FORMATS).map((f) => f.for))] as Array<PrintFormat['for']>;
  for (const fam of families) {
    const all = formatsFor(fam);
    for (const chosen of all) {
      for (const piece of fam === 'invitation' ? ['invitation', 'entourage', 'details', 'menu'] : [fam]) {
        const line = printHeadLine(piece, chosen);
        assert.ok(line.startsWith(`${chosen.label} · `), `${piece}: "${line}" does not lead with the chosen size`);
        assert.match(line, /\d+ × \d+ mm/, `${piece}: "${line}" has no millimetres`);
        for (const other of all) if (other.id !== chosen.id) assert.ok(!line.includes(other.label), `${piece}: "${line}" lists ${other.label} too`);
      }
    }
  }
  assert.equal(printHeadLine('pass', PRINT_FORMATS['calling-card']), 'Calling card · 90 × 54 mm · one per guest');
  assert.equal(printHeadLine('card', PRINT_FORMATS['card-a5']), 'A5 · 148 × 210 mm');
  for (const s of ENTRANCE_CHART_SIZES) {
    const line = chartHeadLine(s);
    for (const o of ENTRANCE_CHART_SIZES) if (o.key !== s.key) assert.ok(!line.includes(o.label), `the chart’s "${line}" lists ${o.label} too`);
  }
  assert.equal(chartHeadLine({ label: 'A2' }), 'A2 · one sheet for the door');
  /* The rows use these — no list of sizes is joined into a head line. */
  const prints = read(`${L}/maker-prints.tsx`);
  const studio = prints.slice(prints.indexOf('if (studio) {'), prints.indexOf('return (\n    <div data-print-editor={k} className="flex flex-col gap-3">'));
  assert.match(studio, /line=\{fam \? printHeadLine\(k, formats\[fam\]\) : spec\.size\}/, 'a piece’s head line is not the chosen size');
  assert.doesNotMatch(studio, /\.join\(/, 'a head line joins a list again');
  assert.match(read(`${L}/print-paper.tsx`), /line=\{chartHeadLine\(spec\)\}/, 'the entrance chart’s head line is not the chosen size');
});
