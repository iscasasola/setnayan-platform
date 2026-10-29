/**
 * the-supplier-frame-holds.test.ts — the supplier dashboard's FRAME at every width (supplier dashboard v13, owner
 * 2026-10-29: "desktop mode is wrong" · "and tablet"; prototype approved "Approved."; DECISION_LOG 2026-10-29
 * "SUPPLIER DASHBOARD — LAST ROUND OF OWNER NOTES" item 12).
 *
 * ── THE PROPERTIES ──────────────────────────────────────────────────────────
 *   1. The supplier tree hands the shell `pinnedBar` with the page menu as its lead, and the shell writes the opt-in
 *      attribute and opens the two seats (`data-pin-lead`, `data-pin-tools`) — ONE bar, not a second row.
 *   2. The stylesheet seats that bar over the content column from 701 (the rail rises to the window's top), hides the
 *      wordmark and the shared search there, and draws the FULL rail from 1100 (the prototype's line), for the opted-in
 *      tree only. Below 701 no rule of it applies.
 *   3. The page menu names each tab's sections FROM THAT TAB'S OWN SOURCE (Customers' segments, Shop's segments), says
 *      the section on screen, draws no ▾ where a tab has nothing to pick, and returns nothing off the four tabs.
 *   4. From 701 the page's thumb row moves UP into the bar's tools seat; on a phone it keeps floating, with a soft fade
 *      behind it.
 *   5. The two columns never draw an empty right column: `pane` is required, and the pane is not drawn on a phone.
 * Every assertion reads the code's own source or resolver; nothing is re-derived here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { supplierPageMenuOf } from './supplier-page-menu';
import { CUSTOMER_SEGMENTS, CUSTOMER_SEGMENT_HREFS, CUSTOMER_SEGMENT_LABEL } from '../customers/segments';
import { SHOP_SEGMENT_HREF, SHOP_SEGMENT_LABEL } from '../shop/_components/shop-segments';

const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
/** Comments out — a property lives in the code, not in the note about it. */
const code = (src: string) => stripComments(src);

test('1 · the supplier tree hands the shell ONE pinned bar, led by the page menu', () => {
  const layout = code(read('app/vendor-dashboard/layout.tsx'));
  assert.match(layout, /<AppRailShell[\s\S]*?pinnedBar=\{\{\s*lead:[\s\S]*?<SupplierPageMenu\s*\/>/, 'the layout no longer hands the page menu to the bar');
  const shell = code(read('app/_components/frontdoor/front-door-shell.tsx'));
  assert.match(shell, /data-pinned-bar=\{pinnedBar \? '' : undefined\}/, 'the shell stopped writing the opt-in attribute');
  assert.match(shell, /className="fd-pinlead" data-pin-lead=""/, 'the bar lost its page-menu seat');
  assert.match(shell, /className="fd-pintools" data-pin-tools=""/, 'the bar lost the seat the thumb row moves up into');
  assert.equal((shell.match(/<header className="fd-topbar">/g) ?? []).length, 1, 'there must be exactly one bar');
  const rail = code(read('app/_components/frontdoor/app-rail-shell.tsx'));
  assert.match(rail, /pinnedBar=\{pinnedBar\}/, 'AppRailShell does not pass the pinned bar through');
});

test('2 · from 701 the bar sits over the content column, the rail runs the window; from 1100 the rail is full', () => {
  const css = read('app/_components/frontdoor/front-door.css');
  const at = css.indexOf('THE BAR IS THE PAGE\'S PINNED ROW');
  assert.ok(at > 0, 'the pinned-bar block is gone from front-door.css');
  const block = css.slice(at);
  const wide = block.slice(block.indexOf('@media (min-width: 701px)'));
  assert.match(wide, /\[data-pinned-bar\] \.fd-topwrap \{\s*margin-left: var\(--fd-rail\);/, 'the bar no longer stops at the rail');
  assert.match(wide, /\[data-pinned-bar\] \.fd-topleft,\s*\.fd\[data-chrome='app'\]\[data-pinned-bar\] \.fd-searchwrap \{\s*display: none;/, 'the wordmark / shared search came back over the page menu');
  assert.match(wide, /\[data-pinned-bar\] \.fd-rail\[data-open\] \{[^}]*top: 0;[^}]*margin-top: calc\(-1 \* var\(--fd-bar\)\);[^}]*max-height: 100vh;/, 'the rail no longer rises to the top of the window');
  assert.match(block, /@media \(min-width: 1100px\) and \(max-width: 1279\.98px\) \{\s*\.fd\[data-pinned-bar\] \{\s*--fd-rail: 240px;/, 'the full rail no longer starts at 1100');
  assert.match(block, /^\.fd-pinlead,\s*\.fd-pintools \{\s*display: none;/m, 'the seats must be hidden below 701 (the phone is untouched)');
  // Nothing of the block may reach a phone: every rule that names the opt-in sits inside a ≥701 query.
  const outside = stripComments(block).replace(/@media[^{]*\{(?:[^{}]*\{[^}]*\})*[^{}]*\}/g, '');
  assert.doesNotMatch(outside, /\[data-pinned-bar\]/, 'a pinned-bar rule escaped its media query and reaches the phone');
});

test('3 · the page menu reads each tab from its own source and invents nothing', () => {
  const c = supplierPageMenuOf('/vendor-dashboard/customers', null);
  assert.ok(c, 'Customers has no menu');
  assert.equal(c!.tab, 'Customers');
  assert.equal(c!.section, CUSTOMER_SEGMENT_LABEL.people);
  assert.deepEqual(c!.sections!.map((s) => s.href), CUSTOMER_SEGMENTS.map((s) => CUSTOMER_SEGMENT_HREFS[s]));
  assert.equal(supplierPageMenuOf('/vendor-dashboard/customers', 'money')!.section, CUSTOMER_SEGMENT_LABEL.money);

  const shop = supplierPageMenuOf(SHOP_SEGMENT_HREF.page, null);
  assert.equal(shop!.tab, 'Shop');
  assert.equal(shop!.section, SHOP_SEGMENT_LABEL.page);
  assert.deepEqual(new Set(shop!.sections!.map((s) => s.href)), new Set(Object.values(SHOP_SEGMENT_HREF)));
  assert.equal(supplierPageMenuOf('/vendor-dashboard/collections', null)!.tab, 'Shop', 'a Shop page off the segments still names its tab');

  // A tab with nothing to pick is a word — no ▾ (a ▾ that opens nothing is a fake door).
  assert.deepEqual(supplierPageMenuOf('/vendor-dashboard', null), { tab: 'Today', section: null, sections: null });
  assert.equal(supplierPageMenuOf('/vendor-dashboard/on-the-day', null)!.sections, null);
  // Off the four tabs the bar says nothing rather than guessing.
  assert.equal(supplierPageMenuOf('/vendor-dashboard/settings', null), null);

  const menu = code(read('app/vendor-dashboard/_components/supplier-page-menu.tsx'));
  assert.match(menu, /<PickMenu\b/, 'the page menu must be the shared PickMenu');
  const frame = read('app/vendor-dashboard/_components/supplier-frame.css');
  assert.match(frame, /@media \(min-width: 701px\) \{\s*\.fd\[data-pinned-bar\] \[data-customers-view\],\s*\.fd\[data-pinned-bar\] \[data-shop-segmented\] \{\s*display: none;/, 'the page\'s own picker no longer steps aside for the bar\'s menu');
  // …and the attributes it steps aside by still exist where the pickers are drawn.
  assert.match(read('app/vendor-dashboard/customers/_components/customers-pin.tsx'), /data-customers-view=""/);
  assert.match(read('app/vendor-dashboard/shop/_components/shop-segments.tsx'), /data-shop-segmented=""/);
});

test('4 · from 701 the thumb row moves up into the bar; on a phone it floats over a soft fade', () => {
  const row = code(read('app/vendor-dashboard/_components/supplier-thumb-row.tsx'));
  assert.match(row, /const UP_QUERY = '\(min-width: 701px\)';/, 'the thumb row no longer moves at the shell\'s 701 line');
  assert.match(row, /document\.querySelector<HTMLElement>\('\[data-pin-tools\]'\)/, 'the thumb row no longer finds the bar\'s tools seat');
  assert.match(row, /if \(upTo\) \{\s*return createPortal\([\s\S]*?upTo,\s*\);/, 'the thumb row no longer portals into the bar from 701');
  const css = read('app/vendor-dashboard/_components/supplier-thumb-row.module.css');
  assert.match(css, /@media \(max-width: 700\.98px\) \{\s*\.lower::before \{[^}]*linear-gradient\(/, 'the phone lost the soft fade behind the thumb row');
});

test('5 · the two columns: a required pane, never drawn on a phone', () => {
  const cols = code(read('app/vendor-dashboard/_components/supplier-columns.tsx'));
  assert.match(cols, /pane: ReactNode;/, 'the right column must be required — never an empty right column');
  assert.doesNotMatch(cols, /pane\?:/, 'the right column became optional');
  const css = read('app/vendor-dashboard/_components/supplier-frame.css');
  assert.match(css, /^\.sn-cols-pane \{\s*display: none;/m, 'the pane must not draw on a phone');
  assert.match(css, /@media \(min-width: 1100px\) \{\s*\.sn-cols \{\s*grid-template-columns: minmax\(0, 5fr\) minmax\(0, 6fr\);/, 'the ≥1100 split is no longer 5 : 6');
});
