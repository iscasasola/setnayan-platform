/**
 * 🔒 THE PRINTS ROUTE LOADS ITS HEAVY DRAWERS ON DEMAND, AND THE PRINT SET STARTS ITS READS TOGETHER
 * (speed pass 2026-11-18 — a cold `/api/hub-print/invitation` took 5.2 s on live c1f9e2f).
 *
 * 1 · `app/api/hub-print/[piece]/route.ts` never imports pdf-lib, the PDF writer, the JPEG rasteriser or the seating routes
 *     at module load — an SVG preview's cold start must not evaluate them. They arrive through `lib/print-drawers-on-demand.ts`
 *     (and Everything ◆ imports pdf-lib and the seating routes inside its own function).
 * 2 · `loadPrintSet` starts the reads that need nothing from each other before the Hub picture is fetched, and awaits each
 *     on the line that always awaited it.
 * 3 · The route reads the host's draft beside the gate's three reads, never after them.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const ROUTE = 'app/api/hub-print/[piece]/route.ts';

test('1 · the prints route imports no heavy drawer statically', () => {
  const route = code(ROUTE);
  const statics = [...route.matchAll(/^import\s[^;]*?from\s+'([^']+)';/gms)].map((m) => m[1]!);
  for (const heavy of ['pdf-lib', 'sharp', '@/lib/print-render-pdf', '@/lib/print-sample-raster']) {
    assert.ok(!statics.includes(heavy), `${ROUTE} imports ${heavy} at module load — load it where a file is drawn`);
  }
  for (const seat of statics.filter((s) => s.includes('/seating/'))) assert.fail(`${ROUTE} imports ${seat} at module load — Everything ◆ imports it on demand`);
  assert.ok(statics.includes('@/lib/print-drawers-on-demand'), 'the on-demand drawers are not where the route draws from');
  // Everything ◆ imports pdf-lib and the three seating routes inside its own function.
  const every = route.slice(route.indexOf('async function everythingPdf('));
  assert.match(every, /import\('pdf-lib'\)/, 'Everything ◆ lost its pdf-lib');
  assert.equal([...every.matchAll(/import\('@\/app\/dashboard\/\[eventId\]\/seating\/(print|export|caterer)\/route'\)/g)].length, 3, 'Everything ◆ lost a seating sheet');
});

test('1b · the on-demand module only ever imports its drawers dynamically', () => {
  const lazy = code('lib/print-drawers-on-demand.ts');
  assert.doesNotMatch(lazy, /^import\s[^;]*from\s+'@\/lib\/print-(render-pdf|sample-raster)'/m, 'a static import defeats the point');
  for (const fn of ['renderPrintPdf', 'renderImposedPdf', 'renderPrintBook', 'renderSampleJpeg', 'renderSampleSheetJpeg']) {
    assert.match(lazy, new RegExp(`export const ${fn}\\b`), `${fn} is not offered on demand`);
  }
});

test('2 · loadPrintSet starts its independent reads before the Hub picture', () => {
  const src = code('lib/print-set.server.ts');
  const body = src.slice(src.indexOf('export async function loadPrintSet('), src.indexOf('export type PassGuestRow'));
  const door = body.indexOf('await printLookForEvent(');
  assert.ok(door > 0, 'the Hub-look door moved — this guard must follow it');
  for (const started of [
    'startAhead(readPrintEvent(',
    'startAhead(readPrintSetInputs(',
    'startAhead(printMarkFor(',
    'startAhead(eventSetnayanMark(',
    'startAhead(resolveEventQrLook(',
    'startAhead(eventWordsFor(',
    'startAhead(posterPhotoBytes(',
  ]) {
    const at = body.indexOf(started);
    assert.ok(at > 0 && at < door, `${started.slice(11)} no longer starts before the Hub picture is fetched`);
  }
  // Nothing is read twice: each started read is awaited, never called again.
  for (const once of ['readPrintSetInputs(', 'printMarkFor(', 'eventSetnayanMark(', 'resolveEventQrLook(', 'eventWordsFor(', 'posterPhotoBytes(']) {
    assert.equal(body.split(once).length - 1, 1, `${once} is called more than once in loadPrintSet`);
  }
  // The Hub picture's own two reads start together.
  assert.match(src, /await Promise\.all\(\[resolveHubTheme\(event\), readHeroConfig\(admin, event\.event_id\)\]\)/);
});

test('3 · the route reads the draft beside the gate reads', () => {
  const route = code(ROUTE);
  const all = route.indexOf('const [ownsPro, storeShell, printEvent, draftRead] = await Promise.all([');
  assert.ok(all > 0, 'the draft is no longer read beside the gate reads');
  assert.equal(route.split('readHubDraft(c, eventId)').length - 1, 1);
  assert.match(route, /const draft: HubDraftEvents \| null = draftRead;/);
});
