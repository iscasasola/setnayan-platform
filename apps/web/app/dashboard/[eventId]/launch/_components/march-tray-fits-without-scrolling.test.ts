/**
 * 🚶 THE MARCH'S LOWER THIRD IS ITS "NOT WALKING" TRAY — scroll-less, and nothing
 * of the guided flow on it (owner, live iPhone 2026-10-06: *"Lower third shows
 * invitation 9 of 12 with back and skip for now and next. We dont want that we
 * want a scroll-less screen there. Just show screen for those not added or will
 * not walk the isle."* · *"No need to show the pdf file."*).
 *
 * `fitChips` is run against a box laid out the way `flex-wrap` lays it out, so
 * "+N more" is proven to appear exactly when the names do not fit — and never
 * when they do. The rest reads the workspace, which draws the lower third.
 *
 * `globalThis.React` before the dynamic imports: tsx compiles JSX to the classic
 * runtime here (see `hub-stage-renders.test.ts`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;

const DIR = 'app/dashboard/[eventId]/launch/_components/';
const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8');

/** A box of `w`×`h` px whose children wrap like `flex-wrap` (gap 6, rows 44 tall). */
function wrapBox(widths: number[], w: number, h: number) {
  const GAP = 6;
  const ROW = 44;
  type Node = { width: number; style: { display: string }; textContent: string; setAttribute: (k: string, v: string) => void; getBoundingClientRect: () => { bottom: number } };
  const mk = (width: number): Node => ({
    width,
    style: { display: '' },
    textContent: '',
    setAttribute: () => {},
    getBoundingClientRect: () => ({ bottom: bottoms().get(node) ?? 0 }),
  });
  let node: Node;
  const chips = widths.map((x) => (node = mk(x)));
  const more = mk(84);
  // A chip's own bottom needs its own identity: rebind per chip.
  for (const c of [...chips, more]) c.getBoundingClientRect = () => ({ bottom: bottoms().get(c) ?? 0 });
  function bottoms(): Map<Node, number> {
    const m = new Map<Node, number>();
    let x = 0;
    let row = 0;
    for (const c of [...chips, more]) {
      if (c.style.display === 'none') continue;
      if (x > 0 && x + c.width > w) {
        row += 1;
        x = 0;
      }
      m.set(c, (row + 1) * ROW + row * GAP);
      x += c.width + GAP;
    }
    return m;
  }
  const box = {
    dataset: {} as Record<string, string>,
    getBoundingClientRect: () => ({ bottom: h }),
    querySelectorAll: () => chips,
    querySelector: () => more,
  };
  const visible = () => chips.filter((c) => c.style.display !== 'none').length;
  return { box: box as unknown as HTMLElement, chips, more, visible };
}

test('names that fit: every one shows, no "+N more"', async () => {
  const { fitChips } = await import('./details-march-tray');
  const t = wrapBox([140, 120, 150], 311, 190);
  assert.equal(fitChips(t.box), 0);
  assert.equal(t.visible(), 3);
  assert.equal(t.more.style.display, 'none');
});

test('names that do not fit: the last place is "+N more", saying exactly how many — and nothing spills', async () => {
  const { fitChips } = await import('./details-march-tray');
  // The owner's tray at 375: ~300 px wide, ~190 px of chips (4 rows) — 30 names.
  const widths = Array.from({ length: 30 }, (_, i) => 120 + ((i * 37) % 110));
  const t = wrapBox(widths, 300, 194);
  const hidden = fitChips(t.box);
  assert.ok(hidden > 0);
  assert.equal(t.visible() + hidden, 30, 'a name was lost — neither shown nor counted');
  assert.equal(t.more.textContent, `+${hidden} more`);
  assert.equal(t.more.style.display, '');
  for (const c of [...t.chips.filter((c) => c.style.display !== 'none'), t.more]) {
    assert.ok(c.getBoundingClientRect().bottom <= 194.5, 'something spills past the tray — it would have to scroll');
  }
  // As many as fit: putting back the first name it set aside makes something spill.
  const firstHidden = t.chips.find((c) => c.style.display === 'none')!;
  firstHidden.style.display = '';
  assert.ok(
    [...t.chips.filter((c) => c.style.display !== 'none'), t.more].some((c) => c.getBoundingClientRect().bottom > 194.5),
    'it set aside a name that would have fit',
  );
});

test('the tray draws its names as drags, one drop zone, and never a scrolling box', async () => {
  const { renderToString } = await import('react-dom/server');
  const { MarchTray } = await import('./details-march-tray');
  const out = [
    { id: 'a', name: 'Mr. Casasola, Manuel C.', role: 'groomsman', section: 'bridesmaids_groomsmen', sectionLabel: 'Crew' },
    { id: 'b', name: 'Atty. Sacdalan-Casasola, Eufrocina M.', role: 'principal_sponsor_ninang', section: 'principal_sponsors', sectionLabel: 'Principal Sponsors' },
  ];
  const html = renderToString(React.createElement(MarchTray, { out, unread: false, lifted: null, over: null, carried: null }));
  assert.match(html, /data-march-drop="tray"/);
  assert.equal((html.match(/data-march-drag="out\|/g) ?? []).length, 2);
  assert.doesNotMatch(html, /overflow-y-auto|overflow-scroll/, 'the tray scrolls');
  assert.match(html, /data-march-tray-chips=""[^>]*overflow-hidden/);
  // Unread is said — never drawn as an empty tray.
  const unread = renderToString(React.createElement(MarchTray, { out: [], unread: true, lifted: null, over: null, carried: null }));
  assert.match(unread, /data-march-tray-unread/);
  assert.doesNotMatch(unread, /Everyone walks/);
});

test('under the march: no step line, no Back · Skip · Next, no Entourage card — the guided flow goes on from the END of the march', () => {
  const ws = read(`${DIR}details-workspace.tsx`);
  // The step sheet's head (the "Invitation · 9 of 12 ▾" line) is not drawn over the march's tray.
  assert.match(ws, /head=\{at\?\.kind === 'step' && stepHere && !marchHere \? <GuideTop /);
  // The sheet's Back · Skip · Next is not drawn under the march…
  assert.match(ws, /\{at\?\.kind === 'step' && !marchHere \? \(\s*<div data-details-guide-foot-sheet=""/);
  // …it is drawn after the march's last walk, on a phone (the desk keeps its own foot).
  assert.match(ws, /i\.key === 'march' && plan && at\?\.kind === 'step' && i\.key === selected \? \(\s*<div data-march-guide-foot="" className="mt-2 lg:hidden">\s*<GuideFoot/);
  // All items: the sheet's own header row (the "Finish · N of M" progress, the sections ▾) is not on the tray.
  assert.match(ws, /\$\{marchHere \? 'hidden' : 'flex'\} shrink-0 items-center gap-2 px-3 pb-1 pt-2 lg:hidden`\}\s*data-details-sheet-head=""/);
  // The editor's room never scrolls under the march.
  assert.match(ws, /marchHere \? 'flex flex-col overflow-hidden/);
  // Opening the march opens its tray.
  assert.match(ws, /useEffect\(\(\) => \{\s*if \(marchHere\) setSheetOpen\(true\);\s*\}, \[marchHere\]\);/);

  const parts = read(`${DIR}details-your-event-parts.tsx`);
  // The march's panel holds the tray slot first (Parents & hosts may follow it, owner 2026-10-06) — never the Entourage card.
  const marchPart = parts.slice(parts.lastIndexOf('march: ('), parts.lastIndexOf('march: (') + 900); // the PANEL's part (the first is the maker)
  assert.ok(marchPart.length > 0, 'anti-vacuity: the march part was not found');
  assert.match(marchPart, /<div data-march-tray-slot="" className="flex min-h-0 flex-1 flex-col" \/>/);
  assert.doesNotMatch(marchPart, /PrintPieceBody/, 'the march panel draws the Entourage card again');
  assert.doesNotMatch(parts, /piece="entourage"/, 'the Entourage card is back in the march');
});
