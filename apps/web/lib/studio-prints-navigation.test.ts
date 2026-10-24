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
 * ⚙ SINCE 2026-10-17 (DECISION_LOG "PRINTS: ONE SETTINGS SHEET, ONE DOWNLOAD PER PIECE, VIEW AS ▾…"): "On every print" is the first
 * heading INSIDE ⚙ Print settings, the head of the form is the ⚙ row ("Print settings" on the bar), every piece's switches live in
 * that one sheet (3), the Event pass is a guest print — View as ▾ · Download · All guests ◆ (5) — and the bar ends on "Download
 * everything" under "Everything" (1b). `prints-settings-and-downloads.test.ts` holds the rest of that ruling.
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
  const start = src.indexOf(`\n    ${key}: `, from);
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

test('1b · the bar’s list is the form, in the form’s order, under the form’s own group words — "Print settings" first', () => {
  const shipped = DETAILS_ITEM_GROUPS.map((g) => ({ key: g.group, label: g.label, items: g.keys.map((key) => ({ key, label: key, group: g.group })), ...(g.form ? { form: true as const } : {}), ...(g.hidden ? { hidden: true as const } : {}) }));
  const prints = studioDetailsGroups(shipped).find((g) => g.key === 'prints')!;
  const pieces = studioPrintsBarPieces(prints.items);
  assert.deepEqual(pieces.map((p) => p.key), prints.items.map((i) => i.key), 'the bar lists other pieces than the form draws');
  assert.equal(pieces[0]!.key, EVERY_PRINT_ITEM, '"Print settings" is not first');
  assert.equal(pieces[0]!.label, 'Print settings', 'the head of the form is not "Print settings" on the bar (owner 2026-10-17)');
  assert.equal(pieces[0]!.group, undefined, '"Print settings" sits under a heading — it is the head of the form');
  assert.deepEqual([...new Set(pieces.map((p) => p.group).filter(Boolean))], ['Your invitation set', 'For the day · free for every event', 'Everything']);
  assert.equal(pieces.at(-1)!.label, 'Download everything', 'the last piece on the bar is not "Download everything"');
  assert.equal(STUDIO_FORM_HEADS[EVERY_PRINT_ITEM], undefined, 'the ⚙ row names itself — a heading over it says it twice');
  assert.deepEqual(STUDIO_FORM_HEADS.download, { title: 'Everything', line: 'one file · Event Hub Pro' });
  assert.ok(STUDIO_FORM_ITEMS.includes(EVERY_PRINT_ITEM), '"Print settings" does not fill the phone screen like the rest of Prints');
  assert.ok(STUDIO_FORM_ITEMS.includes('digital-ticket'), 'the Digital ticket does not fill the phone screen like the rest of Prints');
  /* The Prints tile opens at the head of its form — the settings row first, then the Invitation. */
  assert.equal(STUDIO_TILE_ITEM.prints, EVERY_PRINT_ITEM);
});

/** The ⚙ Print settings editor: from `editors[EVERY_PRINT_ITEM] = (` to its closing `);` (the Digital ticket's line follows it). */
function settingsBlock(src: string): string {
  const block = src.slice(src.indexOf('editors[EVERY_PRINT_ITEM] = ('));
  return block.slice(0, block.indexOf('editors[DIGITAL_TICKET_ITEM]'));
}

test('2 · "Always printed" is said ONCE in Studio › Prints — in Print settings › On every print, never under a piece', () => {
  const src = read(`${L}/maker-details.tsx`);
  assert.match(src, /const qrPerPiece = props\.studio \? null : qrAlways;/, 'a piece’s own QR line is drawn in the Studio again');
  const every = settingsBlock(src);
  assert.ok(every.length > 20, 'the Print settings editor is gone');
  assert.equal((every.match(/\{qrAlways\}/g) ?? []).length, 1, 'Print settings does not hold the QR line once');
  /* No piece of the Prints form draws the QR line itself — in Studio a piece editor has no children at all. */
  for (const key of ['invitation', 'details', 'pass']) {
    const ed = editorBlock(src, key);
    assert.match(ed, /props\.studio \? (null|\(\s*<PrintPieceEditor input=\{prints\} piece="pass" studio \/>)/, `${key}: the Studio row still holds what the piece includes`);
  }
  const uses = [...src.matchAll(/\{qrAlways\}/g)].length;
  assert.equal(uses, 2, 'the QR line is drawn somewhere new');
  assert.match(editorBlock(src, 'qr'), /\{qrAlways\}/);
  assert.match(src, /editors\.qr = <StudioTool part="quiet" \/>;/, 'the Studio no longer replaces the shipped QR editor — its QR line would be drawn twice');
});

test('3 · Print settings holds every switch of every piece, under the prototype’s headings, with NO Save', () => {
  const src = read(`${L}/maker-details.tsx`);
  const every = settingsBlock(src);
  assert.match(every, /<StudioTool\s+part="print-settings"\s+form=\{WORDS_FORM\}/, 'the sheet is not tied to the print words form (its toast’s Try again posts it)');
  assert.doesNotMatch(every, /save=\{/, 'the sheet was handed a Save again — every press already posts (owner 2026-10-21)');
  assert.match(every, /key: 'every',[\s\S]*?\{qrAlways\}\s*\{nfcToggle\}/, '"On every print" is not QR line · NFC switch');
  for (const [key, body] of [
    ['invitation', /\{parentsSwitch\}\{openingSwitch\}/],
    ['details', /body: detailsSwitches/],
    ['passes', /\{guestNamesSwitch\}\s*\{passCornersPick\}\s*<TicketStyle input=\{prints\} \/>/],
    ['story', /part="poster-photo"/],
    ['seating', /\{seatPlanSwitch\}[\s\S]*?part="chart-layout"/],
  ] as const) {
    assert.match(every, new RegExp(`key: '${key}',[\\s\\S]*?${body.source}`), `Print settings › ${key} does not hold its switches`);
  }
  assert.match(src, /const nfcToggle = \(\s*<IncludeSwitch\s+form=\{WORDS_FORM\}\s+name="inc_nfc"/, 'the NFC switch no longer posts `inc_nfc` with the print words form');
  assert.equal([...src.matchAll(/\{nfcToggle\}/g)].length, 2, 'the NFC switch is drawn somewhere new (the shipped QR editor + Print settings only)');
  /* Each piece's switches are drawn once in the source and placed in ONE of two homes: the shipped piece editor or the sheet. */
  for (const c of ['parentsSwitch', 'openingSwitch', 'detailsSwitches', 'guestNamesSwitch', 'seatPlanSwitch']) {
    assert.equal([...src.matchAll(new RegExp(`\\{${c}\\}|body: ${c}\\b`, 'g'))].length, 2, `${c} is drawn somewhere new`);
  }
  /* The sheet keeps its fields mounted while shut — every post sends every field. */
  const sheet = read(`${L}/studio-prints-settings.tsx`);
  assert.match(sheet, /<div data-print-settings-layer="" hidden=\{!open\}/, 'the sheet is not simply hidden while shut');
  assert.match(sheet, /\{body \? createPortal\(panel, body\) : panel\}/, 'the sheet is not ALWAYS drawn (shut or open)');
  assert.doesNotMatch(sheet.slice(sheet.indexOf('export function StudioPrintSettings'), sheet.indexOf('/* ── A PIECE')), /\{open \? \(?\s*<div data-print-settings|open &&/, 'the sheet’s fields are drawn only while it is open');
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
  assert.doesNotMatch(studio, /sizes\.join|\.map\(\(f\) => f\.label\)\s*(?:;|\.join)/, 'a head line joins a list of sizes again');
  assert.match(read(`${L}/print-paper.tsx`), /line=\{chartHeadLine\(spec\)\}/, 'the entrance chart’s head line is not the chosen size');
});

test('5 · the Event pass is a guest print: View as ▾ · Download (that guest, the size picked) · All guests ◆ (every guest, the size picked)', async () => {
  const { renderSettled } = await import('./render-settled.test-helper');
  const { formatFor } = await import('./print-pieces');
  const { PrintPieceEditor, printPlan } = await import(`../${L}/maker-prints`);
  const guests = [
    { id: '00000000-0000-4000-8000-000000000101', name: 'Ana Reyes', reply: 'attending' as const },
    { id: '00000000-0000-4000-8000-000000000102', name: 'Ben Cruz', reply: 'pending' as const },
  ];
  for (const fmt of ['calling-card', 'train', 'boarding'] as const) {
    for (const [theme, pro] of [['house', false], ['abaca', true], ['abaca', false]] as const) {
      const input = { eventId: 'E1', slug: 'rosa-ben', theme, ownsPro: pro, storeShell: false, passGuests: guests, formats: { pass: formatFor('pass', fmt)!, invitation: formatFor('invitation', null)!, card: formatFor('card', null)! } };
      /* The all-guests file's address carries THIS row's size — Classic always, the theme's own when it prints ready. */
      const plan = printPlan(input);
      assert.match(plan.classic('passes'), new RegExp(`^/api/hub-print/passes\\?.*&pass_format=${fmt}$`), `the all-guests file is not in the size picked (${fmt})`);
      const drawn = await renderSettled(React.createElement(PrintPieceEditor as never, { input, piece: 'pass', studio: true } as never));
      const row = drawn.match(/data-print-piece-saves="pass"[^>]*>([\s\S]*?)<\/div><p data-print-guest-count="pass"[^>]*>([^<]*)<\/p>/);
      assert.ok(row, `${theme}/${pro}: the Event pass has no Download · All guests with its line under them`);
      const [, buttons] = row;
      const one = buttons!.search(/>Download</);
      const all = buttons!.search(/>All guests</);
      assert.ok(one >= 0 && all > one, `${theme}/${pro}: not Download, then All guests`);
      assert.doesNotMatch(drawn, /Sample \(PDF\)|Pass for|Every guest’s pass \(PDF\)/, 'a retired control is back (Sample (PDF) · Pass for ▾)');
      /* The one guest's file is that guest's pass — Ana, the first guest, until another is picked. */
      assert.match(buttons!, /data-print-save="rosa-ben-pass(?:-[a-z]+)?-ana-reyes\.pdf"/, `${theme}/${pro}: the Download is not the picked guest’s pass`);
      /* Every guest's pass in one file is FREE since 2026-10-22 (owner: "the goal of the free is to keep everything minimum ready"):
         the file itself for every couple, never the ◆ door. */
      assert.match(buttons!, /data-print-save="rosa-ben-passes(?:-[a-z]+)?\.pdf"/, `${theme}/${pro}: every guest’s pass is not a Download`);
      assert.doesNotMatch(buttons!, /data-print-all-in-one-pro=""/, `${theme}/${pro}: every guest’s pass is still the ◆ door`);
      assert.match(drawn, /data-print-view-as=""/, 'the Event pass has no View as ▾');
    }
  }
  /* …its address: the row's own print file (the size picked rides in it) with the guest added — the route's free one-pass file. */
  const prints = read(`${L}/maker-prints.tsx`);
  assert.match(prints, /one=\{\{ href: `\$\{one\.href\}&pass_guest=\$\{GUEST_TOKEN\}`/, 'the Download is not the row’s own file for the guest picked');
  assert.match(prints, /const one = themedReady \? \{ href: q\(k, 'print'\), file: file\.themed\(k\) \} : \{ href: classic\(k\), file: file\.classic\(k\) \};/);
  /* With nobody to print, the route answers in words — never an empty file — and the button shows those words in place. */
  const route = read('app/api/hub-print/[piece]/route.ts');
  assert.match(route, /if \(!docs\.length\) return new NextResponse\('No guest has a ticket yet[^']*', \{ status: 409 \}\)/, 'with nobody coming, the passes route no longer refuses in words');
  const button = read(`${L}/print-save-button.tsx`);
  assert.match(button, /if \(!res\.ok\) \{\s*const text = \(await res\.text\(\)/, 'a refused file’s words are no longer shown in place');
});

test('6 · the all-guests line says what the FILE holds — its passes, how many are coming and how many have not replied — from the file’s own rule', async () => {
  const { renderSettled } = await import('./render-settled.test-helper');
  const { formatFor } = await import('./print-pieces');
  const { PrintPieceEditor } = await import(`../${L}/maker-prints`);
  const { passGuestReply } = await import('./print-set.server');
  const { passCardEligibility } = await import('./pass-card');
  /* The reply a pass guest is counted under is the one the pass rule read: never `declined` for a guest who has a pass. */
  type Row = { guest_id: string; event_id: string; qr_token: string; entry_source: string; rsvp_status: string; plus_one_of_guest_id?: string };
  const r = (o: Partial<Row> & { guest_id: string }): Row => ({ event_id: 'e', qr_token: 't', entry_source: 'host_seeded', rsvp_status: 'attending', ...o });
  const rows = [
    r({ guest_id: 'a' }),
    r({ guest_id: 'b', rsvp_status: 'declined' }),
    r({ guest_id: 'p', rsvp_status: 'pending' }),
    r({ guest_id: 'm', rsvp_status: 'maybe' }),
    r({ guest_id: 'a1', plus_one_of_guest_id: 'a', rsvp_status: 'pending' }),
    r({ guest_id: 'p1', plus_one_of_guest_id: 'p', rsvp_status: 'pending' }),
    r({ guest_id: 'p2', plus_one_of_guest_id: 'p', rsvp_status: 'attending' }),
  ];
  const by = new Map(rows.map((x) => [x.guest_id, x]));
  const has = rows.filter((x) => passCardEligibility(x as never, x.plus_one_of_guest_id ? (by.get(x.plus_one_of_guest_id) as never) : null) === 'pass');
  const replies = Object.fromEntries(has.map((x) => [x.guest_id, passGuestReply(x as never, x.plus_one_of_guest_id ? (by.get(x.plus_one_of_guest_id) ?? null) : null)]));
  assert.deepEqual(replies, { a: 'attending', p: 'pending', m: 'maybe', a1: 'attending', p1: 'pending', p2: 'attending' }, 'a pass guest is counted under a reply the pass rule did not read');
  /* cale-ice's shape: 6 coming, 103 not replied — the number IS the file. */
  const draw = async (passGuests: Array<{ id: string; name: string; reply: 'attending' | 'pending' | 'maybe' }>) => {
    const input = { eventId: 'E1', slug: 'rosa-ben', theme: 'house', ownsPro: true, storeShell: false, formats: { pass: formatFor('pass', null)!, invitation: formatFor('invitation', null)!, card: formatFor('card', null)! }, passGuests };
    const html = await renderSettled(React.createElement(PrintPieceEditor as never, { input, piece: 'pass', studio: true } as never));
    return html.match(/<p data-print-guest-count="pass"[^>]*>([^<]*)<\/p>/)?.[1] ?? '';
  };
  const guests = (a: number, p: number, m = 0) => [
    ...Array.from({ length: a }, (_, i) => ({ id: `a${i}`, name: `A ${i}`, reply: 'attending' as const })),
    ...Array.from({ length: p }, (_, i) => ({ id: `p${i}`, name: `P ${i}`, reply: 'pending' as const })),
    ...Array.from({ length: m }, (_, i) => ({ id: `m${i}`, name: `M ${i}`, reply: 'maybe' as const })),
  ];
  assert.equal(await draw(guests(6, 103)), '109 passes · 6 coming, 103 not replied yet · ganged on A4 with cut lines');
  assert.equal(await draw(guests(6, 0)), '6 passes · 6 coming · ganged on A4 with cut lines', 'a part that is 0 is not dropped');
  assert.equal(await draw(guests(1, 0)), '1 pass · 1 coming · ganged on A4 with cut lines');
  assert.equal(await draw(guests(2, 1, 3)), '6 passes · 2 coming, 1 not replied yet, 3 maybe · ganged on A4 with cut lines', 'a guest in the file is not counted anywhere');
  /* The counts are the list the file is made from — no second read. */
  const page = read('app/dashboard/[eventId]/launch/page.tsx');
  assert.match(page, /passGuests: passGuestsP \? await passGuestsP : undefined/);
  assert.match(page, /loadPassGuestNames\(eventId, /);
  const loader = read('lib/print-set.server.ts');
  assert.match(loader.slice(loader.indexOf('export async function loadPassGuestNames(')), /passGuestRows\(eventId, true\)/, 'the counts come from a read other than the file’s');
});
