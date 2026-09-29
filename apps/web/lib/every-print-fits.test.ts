/**
 * lib/every-print-fits.test.ts — NOTHING PRINTS PAST THE SAFE LINE.
 *
 * Owner 2026-09-28, verbatim: *"make sure prints out fit properly"* — showing
 * The Entourage (5 × 7 in, deckle cut) for cale-ice, whose Bride's Crew &
 * Groom's Crew ran off the foot of the card past the safe line. The old fit
 * ESTIMATED the height (rows × leading + groups × gap), floored the type at
 * 5 pt, and drew anyway. Nothing measured the card that was drawn.
 *
 * This file measures it. Every piece × every format × every theme is laid out
 * with a HEAVY wedding — cale-ice's real SHAPE (≈ 90 entourage across the
 * groups, 21 Ninong + 17 Ninang, 12 + 12 crew, titled names over 30
 * characters, a long church name, a full program) with INVENTED names; no guest
 * of any real event is copied here — and then every inked op's bounds are
 * checked against the SAFE AREA OF THAT SHEET'S OWN DIE CUT (an arch or a
 * chevron cuts the top corners away; a scallop or a deckle eats the edge), and
 * no text may touch a QR's white plate.
 *
 * Exempt, on purpose, because they are MEANT to run to the edge: the paper,
 * the theme's still and its veil/fade (all drawn into the bleed), and the
 * on-screen dashed safe guide itself.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { INVITE_THEME_IDS } from './invite-themes';
import { buildEntourage, peopleOf, type EntourageGuestRow } from './entourage';
import { PRINT_FORMATS, PRINT_SET_KEYS, formatFamilyOf, printLookFor, type PrintSetKey } from './print-pieces';
import {
  CORNER_QR_PT,
  PRINT_MIN_BODY_PT,
  layoutPieceDocs,
  printedEntourageLines,
  safeContainsBox,
  type PrintDoc,
  type PrintOp,
  type PrintSetData,
} from './print-layout';
import { flattenSvgMark } from './print-mark';

const WEB = join(__dirname, '..');

// ─── The heavy wedding (invented names, real shapes) ────────────────────────

const TITLES = ['Regional Prosecutor', 'Hon.', 'Atty.', 'Engr.', 'Dr.', 'Col.', 'Judge', 'Arch.', 'Gov.', 'Rev. Fr.'];
const FIRST = ['Teodoro', 'Evangelina', 'Marcelino', 'Rosalinda', 'Bienvenido', 'Concepcion', 'Wenceslao', 'Purificacion', 'Florencio', 'Maximiliana', 'Crisostomo', 'Remedios'];
const LAST = ['Villaseñor-Castañeda', 'Dimaculangan', 'Macapagal-Arroyo', 'Pangilinan', 'Buenaventura', 'Sumulong', 'Katigbak', 'Evangelista-Ocampo'];

let serial = 0;
function person(role: string, opts: { titled?: boolean; pair?: string | null; id?: string } = {}): EntourageGuestRow {
  serial += 1;
  const i = serial;
  return {
    guest_id: opts.id ?? `g-${i}`,
    pair_with_guest_id: opts.pair ?? null,
    name_prefix: opts.titled ? TITLES[i % TITLES.length]! : null,
    first_name: FIRST[i % FIRST.length]!,
    middle_name: `${String.fromCharCode(65 + (i % 26))}.`,
    last_name: LAST[i % LAST.length]!,
    name_suffix: i % 7 === 0 ? 'Jr.' : null,
    role,
  };
}

/** cale-ice's shape: Ninong/Ninang, 12 + 12 crew, family, honour, secondary, bearers, flower girls. */
function heavyGuests(paired: boolean): EntourageGuestRow[] {
  const rows: EntourageGuestRow[] = [];
  for (let i = 0; i < 8; i += 1) rows.push(person('groom_immediate_family', { titled: i % 3 === 0 }));
  for (let i = 0; i < 9; i += 1) rows.push(person('bride_immediate_family', { titled: i % 3 === 1 }));
  rows.push(person('maid_of_honor', { id: 'moh', pair: 'bm' }), person('best_man', { id: 'bm', pair: 'moh' }));
  // 21 Ninong + 17 Ninang — paired where the couple paired them.
  for (let i = 0; i < 21; i += 1) {
    const pairId = paired && i < 17 ? `nang-${i}` : null;
    rows.push(person('principal_sponsor_ninong', { titled: true, id: `nong-${i}`, pair: pairId }));
  }
  for (let i = 0; i < 17; i += 1) {
    rows.push(person('principal_sponsor_ninang', { titled: i % 2 === 0, id: `nang-${i}`, pair: paired ? `nong-${i}` : null }));
  }
  for (const r of ['candle_sponsor', 'candle_sponsor', 'veil_sponsor', 'veil_sponsor', 'cord_sponsor', 'cord_sponsor']) rows.push(person(r));
  for (let i = 0; i < 12; i += 1) rows.push(person('bridesmaid'));
  for (let i = 0; i < 12; i += 1) rows.push(person('groomsman'));
  for (const r of ['ring_bearer', 'bible_bearer', 'coin_bearer']) rows.push(person(r));
  for (let i = 0; i < 3; i += 1) rows.push(person('flower_girl'));
  return rows;
}

/** A studio-style logo: nested groups, a translate/scale/translate chain, evenodd letters. */
const STUDIO_LOGO =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" data-logo="layers">' +
  '<g data-logo-layer="a" transform="translate(500 500) scale(0.48828) translate(-1024 -1024)"><g><g>' +
  '<path d="M600 600H1400V1400H600Z M800 800V1200H1200V800Z" fill="rgb(2,2,2)" fill-rule="evenodd"/>' +
  '<path d="M900 300a100 100 0 1 0 200 0a100 100 0 1 0 -200 0z" fill="#1E2229"/>' +
  '</g></g></g></svg>';

/**
 * A LONG LOVE STORY — every chapter, twenty-eight moments, lines near the
 * 600-character cap, places, and a moment with no date (invented words).
 */
const LONG_LINE =
  'We were both late to the same friend’s birthday in Quezon City, both blamed the traffic on EDSA, and both ended up on the balcony because the music inside was too loud. We argued about whether the best lechon is in Cebu or in La Loma, and neither of us has ever admitted defeat. He walked me to the jeepney stop and missed his own ride.';
function heavyStory(): NonNullable<PrintSetData['story']> {
  const chapter = (label: string, n: number, year: number) => ({
    label,
    moments: Array.from({ length: n }, (_, i) => ({
      when: i === 2 ? '' : i % 2 ? `${i + 1} February ${year + i}` : String(year + i),
      line: i % 3 === 0 ? LONG_LINE : `The ${label.toLowerCase()} part of our story, moment ${i + 1} — the rooftop in Makati, a rainy Sunday, the dog we still argue about.`,
      place: i % 2 ? 'Tagaytay Highlands, Cavite' : null,
    })),
  });
  return [chapter('Before us', 4, 2004), chapter('How we met', 3, 2016), chapter('Falling', 12, 2017), chapter('The yes', 3, 2024), chapter('Toward the day', 6, 2025)];
}

function heavy(paired: boolean): PrintSetData {
  const mark = flattenSvgMark(STUDIO_LOGO);
  assert.ok(mark, 'the studio-style logo flattens');
  return {
    names: { first: 'Maria Clarissa Isabel', second: 'Juan Indalecio Ramon' },
    eyebrow: 'The wedding of',
    dateLabel: 'Wednesday · December 18, 2026',
    ceremonyTime: '3:00 PM',
    ceremonyVenue: 'Santuario de San Vicente de Paul Parish & Shrine of the Poor',
    receptionTime: '7:00 PM',
    receptionVenue: 'The Grand Ballroom, Seda Vertis North Hotel & Residences, Quezon City',
    monogram: { kind: 'outline', ...mark },
    initials: 'M & J',
    details: {
      parents: [
        { name: 'Regional Prosecutor Serafino T. Villaseñor-Castañeda', side: 'groom', deceased: false },
        { name: 'Atty. Purificacion M. Villaseñor-Castañeda', side: 'groom', deceased: true },
        { name: 'Engr. Bienvenido L. Dimaculangan Jr.', side: 'bride', deceased: false },
        { name: 'Dr. Concepcion R. Dimaculangan', side: 'bride', deceased: false },
      ],
      openingLine: 'Together with their families, and with thanksgiving to God and the blessing of our parents, request the honour of your presence',
      rsvpContact: 'Florencio Buenaventura (Coordinator) · 0917 555 0123 · florencio.buenaventura@example.com',
      giftLines: [
        'BDO · Maria Clarissa Isabel Villaseñor · 0012 3456 7890',
        'GCash · Juan Indalecio Ramon Dimaculangan · 0917 555 0123',
        'BPI · Villaseñor-Dimaculangan Joint Account · 1234 5678 90',
        'Maya · Maria Clarissa Isabel · 0918 555 9876',
      ],
      thankYou: 'Your presence is the greatest gift. Should you wish to bless us further, a monetary gift towards our first home would be deeply appreciated.',
      specialMessage: 'We cannot wait to celebrate with you. Please come in your finest and bring your dancing shoes — the night is long and the music is good.',
      program: [
        '1:30 PM · Guests arrive and are seated',
        '3:00 PM · The Holy Mass and Rite of Marriage',
        '4:30 PM · Photographs with the families and the entourage',
        '5:00 PM · Cocktail hour at the garden terrace',
        '7:00 PM · Reception, dinner and the program',
        '8:30 PM · First dance, money dance and toasts',
        '9:30 PM · Dancing and open floor',
        '10:30 PM · Send-off',
      ],
      nfc: true,
      storyExcerpt: 'We met at a friend’s birthday in Quezon City in 2016, argued about the best lechon in Cebu, and never stopped talking. Eight years later, he asked on the same rooftop.',
      guestNames: true,
    },
    entourage: buildEntourage(heavyGuests(paired)),
    attire: [
      { label: 'Principal Sponsors', line: 'Filipiniana, champagne or ivory, no white' },
      { label: 'Bride’s Crew', line: 'Floor-length gown in dusty rose' },
      { label: 'Groom’s Crew', line: 'Barong Tagalog in piña with black trousers' },
      { label: 'Guests', line: 'Formal attire in earth tones; please avoid white and red' },
      { label: 'Parents of the Bride', line: 'Terno in gold, barong in piña' },
      { label: 'Parents of the Groom', line: 'Terno in sage, barong in jusi' },
      { label: 'Flower Girls', line: 'White dress with a sage sash' },
    ],
    swatches: ['#c9a27e', '#e8d9c4', '#7d8b6a', '#b7625a', '#3a3a3a', '#f4efe6'],
    hubAddress: 'setnayan.com/maria-clarissa-and-juan-indalecio-2026',
    // A long buffet night, by moment — long dish names on purpose.
    menu: [
      { title: 'After the ceremony', dishes: ['Chilled calamansi and dalandan juice', 'Kutsinta, puto and sapin-sapin', 'Assorted local pastries from Pampanga'] },
      { title: 'Cocktail hour at the garden terrace', dishes: ['Tuna kinilaw in coconut vinegar with ginger and red onion', 'Chicken inasal skewers with atchara', 'Lumpiang shanghai with sweet chili sauce', 'Cheese and charcuterie board with local kesong puti', 'Mango and bagoong crostini'] },
      { title: 'The buffet', dishes: ['Whole Cebu lechon with liver sauce and spiced vinegar', 'Beef kare-kare with bagoong and steamed vegetables', 'Crispy pata with soy-calamansi dip', 'Chicken galantina with pickled vegetables', 'Pancit canton with shrimp and quail eggs', 'Grilled blue marlin with mango salsa', 'Garlic fried rice and steamed jasmine rice', 'Laing, pinakbet and ensaladang talong', 'Bulalo broth with corn and pechay'] },
      { title: 'Dessert', dishes: ['Three-tier ube and macapuno wedding cake', 'Leche flan, buko pandan and mango float', 'Halo-halo station with all the toppings', 'Sans rival and silvanas'] },
      { title: 'Midnight snack', dishes: ['Arroz caldo with chicken and toasted garlic', 'Taho and turon'] },
    ],
    story: heavyStory(),
    hasStill: true,
    hasEventQr: true,
  };
}

// ─── Geometry ───────────────────────────────────────────────────────────────

type Box = { x: number; y: number; w: number; h: number };

/** Bounds of absolute path data (M L H V Q C A Z — what every layout emits). */
function pathBounds(d: string): Box | null {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = (x: number, y: number) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };
  let cmd = '';
  let buf: number[] = [];
  let cx = 0;
  let cy = 0;
  const flush = () => {
    const C = cmd.toUpperCase();
    if (C === 'A') {
      for (let i = 0; i + 6 < buf.length; i += 7) {
        const r = Math.max(buf[i]!, buf[i + 1]!);
        add(cx - r, cy - r);
        add(cx + r, cy + r);
        cx = buf[i + 5]!;
        cy = buf[i + 6]!;
        add(cx, cy);
      }
    } else if (C === 'H') for (const v of buf) add((cx = v), cy);
    else if (C === 'V') for (const v of buf) add(cx, (cy = v));
    else
      for (let i = 0; i + 1 < buf.length; i += 2) {
        add(buf[i]!, buf[i + 1]!);
        cx = buf[i]!;
        cy = buf[i + 1]!;
      }
    buf = [];
  };
  for (const t of tokens) {
    if (/^[a-zA-Z]$/.test(t)) {
      flush();
      cmd = t;
    } else buf.push(Number(t));
  }
  flush();
  return Number.isFinite(minX) ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : null;
}

function opBox(o: PrintOp): Box | null {
  if (o.t === 'rect' || o.t === 'image') return { x: o.x, y: o.y, w: o.w, h: o.h };
  if (o.t === 'circle') return { x: o.cx - o.r, y: o.cy - o.r, w: o.r * 2, h: o.r * 2 };
  return pathBounds(o.d);
}

/** Meant to run to the edge: the paper, the still + its veil/fade, the screen-only safe guide. */
function isBackground(doc: PrintDoc, o: PrintOp): boolean {
  if (o.t === 'image') return o.ref === 'still';
  if (o.t === 'rect') {
    if (o.dash) return true;
    return o.x <= 0.01 || o.y <= 0.01 || o.x + o.w >= doc.w - 0.01 || o.y + o.h >= doc.h - 0.01;
  }
  return false;
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function formatsOf(piece: PrintSetKey): Array<string | null> {
  const family = formatFamilyOf(piece);
  return family ? Object.values(PRINT_FORMATS).filter((f) => f.for === family).map((f) => f.id) : [null];
}

function problemsIn(doc: PrintDoc, where: string): string[] {
  const out: string[] = [];
  const qrPlates = doc.ops
    .filter((o): o is Extract<PrintOp, { t: 'image' }> => o.t === 'image' && (o.ref === 'eventqr' || o.ref.startsWith('qr-')))
    .map((o) => ({ x: o.x - 3, y: o.y - 3, w: o.w + 6, h: o.h + 6 }));
  for (const o of doc.ops) {
    if (isBackground(doc, o)) continue;
    const b = opBox(o);
    if (!b) continue;
    if (!safeContainsBox(doc.die, doc.w, doc.h, b)) {
      out.push(`${where}: ${o.t}${o.t === 'image' ? `(${o.ref})` : ''} at ${b.x.toFixed(1)},${b.y.toFixed(1)} ${b.w.toFixed(1)}×${b.h.toFixed(1)} leaves the safe area of a ${doc.die} ${doc.w.toFixed(0)}×${doc.h.toFixed(0)} sheet`);
    }
    if (o.t === 'path' && o.fill) {
      for (const q of qrPlates) if (overlaps(b, q)) out.push(`${where}: text/mark at ${b.x.toFixed(1)},${b.y.toFixed(1)} touches a QR`);
    }
  }
  return out;
}

// ─── The tests ──────────────────────────────────────────────────────────────

test('EVERY piece × EVERY format × EVERY theme: nothing inked leaves the safe area, nothing touches a QR', () => {
  const problems: string[] = [];
  let sheets = 0;
  for (const paired of [true, false]) {
    const data = heavy(paired);
    for (const theme of INVITE_THEME_IDS) {
      const look = printLookFor(theme);
      for (const piece of PRINT_SET_KEYS) {
        for (const format of formatsOf(piece)) {
          for (const mode of ['print', 'screen'] as const) {
            const docs = layoutPieceDocs(piece, { look, data, mode, foil: false, format });
            docs.forEach((doc, i) => {
              sheets += 1;
              problems.push(...problemsIn(doc, `${theme} · ${piece} · ${format ?? 'A3'} · ${mode} · side ${i + 1}${paired ? '' : ' (unpaired)'}`));
            });
          }
        }
      }
    }
  }
  assert.ok(sheets >= 400, `only ${sheets} sheets were laid out — the sweep did not run`);
  // FIT_DEBUG=<substring> prints every matching problem (e.g. "cinderella · details").
  if (process.env.FIT_DEBUG) for (const p of problems) if (p.includes(process.env.FIT_DEBUG)) console.log('FIT', p);
  // Grouped by piece · format so a failure names WHICH card, then a sample of the ops.
  const byCard = new Map<string, number>();
  for (const p of problems) {
    const [, piece, format] = p.split(' · ');
    const k = `${piece} · ${format}`;
    byCard.set(k, (byCard.get(k) ?? 0) + 1);
  }
  assert.deepEqual(
    problems.slice(0, 25),
    [],
    `${problems.length} ops leave the safe area or touch a QR — by card: ${[...byCard].map(([k, n]) => `${k}: ${n}`).join(' | ')}`,
  );
});

test('the Entourage prints EVERY name — cale-ice-sized, on the fewest sides, never below the floor', () => {
  for (const paired of [true, false]) {
    const data = heavy(paired);
    const people = data.entourage.flatMap(peopleOf);
    assert.ok(people.length >= 85, `the fixture is cale-ice sized (${people.length})`);
    // Every person is on a printed line, once — straight or flowed.
    for (const flow of [false, true]) {
      const printed = data.entourage.flatMap((g) => printedEntourageLines(g, flow).flatMap((l) => [l.l, l.r, l.c])).filter(Boolean);
      assert.equal(printed.length, people.length, `flow=${flow}: ${printed.length} lines for ${people.length} people`);
    }
    const look = printLookFor('abaca'); // the owner's card: 5 × 7, deckle cut
    const docs = layoutPieceDocs('entourage', { look, data, mode: 'print', foil: false, format: 'inv-5x7' });
    assert.ok(docs.length >= 1 && docs.length <= 2, `${docs.length} sides for one wedding`);
    // One ink path per printed line, at least one per person (a long name may wrap to two).
    const inked = docs.reduce((a, d) => a + d.ops.filter((o) => o.t === 'path' && o.fill === look.ink).length, 0);
    assert.ok(inked >= people.length, `${inked} name lines drawn for ${people.length} people — somebody was dropped`);
  }
  assert.equal(PRINT_MIN_BODY_PT, 6);
});

test('the Bride’s Crew & Groom’s Crew end TOGETHER — unpaired halves stack side by side', () => {
  const groups = buildEntourage(heavyGuests(false));
  const crew = groups.find((g) => g.key === 'bridesmaids_groomsmen')!;
  const lines = printedEntourageLines(crew, false);
  assert.equal(lines.length, 12, 'twelve and twelve make twelve lines, not twenty-four');
  assert.ok(lines.every((l) => l.l && l.r), 'every line carries a bridesmaid on the left and a groomsman on the right');
  // A real pair keeps its line.
  const sponsors = buildEntourage(heavyGuests(true)).find((g) => g.key === 'principal_sponsors')!;
  const sl = printedEntourageLines(sponsors, false);
  assert.equal(sl.length, 17 + 2, '17 real pairs, then the 4 unpaired Ninong flowed two by two');
});

test('the corner QR never sits where the die cuts the card away', () => {
  for (const theme of INVITE_THEME_IDS) {
    const doc = layoutPieceDocs('invitation', { look: printLookFor(theme), data: heavy(true), mode: 'print', foil: false })[0]!;
    const qr = doc.ops.find((o) => o.t === 'image' && o.ref === 'eventqr');
    assert.ok(qr && qr.t === 'image' && Math.abs(qr.w - CORNER_QR_PT * (doc.w / 360)) < 1, `${theme}: the corner QR is drawn at its size`);
  }
});

test('the couple’s LOGO prints — a studio logo’s transforms are baked, its holes stay holes', () => {
  const mark = flattenSvgMark(STUDIO_LOGO)!;
  assert.equal(mark.parts.length, 2);
  assert.ok(mark.parts[0]!.evenOdd, 'the letter keeps fill-rule evenodd');
  assert.equal(mark.parts[0]!.fill, '#020202', 'rgb() is normalised for the PDF backend');
  // translate(500 500) scale(0.48828) translate(-1024 -1024): (600,600) → 500 + (600-1024)·0.48828.
  assert.ok(Math.abs(mark.bounds.x - (500 + (600 - 1024) * 0.48828)) < 0.01, `baked x = ${mark.bounds.x}`);
  assert.equal(flattenSvgMark('<svg viewBox="0 0 10 10"><text>Hi</text></svg>'), null, 'text cannot be outlined — initials instead');
  const doc = layoutPieceDocs('entourage', { look: printLookFor('house'), data: heavy(true), mode: 'print', foil: false })[0]!;
  assert.ok(doc.ops.some((o) => o.t === 'path' && o.evenOdd), 'the crest draws the logo, not the initials ring');
  // The print reads the mark through THE hero resolver, never the columns.
  const loader = stripComments(readFileSync(join(WEB, 'lib/print-set.server.ts'), 'utf8'));
  assert.match(loader, /heroMarkSvg\(event\)/, 'the print asks the ONE hero logo call (lib/hero-monogram-data.ts)');
  assert.doesNotMatch(loader, /monogram_custom_svg\s*\)|resolveEventMonogramSvg\(/, 'no second resolver for the print');
});

test('GUARD: the route prints every SIDE — nothing that serves a piece keeps only its front', () => {
  const route = stripComments(readFileSync(join(WEB, 'app/api/hub-print/[piece]/route.ts'), 'utf8'));
  assert.doesNotMatch(route, /\blayoutPiece\(/, 'layoutPiece() is the front only — the route must use layoutPieceDocs / layoutPieceView');
  assert.match(route, /flatMap\(\(k\) => layoutPieceDocs\(/, 'the print-ready PDF carries every side');
});

// ─── The Menu ───────────────────────────────────────────────────────────────

test('the Menu prints every dish of a long night — on the fewest sides, never blank', () => {
  const data = heavy(true);
  const dishes = (data.menu ?? []).reduce((a, m) => a + m.dishes.length, 0);
  for (const theme of INVITE_THEME_IDS) {
    const look = printLookFor(theme);
    const docs = layoutPieceDocs('menu', { look, data, mode: 'print', foil: false, format: 'inv-5x7' });
    const inked = docs.reduce((a, d) => a + d.ops.filter((o) => o.t === 'path' && o.fill === look.ink).length, 0);
    assert.ok(inked >= dishes, `${theme}: ${inked} dish lines drawn for ${dishes} dishes`);
    assert.ok(docs.length <= 2, `${theme}: the menu took ${docs.length} sides`);
  }
  // No dishes → one side carrying only the "add your menu" prompt (the Maker's picture of it).
  const empty = layoutPieceDocs('menu', { look: printLookFor('house'), data: { ...data, menu: [{ title: 'Cocktail hour', dishes: [] }] }, mode: 'screen', foil: false });
  assert.equal(empty.length, 1);
  assert.ok(!empty[0]!.ops.some((o) => o.t === 'path' && o.fill === printLookFor('house').ink), 'an empty menu draws no dish ink');
});

test('the menu is stored as the couple typed it — capped, blanks dropped — and moments start from the schedule', async () => {
  const { parseMenu, parsePrintDetails, serializePrintDetails, foodMoments, MENU_MAX_MOMENTS, MENU_MAX_DISHES } = await import('./print-pieces');
  const many = Array.from({ length: 20 }, (_, i) => ({ title: `  Moment   ${i} `, dishes: [...Array.from({ length: 30 }, (_, j) => `Dish ${j}`), '', '   ', 7] }));
  const parsed = parseMenu(many);
  assert.equal(parsed.length, MENU_MAX_MOMENTS);
  assert.equal(parsed[0]!.title, 'Moment 0');
  assert.equal(parsed[0]!.dishes.length, MENU_MAX_DISHES);
  assert.deepEqual(parseMenu([{ title: '', dishes: [] }, 'junk', null]), [], 'nothing at all is not a moment');
  assert.deepEqual(parseMenu({ not: 'an array' }), []);
  // Round trip through the stored shape keeps it, next to the words.
  const stored = parsePrintDetails({ opening_line: 'Hello', menu: [{ title: 'Dessert', dishes: ['Leche flan'] }] });
  assert.deepEqual(parsePrintDetails(serializePrintDetails(stored)).menu, [{ title: 'Dessert', dishes: ['Leche flan'] }]);
  // The schedule's food moments, in time order, from its own labels.
  const blocks = [
    { label: 'Ceremony', block_type: 'ceremony', start_at: '2026-12-18T15:00:00+00:00', parent_block_id: null },
    { label: 'Reception & dinner', block_type: 'reception', start_at: '2026-12-18T19:00:00+00:00', parent_block_id: null },
    { label: 'Cocktail hour', block_type: 'cocktails', start_at: '2026-12-18T17:00:00+00:00', parent_block_id: null },
    { label: 'Merienda for the crew', block_type: 'custom', start_at: '2026-12-18T10:00:00+00:00', parent_block_id: null },
    { label: 'Toast', block_type: 'custom', start_at: '2026-12-18T20:00:00+00:00', parent_block_id: 'x' },
  ];
  assert.deepEqual(foodMoments(blocks), ['Merienda for the crew', 'Cocktail hour', 'Reception & dinner']);
});

test('GUARD: the menu is never printed blank, and a Details save never erases it', () => {
  const route = stripComments(readFileSync(join(WEB, 'app/api/hub-print/[piece]/route.ts'), 'utf8'));
  assert.match(route, /piece === 'menu' && !hasMenu\)[\s\S]{0,40}status: 409|piece === 'menu' && !hasMenu\) \{\s*return new NextResponse\([^)]*\{ status: 409 \}/, 'an empty menu is refused as a print');
  assert.match(route, /PRINT_SET_KEYS\.filter\(\(k\) => k !== 'menu' \|\| hasMenu\)/, 'the whole set leaves an empty menu out');
  assert.match(route, /menu: stored\.menu \}/, 'the Details (words) save carries the stored menu over');
  assert.match(route, /if \(!current\) \{[\s\S]{0,160}return NextResponse\.redirect/, 'an unreadable print_details is never overwritten blind');
  const maker = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/launch/_components/maker-prints.tsx'), 'utf8'));
  assert.match(maker, /\{menuEmpty(?: \|\| storyMissing)? \? null : \(/, 'the Maker offers no download for an empty menu');
  assert.match(maker, /href="#print-menu"/);
  const editor = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/launch/_components/print-menu-editor.tsx'), 'utf8'));
  assert.match(editor, /id="print-menu"/, 'the "Add your menu" link has somewhere to land');
});

test('every choice on the prints is ONE dropdown — the shared PickMenu, never a row of pills', () => {
  const maker = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/launch/_components/maker-prints.tsx'), 'utf8'));
  // The size is one dropdown. (The "Preview in <theme>" dropdown left with the fold, 2026-09-28:
  // themes are looked at in the Details theme gallery — one theme picker in the Maker.)
  assert.equal((maker.match(/<PrintChoicePicker\b/g) ?? []).length, 1, 'the size is one dropdown');
  assert.doesNotMatch(maker, /formatsFor\(fam\)\.map\(\(f\) => \(\s*<Link/, 'no pill row of sizes');
  assert.doesNotMatch(maker, /HUB_THEMES\.filter\(\(x\) => x\.ready\)\.map\(\(x\) => \(\s*<Link/, 'no pill row of themes');
  const picker = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/launch/_components/print-choice-picker.tsx'), 'utf8'));
  assert.match(picker, /import \{ PickMenu[^}]*\} from '@\/app\/dashboard\/\[eventId\]\/website\/editor\/_components\/pick-menu'/, 'the Maker\'s own PickMenu');
});

// ─── The Our Story poster ───────────────────────────────────────────────────

/** Where an op's ink sits across the sheet — its horizontal centre. */
const midX = (o: PrintOp) => {
  const b = opBox(o);
  return b ? b.x + b.w / 2 : NaN;
};

test('the Our Story poster reads the ONE Love Story source — chapters in order, hidden moments left out', async () => {
  const { printStoryChapters } = await import('./love-story-moments');
  // Words written at onboarding, before any moment was saved — the seed.
  const seeded = printStoryChapters({ how_we_met: 'At a friend’s birthday.', met_year: '2016', proposal: 'On the same rooftop.', proposal_year: 2024, proposal_setting: 'Makati' });
  assert.deepEqual(seeded, [
    { label: 'How we met', moments: [{ when: '2016', line: 'At a friend’s birthday.', place: null }] },
    { label: 'The yes', moments: [{ when: '2024', line: 'On the same rooftop.', place: 'Makati' }] },
  ]);
  // Saved moments: a hidden one and a photo-only one print nothing; the rest group by chapter in reading order.
  const saved = printStoryChapters({
    moments: [
      { id: 'yes', anchor: 'yes', date: { y: 2024, m: 2, d: 14 }, line: 'He asked.', canvas: {} },
      { id: 'met', anchor: 'met', date: { y: 2016 }, line: 'We met.', canvas: {} },
      { id: 'trip', date: { y: 2019 }, line: 'Our first trip.', place: 'Siargao', canvas: {} },
      { id: 'secret', date: { y: 2020 }, line: 'Kept off the hub.', hidden: true, canvas: {} },
      { id: 'photo', date: { y: 2021 }, line: '', media: ['r2://setnayan-media/a.jpg'], canvas: {} },
      { id: 'kid', date: { y: 2005 }, line: 'Same barangay, never met.', canvas: {} },
    ],
  });
  assert.deepEqual(saved.map((c) => c.label), ['Before us', 'How we met', 'Falling', 'The yes']);
  assert.deepEqual(saved.flatMap((c) => c.moments.map((m) => m.line)), ['Same barangay, never met.', 'We met.', 'Our first trip.', 'He asked.']);
  assert.equal(saved[3]!.moments[0]!.when, '14 February 2024');
  assert.deepEqual(printStoryChapters(null), []);
});

test('the Our Story poster prints EVERY moment — one column when short, two when long, never blank', () => {
  const base = heavy(true);
  const look = printLookFor('house');
  const draw = (story: PrintSetData['story']) => layoutPieceDocs('story-poster', { look, data: { ...base, story }, mode: 'print', foil: false });
  const inked = (docs: PrintDoc[]) => docs.flatMap((d) => d.ops.filter((o) => o.t === 'path' && o.fill === look.ink));

  // Short: one sheet, one centred column.
  const short = [{ label: 'How we met', moments: [{ when: '2016', line: 'We met at a friend’s birthday.', place: 'Quezon City' }] }, { label: 'The yes', moments: [{ when: '2024', line: 'He asked on the same rooftop.', place: null }] }];
  const one = draw(short);
  assert.equal(one.length, 1, 'a short story is one sheet');
  const cx = one[0]!.w / 2;
  const lines = inked(one).filter((o) => (opBox(o)?.y ?? 0) > one[0]!.h * 0.3);
  assert.ok(lines.length >= 2, `${lines.length} story lines drawn for 2 moments`);
  assert.ok(lines.every((o) => Math.abs(midX(o) - cx) < 2), 'one column, centred on the sheet');

  // Long: every moment drawn, in two columns.
  const story = heavyStory();
  const moments = story.reduce((a, c) => a + c.moments.length, 0);
  const docs = draw(story);
  const body = inked(docs).filter((o) => (opBox(o)?.y ?? 0) > docs[0]!.h * 0.3);
  assert.ok(body.length >= moments, `${body.length} ink lines for ${moments} moments — a moment was dropped`);
  assert.ok(body.some((o) => midX(o) < cx - 80) && body.some((o) => midX(o) > cx + 80), 'a long story sits in two columns');
  assert.ok(docs.length <= 2, `${docs.length} sheets for a 28-moment story`);

  // Sixty long moments: further sheets, every one printed, nothing past the safe
  // line — in a theme of each still placement (none · top band · left · full).
  const huge = [{ label: 'Falling', moments: Array.from({ length: 60 }, (_, i) => ({ when: String(2000 + (i % 25)), line: LONG_LINE, place: i % 4 ? null : 'Baguio' })) }];
  const problems: string[] = [];
  for (const theme of ['house', 'abaca', 'galeriya', 'velvet'] as const) {
    const l = printLookFor(theme);
    const sides = layoutPieceDocs('story-poster', { look: l, data: { ...base, story: huge }, mode: 'print', foil: false });
    assert.ok(sides.length >= 2, `${theme}: sixty long moments fit ${sides.length} sheet — the type went below the floor`);
    sides.forEach((d, i) => problems.push(...problemsIn(d, `${theme} · story-poster · huge · side ${i + 1}`)));
    const drawn = sides.flatMap((d) => d.ops.filter((o) => o.t === 'path' && o.fill === l.ink)).length;
    assert.ok(drawn >= 60 * 3, `${theme}: ${drawn} ink lines for 60 moments of ~3 lines each`);
  }
  assert.deepEqual(problems.slice(0, 10), [], `${problems.length} ops leave the safe area or touch a QR`);

  // No story: one sheet with the prompt, no story ink — and the QR, as on every card.
  const empty = draw([]);
  assert.equal(empty.length, 1);
  assert.ok(!inked(empty).some((o) => (opBox(o)?.y ?? 0) > empty[0]!.h * 0.45), 'an empty poster draws no story ink');
  assert.ok(empty[0]!.ops.some((o) => o.t === 'image' && o.ref === 'eventqr'), 'the QR is always printed');
});

test('the Our Story poster is A3, prints free in the free themes, and is Pro-only in a Pro theme', async () => {
  const { PRINT_PIECES, mayServe, printAccess, dieCutFor } = await import('./print-pieces');
  const spec = PRINT_PIECES['story-poster'];
  assert.deepEqual([Math.round(spec.widthPt / (72 / 25.4)), Math.round(spec.heightPt / (72 / 25.4))], [297, 420]);
  assert.equal(spec.kind, 'set', 'a themed piece — never the always-free group');
  assert.ok((PRINT_SET_KEYS as readonly string[]).includes('story-poster'), 'listed in the invitation set (the Details navigator reads this list)');
  assert.equal(dieCutFor('cinderella', 'story-poster'), 'rect', 'a poster is cut straight');
  const free = printAccess({ ownsPro: false, storeShell: false });
  const pro = printAccess({ ownsPro: true, storeShell: false });
  for (const t of ['house', 'galeriya', 'cyber'] as const) assert.equal(mayServe('story-poster', 'print', free, t), true, `${t} is a free theme`);
  assert.equal(mayServe('story-poster', 'print', free, 'velvet'), false, 'a Pro theme needs Pro');
  assert.equal(mayServe('story-poster', 'sample', free, 'velvet'), true, 'but its sample is for everyone');
  assert.equal(mayServe('story-poster', 'print', pro, 'velvet'), true);
});

test('GUARD: the Our Story poster is never printed blank', () => {
  const route = stripComments(readFileSync(join(WEB, 'app/api/hub-print/[piece]/route.ts'), 'utf8'));
  assert.match(route, /if \(!wantsSet && piece === 'story-poster' && !hasStory\) \{\s*return new NextResponse\([^)]*\{ status: 409 \}/, 'an empty story poster is refused as a print');
  assert.match(route, /\.filter\(\(k\) => k !== 'story-poster' \|\| hasStory\)/, 'the whole set leaves it out');
  assert.match(route, /\.filter\(\(k\) => k !== 'story-poster' \|\| storyHasMoments\(set\.data\.story\)\)/, 'the sample sheet leaves it out');
  const loader = stripComments(readFileSync(join(WEB, 'lib/print-set.server.ts'), 'utf8'));
  assert.match(loader, /story: printStoryChapters\(event\.love_story\)/, 'the poster reads the Love Story through its one source');
  const maker = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/launch/_components/maker-prints.tsx'), 'utf8'));
  assert.match(maker, /\{menuEmpty \|\| storyMissing \? null : \(/, 'the Maker offers no download for an empty story poster');
  const page = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/launch/page.tsx'), 'utf8'));
  assert.match(page, /storyEmpty=\{!storyHasMoments\(printStoryChapters\(printEvent\.love_story\)\)\}/, 'the Maker asks the same read the print draws');
});
