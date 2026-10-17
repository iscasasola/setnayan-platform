/**
 * prints-settings-and-downloads.test.ts — STUDIO › PRINTS: ONE SETTINGS SHEET, ONE DOWNLOAD PER PIECE, VIEW AS ▾ ON GUEST PRINTS, ALL GUESTS ◆,
 * EVERYTHING ◆ (owner 2026-10-17, verbatim *"ok on prints"*; DECISION_LOG row of that date; prototype
 * `prototypes/prints_settings_and_downloads_2026-10-17.html` + its `after-375-01..10` pictures).
 *
 *   1 · ⚙ Print settings: the sheet is ALWAYS in the page — hidden while shut, never unmounted — so a Save sends every field; its
 *       headings are the prototype's, in its order; Save is the print words form's one Save.
 *   2 · ONE Download per piece: a piece row in Studio draws exactly one free Download — never "Sample (PDF)", "Pass for ▾" or a second Save.
 *   3 · Guest prints are EXACTLY the four (Event pass · Digital ticket · Guest QR codes · Table signs & place cards): each has View as ▾
 *       (ONE pick shared by all four), a Download for that guest and All guests ◆. The Event card is not per guest.
 *   4 · One guest's place card is a real file: `/seating/print?guest=<id>` draws that card alone (`cardsOnly`), refuses an unseated
 *       guest in words; the whole pack is Event Hub Pro at its route, after its free answers.
 *   5 · Everything ◆: one route piece (`everything`), Pro, the set + every guest's pass + the day's sheets, a failed part fails the file;
 *       ONE QR picture per guest in ONE book (`renderPrintBook`), STREAMED (a buffered Vercel response stops at 4.5 MB), 300 s.
 *   6 · The words: View as ▾'s groups and counts, the count lines (the number IS the file, never a guess), the ◆ notes, the bar's ⬇.
 *
 *   7 · View as ▾ has "Search guests" once the list is longer than 8 (controller 2026-10-17): it filters every group, each head keeps its
 *       whole count; the sheet is its own lazy piece — the shared `PickMenu` never grows.
 *
 * SABOTAGE (each seen RED, then restored — see the PR): the search box dropped · the search not filtering a group · a filtered head
 * re-counted · the guest sheet imported eagerly · the sheet drawn only while open · View as ▾ dropped from a guest print · the Event
 * card made a guest print · the pack's PDF without its Pro question · Everything skipping a part that failed · "Sample (PDF)" put back.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { renderSettled } from './render-settled.test-helper';
import {
  EVERYTHING_HEAD,
  GUEST_PRINT_KEYS,
  GUEST_SEARCH_FROM,
  guestPickGroups,
  PRINT_SETTINGS_HEADS,
  guestPickOptions,
  guestPrintCountLine,
  type PrintGuest,
} from './studio-prints-settings';
import { EVERYTHING_PRO_NOTE, PLACE_CARDS_PRO_NOTE, QR_SHEET_PRO_NOTE, allInOneRefusal } from './studio-prints-six';
import { layoutSeatingPack } from './print-seating-pack';

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
const ANA = '00000000-0000-4000-8000-000000000101';
const GUESTS: PrintGuest[] = [
  { id: ANA, name: 'Ana Reyes', reply: 'attending' },
  { id: '00000000-0000-4000-8000-000000000102', name: 'Ben Cruz', reply: 'pending' },
  { id: '00000000-0000-4000-8000-000000000103', name: 'Carla Dizon', reply: 'maybe' },
  { id: '00000000-0000-4000-8000-000000000104', name: 'Dante Lim', reply: 'attending' },
];

async function input(ownsPro = false, storeShell = false) {
  const { formatFor } = await import('./print-pieces');
  return { eventId: 'E1', slug: 'rosa-ben', theme: 'house', ownsPro, storeShell, passGuests: GUESTS, passCardsZip: 'rosa-ben-tickets.zip', formats: { pass: formatFor('pass', null)!, invitation: formatFor('invitation', null)!, card: formatFor('card', null)! } };
}

test('1 · ⚙ Print settings: always in the page, its fields mounted while shut; the prototype’s headings in its order; ONE Save', async () => {
  const { StudioPrintSettings } = await import(`../${L}/studio-prints-settings`);
  const field = React.createElement('input', { form: 'details-print-words', name: 'inc_nfc', type: 'checkbox', defaultChecked: true, 'aria-label': 'nfc' });
  const html = await renderSettled(
    React.createElement(StudioPrintSettings as never, {
      sections: [{ key: 'every', title: 'On every print', line: 'QR · NFC spot', body: field }],
      save: React.createElement('button', { type: 'submit', form: 'details-print-words' }, 'Save'),
    } as never),
  );
  /* Shut (its first render): the ⚙ row shows, the sheet is hidden — and its field is IN the page, posting with the form. */
  assert.match(html, /data-print-settings-open=""[^>]*>[\s\S]*?Print settings[\s\S]*?QR · NFC spot · words on the cards · passes · seat plan/, 'the ⚙ row is not "Print settings" with its line');
  assert.match(html, /<div data-print-settings-layer="" hidden=""/, 'the sheet is not drawn hidden while shut');
  assert.match(html, /<input form="details-print-words"[^>]*name="inc_nfc"/, 'a field of the sheet is not in the page while it is shut — Save would not send it');
  assert.match(html, /data-print-settings-foot=""[\s\S]*?<button type="submit" form="details-print-words">Save<\/button>/, 'the sheet’s foot is not the print words form’s Save');
  /* The headings, as the prototype draws them, in its order. */
  assert.deepEqual(Object.values(PRINT_SETTINGS_HEADS).map((h) => h.title), ['On every print', 'The invitation', 'The Finer Details', 'Passes', 'Our Story poster', 'Seat plan & the door']);
  const details = read(`${L}/maker-details.tsx`);
  const block = details.slice(details.indexOf('editors[EVERY_PRINT_ITEM] = ('), details.indexOf('editors[DIGITAL_TICKET_ITEM]'));
  const order = [...block.matchAll(/key: '(every|invitation|details|passes|story|seating)'/g)].map((m) => m[1]);
  assert.deepEqual(order, ['every', 'invitation', 'details', 'passes', 'story', 'seating'], 'the sheet’s sections are not in the prototype’s order');
});

test('2 · ONE Download per piece — never "Sample (PDF)", "Pass for ▾" or a second Save', async () => {
  const { PrintPieceEditor } = await import(`../${L}/maker-prints`);
  const i = await input(false);
  for (const k of ['invitation', 'entourage', 'details', 'poster', 'story-poster', 'card'] as const) {
    const html = await renderSettled(React.createElement(PrintPieceEditor as never, { input: i, piece: k, studio: true } as never));
    const row = html.match(/data-print-download="[^"]+">([\s\S]*?)<\/div>/)?.[1] ?? '';
    assert.equal((row.match(/<span data-print-save=/g) ?? []).length, 1, `${k}: the row has not exactly ONE Download`);
    assert.match(row, />Download</, `${k}: the row’s button is not "Download"`);
  }
  const pass = await renderSettled(React.createElement(PrintPieceEditor as never, { input: i, piece: 'pass', studio: true } as never));
  assert.doesNotMatch(pass, /Sample \(PDF\)|Pass for|Every guest’s pass \(PDF\)/, 'a retired control is back on the Event pass');
});

test('3 · guest prints are EXACTLY the four — View as ▾ · Download (that guest) · All guests ◆ — and they share ONE pick', async () => {
  assert.deepEqual([...GUEST_PRINT_KEYS], ['pass', 'digital-ticket', 'qr-codes', 'seating-pack']);
  const { PrintPieceEditor, DigitalTicketEditor, freePrintParts } = await import(`../${L}/maker-prints`);
  const i = await input(false);
  const day = (freePrintParts as (...a: unknown[]) => Array<{ key: string; editor: React.ReactNode }>)('E1', 'rosa-ben', i, true);
  const drawn: Record<string, string> = {};
  for (const k of ['invitation', 'entourage', 'details', 'menu', 'pass', 'poster', 'story-poster', 'card'] as const) {
    drawn[k] = await renderSettled(React.createElement(PrintPieceEditor as never, { input: i, piece: k, studio: true } as never));
  }
  drawn['digital-ticket'] = await renderSettled(React.createElement(DigitalTicketEditor as never, { input: i } as never));
  for (const f of day) drawn[f.key] = await renderSettled(React.createElement('div', null, f.editor));
  const viewAs = Object.entries(drawn).filter(([, h]) => /data-print-view-as=""/.test(h)).map(([k]) => k).sort();
  assert.deepEqual(viewAs, [...GUEST_PRINT_KEYS].sort(), 'View as ▾ is on another print than the four (the Event card is the event’s, not a guest’s)');
  for (const k of GUEST_PRINT_KEYS) {
    const h = drawn[k]!;
    assert.match(h, /data-print-view-as=""[^>]*>[\s\S]*?Ana Reyes/, `${k}: View as ▾ does not show the guest picked`);
    assert.match(h, /data-print-download="[^"]+">[\s\S]*?>Download<[\s\S]*?>All guests</, `${k}: not Download, then All guests`);
    assert.match(h, new RegExp(`data-print-guest-count="${k}"`), `${k}: no line says what the all-guests file holds`);
  }
  /* ONE pick for all four: every guest print reads the same store (`usePrintGuest`), keyed by the event. */
  const sheet = read(`${L}/studio-prints-settings.tsx`);
  assert.match(sheet, /const \[picked, setPicked\] = usePrintGuest\(eventId, list\[0\]\?\.id \?\? null\);/);
  assert.match(read(`${L}/prints-view-store.ts`), /const id = useSyncExternalStore\(subscribe, \(\) => GUESTS\.get\(eventId\) \?\? fallback/);
  assert.equal((read(`${L}/maker-prints.tsx`).match(/part="guest-piece"/g) ?? []).length, 3, 'a guest print is drawn by something other than the one guest-piece part (pass · ticket · the two for the day)');
});

test('4 · one guest’s place card is that card alone; an unseated guest is said; the whole pack is Pro at its route', () => {
  const unit = (label: string, guests: string[]) => ({ label, joined: 1, qrRef: `t-${label}`, guests: guests.map((n) => ({ name: n, qrRef: `g-${n}` })) });
  const whole = layoutSeatingPack({ coupleName: 'Rosa & Ben', dateLabel: null, units: [unit('Table 1', ['Ana', 'Ben']), unit('Table 2', ['Carla'])], signLine: 'Scan to visit our event' });
  const one = layoutSeatingPack({ coupleName: 'Rosa & Ben', dateLabel: null, units: [unit('Table 1', ['Ana']), unit('Table 2', [])], signLine: 'Scan to visit our event', cardsOnly: true });
  assert.ok(whole.length >= 4, 'the pack lost its directory or signs');
  assert.equal(one.length, 1, 'one guest’s card is not ONE page — the directory or the signs came with it');
  const words = JSON.stringify(one[0]!.ops);
  assert.match(words, /Ana/);
  assert.doesNotMatch(words, /Ben|Carla|Rosa & Ben/, 'another guest, or the sign, is on one guest’s card page');
  const route = read('app/dashboard/[eventId]/seating/print/route.ts');
  assert.match(route, /if \(oneGuest !== null && !GUEST_ID\.test\(oneGuest\)\) return new NextResponse\('Which guest\?', \{ status: 400 \}\);/);
  assert.match(route, /\.filter\(\(g\) => oneGuest === null \|\| g\.guest_id === oneGuest\)/, 'the card is not filtered to the guest asked');
  assert.match(route, /return new NextResponse\('That guest has no seat yet[^']*', \{ status: 404 \}\)/, 'an unseated guest is not said in words');
  assert.match(route, /cardsOnly: oneGuest !== null/);
  /* The pack's whole PDF asks the event's Pro BEFORE anything is drawn — never the picture, the chart, or one guest's card. */
  const gate = route.indexOf("if (format === 'pdf' && oneGuest === null) {");
  assert.ok(gate > 0 && gate < route.indexOf('const docs = layoutSeatingPack('), 'the pack is drawn before its Pro question');
  assert.match(route.slice(gate, gate + 400), /if \(!ownsPro\) return new NextResponse\(storeShell \? 'Not available here\.' : allInOneRefusal\('seating-pack'\), \{ status: 403 \}\);/);
});

test('5 · Everything ◆: one piece of the route, Pro, the set + every guest’s pass + the day’s sheets — a failed part fails the file', () => {
  const route = read('app/api/hub-print/[piece]/route.ts');
  assert.match(route, /const wantsEverything = rawPiece === 'everything';/);
  assert.match(route, /const allName = wantsEverything \? 'everything' : wantsSet \? 'set' : piece;/);
  assert.match(route, /if \(isAllInOnePrint\(allName, mode\) && !ownsPro\) \{/, 'Everything is not refused to a free event');
  const fn = route.slice(route.indexOf('async function everythingPdf('), route.indexOf('export async function GET('));
  assert.match(fn, /freeSheet\('guest-registry'/, 'Everything leaves out the guest list registry');
  /* 📦 ONE QR picture per guest: drawn once (every guest — the QR sheet's list), the ticket list read WITHOUT drawing, both on the
     same `qr-<guest id>` keys; the set, the registry, the QR sheet and the passes are ONE book (each picture embedded once). */
  assert.match(fn, /loadGuestPasses\(set, \{ width: EVERYTHING_QR_PX \}\)/, 'Everything does not draw every guest’s QR once');
  assert.match(fn, /loadGuestPasses\(set, \{ width: EVERYTHING_QR_PX, ticketsOnly: true, drawOnly: \{ from: 0, count: 0 \} \}\)/, 'the passes draw their QRs a second time');
  assert.match(fn, /const qrSheet = layoutQrCodes\(/, 'Everything leaves out the QR sheet');
  assert.match(fn, /layoutPasses\(\{ \.\.\.input, format: passFormat \}, tickets\.passes/, 'Everything leaves out every guest’s pass');
  assert.match(fn, /renderPrintBook\(\s*\[\s*\{ kind: 'pages', docs: \[\.\.\.docs, \.\.\.registry\.docs, \.\.\.qrSheet\] \},\s*\.\.\.\(passDocs\.length \? \[\{ kind: 'imposed' as const/, 'the set, the registry, the QR sheet and the passes are not ONE book');
  /* 📤 STREAMED — through the route's one PDF door, which streams every print (`bytesStream`, lib/stream-file.ts, #6599). */
  assert.match(fn, /return pdfResponse\(bytes, fileName\(set\.event\.slug, 'everything', set\.theme\)/, 'Everything does not leave through the route’s streamed PDF door');
  assert.match(route, /function pdfResponse\([^)]*\): NextResponse \{\s*return new NextResponse\(bytesStream\(bytes\), \{/, 'the route’s PDF door is buffered — over 4.5 MB it would fail on Vercel');
  assert.doesNotMatch(route, /function pdfStream\(/, 'a second copy of the stream helper');
  assert.match(route, /export const maxDuration = 300;/, 'Everything has less than the zip route’s 300 s');
  for (const path of ['print\\?format=pdf', 'print\\?chart=table&format=pdf', 'caterer\\?format=pdf', 'export\\?mode=moodboard']) {
    assert.match(fn, new RegExp(`at\\('${path}'\\)`), `Everything leaves out the day’s sheet at ${path}`);
  }
  /* A 5xx is the whole file's failure, in the part's words — only a 4xx (nothing to print) is left out. */
  assert.match(fn, /if \(res\.status >= 500\) \{[\s\S]{0,260}return new NextResponse\(`\$\{part\.name\} could not be drawn just now/, 'a part that failed is quietly left out');
  assert.match(fn, /if \(!res\.ok \|\| !\(res\.headers\.get\('content-type'\) \?\? ''\)\.includes\('application\/pdf'\)\) continue;/);
  /* The page: Everything ◆ is the zip's pattern, the same Pro note words as the route's refusal. */
  assert.equal(allInOneRefusal('everything'), `${EVERYTHING_PRO_NOTE.title}. ${EVERYTHING_PRO_NOTE.body}`);
  assert.deepEqual(EVERYTHING_HEAD, { title: 'Everything', line: 'one file · Event Hub Pro' });
});

test('6 · the words: View as ▾’s groups, the count lines (the number IS the file), the ◆ notes, the bar’s ⬇', async () => {
  assert.deepEqual(
    guestPickOptions(GUESTS).map((o) => `${o.group} ${o.label}`),
    ['Coming · 2 Ana Reyes', 'Coming · 2 Dante Lim', 'Not replied yet · 1 Ben Cruz', 'Maybe · 1 Carla Dizon'],
    'View as ▾ is not coming first, then not replied, then maybe — each group with its count',
  );
  assert.equal(guestPrintCountLine('pass', GUESTS), '4 passes · 2 coming, 1 not replied yet, 1 maybe · ganged on A4 with cut lines');
  assert.equal(guestPrintCountLine('digital-ticket', GUESTS), '4 tickets · one PNG per guest who is coming · .zip');
  /* Not read here → no number (never a guess). */
  assert.doesNotMatch(guestPrintCountLine('qr-codes', GUESTS), /\d+ (?:codes|guests)/);
  assert.doesNotMatch(guestPrintCountLine('seating-pack', GUESTS), /\d+ place cards/);
  assert.equal(guestPrintCountLine('pass', null), 'Guests who are coming');
  /* The ◆ notes are the prototype's, said the same by the routes. */
  assert.equal(QR_SHEET_PRO_NOTE.title, 'Every guest’s QR in one file is Event Hub Pro');
  assert.equal(PLACE_CARDS_PRO_NOTE.title, 'Every place card in one file is Event Hub Pro');
  assert.equal(allInOneRefusal('qr-codes'), `${QR_SHEET_PRO_NOTE.title}. ${QR_SHEET_PRO_NOTE.body}`);
  assert.equal(allInOneRefusal('seating-pack'), `${PLACE_CARDS_PRO_NOTE.title}. ${PLACE_CARDS_PRO_NOTE.body}`);
  assert.match(read(`${L}/studio-prints-six.tsx`), /confirmLabel="Event Hub Pro"\s*cancelLabel="Not now"/, 'the ◆ note’s buttons are not "Not now" · "Event Hub Pro"');
  /* The bar: ⬇ opens the Download sheet — "This piece" (the row's own file) and "Everything". */
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StudioPrintsBar } = await import(`../${L}/studio-prints-bar`);
  const bar = renderToStaticMarkup(React.createElement(StudioPrintsBar, { items: [{ key: 'every-print', label: 'x', group: 'set' }, { key: 'pass', label: 'Event pass', group: 'set' }], box: { current: null }, onGo: () => {}, at: 'pass' }));
  assert.match(bar, /data-prints-bar-step="download"[^>]*><button[^>]*aria-label="Download"[^>]*class="ab ab-brand ab-main/, 'the bar has no ⬇ — the filled ActionButton');
  const sheet = read(`${L}/studio-prints-settings.tsx`);
  const dl = sheet.slice(sheet.indexOf('export function StudioPrintsDownloadSheet('));
  assert.match(dl, /<FormRow name="This piece"/);
  assert.match(dl, /<FormRow name="Everything"/);
  assert.match(dl, /const here = item && item !== 'download' \? \(all\.get\(item\) \?\? null\) : null;/, '"This piece" is not the row’s own registered file');
  void input;
});

test('7 · View as ▾ has "Search guests" over a long list — it filters every group, each head keeps its whole count; its own lazy piece', async () => {
  const many: PrintGuest[] = [
    ...Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, name: i === 2 ? 'Bea Santillan' : `Coming ${i}`, reply: 'attending' as const })),
    ...Array.from({ length: 103 }, (_, i) => ({ id: `p${i}`, name: i === 50 ? 'Beatriz Lacson' : `Pending ${i}`, reply: 'pending' as const })),
  ];
  assert.equal(GUEST_SEARCH_FROM, 8);
  assert.deepEqual(guestPickGroups(many, '').map((g) => [g.head, g.options.length]), [['Coming · 6', 6], ['Not replied yet · 103', 103]]);
  /* Typed: both groups filtered, their heads (and whole counts) kept — accent- and case-blind. */
  assert.deepEqual(guestPickGroups(many, 'BEA').map((g) => [g.head, g.options.map((o) => o.label)]), [['Coming · 6', ['Bea Santillan']], ['Not replied yet · 103', ['Beatriz Lacson']]]);
  assert.deepEqual(guestPickGroups(many, 'béatriz').map((g) => g.head), ['Not replied yet · 103'], 'a group with no match is drawn, or the search is accent-blind only one way');
  assert.deepEqual(guestPickGroups(many, 'zzz'), []);
  /* Drawn: the box over a long list, none over a short one; its listbox in groups. */
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { GuestPickSheet } = await import(`../${L}/print-guest-sheet`);
  const g = globalThis as unknown as { document?: unknown };
  const had = g.document;
  g.document = {};
  const reactDom = require('react-dom') as { createPortal: (n: unknown) => unknown };
  const portal = reactDom.createPortal;
  reactDom.createPortal = (n: unknown) => n;
  try {
    const long = renderToStaticMarkup(React.createElement(GuestPickSheet as never, { guests: many, value: 'c2', onPick: () => {}, onClose: () => {} } as never));
    assert.match(long, /data-print-guest-search=""[\s\S]*?placeholder="Search guests"/, 'a long list has no "Search guests"');
    assert.match(long, /data-pick-group="Coming · 6"[\s\S]*?aria-selected="true"[^>]*>[\s\S]*?Bea Santillan[\s\S]*?data-pick-group="Not replied yet · 103"/);
    const short = renderToStaticMarkup(React.createElement(GuestPickSheet as never, { guests: GUESTS, value: ANA, onPick: () => {}, onClose: () => {} } as never));
    assert.doesNotMatch(short, /data-print-guest-search/, 'a short list wears a search box');
  } finally {
    reactDom.createPortal = portal;
    g.document = had;
  }
  /* Its own lazy piece: imported with `dynamic()` by the View as row only — never statically, never through PickMenu. */
  const settings = read(`${L}/studio-prints-settings.tsx`);
  assert.match(settings, /const GuestPickSheet = dynamic\(\(\) => import\(\s*'\.\/print-guest-sheet'\)/, 'the guest sheet is not its own dynamic import');
  assert.match(readFileSync(join(WEB, `${L}/studio-prints-settings.tsx`), 'utf8'), /import\(\/\* webpackChunkName: "prints-guest-sheet" \*\/ '\.\/print-guest-sheet'\)/, 'the guest sheet’s chunk is not named (an unnamed chunk grows the every-page runtime)');
  const importers = ['studio-prints-settings.tsx', 'studio-tools.tsx', 'maker-prints.tsx', 'maker-details.tsx', 'details-lazy.tsx', 'details-workspace.tsx']
    .filter((f) => /from '\.\/print-guest-sheet'/.test(read(`${L}/${f}`)));
  assert.deepEqual(importers, [], 'the guest sheet is imported statically');
  assert.doesNotMatch(read('app/dashboard/[eventId]/website/editor/_components/pick-menu.tsx'), /search/i, 'the shared PickMenu grew a search');
});

test('8 · ONE BOOK embeds a picture once: the set’s pages and the ganged passes share each guest’s QR', async () => {
  const { renderPrintBook, renderPrintPdf, renderImposedPdf } = await import('./print-render-pdf');
  const { layoutPasses, layoutQrCodes } = await import('./print-layout');
  const { printLookFor, formatFor } = await import('./print-pieces');
  const { themeColours } = await import('./theme-colours');
  const { PDFDocument } = await import('pdf-lib');
  const zlib = await import('node:zlib');
  /* A real PNG (1×1) per guest — the size difference is what is measured, not the picture. */
  const png = (n: number) => {
    const crc = (b: Buffer) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
    const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(64, 0); ihdr.writeUInt32BE(64, 4); ihdr[8] = 8; ihdr[9] = 2;
    const raw = Buffer.alloc(64 * (1 + 64 * 3)); for (let i = 0; i < raw.length; i++) raw[i] = (i * 31 + n * 7) & 0xff; for (let r = 0; r < 64; r++) raw[r * 193] = 0;
    return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
  };
  const images = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`qr-g${i}`, { bytes: png(i), mime: 'image/png' as const }]));
  const data = { names: { first: 'A', second: 'B' }, details: { parents: [], openingLine: '', rsvpContact: null, giftLines: [] }, entourage: [], attire: [], swatches: [], menu: [], hasStill: false, hasEventQr: false } as never;
  const input = { look: printLookFor('house', themeColours('house', null)), data, mode: 'print' as const, foil: false, format: null } as never;
  const sheet = layoutQrCodes('t', Array.from({ length: 12 }, (_, i) => ({ name: `G ${i}`, sub: null, qrRef: `qr-g${i}` })));
  const passes = layoutPasses(input, Array.from({ length: 12 }, (_, i) => ({ name: `G ${i}`, seat: null, qrRef: `qr-g${i}`, serial: `Nº ${i}` })));
  const fmt = formatFor('passes', null)!;
  const book = await renderPrintBook([{ kind: 'pages', docs: sheet }, { kind: 'imposed', docs: passes, ...fmt.sheet! }], images, { title: 't' });
  const apart = (await renderPrintPdf(sheet, images, { mode: 'print', title: 't' })).length + (await renderImposedPdf(passes, images, { ...fmt.sheet!, title: 't' })).length;
  const doc = await PDFDocument.load(book);
  const perSheet = fmt.sheet!.cols * fmt.sheet!.rows;
  assert.equal(doc.getPageCount(), sheet.length + Math.ceil(12 / perSheet), 'the book is not the sheet’s pages then the ganged passes');
  const imageObjects = doc.context.enumerateIndirectObjects().filter(([, o]) => (o as { dict?: { get: (k: unknown) => unknown } }).dict?.get?.((doc.context.obj as (x: string) => unknown)('Subtype') as never)?.toString?.() === '/Image').length;
  assert.equal(imageObjects, 12, 'a guest’s QR is embedded more than once in the book');
  assert.ok(book.length < apart, `the book (${book.length} B) is not smaller than the two files apart (${apart} B)`);
});
