/**
 * 📤 BUDGET SHARES ONE FILE — owner 2026-10-29, from the iPhone app: *"Print Budget can be just a share button if it
 * has the print and share there as well? and maximize every other method to share that file? Buttons not shown on
 * design template. fix how that pdf file/page looks"*.
 *
 *   1. Budget offers ONE Share for the budget — the house `ActionButton`, through the shared save (`usePrintSave`:
 *      the phone's share sheet / a download) — and no print PAGE (no `PrintBudgetLink`, no `location.assign`, no
 *      in-app browser), so nothing can open a view the app is trapped in. Print on a computer is offered only after a
 *      DOWNLOAD and never inside the app.
 *   2. The route answers with a PDF FILE (attachment), never an HTML page; it reads nothing before the access gate.
 *   3. 🛑 THE PDF NEVER PRINTS ₱0 FOR "UNKNOWN": `budgetPdf` refuses when any of the three money reads was refused,
 *      and a figure that is absent (no target) prints "—". Read from the FILE's own words (the invisible text layer
 *      carries exactly the words drawn as outlines), not from a flag.
 *   4. A long budget paginates without splitting a row: every line's label and its amount land on the SAME page.
 *   5. No device chrome on paper: no "Done", no "Print or save", no button words.
 *   6. PAPER (owner 2026-10-29, "always use A4?"): A4 (default) · Letter · Long bond each reflow — the sheet is that
 *      size and no row splits on it; posters take A4…A0 · Custom, landscape included; a document route cannot be asked
 *      for a poster size.
 *
 * 🛡 SABOTAGE (2026-10-29, each seen RED, then restored):
 *   · `budgetPdf`'s `if (!moneyReadsAllOk(money)) throw new BudgetUnreadError()` removed → test 3 fails
 *     ("a refused suppliers read still made a file");
 *   · a second Share (`<SharePdfButton … />` pasted twice) on Budget → test 1 fails ("found 2");
 *   · `sheetPoints` drawing every paper as A4 → tests 6 and 6b fail (a Letter page measured 595×842).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';

import { stripComments } from '@/lib/strip-comments';
import { BudgetUnreadError, budgetPdf, budgetPdfModel, peso } from '@/lib/budget-pdf';
import { SHARE_PDF_DOCUMENT_PAPERS, SHARE_PDF_POSTER_PAPERS, customPaper, sharePdf, sharePdfPaper, type SharePdfPaper } from '@/lib/share-pdf';
import type { EventMoney, MoneyLine } from '@/lib/budget-truth';
import type { BudgetLedger } from '@/lib/budget-ledger';

const here = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(here, '..');
const read = (rel: string) => stripComments(readFileSync(resolve(WEB, rel), 'utf8'));
const PAGE = 'app/dashboard/[eventId]/budget/page.tsx';
const BUTTON = 'app/_components/share-pdf-button.tsx';
const ACTIONS = 'app/dashboard/[eventId]/budget/_components/budget-file-actions.tsx';
const ROUTE = 'app/api/budget/[eventId]/export/route.ts';

function line(p: Partial<MoneyLine>): MoneyLine {
  return {
    costKey: p.label ?? 'k',
    label: 'Line',
    bucket: 'catering',
    amountPhp: 0,
    kind: 'committed',
    paidPhp: 0,
    stillOwedPhp: 0,
    source: 'vendor_package',
    sourceRef: 'x',
    vendorId: null,
    vendorName: null,
    readOnly: false,
    dueDate: null,
    bookedOn: null,
    daysUntilDue: null,
    dueState: 'none',
    ...p,
  } as MoneyLine;
}

function moneyOf(lines: MoneyLine[], over: Partial<EventMoney> = {}): EventMoney {
  const agreed = lines.filter((l) => l.kind === 'committed');
  const committed = agreed.reduce((a, l) => a + l.amountPhp, 0);
  const paid = agreed.reduce((a, l) => a + l.paidPhp, 0);
  return {
    reads: { suppliers: 'ok', orders: 'ok', costs: 'ok' },
    targetPhp: 1_000_000,
    estimated: 0,
    committed,
    paid,
    stillOwed: committed - paid,
    overpaid: 0,
    isOverBudget: false,
    overBudgetByPhp: 0,
    lines,
    byBucket: [],
    ...over,
  } as unknown as EventMoney;
}

const LEDGER = {
  rows: [{ bucketId: 'catering', label: 'Catering', plannedPhp: 300_000, plannedSource: 'saved', agreedPhp: 250_000, paidPhp: 50_000, owedPhp: 200_000 }],
} as unknown as BudgetLedger;

const BASE = { eventName: 'Rosa & Ben', eventDate: 'Saturday · December 12, 2026', venue: 'Manila Hotel', generatedAt: new Date('2026-10-29T03:00:00Z') };

/** The words each page of the FILE carries, in drawing order — the invisible layer's `<hex> Tj` operands, decoded. */
async function wordsByPage(bytes: Uint8Array): Promise<string[][]> {
  const doc = await PDFDocument.load(bytes);
  // WinAnsi byte → character, for the bytes these tests use.
  const decode = (hex: string) =>
    Buffer.from(hex, 'hex')
      .toString('latin1')
      .replace(/\x97/g, '—')
      .replace(/\x95/g, '•');
  return doc.getPages().map((page) => {
    const contents = page.node.get(PDFName.of('Contents'));
    const refs = contents && 'asArray' in contents ? (contents as unknown as { asArray(): unknown[] }).asArray() : [contents];
    const out: string[] = [];
    for (const ref of refs) {
      const stream = doc.context.lookup(ref as never);
      if (!(stream instanceof PDFRawStream)) continue;
      const raw = Buffer.from(stream.contents);
      const filtered = stream.dict.get(PDFName.of('Filter'));
      const text = (filtered ? inflateSync(raw) : raw).toString('latin1');
      for (const m of text.matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g)) out.push(decode(m[1]!));
    }
    return out;
  });
}

test('1 · Budget shows ONE Share for the budget, on the house template, through the shared save — no print page', () => {
  const page = read(PAGE);
  const mounts = page.match(/<BudgetFileActions\b/g) ?? [];
  assert.equal(mounts.length, 1, `Budget must mount its file actions once — found ${mounts.length}`);
  assert.match(page, /<BudgetFileActions eventId=\{eventId\} fileSlug=\{budgetFileSlug\} moneyAnswered=\{money !== null\} \/>/);
  const actions = read(ACTIONS);
  const shares = [...page.matchAll(/<SharePdfButton\b/g), ...actions.matchAll(/<SharePdfButton\b/g)];
  assert.equal(shares.length, 1, `Budget must offer exactly one Share for the budget — found ${shares.length}`);
  assert.match(
    actions,
    /<SharePdfButton\s+href=\{`\/api\/budget\/\$\{eventId\}\/export\?format=pdf`\}\s+fileName=\{`setnayan-\$\{fileSlug\}-budget\.pdf`\}\s+name="Share your budget \(PDF\)"\s+papers="document"\s*\/>/,
    'Share no longer fetches the budget PDF with the document papers',
  );
  assert.match(actions, /from '@\/app\/_components\/share-pdf-button'/, 'Budget left the shared Share button');
  for (const src of [page, actions]) {
    assert.doesNotMatch(src, /PrintBudgetLink|Print budget|\/export`\}|SaveFileLink/, 'the print PAGE (or a non-template file link) is back on Budget');
  }
  // The other two files wear the same template and the same save.
  assert.equal((actions.match(/<PrintSaveButton\s+variant="action"/g) ?? []).length, 2, 'the spreadsheet / calendar file left the ActionButton template');

  const button = read(BUTTON);
  assert.match(button, /from '@\/app\/dashboard\/\[eventId\]\/launch\/_components\/print-save-button'/, 'Share left the shared save path (usePrintSave)');
  assert.match(button, /const \{ state, save \} = usePrintSave\(\);/);
  assert.match(button, /<ActionButton\b[\s\S]{0,400}?icon=\{state\.k === 'working' \? [\s\S]{0,120}: Share\}/, 'Share is not the house ActionButton with the share icon');
  assert.match(button, /onClick=\{\(\) => void save\(url, fileName\)\}/, 'Share does not save the file it names');
  assert.match(button, /paper=\$\{encodeURIComponent\(sharePdfPaperParam\(paper\)\)\}/, 'the picked paper does not reach the route');
  // Nothing that opens a page in the app's only view.
  assert.doesNotMatch(button, /location\.assign|location\.href\s*=|openEventHub|<a\b/, 'Share opens a page — the app can be trapped in it');
  // Print (a computer only): after a DOWNLOAD, never inside the app.
  assert.match(button, /state\.k === 'saved' && state\.via === 'download' && !isNativeApp\(\)/, 'Print is offered where it can trap the app');
});

test('2 · the route answers with a PDF file, never an HTML page, and reads nothing before the access gate', () => {
  const s = read(ROUTE);
  assert.doesNotMatch(s, /text\/html|budgetExportHtml/, 'the export route still serves a print page');
  assert.match(s, /'Content-Type': 'application\/pdf'/);
  assert.match(s, /'Content-Disposition': `attachment; filename="setnayan-\$\{fileSlug\}-budget\.pdf"`/);
  const gate = s.indexOf('if (!access.mayRead)');
  for (const call of ['loadVenueBookings(', 'resolveEventMoney(', 'budgetPdf(']) {
    const at = s.indexOf(call);
    assert.ok(at > gate && gate > 0, `${call} runs before the budget access gate`);
  }
  assert.match(s, /if \(e instanceof BudgetUnreadError\) return unread\(\);/, 'a refused read inside the PDF builder is not turned into the refusal');
});

test('3 · 🛑 a refused money read makes NO file — and an absent figure prints "—", never ₱0', async () => {
  const lines = [line({ label: 'Catering package', amountPhp: 250_000, paidPhp: 50_000, stillOwedPhp: 200_000 })];
  for (const source of ['suppliers', 'orders', 'costs'] as const) {
    const money = moneyOf(lines, { reads: { suppliers: 'ok', orders: 'ok', costs: 'ok', [source]: 'failed' } } as never);
    await assert.rejects(budgetPdf({ ...BASE, money, ledger: LEDGER }), BudgetUnreadError, `a refused ${source} read still made a file`);
  }
  assert.equal(peso(null), '—');
  assert.equal(peso(undefined), '—');
  assert.equal(peso(Number.NaN), '—');
  assert.equal(peso(0), '₱0', 'a real zero is still a zero');

  const words = (await wordsByPage(await budgetPdf({ ...BASE, money: moneyOf(lines, { targetPhp: null }), ledger: LEDGER }))).flat();
  assert.ok(words.length > 10, `the file carries only ${words.length} words — the reader is broken`);
  const t = words.indexOf('TARGET');
  assert.ok(t >= 0, 'the summary has no Target');
  assert.equal(words[t + 1], '—', `no target set printed "${words[t + 1]}" instead of "—"`);
  for (const [k, v] of [['AGREED', 'PHP 250,000'], ['PAID', 'PHP 50,000'], ['OWED', 'PHP 200,000']] as const) {
    assert.equal(words[words.indexOf(k) + 1], v, `${k} is not the resolver's own figure`);
  }
});

test('4 · quotes never print, and a long budget paginates without splitting a row', async () => {
  const many: MoneyLine[] = [];
  for (let i = 1; i <= 60; i++) {
    const n = String(i).padStart(2, '0');
    many.push(line({ label: `Row ${n} item`, vendorName: `Supplier ${n}`, bucket: ['catering', 'venue', 'photo_video'][i % 3]!, amountPhp: 100_000 + i * 1_111, stillOwedPhp: 100_000 + i * 1_111, dueDate: '2026-12-01' }));
  }
  many.push(line({ label: 'A QUOTE NOBODY AGREED TO', kind: 'estimated', amountPhp: 999_999 }));
  const money = moneyOf(many);
  assert.ok(!budgetPdfModel(money, LEDGER).sections.some((s) => s.lines.some((l) => l.kind !== 'committed')), 'a quote reached a section');

  const pages = await wordsByPage(await budgetPdf({ ...BASE, money, ledger: LEDGER }));
  assert.ok(pages.length >= 3, `60 rows fit on ${pages.length} page(s) — the pagination did not run`);
  const all = pages.flat();
  assert.ok(!all.some((w) => w.includes('A QUOTE NOBODY AGREED TO')), 'a quote reached the file');
  for (let i = 1; i <= 60; i++) {
    const n = String(i).padStart(2, '0');
    const label = `Row ${n} item`;
    const onPages = pages.map((p, at) => (p.includes(label) ? at : -1)).filter((at) => at >= 0);
    assert.equal(onPages.length, 1, `${label} is on ${onPages.length} pages`);
    const p = pages[onPages[0]!]!;
    const amount = `PHP ${(100_000 + i * 1_111).toLocaleString('en-PH')}`;
    assert.ok(p.includes(`Supplier ${n}`) && p.includes(amount), `${label} was split from its supplier or its amount across a page break`);
  }
  // Every page says which page it is.
  pages.forEach((p, i) => assert.ok(p.includes(`Page ${i + 1} of ${pages.length}`), `page ${i + 1} has no page number`));
});

test('5 · no device chrome on paper — no Done, no print button, no back bar', async () => {
  const words = (await wordsByPage(await budgetPdf({ ...BASE, money: moneyOf([line({ label: 'Venue', amountPhp: 5_000 })]), ledger: LEDGER }))).flat();
  assert.ok(words.length > 10);
  for (const w of words) assert.doesNotMatch(w, /‹|\bDone\b|Print or save|Download|Tap to/i, `"${w}" is device chrome printed on paper`);
  assert.ok(words.includes('SETNAYAN') && words.includes('Rosa & Ben'), 'the head lost the mark line or the event name');
});

function manyRows(n: number): MoneyLine[] {
  const out: MoneyLine[] = [];
  for (let i = 1; i <= n; i++) {
    const k = String(i).padStart(2, '0');
    out.push(line({ label: `Row ${k} item`, vendorName: `Supplier ${k}`, bucket: ['catering', 'venue', 'photo_video'][i % 3]!, amountPhp: 100_000 + i * 1_111, stillOwedPhp: 100_000 + i * 1_111, dueDate: '2026-12-01' }));
  }
  return out;
}

test('6 · every document paper reflows: the sheet is its size, and no row splits on it', async () => {
  assert.deepEqual([...SHARE_PDF_DOCUMENT_PAPERS], ['a4', 'letter', 'long'], 'A4 first (the default), then Letter and Long bond');
  const counts: Record<string, number> = {};
  for (const paper of SHARE_PDF_DOCUMENT_PAPERS) {
    const bytes = await budgetPdf({ ...BASE, money: moneyOf(manyRows(48)), ledger: LEDGER, paper });
    const doc = await PDFDocument.load(bytes);
    // Literal sizes — never the engine's own table, which a sabotage of it would also move.
    const want = { a4: { w: 595.28, h: 841.89 }, letter: { w: 612, h: 792 }, long: { w: 612, h: 936 } }[paper as 'a4' | 'letter' | 'long'];
    for (const p of doc.getPages()) {
      const { width, height } = p.getSize();
      assert.ok(Math.abs(width - want.w) < 0.5 && Math.abs(height - want.h) < 0.5, `${paper}: a page is ${width}×${height}, not ${want.w}×${want.h}`);
    }
    const pages = await wordsByPage(bytes);
    counts[paper] = pages.length;
    for (let i = 1; i <= 48; i++) {
      const k = String(i).padStart(2, '0');
      const on = pages.filter((p) => p.includes(`Row ${k} item`));
      assert.equal(on.length, 1, `${paper}: Row ${k} is on ${on.length} pages`);
      assert.ok(on[0]!.includes(`Supplier ${k}`) && on[0]!.includes(`PHP ${(100_000 + i * 1_111).toLocaleString('en-PH')}`), `${paper}: Row ${k} split across a page break`);
    }
  }
  assert.ok(counts.long! <= counts.letter!, `long bond (${counts.long}) used more pages than letter (${counts.letter}) — it did not reflow to its height`);
  // A document route cannot be asked for a poster sheet; anything unknown is A4.
  assert.equal(sharePdfPaper('letter'), 'letter');
  assert.equal(sharePdfPaper('LONG'), 'long');
  assert.equal(sharePdfPaper('a0'), 'a4');
  assert.equal(sharePdfPaper('custom:1000x1000'), 'a4');
  assert.equal(sharePdfPaper('nonsense'), 'a4');
  assert.equal(sharePdfPaper(null), 'a4');
});

test('6b · poster papers: A4 · A3 · A2 · A1 · A0 · Custom, portrait or landscape', async () => {
  assert.deepEqual([...SHARE_PDF_POSTER_PAPERS], ['a4', 'a3', 'a2', 'a1', 'a0', 'custom'], 'smallest first, then Custom');
  assert.equal(sharePdfPaper('a0', SHARE_PDF_POSTER_PAPERS), 'a0');
  const custom = customPaper(60, 90, 'cm');
  assert.ok(custom && Math.abs(custom.w - (60 / 2.54) * 72) < 0.05, 'a custom size in cm is not turned into points');
  assert.equal(customPaper(5, 90, 'cm'), null, 'a side under 10 cm is refused');
  assert.equal(customPaper(Number.NaN, 90, 'in'), null);
  const back = sharePdfPaper(`custom:${custom!.w}x${custom!.h}`, SHARE_PDF_POSTER_PAPERS) as Exclude<SharePdfPaper, string>;
  assert.ok(typeof back === 'object' && Math.abs(back.w - custom!.w) < 0.05, 'a custom size does not survive the query');
  const doc = { kind: 'Seat plan', title: 'Rosa & Ben', sections: [], generatedAt: BASE.generatedAt };
  const a3 = await PDFDocument.load(await sharePdf({ ...doc, paper: 'a3', orientation: 'landscape' }));
  const { width, height } = a3.getPage(0).getSize();
  assert.ok(width > height && Math.abs(width - 1190.55) < 0.5, `A3 landscape drew ${width}×${height}`);
  const big = await PDFDocument.load(await sharePdf({ ...doc, paper: custom! }));
  assert.ok(Math.abs(big.getPage(0).getSize().height - custom!.h) < 0.5, 'a custom sheet is not its size');
});

