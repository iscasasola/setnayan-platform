/**
 * 🖨 THE SUPPLIER'S PRINTS — Shop › Promote part 3 (owner APPROVED the 15 looks, 5 Nov 2026: "perfect").
 *
 * Holds what the build promised:
 *   · the 15 looks and 7 pieces are the prototype's, in its order and words — never invented;
 *   · SAVE GIVES A PRINT-READY FILE PER PIECE: its exact size in millimetres plus a 3 mm bleed, the card's two sides,
 *     every letter outlined (no `<text>` a print shop's machine would set in a fallback face), and a file name per piece;
 *   · the facts printed are the shop's own (name, services, today's badges) — nothing typed;
 *   · the sheet: Design is ONE dropdown (never a pill row); QR picks the shop's own codes; Save per piece;
 *   · "See it in use" places each surface exactly on its photo's quad, with files that exist;
 *   · nothing is stored, so there is no export to sweep.
 * The QR scans are their own file: lib/supplier-prints-decode.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  PRINT_DESIGNS,
  PRINT_PIECES,
  PRINT_QR,
  PRINT_QR_ORDER,
  PRINT_SCENES,
  PRINT_SCENE_DIR,
  homography,
  printFilename,
  printHref,
  printQrMode,
  project,
} from '@/lib/supplier-prints';
import { PRINT_BLEED_MM, PRINT_FACE_FILES, renderPrint, type PrintShop } from '@/lib/supplier-prints-svg';
import { printHandle, printLine, printShopFrom } from '@/lib/supplier-prints-shop';
import { PROMOTE_QR_MODES } from '@/lib/supplier-qr-codes';
import { stripComments } from '@/lib/strip-comments';

const WEB = path.join(__dirname, '..');
const read = (rel: string) => readFileSync(path.join(WEB, rel), 'utf8');
const SHOP: PrintShop = { name: 'Setnayan Productions', line: 'Weddings & Events', ini: 'SP', handle: 'setnayan.com/v/setnaprod', verified: true, rating: { avg: 4.9, count: 32 }, badges: [] };
const QR = { mode: 'dates' as const, url: 'https://www.setnayan.com/v/setnaprod/dates' };

test('the 15 approved looks, in the prototype’s order and names', () => {
  assert.deepEqual(
    PRINT_DESIGNS.map((d) => d.name),
    ['Ink & gold', 'Ivory foil', 'Marble', 'Classic serif', 'Sage linen', 'Terracotta', 'Jet mono', 'Spotlight', 'Electric blue', 'Fiesta', 'Blush', 'Kraft', 'Forest', 'Pearl', 'Slate'],
  );
  assert.equal(new Set(PRINT_DESIGNS.map((d) => d.id)).size, 15);
});

test('the 7 pieces — the prototype’s names and sizes', () => {
  assert.deepEqual(
    PRINT_PIECES.map((p) => `${p.name} · ${p.size}`),
    ['Calling card · 3.5 × 2 in', 'A5 mini standee · 148 × 210 mm', 'Door print · A4 · 210 × 297 mm', 'Booth backdrop · 8 × 8 ft', 'Booth / office tarp · 6 × 3 ft', 'Roll-up banner · 80 × 200 cm', 'Table-front · 6 × 2.5 ft'],
  );
  for (const p of PRINT_PIECES) assert.ok(Math.abs(p.mm.w / p.mm.h - p.ratio) < 1e-9, `${p.name}: its millimetres and its ratio disagree`);
});

test('the QR choices are the shop’s own Promote codes + Reviews, Check a date first, with their printed captions', () => {
  // Every Promote code prints (owner 2026-11-06, "ONE HOME FOR EVERY PROMOTE TOOL"). Retargeted 2026-11-06 for QR codes
  // Option B: Reviews is now a ROW of Promote's list too (the prototype's four), so the print choices ARE the Promote
  // codes, one for one — a code a print offers that the list cannot show (or the reverse) is the drift this catches.
  assert.deepEqual([...PRINT_QR_ORDER].sort(), [...PROMOTE_QR_MODES].sort());
  assert.ok((PROMOTE_QR_MODES as readonly string[]).includes('reviews'), 'Reviews left Promote’s QR list — Option B has four rows');
  assert.equal(PRINT_QR_ORDER[0], 'dates');
  assert.equal(printQrMode(null), 'dates');
  assert.equal(printQrMode('reviews'), 'reviews');
  assert.equal(printQrMode('crew'), 'dates', 'a code that does not live on Promote is never printed');
  assert.deepEqual(
    PRINT_QR_ORDER.map((k) => PRINT_QR[k].cap),
    // the first three are the prototype's; the Reviews caption is this build's words (flagged for the owner)
    ['Scan to check our dates', 'Scan to save us', 'Scan to see our work', 'Scan to review us'],
  );
});

test('the printed words are the prototype’s — copied, never invented', () => {
  const svg = renderPrint({ piece: PRINT_PIECES.find((p) => p.id === 'door')!, design: PRINT_DESIGNS[0]!, shop: SHOP, qr: QR });
  // the words are outlined, so the test reads the renderer's source for them
  const src = stripComments(read('lib/supplier-prints-svg.ts'));
  for (const w of ["'We are part of'", "'Setnayan Verified'", "'Setnayan'"]) assert.ok(src.includes(w), `the renderer lost ${w}`);
  assert.ok(svg.includes('data-print-qr="https://www.setnayan.com/v/setnaprod/dates"'));
});

test('SAVE GIVES A PRINT-READY FILE PER PIECE — exact size + 3 mm bleed, type outlined, a name of its own', () => {
  const names = new Set<string>();
  for (const p of PRINT_PIECES) {
    for (const d of PRINT_DESIGNS) {
      const svg = renderPrint({ piece: p, design: d, shop: SHOP, qr: QR, for: 'print' });
      assert.match(svg, /^<\?xml/);
      const w = Number(/width="([\d.]+)mm"/.exec(svg)?.[1]);
      const h = Number(/height="([\d.]+)mm"/.exec(svg)?.[1]);
      assert.ok(Math.abs(w - (p.mm.w + 2 * PRINT_BLEED_MM)) < 0.01, `${p.name}: ${w} mm wide`);
      const oneSide = p.mm.h + 2 * PRINT_BLEED_MM;
      const expectH = p.sides === 2 ? 2 * oneSide + 10 : oneSide;
      assert.ok(Math.abs(h - expectH) < 0.05, `${p.name}: ${h} mm tall, expected ${expectH}`);
      assert.equal((svg.match(/data-print-side="/g) ?? []).length, p.sides, `${p.name}: every side is in its file`);
      assert.ok(!/<text[\s>]/.test(svg), `${p.name} · ${d.name}: a <text> reached the file — every letter must be outlined`);
      assert.ok(!svg.includes('NaN'), `${p.name} · ${d.name}: a NaN in the drawing`);
    }
    names.add(printFilename(p, PRINT_DESIGNS[0]!));
  }
  assert.equal(names.size, 7, 'each piece saves under its own name');
  assert.equal(printFilename(PRINT_PIECES[0]!, PRINT_DESIGNS[0]!), 'setnayan-calling-card-ink-gold.svg');
});

test('the Save link asks the route for the print file; the picture asks for the screen drawing', () => {
  assert.equal(printHref({ piece: 'tarp', design: 'kraft', qr: 'page', save: true }), '/api/vendor/prints?piece=tarp&design=kraft&qr=page&save=1');
  assert.equal(printHref({ piece: 'card', side: 'b', design: 'inkgold', qr: 'dates' }), '/api/vendor/prints?piece=card&design=inkgold&qr=dates&side=b');
  const route = stripComments(read('app/api/vendor/prints/route.ts'));
  assert.match(route, /for: save \? 'print' : 'screen'/);
  assert.match(route, /content-disposition/);
});

test('NOTHING IS STORED — every file is drawn on request, so there is no export to sweep', () => {
  const route = stripComments(read('app/api/vendor/prints/route.ts'));
  for (const w of ['.upload(', 'putObject', 'PutObjectCommand', '.insert(', '.upsert(', 'presign']) assert.ok(!route.includes(w), `the print route stores something (${w}) — then it needs a cleanup sweep`);
});

test('the facts are the shop’s own: name, services in its words, today’s badges', () => {
  const label = (k: string) => ({ photo_video: 'Photo & video', sound: 'Sound', lights: 'Lights', host: 'Host' })[k] ?? k;
  assert.equal(printLine(['photo_video', 'sound', 'lights', 'host'], 'We make memories', label), 'Photo & video · Sound · Lights');
  assert.equal(printLine([], 'We make memories', label), 'We make memories');
  assert.equal(printLine([], null, label), '', 'no services and no tagline print nothing — never a filler');
  assert.equal(printHandle('https://www.setnayan.com', 'setnaprod'), 'setnayan.com/v/setnaprod');
  const shop = printShopFrom({
    name: 'Saysay Live Band & Hosting',
    slug: 'saysay',
    services: ['host'],
    tagline: null,
    facts: { verified: false, completedEvents: 0, trusted: null, inBusinessSinceYear: null, awards: [], nowYear: 2026 },
    kindLabel: label,
    origin: 'https://www.setnayan.com',
  });
  assert.equal(shop.ini, 'SL');
  assert.equal(shop.verified, false);
  assert.equal(shop.rating, null);
  assert.deepEqual(shop.badges, [], 'a shop with nothing earned prints no seal, no rating, no badge');
});

test('every face a look names ships in public/print-fonts and is traced into the print route', () => {
  for (const f of PRINT_FACE_FILES) assert.ok(existsSync(path.join(WEB, f)), `${f} is missing`);
  assert.match(read('next.config.ts'), /'\/api\/vendor\/prints': \['\.\/public\/print-fonts\/\*\.ttf'\]/);
});

test('See it in use: every surface lands on its quad, and every photo, shade and mask file exists', () => {
  for (const s of PRINT_SCENES) {
    assert.ok(existsSync(path.join(WEB, 'public', PRINT_SCENE_DIR, `${s.slug}.webp`)), `${s.slug}.webp`);
    for (const f of s.surfaces) {
      assert.ok(PRINT_PIECES.some((p) => p.id === f.piece));
      for (const m of [f.shade, f.mask].filter(Boolean) as Array<{ file: string; w: number; h: number }>) {
        const abs = path.join(WEB, 'public', PRINT_SCENE_DIR, m.file);
        assert.ok(existsSync(abs), m.file);
        // the file is stored at the photo's 800-px scale; drawn at w × h it must keep its own shape (a stretched shade
        // printed a seam across the expo booth's counter)
        const png = readFileSync(abs);
        const pw = png.readUInt32BE(16);
        const ph = png.readUInt32BE(20);
        assert.ok(Math.abs(pw / ph - m.w / m.h) < 0.02 * (m.w / m.h) + 1 / ph, `${m.file}: drawn ${m.w}×${m.h}, its file is ${pw}×${ph}`);
      }
      const h = homography(720, 400, f.quad);
      const corners: Array<[number, number]> = [[0, 0], [720, 0], [720, 400], [0, 400]];
      corners.forEach(([x, y], i) => {
        const [u, v] = project(h, x, y);
        assert.ok(Math.hypot(u - f.quad[i]![0], v - f.quad[i]![1]) < 0.01, `${s.slug} · ${f.piece}: corner ${i} misses its quad`);
      });
    }
  }
  assert.deepEqual(PRINT_SCENES.map((s) => s.cap), ['Expo booth', 'Venue entrance', 'Your shop door', 'Shop window', 'A guest scans', 'At the buffet', 'Welcome table', 'Your office']);
});

test('the sheet: Design is ONE dropdown of the 15 (never a pill row), QR is one dropdown, Save per piece', () => {
  const src = stripComments(read('app/vendor-dashboard/shop/promote/_components/shop-prints-section.tsx'));
  assert.match(src, /<PickMenu\s+label="Design"[\s\S]*?options=\{PRINT_DESIGNS\.map/);
  assert.match(src, /<PickMenu\s+label="QR on your prints"[\s\S]*?options=\{PRINT_QR_ORDER\.map/);
  assert.ok(!/PRINT_DESIGNS\.map\(\(\w+\) => \(\s*<button/.test(src), 'the looks are drawn as a row of buttons — a pill row');
  assert.match(src, /PRINT_PIECES\.map\(\(p\) =>[\s\S]*?<SaveButton piece=\{p\}/);
  assert.match(src, /<SaveFileLink/);
  // THE ONE BUILD (C4): Promote's rows are its ONE body (`promote-body.tsx`), mounted by the page and Shop's sheets.
  const page = stripComments(read('app/vendor-dashboard/shop/promote/_components/promote-body.tsx'));
  assert.match(page, /<ShopPrintsSection canShare=\{canShare\}/);
});

test('Promote’s rows, in the ruled order: QR codes · prints · gifts · share your work — and its ▾ hint says so', () => {
  // owner 2026-11-06, DECISION_LOG "ONE HOME FOR EVERY PROMOTE TOOL": (1) QR codes (2) Calling card + tarps (3) gifts
  // (4) Share your work; hint "QR codes · prints · gifts · share your work". THE ONE BUILD: the rows are the ONE body.
  const page = stripComments(read('app/vendor-dashboard/shop/promote/_components/promote-body.tsx'));
  const at = (re: RegExp) => page.search(re);
  const order = [at(/\{body\}/), at(/<ShopPrintsSection /), at(/<ShopGiftsSection /), at(/<ShareYourWork /)];
  assert.ok(order.every((i) => i > 0), `a Promote row is missing: ${order.join(',')}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'Promote’s rows are out of the ruled order');
  assert.match(read('app/vendor-dashboard/shop/_components/shop-sections.ts'), /promote: 'QR codes · prints · gifts · share your work',/);
});

test('the badge print is a piece INSIDE prints — and the Shop tab’s badge row does not save it', () => {
  // owner 2026-11-06: "the door print and the badge print are pieces INSIDE prints".
  const src = stripComments(read('app/vendor-dashboard/shop/promote/_components/shop-prints-section.tsx'));
  assert.match(src, /<\/ul>\s*<BadgesPiece open=\{open\} factsUrl=\{badgeFactsUrl\} \/>/, 'the badges piece left the prints list');
  assert.match(src, /const BADGE_PRINT_API = '\/api\/vendor\/badges\?badge=all';/);
  assert.match(src, /<SaveFileLink\s+href=\{BADGE_PRINT_API\}\s+filename="setnayan-badges\.svg"/);
  // a refused read is said, never "none"; Save shows only when there is something to print
  assert.match(src, /read\.k === 'unread'\s*\?\s*'Couldn’t load your badges just now\.'/);
  assert.match(src, /\{read\.k === 'ok' && read\.badges\.length > 0 \? \(\s*<SaveFileLink/);
  // The one badge tracker is the Shop tab's badge row (under the Analytics carousel, owner 11 Nov 2026) — not a print.
  const row = stripComments(read('app/vendor-dashboard/shop/_components/shop-badge-row.tsx'));
  assert.doesNotMatch(row, /SaveFileLink|Save to print|\/api\/vendor\/badges/, 'the badge row saves the badge print — it lives in Prints');
});
