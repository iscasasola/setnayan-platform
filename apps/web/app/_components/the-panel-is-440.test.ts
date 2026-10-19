/**
 * GUARD — on the couple dashboard every sheet is ONE right-hand panel, 440 px, from the ONE line (701).
 *
 * Owner 2026-10-19, DECISION_LOG "APPROVED — COUPLE DASHBOARD DESKTOP + TABLET (AREA 2)" (Q2: *"440 · one token"*),
 * prototype `couple_dashboard_desktop_tablet_2026-10-19.html` § notes: *"Every bottom sheet is the 440-px side panel
 * … The shipped SidePanel primitive … takes the 440 token and the 701 boundary"*.
 *
 * Held as properties:
 *   1 · the token is ONE value (27.5 rem) in all three shared panels — SidePanel, the guest card's panel, the
 *       couple dashboard's Sheet geometry — and each switches at `BREAKPOINTS.tab`;
 *   2 · every hand-rolled sheet on the five area-2 pages (Home · Guests · Suppliers · Budget · a Studio product)
 *       switches on that same line — never `sm:` (640) or `lg:` (1024) — and, where it docks right, docks at 440.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const TAB = Number(/\btab\s*:\s*(\d+)/.exec(read('lib/use-responsive.ts'))?.[1]);
const CSS = read('app/globals.css');
const TOKEN_CSS = 'min(27.5rem, calc(100vw - 3.5rem))';
const TOKEN_TW = 'w-[min(27.5rem,calc(100vw-3.5rem))]';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('1 · SidePanel and the guest card panel are 440 from the line; a phone sheet rises below it', () => {
  assert.ok(TAB === 701, `BREAKPOINTS.tab is ${TAB}`);
  for (const sel of ['.sn-side-panel', '.sn-inspector-sheet']) {
    assert.match(
      CSS,
      new RegExp(`@media \\(min-width: ${TAB}px\\) \\{\\s*${esc(sel)} \\{ left: auto; width: ${esc(TOKEN_CSS)}; \\}`),
      `${sel} is not the 440 panel from ${TAB}px`,
    );
  }
  assert.match(CSS, new RegExp(`@media \\(max-width: ${TAB - 0.02}px\\) \\{\\s*\\.sn-side-panel\\[data-phone='sheet'\\]`), 'the phone sheet does not end on the line');
  assert.doesNotMatch(CSS, /\.sn-side-panel \{ left: auto; width: min\(30rem/, 'the 480 width is back');
});

test('1 · the couple dashboard Sheet docks at 440 for both widths', () => {
  const sheet = read('app/_components/sheet.tsx');
  const tab = /\n {2}tab: \{([\s\S]*?)\n {2}\},/.exec(sheet)?.[1] ?? '';
  assert.match(tab, new RegExp(`narrow: 'tab:${esc(TOKEN_TW)}'`), 'the tab sheet is not the 440 panel');
  assert.match(tab, new RegExp(`wide: 'tab:${esc(TOKEN_TW)}'`), 'the tab sheet\'s wide variant is not the same 440 panel');
});

const AREA2_DIALOGS = [
  'app/dashboard/[eventId]/_components/inline-checkout-drawer.tsx',
  'app/dashboard/[eventId]/_components/cohost-welcome.tsx',
  'app/dashboard/[eventId]/guests/_components/add-guest-sheet.tsx',
  'app/dashboard/[eventId]/guests/_components/quick-add-sheet.tsx',
  'app/dashboard/[eventId]/guests/_components/add-from-people-sheet.tsx',
  'app/dashboard/[eventId]/guests/_components/overlay-primitives.tsx',
  'app/dashboard/[eventId]/guests/_components/guests-screen.tsx',
  'app/dashboard/[eventId]/vendors/_components/accordion-build.tsx',
  'app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx',
];

test('2 · every hand-rolled sheet on the area-2 pages switches on the line, and docks at 440', () => {
  for (const rel of AREA2_DIALOGS) {
    const src = read(rel);
    const sheets = [...src.matchAll(/"([^"]*\brounded-t-(?:2xl|3xl)\b[^"]*)"/g)].map((m) => m[1]!);
    assert.ok(sheets.length > 0, `${rel}: no bottom sheet found — re-point this guard if it was rebuilt`);
    for (const cls of sheets) {
      const bps = [...new Set([...cls.matchAll(/\b(sm|md|lg|xl|tab):/g)].map((m) => m[1]))];
      assert.deepEqual(bps.filter((b) => b !== 'tab'), [], `${rel}: a sheet switches at ${bps.join(', ')} — "${cls.slice(0, 120)}…"`);
      if (/\btab:rounded-l-/.test(cls)) assert.ok(cls.includes(`tab:${TOKEN_TW}`), `${rel}: a right panel that is not 440 — "${cls.slice(0, 120)}…"`);
    }
  }
});
