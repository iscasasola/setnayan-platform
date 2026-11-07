/**
 * GUARD — every sheet the service maker opens is drawn ABOVE the frame that hosts the maker.
 *
 * MEASURED LIVE 2026-11-06 (www.setnayan.com, a new supplier on Today): "What you offer → ＋ Start" opens the maker in
 * the shared `Sheet` (`setup-offer-fold.tsx`, z-50). Tapping "What you offer" opened `CanvasSheet id="canvas-kind"` —
 * whose root was `z-40` — so the picker painted BEHIND that sheet: `elementFromPoint` at its heading hit the z-50
 * modal, the tap looked dead, and since the card is "Hidden until what you offer…", no card could be made from Today.
 * The maker's Preview · Create row (`SupplierThumbRow`, portalled to <body> at z 25) was under the same sheet.
 *
 * Every layer is READ from its source (the class on the element, through the Tailwind theme to the CSS token) — no
 * number is typed here. Sabotage: put `z-40` back on CanvasSheet → test 1 red; drop `<InSheet.Provider` from the Sheet
 * or the `inSheet ?` from the row → test 4 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = process.cwd().endsWith('apps/web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const MAKER = read('app/vendor-dashboard/services/_components/canvas-maker.tsx');
const SHEET = read('app/_components/sheet.tsx');
const HOST = read('app/vendor-dashboard/_components/setup-offer-fold.tsx');
const ROW = read('app/vendor-dashboard/_components/supplier-thumb-row.tsx');
const PICK = read('app/dashboard/[eventId]/website/editor/_components/pick-menu.tsx');
const TW = read('tailwind.config.ts');
const CSS = read('app/globals.css');

/** The z-index a class list asks for: `z-50`, `z-[95]`, or a theme key (`z-sn-toast` → `var(--sn-z-toast)` → its value). */
function layerOf(classes: string): number {
  const m = /(?:^|\s)z-(\[\d+\]|\d+|[a-z][\w-]*)(?=\s|$)/.exec(classes);
  assert.ok(m, `no z- class in "${classes}"`);
  const v = m![1]!;
  if (/^\d+$/.test(v)) return Number(v);
  if (/^\[\d+\]$/.test(v)) return Number(v.slice(1, -1));
  const block = TW.slice(TW.indexOf('zIndex:'));
  const token = new RegExp(`['"]?${v}['"]?\\s*:\\s*'var\\((--[\\w-]+)\\)'`).exec(block)?.[1];
  assert.ok(token, `z-${v} is not a key of the Tailwind zIndex theme`);
  const value = new RegExp(`${token}:\\s*(\\d+)\\s*;`).exec(CSS)?.[1];
  assert.ok(value, `${token} is not defined in globals.css`);
  return Number(value);
}

/** The class list on CanvasSheet's portalled root. */
function canvasSheetLayer(): number {
  const body = MAKER.slice(MAKER.indexOf('function CanvasSheet('));
  assert.ok(body.length > 500, 'CanvasSheet is gone — re-anchor this guard on whatever draws the maker’s sheets');
  const root = /createPortal\(\s*<div hidden=\{!open\}[^>]*?className="([^"]+)"/.exec(body)?.[1];
  assert.ok(root, 'CanvasSheet no longer portals a `hidden={!open}` root with a static className');
  return layerOf(root!);
}

test('the Today host draws the maker inside the shared Sheet (so the Sheet’s layer is the one to clear)', () => {
  assert.match(HOST, /import \{ Sheet \} from '@\/app\/_components\/sheet';/);
  assert.match(HOST, /<Sheet\b[^>]*>[\s\S]*?\{maker\}[\s\S]*?<\/Sheet>/, 'SetupOfferFold no longer hosts `{maker}` in <Sheet>');
});

test('1 · CanvasSheet’s layer is above every geometry of the Sheet that hosts the maker on Today', () => {
  const canvas = canvasSheetLayer();
  const roots = [...SHEET.matchAll(/\broot:\s*'([^']+)'/g)].map((m) => m[1]!);
  assert.ok(roots.length >= 2, `found ${roots.length} Sheet root geometries — re-anchor on SHEET_AT`);
  for (const r of roots) {
    const host = layerOf(r);
    assert.ok(canvas > host, `CanvasSheet (z ${canvas}) is not above the Today sheet (z ${host}) — the maker’s pickers open BEHIND it`);
  }
});

test('2 · CanvasSheet is drawn on <body>, where its z-index is compared with the Sheet’s (not inside the Sheet’s own stack)', () => {
  const body = MAKER.slice(MAKER.indexOf('function CanvasSheet('));
  assert.match(body, /document\.body,?\s*\)/, 'CanvasSheet no longer portals to <body>');
  assert.match(SHEET, /createPortal\(sheet, host\)/, 'the Sheet no longer portals itself to <body>');
});

test('3 · a PickMenu list (the Schedule "Its own schedule ▾") opens above a CanvasSheet, and so above the Sheet', () => {
  const list = /createPortal\([\s\S]*?className="([^"]*\bz-[^"]*)"/.exec(PICK)?.[1];
  assert.ok(list, 'PickMenu no longer portals a list with a z- class');
  assert.match(PICK, /position: 'fixed'/);
  assert.ok(layerOf(list!) > canvasSheetLayer(), 'a PickMenu inside a maker sheet would open under it');
});

test('4 · inside a Sheet the maker’s Preview · Create row stays in the Sheet’s layer (never portalled under it)', () => {
  assert.match(SHEET, /export const InSheet = createContext\(false\)/);
  assert.match(SHEET, /<InSheet\.Provider value>\{children\}<\/InSheet\.Provider>/, 'the Sheet no longer tells its body it is inside a sheet');
  assert.match(ROW, /const inSheet = useContext\(InSheet\);/);
  assert.match(ROW, /const upTo = inSheet \? null : pinTools;/, 'inside a sheet the row would move up into the page’s pinned row, behind the sheet');
  const outer = ROW.slice(ROW.indexOf('export function SupplierThumbRow('), ROW.indexOf('function ThumbFit('));
  const toBody = [...outer.matchAll(/createPortal\(\s*(\w+),\s*document\.body,?\s*\)/g)].map((m) => m[1]!);
  assert.equal(toBody.length, 2, 'expected the row’s two <body> portals (band · glass)');
  for (const node of toBody) {
    assert.match(outer, new RegExp(`return inSheet \\? ${node} : createPortal\\(`), `the ${node} row is portalled under the sheet even inside one`);
  }
  // And the maker really renders it — the row this guards is the one holding Create.
  assert.match(MAKER, /<SupplierThumbRow name="maker"/);
});
