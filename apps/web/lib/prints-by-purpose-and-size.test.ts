/**
 * 🖨 PRINTS BY PURPOSE AND SIZE (owner 2026-11-06, "Yes ship it" · DECISION_LOG "PRINTS BY PURPOSE AND SIZE").
 *
 * Holds what the ruling promised:
 *   · each piece carries the blocks its purpose names (`PRINT_PURPOSE`) — and no other;
 *   · a missing fact drops its block — never a zero, never an empty box;
 *   · the ONE `On your prints ▾` switch takes a block off EVERY piece (the picture and the Save file both);
 *   · one fact, one place: where the stars line is drawn, no rating pill; where "since" is drawn, no years pill;
 *   · 🔒 NO PRICE on any print (no "₱", ever) and no phone or email — even when the supplier typed one into a title;
 *   · the personal calling card: the member's name, their Team label ONLY when set (never the access level);
 *   · the door print is unchanged.
 * Every letter is outlined, so the drawn words are read through `renderPrint({ words })`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  PERSONAL_CARD_PURPOSE,
  PRINT_BLOCKS,
  PRINT_BLOCK_KEYS,
  PRINT_DESIGNS,
  PRINT_PIECES,
  PRINT_PURPOSE,
  printFilename,
  printHidden,
  printHref,
  type PrintBlock,
  type PrintPiece,
} from '@/lib/supplier-prints';
import { printSafe, renderPrint, type PrintMember, type PrintShop } from '@/lib/supplier-prints-svg';
import { printMemberFrom, printQr, printReachLine, printShopFrom, printSinceLine } from '@/lib/supplier-prints-shop';
import { stripComments } from '@/lib/strip-comments';

const WEB = path.join(__dirname, '..');
const read = (rel: string) => readFileSync(path.join(WEB, rel), 'utf8');

// a 1 × 1 PNG — the renderer embeds whatever picture it is handed; the route hands it a data: URI too
const PX = { href: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', w: 1, h: 1 };
const ORIGIN = 'https://www.setnayan.com';
const SLUG = 'casa-buenaventura';
const BASE = printShopFrom({
  name: 'Casa Buenaventura',
  slug: SLUG,
  services: ['catering'],
  tagline: 'Weddings and debuts done gently',
  facts: { verified: true, completedEvents: 100, trusted: { trusted_avg_rating: 4.9, trusted_review_count: 32 }, inBusinessSinceYear: 2014, awards: [], nowYear: 2026 },
  kindLabel: () => 'Catering',
  origin: ORIGIN,
});
const FULL: PrintShop = {
  ...BASE,
  logo: PX,
  services: ['Grazing tables', 'Plated dinner', 'Buffet for two hundred', 'Dessert bar', 'Coffee cart', 'Lechon station'],
  since: 'In business since 2014',
  area: 'Serves up to 100 km around Tagaytay',
  photo: PX,
  about: 'A family kitchen that cooks for the whole hall and serves it warm.',
  ownDomain: 'casabuenaventura.ph',
};
const QR = printQr('dates', ORIGIN, SLUG);
const DESIGN = PRINT_DESIGNS[0]!;
const piece = (id: string) => PRINT_PIECES.find((p) => p.id === id)!;
const sidesOf = (p: PrintPiece) => (p.sides === 2 ? (['f', 'b'] as const) : (['f'] as const));

/** Both sides of a piece: the SVG and every line of words it drew, upper-cased for comparing. */
function draw(p: PrintPiece, shop: PrintShop, opts: { hide?: PrintBlock[]; member?: PrintMember | null; design?: (typeof PRINT_DESIGNS)[number] } = {}) {
  let svg = '';
  const words: string[] = [];
  for (const s of sidesOf(p)) svg += renderPrint({ piece: p, design: opts.design ?? DESIGN, shop, qr: QR, side: s, hide: opts.hide, member: opts.member, words });
  return { svg, text: ` ${words.join(' ').replace(/\s+/g, ' ').toUpperCase()} ` };
}
const has = (text: string, s: string) => text.includes(s.replace(/\s+/g, ' ').toUpperCase());

/** How each block shows on a print — a marker where the renderer draws one, else its words. */
const SHOWS: Record<PrintBlock, (d: { svg: string; text: string }) => boolean> = {
  logo: (d) => d.svg.includes('data-print-block="logo"'),
  tagline: (d) => has(d.text, FULL.tagline!),
  services: (d) => d.svg.includes('data-print-block="services"'),
  stars: (d) => d.svg.includes('data-print-block="stars"') || has(d.text, '32 REVIEWS'),
  badges: (d) => d.svg.includes('data-print-badge=') || BASE.badges.some((b) => b.kind !== 'verified' && b.kind !== 'rating' && has(d.text, b.label)),
  since: (d) => has(d.text, 'In business since 2014'),
  area: (d) => has(d.text, FULL.area!),
  photo: (d) => d.svg.includes('data-print-block="photo"'),
  about: (d) => d.svg.includes('data-print-block="about"'),
  reach: (d) => d.svg.includes('data-print-block="reach"') || has(d.text, 'setnayan.com/v/casa-buenaventura'),
};

test('the block table is the prototype’s ten, minus prices — and `hide=` reads only those words', () => {
  assert.deepEqual(PRINT_BLOCK_KEYS, ['logo', 'tagline', 'services', 'stars', 'badges', 'since', 'area', 'photo', 'about', 'reach']);
  assert.ok(!PRINT_BLOCKS.some((b) => /price|₱|rate/i.test(`${b.key} ${b.label}`)), 'a price block came back');
  assert.deepEqual(printHidden('reach,logo, stars,price,phone'), ['logo', 'stars', 'reach'], 'table order; unknown words ignored');
  assert.deepEqual(printHidden(null), []);
  for (const p of PRINT_PIECES) for (const b of PRINT_PURPOSE[p.id].blocks) assert.ok(PRINT_BLOCK_KEYS.includes(b), `${p.id}: ${b}`);
});

test('EACH PIECE CARRIES WHAT ITS PURPOSE NAMES — and nothing else', () => {
  for (const p of PRINT_PIECES) {
    const d = draw(p, FULL);
    for (const b of PRINT_BLOCK_KEYS) {
      const want = PRINT_PURPOSE[p.id].blocks.includes(b);
      assert.equal(SHOWS[b](d), want, `${p.name}: "${b}" should ${want ? '' : 'NOT '}be on it`);
    }
  }
});

test('the service list follows the purpose — up to 3 · 3 · 4 · 6 names, none on the card, door or backdrop', () => {
  const want: Record<string, number> = { standee: 3, table: 3, tarp: 4, rollup: 6 };
  for (const p of PRINT_PIECES) {
    const m = draw(p, FULL).svg.match(/data-print-block="services" data-print-count="(\d+)"/);
    assert.equal(m ? Number(m[1]) : 0, want[p.id] ?? 0, p.name);
  }
});

test('A MISSING FACT DROPS ITS BLOCK — never a zero, never an empty box', () => {
  const bare: PrintShop = { ...BASE, rating: null, badges: BASE.badges.filter((b) => b.kind !== 'rating'), logo: null, services: [], since: null, area: null, photo: null, about: null, ownDomain: null };
  for (const p of PRINT_PIECES) {
    const d = draw(p, bare);
    for (const b of ['logo', 'services', 'stars', 'since', 'area', 'photo', 'about'] as const) assert.equal(SHOWS[b](d), false, `${p.name}: "${b}" drawn with no fact behind it`);
    assert.ok(!/\b0 REVIEWS\b|★ 0\b|\b0\.0\b/.test(d.text), `${p.name}: a zero was printed`);
    // no logo → the monogram, as before
    if (p.id !== 'door') assert.ok(!d.svg.includes('<image'), `${p.name}: an empty picture frame`);
  }
  // no own domain → the Setnayan address alone, never an empty line above it
  const t = draw(piece('tarp'), bare);
  assert.ok(has(t.text, 'setnayan.com/v/casa-buenaventura'));
  assert.ok(!has(t.text, 'casabuenaventura.ph'));
});

test('ONE SWITCH, EVERY PIECE — `On your prints ▾` takes a block off each print that carries it', () => {
  for (const p of PRINT_PIECES) {
    for (const b of PRINT_PURPOSE[p.id].blocks) {
      assert.equal(SHOWS[b](draw(p, FULL, { hide: [b] })), false, `${p.name}: "${b}" still drawn with it switched off`);
    }
  }
  // the Save file honours it too — the same renderer, the print mode
  const save = renderPrint({ piece: piece('rollup'), design: DESIGN, shop: FULL, qr: QR, for: 'print', hide: ['photo', 'about'] });
  assert.ok(!save.includes('data-print-block="photo"') && !save.includes('data-print-block="about"'));
  // name and QR are always on — there is no switch for them
  const off = draw(piece('tarp'), FULL, { hide: [...PRINT_BLOCK_KEYS] });
  assert.ok(off.svg.includes('data-print-qr='), 'the QR left with the blocks');
  assert.ok(has(off.text, 'Casa Buenaventura'), 'the name left with the blocks');
});

test('ONE FACT, ONE PLACE — the stars line takes the rating pill’s place; the since line, the years pill’s', () => {
  assert.ok(BASE.badges.some((b) => b.kind === 'rating') && BASE.badges.some((b) => b.kind === 'years'), 'the seed lost its rating/years badges');
  for (const id of ['tarp', 'rollup', 'backdrop']) {
    const d = draw(piece(id), FULL);
    assert.ok(SHOWS.stars(d) && !d.svg.includes('data-print-badge="rating"'), `${id}: the rating is printed twice`);
    assert.ok(SHOWS.since(d) && !d.svg.includes('data-print-badge="years"'), `${id}: the years are printed twice`);
  }
  // a shop with NO stars line to draw (no reviews read as a line) still shows its rating pill — the pill is the one place
  const noLine = draw(piece('tarp'), { ...FULL, rating: null });
  assert.ok(noLine.svg.includes('data-print-badge="rating"'), 'with no stars line the rating pill is the fact’s one place');
});

test('SWITCHED OFF IS GONE — "Stars and reviews" off takes the rating pill too, on every piece', () => {
  for (const p of PRINT_PIECES) {
    const d = draw(p, FULL, { hide: ['stars'] });
    assert.ok(!SHOWS.stars(d), `${p.name}: the stars line is still drawn`);
    assert.ok(!d.svg.includes('data-print-badge="rating"'), `${p.name}: the rating came back as a pill`);
    const rating = BASE.badges.find((b) => b.kind === 'rating')!;
    assert.ok(!has(d.text, rating.label), `${p.name}: the rating came back as a badge word`);
  }
  // the other badges stay — only the switched-off fact leaves
  assert.ok(draw(piece('tarp'), FULL, { hide: ['stars'] }).svg.includes('data-print-badge='), 'every badge left with the rating');
});

test('SWITCHED OFF IS GONE — "In business since" off takes the years pill too, on every piece', () => {
  const years = BASE.badges.find((b) => b.kind === 'years')!;
  for (const p of PRINT_PIECES) {
    const d = draw(p, FULL, { hide: ['since'] });
    assert.ok(!SHOWS.since(d), `${p.name}: the since line is still drawn`);
    assert.ok(!d.svg.includes('data-print-badge="years"'), `${p.name}: the years came back as a pill`);
    assert.ok(!has(d.text, years.label), `${p.name}: the years came back as a badge word`);
  }
  assert.ok(draw(piece('tarp'), FULL, { hide: ['since'] }).svg.includes('data-print-badge='), 'every badge left with the years');
});

test('one fact, one place — continued: the standee and table draw no since line, so the years pill stays', () => {
  for (const id of ['standee', 'table']) {
    const d = draw(piece(id), FULL);
    assert.ok(!d.svg.includes('data-print-badge="rating"') && d.svg.includes('data-print-badge="years"'), id);
  }
});

// ── 🔒 NO PRICE · NO DOOR OUT ────────────────────────────────────────────────────────────────────────────────────────
const SNEAKY: PrintShop = {
  ...FULL,
  tagline: 'Weddings from ₱45,000 · call 0917 123 4567',
  line: 'Catering · PHP 1,200/head',
  services: ['Grazing table ₱12,000', 'Plated dinner PHP 1,200/head', 'Email us at hello@casa.ph', 'Viber +63 917-555-0101', 'Buffet P35k'],
  about: 'Packages start at ₱80,000. Call (02) 8123-4567 or write to bookings@casabuenaventura.ph for 1,500 pesos off.',
};
const SNEAKY_ROLE: PrintMember = { name: 'Juan dela Cruz', role: 'Head chef ₱500/hr · 0917-123-4567' };
const PESO = /₱|\bPHP\s?\d|\bP\s?\d[\d,.]*\s?[kKmM]?\b|\d\s?PESOS?\b/i;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = (t: string) => (t.match(/\+?\(?\d[\d\s().-]{5,}\d/g) ?? []).some((m) => m.replace(/\D/g, '').length >= 7);

test('🔒 NO "₱" ON ANY PRINT — every piece × every look × every side × screen and Save, the personal card too', () => {
  let n = 0;
  for (const p of PRINT_PIECES) {
    for (const design of PRINT_DESIGNS) {
      for (const mode of ['screen', 'print'] as const) {
        for (const s of mode === 'print' ? (['f'] as const) : sidesOf(p)) {
          for (const member of p.id === 'card' ? [null, SNEAKY_ROLE] : [null]) {
            const words: string[] = [];
            const svg = renderPrint({ piece: p, design, shop: SNEAKY, qr: QR, side: s, for: mode, member, words });
            const text = words.join(' ');
            const where = `${p.name} · ${design.name} · ${mode}${mode === 'screen' ? ` · ${s}` : ''}${member ? ' · personal' : ''}`;
            assert.ok(!svg.includes('₱') && !text.includes('₱'), `${where}: a ₱ was printed`);
            assert.ok(!PESO.test(text), `${where}: a price was printed — ${text}`);
            assert.ok(!EMAIL.test(text) && !EMAIL.test(svg.replace(/data:[^"]+/g, '')), `${where}: an email was printed`);
            assert.ok(!PHONE(text), `${where}: a phone number was printed — ${text}`);
            n++;
          }
        }
      }
    }
  }
  assert.ok(n >= 7 * 15 * 2, `only ${n} prints were checked`);
});

test('🔒 the typed words are cleaned before they reach a print — the useful words stay', () => {
  assert.equal(printSafe('Grazing tables from ₱45,000'), 'Grazing tables from');
  assert.equal(printSafe('Call 0917 123 4567 or mail hi@shop.ph'), 'Call or mail');
  assert.equal(printSafe('Viber +63 917-123-4567'), 'Viber');
  assert.equal(printSafe('Buffet for 200 — P35k'), 'Buffet for 200');
  assert.equal(printSafe('₱'), null, 'nothing left → no block');
  for (const keep of ['Weddings & Events', 'Since 2014 · 200 guests', 'Package 3', 'Same-day edit film']) assert.equal(printSafe(keep), keep);
  // and the drawn rollup carries the cleaned service name, not a blank row
  assert.ok(has(draw(piece('rollup'), SNEAKY).text, 'Grazing table'));
});

test('🔒 no price is READ for a print — the readers ask for names, never an amount', () => {
  for (const f of ['lib/supplier-prints.server.ts', 'lib/supplier-prints-shop.ts', 'app/api/vendor/prints/route.ts']) {
    const src = stripComments(read(f));
    assert.ok(!/price|amount|rate_php|_php\b|₱/i.test(src), `${f} reads a price`);
  }
  const svgSrc = stripComments(read('lib/supplier-prints-svg.ts'));
  assert.ok(!/\bprice\w*\s*[:?]/i.test(svgSrc), 'the print facts grew a price field');
});

// ── 🪪 THE PERSONAL CALLING CARD (owner 2026-11-06, "Yes") ─────────────────────────────────────────────────────────────
test('🪪 personal card WITH a role — name + Team label on the front, the shop’s back', () => {
  const card = piece('card');
  const m = printMemberFrom('Juan dela Cruz', 'Owner · Director')!;
  const front = renderPrint({ piece: card, design: DESIGN, shop: FULL, qr: QR, side: 'f', member: m, words: [] });
  const words: string[] = [];
  renderPrint({ piece: card, design: DESIGN, shop: FULL, qr: QR, side: 'f', member: m, words });
  const text = words.join(' ').toUpperCase();
  assert.ok(front.includes('data-print-block="member"') && front.includes('data-print-block="role"'));
  assert.ok(text.includes('JUAN DELA CRUZ') && text.includes('OWNER · DIRECTOR') && text.includes('CASA BUENAVENTURA'), text);
  assert.ok(front.includes('data-print-block="logo"'), 'the shop’s logo, small');
  // the back is the shop card's back, byte for byte (bar the per-draw ids and the file's title)
  const ids = (s: string) => s.replace(/<title>.*?<\/title>/, '').replace(/(id="|url\(#)[a-z-]*\w*?\d+/gi, '$1#');
  assert.equal(
    ids(renderPrint({ piece: card, design: DESIGN, shop: FULL, qr: QR, side: 'b', member: m })),
    ids(renderPrint({ piece: card, design: DESIGN, shop: FULL, qr: QR, side: 'b' })),
  );
  // its Save file and its name
  assert.match(printFilename(card, DESIGN, m.name), /^setnayan-calling-card-juan-dela-cruz-ink-gold\.svg$/);
  assert.ok(printHref({ piece: 'card', design: 'inkgold', qr: 'dates', who: 'me' }).includes('who=me'));
  assert.ok(!printHref({ piece: 'tarp', design: 'inkgold', qr: 'dates', who: 'me' }).includes('who='), 'only the card is personal');
});

test('🪪 personal card WITHOUT a role — no role line, never the access level, never an invented title', () => {
  const card = piece('card');
  const m = printMemberFrom('Juan dela Cruz', '   ')!;
  assert.deepEqual(m, { name: 'Juan dela Cruz', role: null });
  const words: string[] = [];
  const front = renderPrint({ piece: card, design: DESIGN, shop: FULL, qr: QR, side: 'f', member: m, words });
  const text = ` ${words.join(' ').toUpperCase()} `;
  assert.ok(front.includes('data-print-block="member"') && !front.includes('data-print-block="role"'));
  for (const w of ['OWNER', 'ADMIN', 'AGENT', 'VIEWER', 'MANAGER', 'STAFF', 'MEMBER']) assert.ok(!text.includes(` ${w} `), `"${w}" was printed as a role`);
  // no name → no personal card (the route answers 409; the sheet does not offer it)
  assert.equal(printMemberFrom('', 'Head chef'), null);
  assert.equal(printMemberFrom(null, 'Head chef'), null);
  assert.equal(printMemberFrom('juan@casa.ph', null), null, 'an email is not a name');
  // a member only ever reaches the card — every other piece draws the shop
  const tarp = renderPrint({ piece: piece('tarp'), design: DESIGN, shop: FULL, qr: QR, member: m });
  assert.ok(!tarp.includes('data-print-block="member"'));
  assert.deepEqual([...PERSONAL_CARD_PURPOSE.blocks], ['logo', 'stars', 'badges', 'reach']);
  // the access level is never read for the card
  assert.ok(!/\b(access_level|role)\b\s*[,:]?\s*(?:'|")?\s*(owner|admin|agent|viewer)/i.test(stripComments(read('lib/supplier-prints.server.ts'))));
});

// ── the facts builders ─────────────────────────────────────────────────────────────────────────────────────────────
test('the reach and since lines print only a claim the shop can keep', () => {
  assert.equal(printSinceLine(2014, 2026), 'In business since 2014');
  assert.equal(printSinceLine(null, 2026), null);
  assert.equal(printSinceLine(2031, 2026), null, 'a year in the future is no fact');
  assert.equal(printReachLine({ kind: 'until_verified' }, 'Tagaytay'), 'Tagaytay', 'no ring → the city alone, never "opens once verified"');
  assert.equal(printReachLine({ kind: 'until_verified' }, null), null);
  assert.match(printReachLine({ kind: 'ring', km: 100 }, 'Tagaytay') ?? '', /100 km/);
});

// ── the sheet ─────────────────────────────────────────────────────────────────────────────────────────────────────
test('the sheet: ONE `On your prints ▾` multi-pick (PickMenu `picked`, never a pill row) that reaches the picture, Save and the photos', () => {
  const src = stripComments(read('app/vendor-dashboard/shop/promote/_components/shop-prints-section.tsx'));
  const picks = src.match(/<PickMenu\s+label="On your prints"[\s\S]*?\/>/g) ?? [];
  assert.equal(picks.length, 1, 'one pick, not two');
  assert.ok(/picked=\{/.test(picks[0]!) && /options=\{PRINT_BLOCKS\.map/.test(picks[0]!), 'the pick is not PickMenu’s multi-pick over PRINT_BLOCKS');
  assert.ok(/Always on: your name · the QR\./.test(src), 'name and QR are always on — the pick says so');
  // every drawing the sheet asks for carries the switches
  const calls = src.match(/printHref\(\{[^}]*\}\)/g) ?? [];
  assert.ok(calls.length >= 3, `only ${calls.length} printHref calls`);
  for (const c of calls) assert.ok(/\bhide\b/.test(c), `a drawing ignores the switches: ${c}`);
  // the personal card sits beside the shop card, only for a member with a name
  assert.ok(/data-prints-piece="card-me"/.test(src));
});

test('the door print is unchanged — the new facts never reach it', () => {
  const door = piece('door');
  const ids = (s: string) => s.replace(/(id="|url\(#)[a-z-]*\w*?\d+/gi, '$1#');
  for (const design of PRINT_DESIGNS) {
    const plain: PrintShop = { name: FULL.name, line: FULL.line, ini: FULL.ini, handle: FULL.handle, verified: FULL.verified, rating: FULL.rating, badges: FULL.badges };
    assert.equal(ids(renderPrint({ piece: door, design, shop: FULL, qr: QR })), ids(renderPrint({ piece: door, design, shop: plain, qr: QR })), design.name);
  }
});
