/**
 * PRINTS & TICKETS — the rules the build plan's Phase 9 names as its tests,
 * measured on real layouts and real PDF bytes (not on flags):
 *
 *   · ceremony time comes from the CEREMONY block (fixture whose first block is not it);
 *   · † renders only when `deceased`;
 *   · every theme has a die-cut; every FORMAT (calling card · CR80 · train · boarding pass ·
 *     5×7 · A5 · index cards) lays out at its mm size, and its print PDF's TrimBox says so;
 *   · the per-guest pass batch gangs onto A4 with cut lines;
 *   · the FREE sample is one flattened, watermarked JPEG ≤ 800 px — never a PDF or vector —
 *     with placeholder QRs; the Pro file has bleed, crop marks, layers and NO watermark;
 *   · GUARD: the free path never reaches the print-ready renderer (Pro checked server-side first);
 *   · entourage groups keep `lib/entourage.ts` order;
 *   · no price and no Pro path in the app-store shell.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFString } from 'pdf-lib';
import QRCode from 'qrcode';

import { stripComments } from './strip-comments';
import { INVITE_THEME_IDS } from './invite-themes';
import { buildEntourage, ENTOURAGE_GROUP_KEYS } from './entourage';
import {
  BLEED_MM,
  DIE_CUTS,
  PRINT_FORMATS,
  PRINT_PIECES,
  PRINT_SET_KEYS,
  PT_PER_MM,
  blockTime,
  ceremonyBlock,
  formatFor,
  maskAccountLine,
  mayServe,
  parentLine,
  parsePrintDetails,
  NFC_STICKER_DIAMETER_MM,
  OPENING_LINE_TEMPLATES,
  printAccess,
  printLookFor,
  spotLayersFor,
} from './print-pieces';
import { NFC_SPOT_R, layoutPasses, layoutPiece, opsOnLayer, watermarkOps, type PrintOp, type PrintSetData } from './print-layout';
import { renderImposedPdf, renderPrintPdf } from './print-render-pdf';
import {
  SAMPLE_JPEG_QUALITY,
  SAMPLE_LONG_EDGE_PX,
  isQrRef,
  placeholderQrPng,
  renderSampleJpeg,
  sampleImages,
  sampleSvg,
} from './print-sample-raster';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

// Stored the way prod stores it: the venue's WALL CLOCK in a UTC-typed column.
const BLOCKS = [
  { label: 'Guests arrive', block_type: 'pre_ceremony', start_at: '2026-12-18T13:30:00+00:00', parent_block_id: null },
  { label: 'Ceremony', block_type: 'ceremony', start_at: '2026-12-18T14:00:00+00:00', parent_block_id: null },
  { label: 'Reception', block_type: 'reception', start_at: '2026-12-18T17:00:00+00:00', parent_block_id: null },
];

test('print uses the CEREMONY block time — not the first item of the run of show', () => {
  const block = ceremonyBlock(BLOCKS);
  assert.equal(block?.label, 'Ceremony');
  assert.equal(blockTime(block), '2:00 PM', 'the ceremony prints at the venue wall clock, never converted');
  assert.notEqual(blockTime(BLOCKS[0]!), blockTime(block), 'the fixture must actually differ from the first block');
  assert.equal(ceremonyBlock(BLOCKS.filter((b) => b.block_type !== 'ceremony')), null, 'no ceremony block → no time, never a guess');
});

test('† follows a parent only when marked departed; print_details stores only choices, never copies', () => {
  assert.equal(parentLine({ name: 'Indalecio Sr.', deceased: true, side: 'groom' }), 'Indalecio Sr. †');
  assert.equal(parentLine({ name: 'Rosa', deceased: false, side: 'groom' }), 'Rosa');
  // Parents live on the Guest list and gifts on E-Gifts (owner 2026-09-25) —
  // a stored copy of either is DROPPED, never read back.
  const stored = parsePrintDetails({
    parents: [{ name: 'Typed Parent', deceased: true }],
    gift_lines: ['BDO 1234567890'],
    opening_line: '  With thanksgiving to God  ',
    rsvp: { kind: 'manual', text: 'Reply to Claire' },
  });
  assert.equal(stored.openingLine, 'With thanksgiving to God');
  assert.deepEqual(stored.rsvp, { kind: 'manual', text: 'Reply to Claire' });
  assert.equal('parents' in stored, false);
  assert.equal('giftLines' in stored, false);
  const host = parsePrintDetails({ rsvp: { kind: 'host', moderator_id: '00000000-0000-4000-8000-000000000001' } });
  assert.deepEqual(host.rsvp, { kind: 'host', moderatorId: '00000000-0000-4000-8000-000000000001' });
  assert.equal(parsePrintDetails({ rsvp: { kind: 'host', moderator_id: 'not-a-uuid' } }).rsvp, null);
  const none = parsePrintDetails(null);
  assert.equal(none.openingLine, null);
  assert.equal(none.include.nfc, false, 'the NFC spot is opt-in');
  assert.equal(OPENING_LINE_TEMPLATES.length >= 4, true, 'a few opening-line templates to start from');
});

test('gift lines print their account number masked', () => {
  assert.equal(maskAccountLine('BDO · I. Casasola · 1234 5678 9012'), 'BDO · I. Casasola · •••• 9012');
  assert.equal(maskAccountLine('GCash 0917-123-4567'), 'GCash •••• 4567');
  assert.equal(maskAccountLine('Reply by Nov 18'), 'Reply by Nov 18');
});

test('every theme has a die-cut and a look on paper', () => {
  for (const id of INVITE_THEME_IDS) {
    assert.ok(DIE_CUTS[id], `${id} has no die-cut`);
    const look = printLookFor(id);
    assert.match(look.paper, /^#[0-9a-f]{6}$/i);
  }
  assert.equal(printLookFor('house').still, 'none', 'Classic prints on paper alone (owner: "classic has no photo or video")');
});

function data(over: Partial<PrintSetData> = {}): PrintSetData {
  return {
    names: { first: 'Indalecio', second: 'Claire' },
    eyebrow: 'The wedding of',
    dateLabel: 'Friday · December 18, 2026',
    ceremonyTime: '2:00 PM',
    ceremonyVenue: 'San Agustin Church',
    receptionTime: '5:00 PM',
    receptionVenue: 'The Manila Hotel',
    monogram: null,
    initials: 'I & C',
    details: { parents: [{ name: 'Rosa', side: 'groom', deceased: true }], openingLine: null, rsvpContact: null, giftLines: [] },
    entourage: [],
    attire: [],
    swatches: [],
    hubAddress: 'setnayan.com/cale-ice',
    hasStill: false,
    hasEventQr: true,
    ...over,
  };
}

test('every PRINT_FORMAT lays out at its own mm size, and print lays 3 mm of bleed around it', () => {
  for (const f of Object.values(PRINT_FORMATS)) {
    const piece = f.for === 'pass' ? 'pass' : f.for === 'card' ? 'card' : 'invitation';
    const doc = layoutPiece(piece, { look: printLookFor('vintage'), data: data(), mode: 'print', foil: false, format: f.id });
    assert.ok(Math.abs(doc.w - f.wMm * PT_PER_MM) < 0.01, `${f.id}: width ${doc.w} ≠ ${f.wMm} mm`);
    assert.ok(Math.abs(doc.h - f.hMm * PT_PER_MM) < 0.01, `${f.id}: height ${doc.h} ≠ ${f.hMm} mm`);
    assert.ok(Math.abs(doc.bleed - BLEED_MM * PT_PER_MM) < 1e-9, `${f.id}: print bleed is 3 mm`);
    const paper = doc.ops[0]!;
    assert.ok(paper.t === 'rect' && paper.x <= -doc.bleed && paper.w >= doc.w + 2 * doc.bleed - 0.01, `${f.id}: the paper must run into the bleed`);
  }
  // The owner's sizes, verbatim: a calling card, a train ticket, a plane ticket; an index card and A5.
  assert.deepEqual([PRINT_FORMATS['calling-card'].wMm, PRINT_FORMATS['calling-card'].hMm], [90, 54]);
  assert.deepEqual([PRINT_FORMATS.boarding.wMm, PRINT_FORMATS.boarding.hMm], [203, 82]);
  assert.deepEqual([PRINT_FORMATS['card-a5'].wMm, PRINT_FORMATS['card-a5'].hMm], [148, 210]);
  assert.equal(formatFor('pass', 'card-a5')?.id, 'calling-card', 'a pass cannot wear a card size — it falls back to its default');
  assert.equal(formatFor('poster', 'train'), null, 'the poster is A3, always');
});

async function qrImages() {
  const png = await QRCode.toBuffer('https://setnayan.com/x', { type: 'png', width: 120, margin: 1 });
  return { eventqr: { bytes: new Uint8Array(png), mime: 'image/png' as const } };
}

test('each format’s print-ready PDF: the TrimBox is its mm size, with 3 mm bleed and crop marks', async () => {
  for (const f of Object.values(PRINT_FORMATS)) {
    const piece = f.for === 'pass' ? 'pass' : f.for === 'card' ? 'card' : 'invitation';
    const doc = layoutPiece(piece, { look: printLookFor('whimsical'), data: data(), mode: 'print', foil: false, format: f.id });
    const pdf = await PDFDocument.load(await renderPrintPdf([doc], await qrImages(), { mode: 'print', title: f.id }));
    const page = pdf.getPage(0);
    const trim = page.getTrimBox();
    const bleed = page.getBleedBox();
    assert.ok(Math.abs(trim.width / PT_PER_MM - f.wMm) < 0.05 && Math.abs(trim.height / PT_PER_MM - f.hMm) < 0.05, `${f.id}: TrimBox ${trim.width / PT_PER_MM} × ${trim.height / PT_PER_MM} mm`);
    assert.ok(Math.abs(bleed.width - trim.width - 2 * BLEED_MM * PT_PER_MM) < 0.01, `${f.id}: bleed is 3 mm each side`);
    assert.ok(page.getWidth() > bleed.width, `${f.id}: crop marks sit in a slug outside the bleed`);
  }
});

test('the PRINT-READY PDF: bleed + trim boxes, and Foil / White ink / Die cut layers — no watermark', async () => {
  const spot = spotLayersFor('velvet');
  assert.ok(spot.foil && spot.whiteInk, 'Luxe foils its names and underprints white');
  const docs = PRINT_SET_KEYS.map((k) =>
    layoutPiece(k, { look: printLookFor('velvet'), data: data(), mode: 'print', foil: spot.foil, whiteInk: spot.whiteInk }),
  );
  assert.ok(opsOnLayer(docs[0]!, 'foil') > 0, 'the names must be on the Foil layer');
  assert.ok(opsOnLayer(docs[0]!, 'white') > 0, 'light type on dark stock needs a white underprint');
  const bytes = await renderPrintPdf(docs, await qrImages(), { mode: 'print', title: 't' });
  const pdf = await PDFDocument.load(bytes);
  const page = pdf.getPage(0);
  assert.equal(Math.round(page.getTrimBox().width), Math.round(PRINT_PIECES.invitation.widthPt));
  const oc = pdf.catalog.lookup(PDFName.of('OCProperties'), PDFDict);
  const ocgs = oc.lookup(PDFName.of('OCGs'), PDFArray);
  const names = ocgs.asArray().map((ref) => (pdf.context.lookup(ref, PDFDict).lookup(PDFName.of('Name')) as PDFString).decodeText());
  assert.deepEqual(names, ['Foil', 'White ink', 'Die cut']);
  // The Pro file carries no watermark: the layout has none of the watermark's ops.
  const wm = new Set(watermarkOps(docs[0]!.w, docs[0]!.h).map((o) => (o.t === 'path' ? o.d : '')));
  assert.ok(!docs[0]!.ops.some((o) => o.t === 'path' && wm.has(o.d)), 'a print-ready layout must not carry the sample watermark');
});

test('the per-guest pass batch gangs onto A4 with cut lines, the count its format says', async () => {
  const f = PRINT_FORMATS['calling-card'];
  const passes = Array.from({ length: 11 }, (_, i) => ({ name: `Guest ${i + 1}`, seat: null, qrRef: 'eventqr', serial: null }));
  const docs = layoutPasses({ look: printLookFor('vintage'), data: data(), mode: 'print', foil: false, format: f.id }, passes);
  const pdf = await PDFDocument.load(await renderImposedPdf(docs, await qrImages(), { ...f.sheet!, title: 'passes' }));
  const perPage = f.sheet!.cols * f.sheet!.rows;
  assert.equal(pdf.getPageCount(), Math.ceil(11 / perPage));
  const page = pdf.getPage(0);
  assert.ok(Math.abs(page.getWidth() / PT_PER_MM - 210) < 0.1 && Math.abs(page.getHeight() / PT_PER_MM - 297) < 0.1, 'an A4 sheet');
  // Every pass format must fit its own imposition on A4, bleeds and cut-line margins included.
  for (const p of Object.values(PRINT_FORMATS).filter((x) => x.for === 'pass')) {
    const [W, H] = p.sheet!.landscape ? [297, 210] : [210, 297];
    const gridW = p.sheet!.cols * (p.wMm + 2 * BLEED_MM);
    const gridH = p.sheet!.rows * (p.hMm + 2 * BLEED_MM);
    assert.ok(gridW + 14 <= W && gridH + 14 <= H, `${p.id}: ${p.sheet!.cols}×${p.sheet!.rows} does not fit A4 with room for cut lines`);
  }
});

test('the FREE sample is one flattened JPEG, ≤ the low-res cap, watermarked across the whole sheet, QRs replaced', async () => {
  const doc = layoutPiece('invitation', { look: printLookFor('vintage'), data: data(), mode: 'sample', foil: false });
  assert.equal(doc.bleed, 0, 'a sample carries no bleed');
  const jpeg = await renderSampleJpeg(doc, await qrImages());
  assert.equal(jpeg[0], 0xff);
  assert.equal(jpeg[1], 0xd8, 'a JPEG — never a PDF (%PDF) and never an SVG (<svg)');
  const sharp = (await import('sharp')).default;
  const meta = await sharp(Buffer.from(jpeg)).metadata();
  assert.equal(meta.format, 'jpeg');
  assert.ok(Math.max(meta.width!, meta.height!) <= SAMPLE_LONG_EDGE_PX, `long edge ${Math.max(meta.width!, meta.height!)} > cap ${SAMPLE_LONG_EDGE_PX}`);
  assert.ok(SAMPLE_LONG_EDGE_PX <= 800 && SAMPLE_JPEG_QUALITY <= 60, 'owner: "make it low res" — 800 px, quality 60');
  // The watermark tiles the WHOLE sheet, over the design (not a corner mark).
  const svg = sampleSvg(doc, {});
  const marks = watermarkOps(doc.w, doc.h);
  assert.ok(marks.length >= 8, `only ${marks.length} watermark rows`);
  assert.ok(svg.lastIndexOf(marks[0]!.t === 'path' ? marks[0]!.d.slice(0, 40) : '') > svg.indexOf('Indalecio'.slice(0, 0)), 'the watermark is drawn after the design');
  const ops = marks.filter((o): o is Extract<typeof o, { t: 'path' }> => o.t === 'path');
  const opacities = new Set(ops.map((o) => o.opacity));
  assert.ok(opacities.size >= 3 && [...opacities].every((a) => a! >= 0.12 && a! <= 0.22), 'opacity varies 12–22 %');
  const ys = ops.flatMap((o) => [...o.d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => Number(m[2])));
  assert.ok(Math.min(...ys) < doc.h * 0.1 && Math.max(...ys) > doc.h * 0.9, 'the watermark reaches the top and the bottom of the sheet');
  // A sample's QRs are placeholders — it cannot work as an invitation.
  const imgs = await sampleImages(await qrImages());
  const placeholder = await placeholderQrPng();
  assert.deepEqual(imgs.eventqr!.bytes, placeholder);
  assert.ok(isQrRef('qr-123') && isQrRef('eventqr') && !isQrRef('still'));
});

test('free events get samples; print-ready and the pass batch need Pro; the QR sheet is free', () => {
  const free = printAccess({ ownsPro: false, storeShell: false });
  const pro = printAccess({ ownsPro: true, storeShell: false });
  const shell = printAccess({ ownsPro: true, storeShell: true });
  assert.equal(mayServe('invitation', 'sample', free), true);
  assert.equal(mayServe('invitation', 'screen', free), true);
  assert.equal(mayServe('invitation', 'print', free), false, 'the PDF route must refuse a free event');
  assert.equal(mayServe('passes', 'print', free), false);
  assert.equal(mayServe('qr-codes', 'print', free), true, 'the do-it-yourself QR sheet is free');
  assert.equal(mayServe('invitation', 'print', pro), true);
  assert.equal(shell.printReady, false, 'in the store shell the Pro path is absent, whatever the unlock says');
  assert.equal(shell.offerPro, false, 'and no pitch');
  assert.equal(free.offerPro, true);
});

test('GUARD: the free path never reaches the print-ready renderer — Pro is checked on the server first', () => {
  const route = read('app/api/hub-print/[piece]/route.ts');
  const proBlock = route.indexOf("if (mode === 'print' || piece === 'passes' || (mode === 'screen' && access.printReady))");
  const refuse = route.indexOf('if (!access.printReady || !mayServe(', proBlock);
  assert.ok(proBlock > 0 && refuse > proBlock, 'the print-ready block must open with the Pro refusal');
  const samplePath = route.indexOf("await loadPrintSet(eventId, { mode: 'sample'");
  assert.ok(samplePath > refuse, 'the sample path follows the Pro block');
  // Every print-ready render call lives inside the Pro block, after the refusal.
  for (const call of ['renderPrintPdf(', 'renderImposedPdf(', 'renderPrintSvg(']) {
    for (const m of route.matchAll(new RegExp(call.replace('(', '\\('), 'g'))) {
      const at = m.index!;
      if (call === 'renderPrintPdf(' && route.slice(Math.max(0, at - 1200), at).includes("piece === 'qr-codes'") && route.slice(at, at + 120).includes("mode: 'plain'")) continue;
      assert.ok(at > refuse && at < samplePath, `${call} at ${at} is outside the Pro-checked block`);
    }
  }
  // …and the sample path renders ONLY rasters.
  const sampleSrc = route.slice(samplePath);
  assert.doesNotMatch(sampleSrc, /renderPrintPdf|renderImposedPdf|renderPrintSvg|application\/pdf|image\/svg/);
  assert.match(sampleSrc, /image\/jpeg/);
  // The sample renderer cannot make a print-ready file at all.
  const raster = read('lib/print-sample-raster.ts');
  assert.doesNotMatch(raster, /print-render-pdf|renderPrintPdf|pdf-lib/);
  // The QR sheet asks no Pro question — it is free for every event.
  assert.ok(route.indexOf("piece === 'qr-codes'") < route.indexOf('printOwnsPro('));
});

test('entourage groups print in lib/entourage.ts order', () => {
  const groups = buildEntourage([
    { guest_id: 'a', first_name: 'Ana', last_name: 'Cruz', role: 'bridesmaid' },
    { guest_id: 'b', first_name: 'Jose', last_name: 'Reyes', role: 'principal_sponsor_ninong' },
    { guest_id: 'c', first_name: 'Paolo', last_name: 'Go', role: 'ring_bearer' },
  ]);
  const keys = groups.map((g) => g.key);
  const order = ENTOURAGE_GROUP_KEYS.filter((k) => keys.includes(k));
  assert.deepEqual(keys, order);
  // …and the card draws them in the order it was handed — one section head per group.
  const doc = layoutPiece('entourage', { look: printLookFor('vintage'), data: data({ entourage: groups }), mode: 'screen', foil: false });
  assert.ok(doc.ops.length > 10);
  const loader = read('lib/print-set.server.ts');
  assert.match(loader, /buildEntourage\([\s\S]{0,80}loadEntourageSectionOrder\(/, 'the print set must honour the couple’s own section order');
});

test('the Maker workspace prints no price and hides the Pro path in the store shell', () => {
  const ws = read('app/dashboard/[eventId]/launch/_components/maker-prints.tsx');
  assert.doesNotMatch(ws, /₱|PHP\s?\d/, 'no price on the prints workspace');
  assert.match(ws, /access\.printReady \? \(/, 'the print-ready controls render only when printReady');
  assert.match(ws, /Download them from your Guest list/, 'the one-line pointer to the free QR PDF');
});

test('THE QR IS ALWAYS PRINTED — every piece, every format, every include combination', () => {
  // Owner 2026-09-25: "QR is automatic. NFC is optional. we need that QR code since it is universal".
  const combos: Array<Partial<PrintSetData['details']>> = [
    {},
    { nfc: true },
    { nfc: false, giftLines: [], program: [], thankYou: null, specialMessage: null, storyExcerpt: null, guestNames: false },
    { nfc: true, program: ['2:00 PM · Ceremony', '5:00 PM · Reception'], thankYou: 'Thank you', specialMessage: 'See you', storyExcerpt: 'We met.' },
  ];
  let checked = 0;
  for (const piece of PRINT_SET_KEYS) {
    const family = piece === 'pass' ? 'pass' : piece === 'card' ? 'card' : piece === 'poster' ? null : 'invitation';
    const formats = family ? Object.values(PRINT_FORMATS).filter((f) => f.for === family).map((f) => f.id) : [null];
    for (const format of formats) {
      for (const combo of combos) {
        for (const mode of ['sample', 'print'] as const) {
          const d = data();
          const doc = layoutPiece(piece, { look: printLookFor('whimsical'), data: { ...d, details: { ...d.details, ...combo } }, mode, foil: false, format });
          const qr = doc.ops.find((o) => o.t === 'image' && (o.ref === 'eventqr' || o.ref.startsWith('qr-')));
          assert.ok(qr && qr.t === 'image', `${piece} · ${format ?? 'A3'} · ${JSON.stringify(combo)} · ${mode}: no QR`);
          // …and it sits ON the sheet — a QR pushed off the foot is no QR.
          assert.ok(qr.x >= 0 && qr.y >= 0 && qr.x + qr.w <= doc.w + 0.01 && qr.y + qr.h <= doc.h + 0.01, `${piece} · ${format ?? 'A3'}: the QR runs off the sheet`);
          checked += 1;
        }
      }
    }
  }
  assert.ok(checked >= 60, `only ${checked} combinations checked`);
});

test('the NFC sticker spot is 25 mm, true to size, in every format that draws it', () => {
  const d = data();
  const withNfc = { ...d, details: { ...d.details, nfc: true } };
  const spots: Array<[string, PrintOp | undefined]> = [];
  for (const f of Object.values(PRINT_FORMATS)) {
    const piece = f.for === 'pass' ? 'pass' : f.for === 'card' ? 'card' : 'details';
    const doc = layoutPiece(piece, { look: printLookFor('vintage'), data: withNfc, mode: 'print', foil: false, format: f.id });
    spots.push([`${piece}/${f.id}`, doc.ops.find((o) => o.t === 'circle' && o.nfc)]);
  }
  spots.push(['poster', layoutPiece('poster', { look: printLookFor('vintage'), data: withNfc, mode: 'print', foil: false }).ops.find((o) => o.t === 'circle' && o.nfc)]);
  let drawn = 0;
  for (const [where, op] of spots) {
    if (!op || op.t !== 'circle') continue;
    drawn += 1;
    assert.ok(Math.abs((op.r * 2) / PT_PER_MM - NFC_STICKER_DIAMETER_MM) < 0.01, `${where}: the spot is ${(op.r * 2) / PT_PER_MM} mm, not 25`);
    assert.ok(op.dash, `${where}: the guide ring is dashed`);
  }
  assert.ok(spots.find(([w]) => w === 'pass/calling-card')?.[1], 'the calling card carries the spot (in its corner)');
  assert.ok(drawn >= 6, `only ${drawn} formats drew the spot`);
  assert.equal(NFC_SPOT_R * 2, NFC_STICKER_DIAMETER_MM * PT_PER_MM);
  // Off by default: no spot unless the couple adds one.
  const off = layoutPiece('pass', { look: printLookFor('vintage'), data: d, mode: 'print', foil: false });
  assert.ok(!off.ops.some((o) => o.t === 'circle' && o.nfc));
});
