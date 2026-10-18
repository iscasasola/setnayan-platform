/**
 * 🎨 STUDIO ON A DESKTOP IS THE PHONE'S SCREEN, WITH ROOM (`MAKER_DESKTOP_ADAPTATION_2026-10-07_fable.md` § Studio,
 * build plan PR 5; owner "all A", DECISION_LOG 2026-10-07): "A tool: the same full screen; the form in one comfortable
 * column (760 px) for Info · Love Story · Schedule · E-Gifts · RSVP · Prints; Mood Board · Logo · Wedding March · Seat
 * plan use the width (1100 px) … Studio › Look keeps the page beside its controls: two columns … the background
 * previews as a 2-column grid"; and the top nav's "the event's name in the middle". Held four ways:
 *
 *   1 · WHICH HALF IS THE PHONE'S OWN LIST — a form (`STUDIO_FORM_ITEMS`) is the form alone, a page
 *       (`STUDIO_PAGE_ITEMS`, the Seat plan) the page alone; the old navigator is not drawn (Studio ▾ is its heir).
 *       Sabotage: the form's preview left drawn → red.
 *   2 · THE WIDTHS ARE THE DOC'S — 760 for a form, 1100 for the four that take the width, Look's controls the tools
 *       column's 384 beside its page. Sabotage: Logo dropped from the wide four → red.
 *   3 · THE PHONE'S SKIN, SCOPED — the desktop wears the phone's own form rules (`STUDIO_SKIN_CSS`), every selector
 *       given the desk switch by `deskScoped`; the phone's rule set stays a phone's (under 1024 px only).
 *       Sabotage: `deskScoped` returning a selector untouched → red.
 *   4 · THE EVENT'S NAME — handed to the shell only with the columns on, drawn only by the lazy `MakerDesk`, and only
 *       from 1280 px (under it the bar has no room). Sabotage: the name handed in without the flag → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { STUDIO_FORM_ITEMS, STUDIO_PAGE_ITEMS, STUDIO_SKIN_CSS, studioFullScreenCss } from './studio-details';

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const read = (f: string) => stripComments(readFileSync(join(WEB, f), 'utf8'));
const WS = '[data-maker-shell][data-maker-desk]:not(:has([data-stage-tools])) [data-details-workspace]';
const on = (keys: readonly string[]) => `:is(${keys.map((k) => `[data-details-item="${k}"]`).join(',')})`;

test('1 · a form is the form alone, a page the page alone — the phone’s own lists; no old navigator', async () => {
  const { MAKER_DESK_CSS } = await import(`../${L}/maker-desk`);
  assert.ok(STUDIO_FORM_ITEMS.includes('names') && STUDIO_PAGE_ITEMS.includes('schedule'), 'precondition: the phone’s lists');
  assert.ok(MAKER_DESK_CSS.includes(`${WS} [data-phone-chrome="strip"]{display:none!important}`), 'the old navigator is drawn');
  assert.ok(MAKER_DESK_CSS.includes(`${WS}${on(STUDIO_FORM_ITEMS)} [data-details-body]{display:none!important}`), 'a form’s preview is drawn beside it');
  assert.ok(MAKER_DESK_CSS.includes(`${WS}${on(STUDIO_FORM_ITEMS)} [data-details-editor-panel]{width:100%!important`), 'a form is not the column’s width');
  assert.ok(MAKER_DESK_CSS.includes(`${WS}${on([...STUDIO_PAGE_ITEMS, 'seating'])} [data-details-editor-panel]{display:none!important}`), 'a page draws a second editor beside it');
});

test('2 · the widths are the doc’s — 760 · 1100 · Look’s controls 384 beside its page', async () => {
  const m = await import(`../${L}/maker-desk`);
  assert.equal(m.DESK_STUDIO_COLUMN_PX, 760);
  assert.equal(m.DESK_STUDIO_WIDE_PX, 1100);
  assert.deepEqual([...m.DESK_STUDIO_WIDE_ITEMS].sort(), ['logo', 'march', 'mood-board', 'seating']);
  const css: string = m.MAKER_DESK_CSS;
  assert.ok(css.includes(`${WS} [data-details-row]{width:100%;max-width:760px;margin-inline:auto}`));
  assert.ok(css.includes(`${WS}${on(m.DESK_STUDIO_WIDE_ITEMS)} [data-details-row]{max-width:1100px}`));
  assert.ok(css.includes(`${WS} [data-details-editor-panel]:has([data-details-editor]:not([hidden]) [data-studio-look-bar]){width:${m.DESK_TOOLS_PX}px!important}`), 'Look’s controls are not the tools column’s width');
  assert.match(css, /\[data-bg-cards\]\{display:grid!important;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/, 'Look’s backgrounds are not a 2-column grid');
});

test('3 · the phone’s form skin, every selector given the desk switch; the phone’s set stays a phone’s', async () => {
  const { deskScoped } = await import(`../${L}/maker-desk`);
  const D = '[data-maker-shell][data-maker-desk]';
  const out: string = deskScoped(STUDIO_SKIN_CSS, D);
  const rules = (css: string) => [...css.matchAll(/([^{}]+)\{/g)].map((x) => x[1]!.trim());
  assert.equal(rules(out).length, rules(STUDIO_SKIN_CSS).length, 'a rule was lost');
  for (const head of rules(out)) for (const s of head.split(/,(?![^(]*\))/)) assert.match(s.trim(), /^\[data-maker-shell\]\[data-maker-desk\]\[data-maker-studio-full\]/, `"${s}" is not the desktop's`);
  /* A selector that named no Studio screen is put under it. */
  assert.equal(deskScoped('a,b:is(c,d){x:1}', D), `${D}[data-maker-studio-full] a,${D}[data-maker-studio-full] b:is(c,d){x:1}`);
  assert.ok(studioFullScreenCss().startsWith('@media (max-width:1023.98px){'), 'the phone’s Studio rules left the phone');
});

test('4 · the event’s name: handed in only with the columns on, drawn only by the lazy desk, from 1280', async () => {
  const page = read('app/dashboard/[eventId]/launch/page.tsx');
  assert.match(page, /deskTitle=\{desktopColumns \? \(eventRow\?\.display_name \?\? null\) : null\}/);
  const shell = read(`${L}/maker-shell.tsx`);
  assert.doesNotMatch(shell, /data-maker-desk-title/, 'the shell draws the desktop’s name itself');
  const desk = read(`${L}/maker-desk.tsx`);
  assert.match(desk, /const title = useMaker\(\)\?\.deskTitle \?\? null;/);
  assert.match(desk, /<p data-maker-desk-title=""[^>]*>\s*Event Hub · \{title\}/);
  const { MAKER_DESK_CSS } = await import(`../${L}/maker-desk`);
  assert.match(MAKER_DESK_CSS, /@media \(max-width:1279\.98px\)\{[^}]*\[data-maker-desk-title\]\{display:none\}/, 'the name is drawn where the bar has no room');
});
