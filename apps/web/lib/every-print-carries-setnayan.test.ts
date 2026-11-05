/**
 * lib/every-print-carries-setnayan.test.ts — EVERY PRINT CARRIES SETNAYAN, ONCE.
 *
 * Owner 2026-10-21, verbatim: *"i want the prints branded with setnayan"* — and he chose option A:
 *   · FREE (plain-white) prints — a small line, "Made with Setnayan · setnayan.com", on the FRONT's bottom edge;
 *   · PRO (Hub-look) prints — a tiny Setnayan mark on the back, or at the very edge where a piece has no back;
 *   · the plain A4 utility printouts (QR sheet, guest list, table signs & place cards, caterer counts, entrance chart)
 *     carry the free line too.
 *
 * This file measures the DRAWN sheets (`brandPiece`, lib/print-layout.ts), never the code that draws them. For every
 * piece × every format × print and screen × a free look, every theme's Pro look and two Hub looks (a picture and a
 * plain colour), and for every guest's ticket and every utility page:
 *
 *   1 · the brand is there EXACTLY ONCE per piece — the line on the front; the mark on the back when there is one;
 *   2 · its whole ink sits inside the safe area of that sheet's OWN die cut;
 *   3 · it touches no QR (with its white plate) and no word, mark, plate or rule the layout drew;
 *   4 · the line reads (≥ 6 pt, ≥ 4.5 : 1 on its paper) and says exactly the owner's words;
 *   5 · the mark is the shipped artwork — the very path of public/brand/setnayan-mark.svg — quiet, in the Hub's ink.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildEntourage, type EntourageGuestRow } from './entourage';
import { INVITE_THEME_IDS } from './invite-themes';
import { hexRgb, worstContrast, MIN_CONTRAST, pathBounds } from './print-ground';
import { printHubFonts, printLookForEvent, printLookFromHub, printLooksFor, plainPrintLook } from './print-hub-look';
import {
  PRINT_BRAND_MARK_OPACITY,
  PRINT_BRAND_WORDS,
  PRINT_MIN_BODY_PT,
  SAFE_PT,
  layoutPasses,
  layoutPieceDocs,
  layoutQrCodes,
  safeContainsBox,
  type PrintDoc,
  type PrintOp,
  type PrintPass,
  type PrintSetData,
} from './print-layout';
import { PRINT_FORMATS, PRINT_SET_KEYS, formatFamilyOf, type PrintLook, type PrintSetKey } from './print-pieces';
import { layoutGuestRegistry, type RegistryRow } from './print-guest-registry';
import { layoutSeatingPack } from './print-seating-pack';
import { layoutReport } from './print-report';
import { layoutEntranceChart } from './print-entrance-chart';
import { SETNAYAN_MARK_PATH } from './qr-style-svg';
import { buildCustomSiteColorVars } from './site-palette';

const WEB = join(__dirname, '..');

// ─── An invented wedding — a light one, and one heavy enough to need a back ───────────────────────────────────────

let n = 0;
function person(role: string, prefix: string | null = null): EntourageGuestRow {
  n += 1;
  const first = ['Teodoro', 'Evangelina', 'Marcelino', 'Rosalinda', 'Bienvenido', 'Concepcion', 'Wenceslao', 'Purificacion'][n % 8]!;
  const last = ['Villaseñor-Castañeda', 'Dimaculangan', 'Pangilinan', 'Buenaventura', 'Evangelista-Ocampo'][n % 5]!;
  return { guest_id: `g-${n}`, march: null, name_prefix: prefix, first_name: first, middle_name: `${String.fromCharCode(65 + (n % 26))}.`, last_name: last, name_suffix: null, role };
}

function wedding(heavy: boolean): PrintSetData {
  const rows: EntourageGuestRow[] = [];
  const times = heavy ? 1 : 0.25;
  for (let i = 0; i < Math.ceil(8 * times); i += 1) rows.push(person('groom_immediate_family', 'Mr.'), person('bride_immediate_family', 'Mrs.'));
  rows.push(person('maid_of_honor'), person('best_man'));
  for (let i = 0; i < Math.ceil(20 * times); i += 1) rows.push(person('principal_sponsor_ninong', 'Hon.'), person('principal_sponsor_ninang', 'Atty.'));
  for (let i = 0; i < Math.ceil(12 * times); i += 1) rows.push(person('bridesmaid'), person('groomsman'));
  rows.push(person('ring_bearer'), person('flower_girl'));
  const dishes = (k: number) => Array.from({ length: heavy ? k * 3 : k }, (_, i) => `A long-named dish of the night, number ${i + 1}, with its sauce`);
  return {
    names: { first: heavy ? 'Maria Clarissa Isabel' : 'Andrea', second: heavy ? 'Juan Indalecio Ramon' : 'Miguel' },
    eyebrow: 'The wedding of',
    dateLabel: 'Saturday · December 12, 2026',
    ceremonyTime: '3:00 PM',
    ceremonyVenue: 'Santuario de San Vicente de Paul Parish & Shrine of the Poor',
    receptionTime: '7:00 PM',
    receptionVenue: 'The Grand Ballroom, Seda Vertis North Hotel & Residences, Quezon City',
    monogram: null,
    initials: 'A & M',
    details: {
      parents: [
        { name: 'Mr. Ramon & Mrs. Teresita Dela Paz', deceased: false, side: 'groom' },
        { name: 'Dr. Eduardo & Mrs. Liza Villanueva', deceased: true, side: 'bride' },
      ],
      openingLine: 'Together with their families, and with thanksgiving to God, request the honour of your presence',
      rsvpContact: 'Kindly reply by 1 November · Bianca Torres · 0917 555 0142',
      giftLines: heavy ? ['BDO · Maria Clarissa Isabel · 0012 3456 7890', 'GCash · Juan Indalecio · 0917 555 0123', 'BPI · Joint Account · 1234 5678 90'] : ['GCash · Andrea · 0917 555 0199'],
      thankYou: heavy ? 'Your presence is the greatest gift. Should you wish to bless us further, a gift towards our first home is deeply appreciated.' : null,
      specialMessage: 'Your presence is the gift we treasure most.',
      program: heavy ? Array.from({ length: 8 }, (_, i) => `${i + 1}:00 PM · A moment of the night, number ${i + 1}`) : ['3:00 PM · Ceremony', '7:00 PM · Reception'],
      nfc: heavy,
      storyExcerpt: heavy ? 'We met at a friend’s birthday in Quezon City in 2016 and never stopped talking.' : null,
      guestNames: true,
    },
    entourage: buildEntourage(rows),
    attire: [
      { label: 'Principal sponsors', line: 'Barong Tagalog · Filipiniana in champagne' },
      { label: 'Guests', line: 'Formal — sage, gold and cream' },
    ],
    swatches: ['#6B7F5E', '#E9E4D4', '#B08D57', '#FBF8F1', '#C9A9A6'],
    hubAddress: 'setnayan.com/andrea-and-miguel',
    menu: [
      { title: 'To begin', dishes: dishes(2) },
      { title: 'The main course', dishes: dishes(4) },
      { title: 'Something sweet', dishes: dishes(3) },
    ],
    story: [
      { label: 'How we met', moments: Array.from({ length: heavy ? 8 : 1 }, (_, i) => ({ when: `June ${2016 + i}`, line: 'A borrowed umbrella outside the library, and a coffee that ran three hours — then dinner, then the jeepney home.', place: 'Quezon City' })) },
      { label: 'The yes', moments: [{ when: 'February 2025', line: 'Sunrise on the Batanes hills — he forgot the speech, she said yes anyway.', place: 'Batanes' }] },
    ],
    hasStill: true,
    hasEventQr: true,
    eventWord: 'Wedding',
  };
}

const PASSES: PrintPass[] = [
  { name: 'Ms. Bianca Torres', seat: 'Table 3', seatNumber: '4', qrRef: 'qr-1', serial: 'Nº 0012' },
  { name: 'Regional Prosecutor Benjamin Villaseñor-Castañeda', seat: 'Table 12 — Ninong & Ninang', seatNumber: '2', qrRef: 'qr-2', serial: 'Nº 0013', bringing: 'Dr. Carmen Lopez', party: 1 },
];

// ─── The looks: free, every theme's Pro, and two Hub looks ────────────────────────────────────────────────────────

const BOARD = { reception: ['#6B7F5E', '#E9E4D4', '#B08D57', '#FBF8F1', '#C9A9A6'] };
const proBase = printLooksFor('house', BOARD).pro;
const HUB_PICTURE = printLookFromHub(proBase, {
  theme: 'house',
  rolePalette: BOARD,
  vars: null,
  fonts: printHubFonts('playfair', { body: { font: 'lora' }, highlight: { font: 'manrope' } }),
  picture: { samples: ['#595607', '#484707', '#756b08', '#f8d8a1', '#282a0e'], scrim: 0.45 },
  wearsThemeLoop: true,
});
const HUB_COLOUR = printLookFromHub(proBase, {
  theme: 'house',
  rolePalette: BOARD,
  vars: buildCustomSiteColorVars('#2E3B4E', null)!,
  fonts: printHubFonts('cinzel', { body: { font: 'cormorant' }, highlight: { font: 'marcellus' } }),
  picture: null,
  wearsThemeLoop: false,
});
const LOOKS: Array<{ id: string; look: PrintLook; kind: 'line' | 'mark' }> = [
  { id: 'free', look: plainPrintLook(), kind: 'line' },
  { id: 'hub-picture', look: HUB_PICTURE, kind: 'mark' },
  { id: 'hub-colour', look: HUB_COLOUR, kind: 'mark' },
  ...INVITE_THEME_IDS.map((t) => ({ id: `pro-${t}`, look: printLooksFor(t, BOARD).pro, kind: 'mark' as const })),
];

// ─── Measuring a drawn sheet ─────────────────────────────────────────────────────────────────────────────────────

type Box = { x: number; y: number; w: number; h: number };
const meet = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const grow = (b: Box, c: number): Box => ({ x: b.x - c, y: b.y - c, w: b.w + 2 * c, h: b.h + 2 * c });

/** The brand's own ops on a sheet (its white underprint is the same ink, not a second brand). */
const brandOps = (doc: PrintDoc) =>
  doc.ops.filter((o): o is Extract<PrintOp, { t: 'path' }> => o.t === 'path' && Boolean(o.brand) && o.layer !== 'white');

function unionBox(ops: ReadonlyArray<Extract<PrintOp, { t: 'path' }>>): Box {
  const boxes = ops.map((o) => pathBounds(o.d)!).filter(Boolean);
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w));
  const y1 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Everything else the layout INKED on this sheet — measured here, independently of the stamp's own search. */
function drawnInk(doc: PrintDoc): Array<{ what: string; box: Box }> {
  const out: Array<{ what: string; box: Box }> = [];
  const first = doc.ops[0]!;
  const paper = first.t === 'rect' ? first.fill : undefined;
  for (const o of doc.ops) {
    if (o.t === 'path') {
      if (o.brand || o.layer === 'white') continue;
      const b = pathBounds(o.d);
      if (!b) continue;
      if (!o.fill) {
        // A stroked line or frame: its sides (a frame round the whole card is four hairlines, not a wall).
        if (!o.stroke) continue;
        const t = (o.sw ?? 0.5) / 2;
        for (const side of [{ x: b.x - t, y: b.y - t, w: b.w + 2 * t, h: 2 * t }, { x: b.x - t, y: b.y + b.h - t, w: b.w + 2 * t, h: 2 * t }, { x: b.x - t, y: b.y - t, w: 2 * t, h: b.h + 2 * t }, { x: b.x + b.w - t, y: b.y - t, w: 2 * t, h: b.h + 2 * t }]) {
          out.push({ what: 'a drawn line or frame', box: side });
        }
        continue;
      }
      out.push({ what: o.text ? `the words "${o.text.s.slice(0, 30)}"` : 'a mark', box: b });
    } else if (o.t === 'image') {
      if (o.ref === 'still' || o.ref === 'posterBg') continue;
      // A QR with its white plate (3 pt) — the brand may not sit on either.
      out.push({ what: o.ref === 'mark' ? 'the couple’s logo' : `the QR (${o.ref})`, box: o.ref === 'mark' ? o : grow(o, 3) });
    } else if (o.t === 'circle') {
      if (o.fill === '#ffffff' || o.fill) out.push({ what: 'a plate or spot', box: { x: o.cx - o.r, y: o.cy - o.r, w: 2 * o.r, h: 2 * o.r } });
      else if (o.stroke && !o.dash) out.push({ what: 'a ring', box: { x: o.cx - o.r, y: o.cy - o.r, w: 2 * o.r, h: 2 * o.r } });
    } else if (o.t === 'rect') {
      // Inked shapes (a QR plate, a rule, a tear line, a band of facts). Not ink: a sheet-wide ground or veil, a band of
      // the sheet's own paper spanning it (a fade, a panel, a stub), the screen's dashed guide.
      const ground = (o.w >= doc.w * 0.6 && o.h >= doc.h * 0.6) || (o.fill === paper && (o.w >= doc.w * 0.6 || o.h >= doc.h * 0.6));
      if (ground || o.dash) continue;
      if (!o.fill) {
        const t = o.sw ?? 0.5;
        if (o.stroke) for (const side of [{ x: o.x, y: o.y, w: o.w, h: t }, { x: o.x, y: o.y + o.h - t, w: o.w, h: t }, { x: o.x, y: o.y, w: t, h: o.h }, { x: o.x + o.w - t, y: o.y, w: t, h: o.h }]) out.push({ what: 'a frame', box: side });
        continue;
      }
      out.push({ what: 'a plate or rule', box: o });
    }
  }
  return out;
}

/** What is wrong with the brand on ONE piece (its sides), or nothing. */
function brandProblems(docs: PrintDoc[], kind: 'line' | 'mark', where: string, ink?: string): string[] {
  const out: string[] = [];
  const carrying = docs.map((d, i) => ({ i, doc: d, ops: brandOps(d) })).filter((s) => s.ops.length > 0);
  if (carrying.length !== 1) return [`${where}: the brand is on ${carrying.length} of ${docs.length} sides (must be exactly one)`];
  const { i, doc, ops } = carrying[0]!;
  const want = kind === 'mark' && docs.length > 1 ? docs.length - 1 : 0;
  if (i !== want) out.push(`${where}: the ${kind} is on side ${i + 1}, not ${kind === 'mark' ? 'the back' : 'the front'} (side ${want + 1})`);
  if (ops.some((o) => o.brand !== kind)) out.push(`${where}: a ${ops[0]!.brand} where the look carries a ${kind}`);
  if (kind === 'line') {
    if (ops.length !== 1) out.push(`${where}: the line is ${ops.length} lines`);
    const t = ops[0]!.text;
    if (!t || t.s !== PRINT_BRAND_WORDS.toUpperCase()) out.push(`${where}: the line says "${t?.s}"`);
    if (t && t.size < PRINT_MIN_BODY_PT) out.push(`${where}: the line is ${t.size.toFixed(2)} pt, under the ${PRINT_MIN_BODY_PT} pt floor`);
    const first = doc.ops[0]!;
    const paper = (first.t === 'rect' ? first.fill : undefined) ?? '#ffffff';
    const c = worstContrast(hexRgb(ops[0]!.fill!), 1, [hexRgb(paper)]);
    if (c < MIN_CONTRAST) out.push(`${where}: the line reads ${c.toFixed(2)} : 1 on its paper`);
  } else {
    if (ops.some((o) => o.text)) out.push(`${where}: the mark carries words`);
    if (ink && ops.some((o) => o.fill !== ink)) out.push(`${where}: the mark is not in the Hub’s ink (${ops[0]!.fill} vs ${ink})`);
    if (ops.some((o) => (o.opacity ?? 1) > 0.5)) out.push(`${where}: the mark is loud (opacity ${ops[0]!.opacity})`);
  }
  const box = unionBox(ops);
  if (!safeContainsBox(doc.die, doc.w, doc.h, box)) {
    out.push(`${where}: the ${kind} at ${box.x.toFixed(1)},${box.y.toFixed(1)} ${box.w.toFixed(1)}×${box.h.toFixed(1)} leaves the safe area of a ${doc.die} ${doc.w.toFixed(0)}×${doc.h.toFixed(0)} sheet`);
  }
  for (const o of drawnInk(doc)) if (meet(box, o.box)) out.push(`${where}: the ${kind} touches ${o.what}`);
  return out;
}

function formatsOf(piece: PrintSetKey): Array<string | null> {
  const family = formatFamilyOf(piece);
  return family ? Object.values(PRINT_FORMATS).filter((f) => f.for === family).map((f) => f.id) : [null];
}

// ─── The tests ───────────────────────────────────────────────────────────────────────────────────────────────────

test('EVERY set piece × format × look × side: the brand once, in the safe area, on nothing', () => {
  const problems: string[] = [];
  let pieces = 0;
  let backs = 0;
  const kinds = { line: 0, mark: 0 };
  for (const heavy of [false, true]) {
    const data = wedding(heavy);
    for (const { id, look, kind } of LOOKS) {
      for (const piece of PRINT_SET_KEYS) {
        for (const format of formatsOf(piece)) {
          for (const mode of ['print', 'screen'] as const) {
            for (const whiteInk of mode === 'print' && id.startsWith('hub') ? [false, true] : [false]) {
              const docs = layoutPieceDocs(piece, { look, data, mode, foil: false, format, whiteInk });
              pieces += 1;
              if (docs.length > 1) backs += 1;
              kinds[kind] += 1;
              problems.push(...brandProblems(docs, kind, `${id} · ${piece} · ${format ?? 'A3'} · ${mode}${whiteInk ? ' + white ink' : ''}${heavy ? ' · heavy' : ''}`, kind === 'mark' ? look.ink : undefined));
            }
          }
        }
      }
    }
  }
  if (process.env.BRAND_DEBUG) {
    console.log('BRAND counts', { pieces, backs, ...kinds, problems: problems.length });
    for (const p of problems) if (p.includes(process.env.BRAND_DEBUG)) console.log('BRAND', p);
  }
  assert.ok(pieces >= 1000, `only ${pieces} pieces were laid out — the sweep did not run`);
  assert.ok(backs >= 50, `only ${backs} pieces had a back — the Pro mark's "on the back" was never measured`);
  assert.ok(kinds.line >= 50 && kinds.mark >= 800, `free ${kinds.line} · pro ${kinds.mark}`);
  assert.deepEqual(problems.slice(0, 25), [], `${problems.length} problems`);
});

test('EVERY guest’s ticket — each one cut and handed over on its own — carries the brand once', () => {
  const problems: string[] = [];
  let tickets = 0;
  for (const { id, look, kind } of LOOKS) {
    for (const f of Object.values(PRINT_FORMATS).filter((x) => x.for === 'pass')) {
      for (const mode of ['print', 'screen'] as const) {
        const docs = layoutPasses({ look, data: wedding(true), mode, foil: false, format: f.id }, PASSES);
        assert.equal(docs.length, PASSES.length);
        docs.forEach((d, i) => {
          tickets += 1;
          // A pass with NFC has a back (its sticker spot): the brand is once across BOTH sides.
          problems.push(...brandProblems(d.back ? [d, d.back] : [d], kind, `${id} · ticket ${i + 1} · ${f.id} · ${mode}`, kind === 'mark' ? look.ink : undefined));
        });
      }
    }
  }
  assert.ok(tickets >= 250, `${tickets} tickets`);
  assert.deepEqual(problems.slice(0, 25), [], `${problems.length} problems`);
});

test('the plain A4 utility sheets carry the free line on EVERY page — QR sheet · guest list · seating pack · caterer · chart', () => {
  const cells = Array.from({ length: 30 }, (_, i) => ({ name: `Guest ${i + 1} Villaseñor-Castañeda`, sub: `Table ${(i % 6) + 1}`, qrRef: `qr-${i}` }));
  const rows: RegistryRow[] = Array.from({ length: 140 }, (_, i) => ({ guestId: `g${i}`, name: `Dimaculangan, Purificacion ${i}`, companions: i % 4 ? [] : ['Ben Cruz'], party: 2, table: `Table ${i % 12}`, rsvp: 'Coming', counted: true }));
  const units = Array.from({ length: 5 }, (_, u) => ({ label: `Table ${u + 1}`, joined: 1, qrRef: `t-${u}`, guests: Array.from({ length: 9 }, (_, g) => ({ name: `Guest ${u}-${g} Pangilinan`, qrRef: `g-${u}-${g}` })) }));
  const sheets: Array<[string, PrintDoc[]]> = [
    ['QR sheet (square)', layoutQrCodes('Andrea & Miguel', cells)],
    ['QR sheet (round)', layoutQrCodes('Andrea & Miguel', cells, 'circle')],
    ['guest list', layoutGuestRegistry({ title: 'Andrea & Miguel', dateLabel: 'December 12, 2026', rows })],
    ['seating pack', layoutSeatingPack({ coupleName: 'Andrea & Miguel', dateLabel: 'December 12, 2026', units, signLine: 'Scan to visit our wedding' })],
    ['one place card', layoutSeatingPack({ coupleName: 'Andrea & Miguel', dateLabel: null, units: [{ ...units[0]!, guests: units[0]!.guests.slice(0, 1) }], signLine: 'Scan to visit our wedding', cardsOnly: true })],
    ['caterer counts', layoutReport({ piece: 'caterer-report', title: 'Meal counts', sections: [{ heading: 'Table 1', columns: [{ label: 'Guest', width: 0.7 }, { label: 'Meal', width: 0.3 }], rows: rows.map((r) => ({ cells: [r.name, 'Beef'] })), empty: 'None' }] })],
  ];
  for (const layout of ['table', 'az'] as const) {
    for (const size of ['a3', 'a2'] as const) {
      const r = layoutEntranceChart({
        coupleName: 'Andrea & Miguel',
        dateLabel: 'December 12, 2026',
        layout,
        size,
        units: units.map((u) => ({ label: u.label, names: u.guests.map((g) => ({ guestId: g.qrRef, name: g.name })) })),
        entries: units.flatMap((u) => u.guests.map((g) => ({ guestId: g.qrRef, name: g.name, key: g.name, letter: g.name[0]!, table: u.label }))),
      });
      sheets.push([`entrance chart ${layout} ${size}`, [r.doc]]);
    }
  }
  const problems: string[] = [];
  let pages = 0;
  for (const [what, docs] of sheets) {
    assert.ok(docs.length > 0, `${what}: no pages`);
    docs.forEach((d, i) => {
      pages += 1;
      problems.push(...brandProblems([d], 'line', `${what} · page ${i + 1}`));
    });
  }
  assert.ok(pages >= 20, `${pages} pages`);
  assert.deepEqual(problems, []);
  // The reports' foot keeps its page count, and no longer names Setnayan a second time.
  const foot = layoutGuestRegistry({ title: 'x', rows })[0]!.ops.filter((o) => o.t === 'path' && o.text && /SETNAYAN|Setnayan/.test(o.text.s));
  assert.equal(foot.length, 1, 'a report page names Setnayan more than once');
});

test('the looks: free = the line; Pro (every theme, both Hub looks) = the mark; the door hands each its own', async () => {
  assert.equal(plainPrintLook().brand, 'line');
  for (const t of INVITE_THEME_IDS) assert.equal(printLooksFor(t, BOARD).pro.brand, 'mark', t);
  assert.equal(HUB_PICTURE.brand, 'mark');
  assert.equal(HUB_COLOUR.brand, 'mark');
  const looks = printLooksFor('house', BOARD);
  const wear = async () => ({ hub: { theme: 'house' as const, rolePalette: BOARD, vars: null, fonts: printHubFonts(null, null), picture: null, wearsThemeLoop: true }, picture: null });
  assert.equal((await printLookForEvent(looks, false, wear)).look.brand, 'line', 'a free event prints the line');
  assert.equal((await printLookForEvent(looks, true, wear)).look.brand, 'mark', 'a Pro event prints the mark');
  assert.equal((await printLookForEvent(looks, true, async () => null)).look.brand, 'mark', 'a Pro event whose Hub cannot be read still prints the mark');
  assert.equal(printLooksFor('house', BOARD, { sampleGallery: true }).free.brand, 'mark', 'a theme sample is a Pro look');
});

test('the mark is the SHIPPED artwork — the path of public/brand/setnayan-mark.svg — quiet, and only that', () => {
  const svg = readFileSync(join(WEB, 'public/brand/setnayan-mark.svg'), 'utf8');
  const d = /<path\s+d="([^"]+)"[^>]*fill="#cb9e4b"/s.exec(svg)?.[1];
  assert.ok(d, 'the brand file has its mark path');
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  assert.equal(norm(SETNAYAN_MARK_PATH), norm(d!), 'the print mark is not the shipped artwork');
  assert.ok(PRINT_BRAND_MARK_OPACITY > 0.2 && PRINT_BRAND_MARK_OPACITY <= 0.5, 'the mark is neither invisible nor loud');
  // On the piece: the mark's box is square (the artwork's own proportion) and tiny next to the sheet.
  const docs = layoutPieceDocs('invitation', { look: HUB_COLOUR, data: wedding(false), mode: 'print', foil: false, format: 'inv-5x7' });
  const box = unionBox(brandOps(docs[0]!));
  assert.ok(Math.abs(box.w / box.h - 1) < 0.02, `the mark is ${box.w.toFixed(2)} × ${box.h.toFixed(2)}`);
  assert.ok(box.w <= 12 && box.w >= 5, `the mark is ${box.w.toFixed(1)} pt`);
  // Free: the line sits ON the front's bottom edge — its ink ends within a few points of the safe line.
  const free = layoutPieceDocs('invitation', { look: plainPrintLook(), data: wedding(false), mode: 'print', foil: false, format: 'inv-5x7' })[0]!;
  const line = unionBox(brandOps(free));
  assert.ok(free.h - SAFE_PT - (line.y + line.h) < 4, `the line floats ${(free.h - SAFE_PT - (line.y + line.h)).toFixed(1)} pt above the bottom edge`);
});
