/**
 * the-maker-lower-third-holds-every-tool.test.ts — THE MAKER'S LOWER THIRD
 * (owner 2026-10-05: *"we only maximize the height on the lower third. and all
 * tools can only reside on the thumb area / lower third"* → *"approve"* of
 * `prototypes/maker_lower_third_interactive_2026-10-05_fable.html`; then *"each
 * scene and setting must be there and not links. editing should be on the
 * actual tool thirds"*).
 *
 *   1 · THE ORDER IS FIXED — top nav · the page · the lower third, in the
 *       shell's flow; inside it, "where you are" above the navigator. Nothing
 *       of the lower third is `fixed` or floats, so it can never jump above
 *       the page or below anything.
 *   2 · THE MENU HAS EXACTLY TWO GROUPS — Global settings (Theme · Settings ·
 *       Details) and Stages (Save the Date · RSVP · Invitation · The Day ·
 *       Post Event) — a sheet INSIDE the lower third, never over the page.
 *   3 · A TOOL OPEN FOLDS THE NAVIGATOR INTO THE LEFT COLUMN — the tool's name,
 *       ‹ ›, × — and the tool takes the rest: ≥ 300 px at 375.
 *   4 · EVERY OLD DOOR IS REACHABLE — each control the bottom bar, Page ▾ and
 *       the floating Event Bar held has its home in the lower third.
 *   5 · NO TOOL OF THE LOWER THIRD LINKS OUT — no `href` to another page and no
 *       router push from the lower third, a scene's sheet or a tile's note.
 *
 * Each was broken once by hand and seen RED before it was trusted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import { MAKER_LT_COLUMN_PX, MAKER_LT_TOOL, MAKER_LT_TOOL_MIN_PX } from './maker-phone-room';
import { makerDoorOf, MAKER_PAGE_STAGES, makerStageLabel } from '../app/dashboard/[eventId]/launch/_components/maker-bar';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const E = 'app/dashboard/[eventId]/website/editor/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const ROUTER = { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} };

async function shell(): Promise<string> {
  const { MakerShell } = await import(`../${L}/maker-shell`);
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  return renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: ROUTER as never },
      React.createElement(
        MakerShell,
        {
          eventId: 'e1',
          slug: 'maria-and-jose',
          liveStage: 'rsvp',
          initialStage: 'rsvp',
          storeShell: false,
          tourSlides: [],
          firstVisit: false,
          completeTourAction: async () => {},
          renderStamp: '1',
          more: null,
          hasWork: true,
        },
        React.createElement('i', { 'data-probe-work': '' }),
      ),
    ),
  );
}

async function lowerThird(props: Record<string, unknown>): Promise<string> {
  const { MakerLowerThird } = await import(`../${L}/maker-lower-third`);
  return renderToStaticMarkup(
    React.createElement(MakerLowerThird, {
      pick: 'rsvp-stage',
      pickLabel: 'RSVP',
      where: 'RSVP form',
      global: [
        { key: 'theme', label: 'Theme' },
        { key: 'settings', label: 'Settings' },
        { key: 'details', label: 'Details' },
      ],
      stages: MAKER_PAGE_STAGES.map((s) => ({ key: s, label: makerStageLabel(s) })),
      onPick: () => {},
      parts: [],
      tool: null,
      setNav: () => {},
      stepTiles: true,
      ...props,
    }),
  );
}

/* ══ 1 · THE ORDER IS FIXED ═════════════════════════════════════════════════ */

test('1 · top nav · the page · the lower third — in the shell’s flow, in that order; nothing of the lower third floats', async () => {
  const html = await shell();
  const top = html.indexOf('<header data-maker-toolbar=""');
  const page = html.indexOf('data-probe-work=""');
  const lt = html.indexOf('data-maker-lower-third=""');
  assert.ok(top >= 0 && page >= 0 && lt >= 0, 'a zone was not drawn');
  assert.ok(top < page && page < lt, `the zones are out of order: top ${top} · page ${page} · lower third ${lt}`);
  const tag = /<section\b[^>]*data-maker-lower-third=""[^>]*>/.exec(html)![0];
  const cls = /\bclass="([^"]*)"/.exec(tag)![1]!.split(/\s+/);
  for (const bad of ['fixed', 'absolute', 'sticky']) assert.ok(!cls.includes(bad), `the lower third is ${bad} — it can leave its place`);
  assert.ok(cls.includes('shrink-0') && cls.includes('relative'), 'the lower third is not a block of the shell’s flow');
  // Inside: "where you are" above the navigator.
  const where = html.indexOf('data-lt-where=""');
  const nav = html.indexOf('data-lt-navigator=""');
  assert.ok(where > lt && nav > where, '"where you are" is not above the navigator');
  // The old bottom bar is gone, not hidden.
  assert.doesNotMatch(html, /data-maker-bottom-bar|aria-label="Maker tools"/, 'the old bottom bar is back');
});

/* ══ 2 · THE MENU: EXACTLY TWO GROUPS ═══════════════════════════════════════ */

test('2 · the menu is a sheet INSIDE the lower third with exactly two groups — Global settings · Stages', async () => {
  const html = await lowerThird({});
  const groups = [...html.matchAll(/data-lt-menu-group="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(groups, ['global', 'stages'], `the menu's groups are ${groups.join(' · ')}`);
  const rowsOf = (g: string) => {
    const at = html.indexOf(`data-lt-menu-group="${g}"`);
    const seg = html.slice(at, html.indexOf('</ul>', at));
    return [...seg.matchAll(/data-lt-menu-row="([^"]+)"/g)].map((m) => m[1]);
  };
  assert.deepEqual(rowsOf('global'), ['theme', 'settings', 'details']);
  assert.deepEqual(rowsOf('stages'), ['save_the_date', 'rsvp-stage', 'rsvp', 'event', 'editorial']);
  assert.deepEqual(MAKER_PAGE_STAGES.map(makerStageLabel), ['Save the Date', 'RSVP', 'Invitation', 'The Day', 'Post Event']);
  // Inside the lower third: absolutely placed in it, shut by sliding down — never `fixed` over the page.
  const menu = /<div\b[^>]*data-lt-menu=""[^>]*>/.exec(html)![0];
  assert.match(menu, /class="absolute inset-0 /, 'the menu is not a sheet inside the lower third');
  assert.doesNotMatch(menu, /\bfixed\b/, 'the menu floats over the page');
  assert.match(menu, /aria-hidden="true"/, 'a shut menu is not hidden from a screen reader');
  // One open at a time (`lib/one-open.ts`).
  assert.match(read(`${L}/maker-lower-third.tsx`), /const menuId = useOneOpen\(menuOpen, setMenuOpen\);/);
});

/* ══ 3 · A TOOL OPEN: THE LEFT COLUMN AND ≥ 300 PX ══════════════════════════ */

test('3 · a tool open folds the menu and the navigator into the left column — name · ‹ › · × — and the tool takes ≥ 300 px', async () => {
  let closed = 0;
  const html = await lowerThird({ tool: { key: 'part:f:hero:names', name: 'Names', close: () => (closed += 1), step: { prev: null, next: () => {} } } });
  const col = /<div\b[^>]*data-lt-column=""[^>]*>/.exec(html)![0];
  assert.match(col, /\bw-\[52px\]/, 'the column is not 52 px');
  assert.doesNotMatch(col, /aria-hidden/, 'the column is hidden while a tool is open');
  assert.match(html, /data-lt-column-name=""[\s\S]*?>Names</, 'the column does not name the tool');
  assert.match(html, /data-lt-step="prev"[^>]*disabled=""/, '‹ is offered with nothing before');
  assert.doesNotMatch(/<button\b[^>]*data-lt-step="next"[^>]*>/.exec(html)![0], /\sdisabled=""/, '› is not offered');
  assert.match(html, /data-lt-close=""/, 'the column has no ×');
  // The rows step aside — out of reach of a tap and of a screen reader.
  const rows = /<div\b[^>]*data-lt-rows=""[^>]*>/.exec(html)![0];
  assert.match(rows, /aria-hidden="true"/);
  assert.match(rows, /\binert=""/);
  assert.match(rows, /-translate-x-6 opacity-0/, 'the navigator does not fold sideways');
  // …and at rest the rows carry NO transform (a transformed box would hold every fixed child).
  const rest = /<div\b[^>]*data-lt-rows=""[^>]*>/.exec(await lowerThird({}))![0];
  assert.doesNotMatch(rest, /translate-x/, 'the navigator wears a transform at rest');
  // The tool's width at 375: left 60 (column 52 + 4 + 4), right 4.
  assert.match(MAKER_LT_TOOL, /max-lg:left-\[60px\]/);
  assert.match(MAKER_LT_TOOL, /max-lg:right-1\b/);
  assert.ok(375 - (MAKER_LT_COLUMN_PX + 8) - 4 >= MAKER_LT_TOOL_MIN_PX, 'the tool is under 300 px at 375');
  // 200–280 ms, instant under Reduce Motion.
  const src = read(`${L}/maker-lower-third.tsx`);
  for (const m of src.matchAll(/duration-\[(\d+)ms\]/g)) assert.ok(Number(m[1]) >= 200 && Number(m[1]) <= 280, `a ${m[1]} ms move`);
  assert.ok((src.match(/motion-reduce:transition-none/g) ?? []).length >= 3, 'a move is not instant under Reduce Motion');
  assert.equal(closed, 0, 'drawing the column closed the tool');
});

test('3 · the part tapped on the page is a tool: the part sheet registers, and ‹ › step to its scene’s other parts', () => {
  const sheet = read(`${E}/element-sheet.tsx`);
  assert.match(sheet, /useMakerTool\(true, \{\s*key: `part:\$\{target\.key\}:\$\{target\.el\}`,\s*name: HUB_ELEMENT_LABEL\[target\.el\],\s*close: onClose,\s*step: \{ prev: prevPart && onPart \? \(\) => onPart\(prevPart\) : null, next: nextPart && onPart \? \(\) => onPart\(nextPart\) : null \},/);
  assert.match(sheet, /\$\{MAKER_LT_TOOL\}/, 'the part sheet is not in the lower third');
  assert.match(sheet, /<ISegmented label="Edit this part">/, 'the part sheet lost Text · Motion · Arrange');
});

/* ══ 4 · EVERY OLD DOOR IS REACHABLE ════════════════════════════════════════ */

test('4 · every control the bottom bar, Page ▾ and the floating Event Bar held has its home in the lower third', () => {
  const shellSrc = read(`${L}/maker-shell.tsx`);
  // Page ▾'s stages → the menu's Stages; its pages → a stage's PARTS (`pickPage`).
  assert.match(shellSrc, /const ltStages = MAKER_PAGE_STAGES\.filter/);
  assert.match(shellSrc, /onPick: \(\) => pickPage\(o\.key\),/, 'a stage’s pages are not its parts');
  // Look → Theme · Event Details → Details (the same doors, on the navigator).
  assert.match(shellSrc, /if \(key === 'theme'\) return openDoorOnNavigator\('look'\);/);
  assert.match(shellSrc, /if \(key === 'details'\) return openDoorOnNavigator\('details'\);/);
  // Page ▾'s other rows and the canvas's Event Bar → Settings.
  const settings = shellSrc.slice(shellSrc.indexOf("ltPick === 'settings'"), shellSrc.indexOf(': isStagePhase(ltPick)'));
  const DOORS: Array<[string, RegExp]> = [
    ['Event Bar', /key: 'event-bar'[\s\S]*?toggle: true, on: eventBar\.on, onPick: eventBar\.toggle/],
    ['Who can view', /key: 'who'[\s\S]*?onPick: \(\) => setMoreOpen\(true\)/],
    ['Prints', /key: 'prints'[\s\S]*?pressDoor\('prints'\)/],
    ['Restore what guests see', /key: 'restore'[\s\S]*?draft\.restore\(\)/],
    ['Reset this stage…', /key: 'reset'[\s\S]*?new Event\(MAKER_OPEN_RESET_EVENT\)/],
    ['About the Maker', /key: 'about'[\s\S]*?setTour\(true\)/],
  ];
  for (const [door, re] of DOORS) assert.match(settings, re, `${door} has no home in Settings`);
  // The address is Details › Your Event Hub (a Details item, on the Details door).
  assert.equal(makerDoorOf('address'), 'details');
  // ＋ Add a scene stays the strip's last tile — the strip IS the stage's navigator on a phone.
  const work = read(`${E}/editor-shell.tsx`);
  assert.match(work, /<IntoLowerThird to=\{ltNav\}>[\s\S]*triggerLabel="\+ Add a scene"[\s\S]*<\/IntoLowerThird>/, 'Add a scene is not in the navigator');
  // The canvas's floating Event Bar switch is a desktop's only; a phone's is Settings' tile.
  assert.match(work, /setEventBar\?\.\(publicLandingUrl \? \{ on: guestBars, toggle: \(\) => toggleRef\.current\(\) \} : null\);/);
  assert.match(work, /<div className="flex w-full shrink-0 items-center justify-end gap-1 pt-1\.5 max-lg:hidden">\s*<button\s+type="button"\s+role="switch"/);
  // The RSVP's three screens, Details' items and the logo's two panels draw THEIR tiles into the navigator.
  assert.match(read(`${L}/maker-rsvp-stage.tsx`), /<IntoLowerThird to=\{maker\.ltNav\}>/);
  assert.match(read(`${L}/details-workspace.tsx`), /<IntoLowerThird to=\{ltNav\}>/);
  assert.match(read(`${L}/maker-logo.tsx`), /<IntoLowerThird to=\{ltNav\}>/);
});

/* ══ 5 · NO TOOL OF THE LOWER THIRD LINKS OUT ═══════════════════════════════ */

test('5 · no href to another page and no router push from the lower third, a scene’s sheet or a tile’s note', () => {
  const lt = read(`${L}/maker-lower-third.tsx`);
  assert.doesNotMatch(lt, /\bhref=|<Link\b|router\.|location\.(?:href|assign)|window\.open/, 'the lower third links out');
  const work = read(`${E}/editor-shell.tsx`);
  const inspector = work.slice(work.indexOf('function Inspector('), work.indexOf('function makerSelectionKey('));
  assert.ok(inspector.length > 2000, 'the scene sheet was not found — this scan is blind');
  assert.doesNotMatch(inspector, /<Link\b|href=\{`\/dashboard|router\.(?:push|replace)|onOpenTool/, 'a scene sheet links out of the Maker');
  const nav = work.slice(work.indexOf('aria-label="Scenes"'), work.indexOf('aria-label="Preview"'));
  assert.ok(nav.length > 2000, 'the navigator was not found — this scan is blind');
  assert.doesNotMatch(nav, /<Link\b|href=\{`\/dashboard/, 'a tile’s note links out of the Maker');
  // The fixed scenes' "where it comes from" is said, never linked.
  assert.match(inspector, /data-maker-fixed-source=\{fixed\}>\s*\{f\.source\.text\}\s*<\/p>/);
});
