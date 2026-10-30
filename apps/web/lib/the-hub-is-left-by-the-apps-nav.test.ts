/**
 * 🧭 THE HUB IS LEFT BY THE APP'S OWN NAV — owner, 30 Oct, verbatim: *"i was thinking having the bottom nav still and
 * the bottom toolbar to show and hide when not needed?"*, then *"yes"* to the controller's call (1): drop the Maker's ✕
 * (DECISION_LOG 2026-10-30 "EVENT HUB PRO (look redesign) — THE APP'S NAV STAYS"; amends Maker_Two_Bars_LOCKED's
 * "✕ left everywhere" for the Hub tab).
 *
 * This file replaces `the-maker-exit-goes-to-the-event.test.ts` (25 Oct), which held the ✕ as ONE link to
 * `/dashboard/<eventId>` (owner then: *"It just needs to go back to the event's dashboard"*). That destination is
 * unchanged — it is now the app's Home tab, on screen beside the Hub, instead of a red pill of the Maker's own.
 *
 *   1 · the Maker's bar draws no ✕ and no ‹ — nothing of its own leads out; the shell keeps no exit link;
 *   2 · the app's chrome stays on screen: the shell sits in the room the top bar, rail and bottom nav leave, never
 *       over them (`MAKER_IN_THE_APP_CSS`), and the event's Home tab is `/dashboard/<eventId>` — the ✕'s old door;
 *   3 · no choice sheet exists (held since 25 Oct): the file is gone, nothing imports it, the lazy door is gone.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { MAKER_IN_THE_APP_CSS } from './maker-phone-room';
import { buildCustomerMenuTree } from './customer-menu';

const WEB = join(__dirname, '..');
const LAUNCH = 'app/dashboard/[eventId]/launch/_components';
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const SHELL = src(`${LAUNCH}/maker-shell.tsx`);

function bar(): string {
  const at = SHELL.indexOf('data-maker-toolbar=""');
  assert.ok(at > 0, 'precondition: the Maker toolbar was found');
  const end = SHELL.indexOf('</header>', at);
  assert.ok(end > at + 500, 'precondition: the toolbar’s end was found — this scan is blind');
  return SHELL.slice(at, end);
}

test('1 · no ✕, no ‹ — nothing of the Maker’s own leads out of the Hub', () => {
  const row = bar();
  assert.doesNotMatch(row, /<IconPill tone="exit">|data-maker-tool="exit"|aria-label="Exit"|ICON_PILL_EXIT/, 'the ✕ Exit is back on the Hub’s pinned row');
  assert.doesNotMatch(row, /<Link\b|href=\{`\/dashboard/, 'the pinned row leads out of the Maker by a link of its own again');
  assert.doesNotMatch(SHELL, /^import Link from 'next\/link';$/m, 'the shell imports a link again — its only one was the ✕');
});

test('2 · the app’s nav stays on screen — the shell sits in its room; Home is the event’s dashboard', () => {
  assert.match(SHELL, /MAKER_IN_THE_APP_CSS \+/, 'the shell does not draw itself inside the app’s chrome');
  assert.match(MAKER_IN_THE_APP_CSS, /top:var\(--maker-app-top,/, 'the shell does not start under the app’s top bar');
  assert.match(MAKER_IN_THE_APP_CSS, /bottom:var\(--maker-app-bottom,/, 'the shell does not end above the app’s bottom nav');
  assert.doesNotMatch(MAKER_IN_THE_APP_CSS, /z-index/, 'the shell lifts itself over the app’s chrome');
  // A sheet on <body> (⚙, the bell, the account panel) covers the Maker — the picked part's frame steps under it.
  assert.match(MAKER_IN_THE_APP_CSS, /html:has\(\[data-sheet\]\) \[data-part-edges\]\{visibility:hidden!important\}/, 'the part’s frame paints over an open sheet');
  const home = buildCustomerMenuTree('e1').find((m) => m.key === 'home');
  assert.equal(home?.href, '/dashboard/e1', 'the app’s Home tab is not the event’s dashboard — the ✕’s old door is lost');
  assert.ok(buildCustomerMenuTree('e1', { websiteEnabled: true }).some((m) => m.key === 'launch'), 'the bottom nav has no Hub tab to stand on');
});

test('3 · no choice sheet: the file, its lazy door and the shell’s open state are gone', () => {
  assert.equal(existsSync(join(WEB, `${LAUNCH}/maker-exit-sheet.tsx`)), false, 'the Leave the Maker sheet is back');
  assert.doesNotMatch(src(`${LAUNCH}/details-lazy.tsx`), /MakerExitSheet|maker-exit-sheet/);
  assert.doesNotMatch(SHELL, /MakerExitSheet|exitOpen|setExitOpen|Leave the Maker|All events/);
});
