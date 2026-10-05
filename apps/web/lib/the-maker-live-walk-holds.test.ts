/**
 * the-maker-live-walk-holds.test.ts — what the controller's live walk of the
 * Maker at 375 px found on maria-and-jose (2026-10-05, train #6361), held:
 *
 *   1 · ONE TAP ON A PART OPENS ITS TOOLS. Tapping words on the page showed the
 *       old floating type bar (✓ Done · Wording ▾ · Style ▾ · Hide) over the
 *       scene navigator; the part's tools came only after Style. On a phone the
 *       tap now opens the part's own tools in the lower third (Text first), the
 *       type bar's rows are drawn INSIDE the Text tools, and nothing floats.
 *   2 · THE TICKET NEVER SHOWS BLANK. The Guest's ticket scene was white for
 *       ~8 s while the server drew it. The ticket's shape (the guest card's
 *       placeholder, one component) holds the page until the picture LOADS,
 *       and the picture is asked for once its stage is on screen.
 *   3 · THE GUIDE OWNS THE LOWER THIRD. The guided stage picker sat over
 *       Theme's navigator — two things at once. While the flow shows a screen
 *       of its own, the lower third is only its menu (EXECUTED below), and the
 *       flow's sheet folds it only on a step, where the sheet is drawn.
 *   4 · EVERY PAGE TILE OPENS ITS PAGE. "Our Love Story" / "Me" did nothing: a
 *       page of the stage on screen waited for a canvas bar that never came,
 *       and an empty Love Story was a dead tile. Now it jumps, or opens Details'
 *       Love Story.
 *   5 · NO UNNAMED vendor_profiles EMBED ON event_vendors. Two keys reach it;
 *       PostgREST refuses an unnamed embed (PGRST201) — the Maker's Mood Board
 *       read failed on every open since 2026-09-05 and fell to `[]`.
 *
 * Each was broken once by hand and seen RED before it was trusted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import { MAKER_PAGE_STAGES, makerStageLabel } from '../app/dashboard/[eventId]/launch/_components/maker-bar';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const E = 'app/dashboard/[eventId]/website/editor/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
/** The text between two anchors (both must exist). */
const between = (src: string, from: string, to: string) => {
  const a = src.indexOf(from);
  assert.ok(a > -1, `anchor moved: ${from}`);
  const b = src.indexOf(to, a + from.length);
  assert.ok(b > -1, `anchor moved: ${to}`);
  return src.slice(a, b);
};

test('1 · a phone tap on a part opens its tools (Text), and the type rows sit inside them — nothing floats', () => {
  const shell = read(`${E}/editor-shell.tsx`);
  const onType = between(shell, 'const start = readTypeStart(event.data, event.source, Date.now());', 'setTypeStart(start);\n    };');
  const phone = between(onType, 'window.innerWidth < 1024 && elementEditingRef.current', 'return;');
  assert.match(phone, /sheetDo\(\{ t: 'tapPart'/, 'a phone tap on words does not open the part’s tools');
  assert.match(phone, /sheetDo\(\{ t: 'section', section: 'text' \}\)/, 'the part’s tools do not open on Text (where Wording is)');
  assert.match(phone, /setTypeInline\(true\)/, 'the type rows are not drawn inside the tools');
  assert.doesNotMatch(phone, /setElementTarget\(null\)/, 'the phone tap closes the part’s tools again');
  // The bar is handed its slot inside the Text tools, and the tools hand that slot in.
  assert.match(shell, /inline=\{typeInline \? \{ slot: typeSlot \} : null\}/, 'the type bar is not told it is inline');
  assert.match(shell, /<div ref=\{setTypeSlot\} data-type-slot="" \/>/, 'the part’s tools carry no slot for the type rows');
  // Closing the tools ends the typing (× is Done).
  assert.match(shell, /elementTarget\.key !== t\.key \|\| elementTarget\.el !== t\.el\) endTypingRef\.current\(\)/, 'closing the part’s tools leaves the typing running');

  const bar = read(`${E}/type-in-place.tsx`);
  const inline = between(bar, 'if (p.inline) {', 'const phone = typeof window');
  assert.match(inline, /createPortal\(/, 'the inline rows are not drawn into the slot');
  assert.match(inline, /p\.inline\.slot/, 'the inline rows are not drawn into the slot');
  assert.doesNotMatch(inline, /fixed|Done|Style ▾|data-type-hide/, 'the inline rows grew the floating bar’s chrome back');
  assert.match(inline, /data-type-wording/, 'Wording ▾ is missing from the part’s Text tools');
  // Inline, a tap in the tools must not end the typing.
  assert.match(bar, /if \(!inline\) window\.addEventListener\('pointerdown', onDown, true\)/, 'a tap inside the tools closes the inline rows');

  // The lower third never steals the caret from the page.
  const lt = read(`${L}/maker-lower-third.tsx`);
  assert.match(lt, /if \(document\.activeElement instanceof HTMLIFrameElement\) return;/, 'opening the tools takes the caret off the page');

  // The sheet open beside the typing builds on the typed words, not its own stale copy.
  const sheet = read(`${E}/element-sheet.tsx`);
  assert.match(sheet, /hearDraftedCanvas\(\(type\) => \{/, 'the part’s tools do not hear the words typed beside them');
});

test('2 · the Guest’s ticket: its shape under the picture until it LOADS, and the picture asked for early', async () => {
  const { TicketPlaceholder } = await import('../app/_components/ticket-placeholder');
  const html = renderToStaticMarkup(React.createElement(TicketPlaceholder, { name: null, waiting: true, size: 'stage' }));
  assert.match(html, /data-guest-ticket-waiting=""/, 'the stage placeholder draws nothing');
  assert.match(html, /<svg/, 'the stage placeholder lost its QR mark');
  assert.doesNotMatch(html, /bg-white/, 'the placeholder paints white');

  const shell = read(`${E}/editor-shell.tsx`);
  const view = between(shell, 'data-maker-ticket-view={ticketDesign}', '{bothTooNarrow ?');
  const ph = view.indexOf('<TicketPlaceholder');
  const img = view.indexOf('<img');
  assert.ok(ph > -1 && img > ph, 'the placeholder must sit UNDER the picture (drawn before it)');
  assert.match(view, /onLoad=\{\(e\) => setTicketLoaded\(e\.currentTarget\.getAttribute\('src'\)\)\}/, 'nothing records that the ticket arrived');
  assert.match(view, /'opacity-100' : 'opacity-0'/, 'the ticket is visible before it has loaded');
  assert.match(view, /img\?\.complete && img\.naturalWidth > 0/, 'a cached ticket stays behind the placeholder');
  // Asked for once the stage holding the scene is on screen.
  const ask = between(shell, 'const ticketInStage =', '}, [ticketInStage, canvasSrc, eventId, ticketDesign]);');
  assert.match(ask, /t\.fixed === MAKER_FIXED_TICKET/, 'the early ask is not tied to the ticket’s stage');
  assert.match(ask, /img\.src = src/, 'the ticket is not asked for before it is shown');
  assert.match(ask, /makerTicketSrc\(eventId, ticketDesign\)/, 'the early ask is not the address the scene draws');
});

const LT_PROPS = {
  pick: 'theme',
  pickLabel: 'Theme',
  where: 'Background',
  global: [{ key: 'theme', label: 'Theme' }],
  stages: MAKER_PAGE_STAGES.map((s) => ({ key: s, label: makerStageLabel(s) })),
  onPick: () => {},
  parts: [{ key: 'theme:look', label: 'Background', on: false, onPick: () => {} }],
  tool: null,
  setNav: () => {},
  stepTiles: true,
};

test('3 · the guided flow’s own screen: the lower third is ONLY its menu (executed)', async () => {
  const { MakerLowerThird } = await import(`../${L}/maker-lower-third`);
  const bare = renderToStaticMarkup(React.createElement(MakerLowerThird, { ...LT_PROPS, bare: true }));
  const nav = /<div[^>]*data-lt-navigator=""[^>]*>/.exec(bare)?.[0] ?? '';
  assert.ok(nav, 'the navigator vanished from the markup');
  assert.match(nav, /class="(?:[^"]* )?hidden(?: [^"]*)?"/, 'the guide’s screen still shows an item’s navigator under it');
  assert.match(bare, /data-lt-bare=""/, 'the lower third does not shrink to its menu');
  assert.match(bare, />Menu</, 'the menu still wears an item’s name under the guide');
  assert.match(bare, /class="[^"]*\binvisible\b[^"]*" data-lt-where-words=""/, 'an item’s name is still shown under the guide');

  const normal = renderToStaticMarkup(React.createElement(MakerLowerThird, { ...LT_PROPS, bare: false }));
  const nav2 = /<div[^>]*data-lt-navigator=""[^>]*>/.exec(normal)?.[0] ?? '';
  assert.doesNotMatch(nav2, /class="(?:[^"]* )?hidden(?: [^"]*)?"/, 'the navigator is hidden outside the guide');
  assert.doesNotMatch(normal, /data-lt-bare/, 'the lower third is short outside the guide');

  // The flow says when it is on a screen of its own, and its sheet folds the lower third only on a step.
  const work = read(`${L}/details-workspace.tsx`);
  assert.match(work, /const guideBare = at !== null && at\.kind !== 'step';/, 'the flow does not say when it shows a screen of its own');
  assert.match(work, /tool=\{at\?\.kind === 'step'\}/, 'the flow’s sheet folds the lower third while it is not drawn');
  const sheet = read(`${L}/maker-sheet.tsx`);
  assert.match(sheet, /useMakerTool\(inMaker && tool && Boolean\(state\.target\)/, 'a sheet not drawn still folds the lower third');
  const shell = read(`${L}/maker-shell.tsx`);
  assert.match(shell, /bare=\{phone && guideBare && \(openDoor === 'look' \|\| openDoor === 'details'\)\}/, 'the shell does not hand the guide’s state to the lower third');
});

test('4 · every page tile opens its page — this stage’s at once, an empty Love Story its editor', () => {
  const editor = read(`${E}/editor-shell.tsx`);
  const jump = between(editor, 'if (!pageJump || pageJump.stage !== stage) return;', 'if (page) jumpRef.current(page);');
  assert.match(jump, /if \(!pageJump\.sameStage && \(!canvasBar \|\| canvasBar === jumpWaits\.current\.bar\)\) return;/, 'a page of this stage waits for a bar that may never come');
  const shell = read(`${L}/maker-shell.tsx`);
  const tiles = between(shell, 'const storyEditor =', ': () => pickPage(o.key),');
  assert.match(tiles, /pk\.page === 'story'/, 'the empty Love Story tile is not recognised');
  assert.match(tiles, /disabled: Boolean\(o\.disabledNote\) && !storyEditor/, 'an empty Love Story tile is still dead');
  assert.match(tiles, /setDetailsItem\('love-story'\)/, 'the empty Love Story tile does not open its editor');
});

/** Every .ts/.tsx under app/ and lib/ (tests and node_modules aside). */
function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('5 · no read of event_vendors embeds vendor_profiles without naming the key (PGRST201)', async () => {
  const { BOOKED_SUPPLIER_SELECT } = { BOOKED_SUPPLIER_SELECT: /export const BOOKED_SUPPLIER_SELECT = '([^']+)'/.exec(read('app/dashboard/[eventId]/studio/mood-board/_components/mood-board-editor.tsx'))?.[1] ?? '' };
  assert.match(BOOKED_SUPPLIER_SELECT, /vendor_profiles!event_vendors_marketplace_vendor_id_fkey\s*\(/, 'the Mood Board’s booked-supplier read does not name the booked shop’s key');
  const bad: string[] = [];
  let reads = 0;
  for (const file of [...sources(join(WEB, 'app')), ...sources(join(WEB, 'lib'))]) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const m of src.matchAll(/\.from\(\s*['"]event_vendors['"]\s*\)\s*\.select\(\s*(['"`])([\s\S]*?)\1/g)) {
      reads += 1;
      if (/vendor_profiles(?!\s*!)\s*\(/.test(m[2]!)) bad.push(`${relative(WEB, file)}: ${m[2]!.replace(/\s+/g, ' ').slice(0, 120)}`);
    }
  }
  assert.ok(reads > 50, `the scan found only ${reads} event_vendors reads — it is not looking where they are`);
  assert.deepEqual(bad, [], `an unnamed vendor_profiles embed on event_vendors (PGRST201 — name event_vendors_marketplace_vendor_id_fkey or event_vendors_linked_vendor_profile_id_fkey):\n${bad.join('\n')}`);
  // The refused read is SAID, never "book one first".
  const mb = read('app/dashboard/[eventId]/studio/mood-board/_components/mood-board-editor.tsx');
  assert.match(mb, /\.select\(BOOKED_SUPPLIER_SELECT\)/, 'the read does not use the named select');
  assert.match(mb, /blockerMessage: bookedUnread \? BOOKED_SUPPLIERS_UNREAD/, 'a refused supplier read still reads as nothing booked');
  assert.match(mb, /logQueryError\('moodBoard\.bookedSuppliers'/, 'a refused supplier read is not logged');
});

test('6 · the Apply sheet opens ABOVE the Maker — never behind it (owner: "pressing Apply showed nothing")', () => {
  /* The sheet is portalled to <body> (a glass ancestor would trap `fixed`), so it
     stacks against the Maker's own fixed shell — and at z-50 it opened, focus and
     all, BEHIND the shell's z-[80]: a tap on ✓ did nothing anyone could see. */
  const zOf = (cls: string) => Number(/\bz-\[?(\d+)\]?/.exec(cls)?.[1] ?? NaN);
  const shell = read(`${L}/maker-shell.tsx`);
  const shellCls = /className="(fixed inset-x-0 top-0 z-\[\d+\][^"]*)"/.exec(shell)?.[1] ?? '';
  assert.ok(shellCls, 'the Maker shell’s fixed root moved — re-anchor this guard');
  const sheet = read('app/dashboard/[eventId]/website/_components/apply-pro-sheet.tsx');
  const sheetCls = /className="(fixed inset-0 z-[^"]*)"/.exec(sheet)?.[1] ?? '';
  assert.ok(sheetCls, 'the Apply sheet’s fixed root moved — re-anchor this guard');
  const bar = read('app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx');
  assert.match(bar, /createPortal\(\s*<ApplyProSheet[\s\S]*?document\.body/, 'the Apply sheet is no longer portalled to <body> — re-check its stacking');
  assert.ok(zOf(sheetCls) > zOf(shellCls), `the Apply sheet (z ${zOf(sheetCls)}) opens behind the Maker (z ${zOf(shellCls)})`);
});

test('7 · a tap on the couple’s mark opens the Logo Maker in place — never its size sheet, never a link', () => {
  const shell = read(`${E}/editor-shell.tsx`);
  const tap = between(shell, "if (data.key === 'f:hero' && data.el === 'mark' && select) {", 'return;\n      }');
  assert.match(tap, /select\(\{ kind: 'tool', key: 'logo' \}\)/, 'the mark does not open the Logo Maker in the Maker');
  assert.match(tap, /setElementTarget\(null\)/, 'the mark’s size sheet still opens over the Logo Maker');
  assert.doesNotMatch(tap, /href|router\.push|location/, 'the mark links out of the Maker');
  // …and it is decided BEFORE the generic part tap that would open the size sheet.
  assert.ok(shell.indexOf("data.el === 'mark' && select") < shell.indexOf("sheetDo({ t: 'tapPart', target: { key: data.key, widgetType, el, range: null } })"), 'the part sheet answers the mark first');
});
