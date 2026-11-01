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
 *   3 · no choice sheet exists (held since 25 Oct): the file is gone, nothing imports it, the lazy door is gone;
 *   4 · NOTHING OF THE MAKER STANDS ON THE NAV (owner, live iPhone 31 Oct: *"bottom nav of event hub is not fixed"* —
 *       the tab labels alone showed; the toolbar's rows covered the icons). The shell ends ON the nav's top, its whole
 *       height — never "less the home indicator", which put the shell's z-40 foot over the nav's icons; what stands IN
 *       the shell keeps `--maker-safe-b` (0 above the nav) where it kept `env(safe-area-inset-bottom)`; every `fixed`
 *       phone tool — placed from the SCREEN's foot, the shell being no containing block — adds `--maker-lift`;
 *   5 · THE APP'S TOP BAR NEVER RIDES OFF ABOVE THE MAKER (same report: the bar gone, an empty band in its place). The
 *       document is the screen's height while the Maker is open, so a `scrollIntoView` inside it has no document to
 *       scroll (measured in /dev/maker-lab at 390: scrollY 39 — the bar's foot at 12, the shell's top at 51).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { MAKER_IN_THE_APP_CSS, MAKER_LT_TOOL } from './maker-phone-room';
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
  assert.match(MAKER_IN_THE_APP_CSS, /--maker-nav:var\(--maker-app-bottom,[^;]*;bottom:var\(--maker-nav\);/, 'the shell does not end above the app’s bottom nav');
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

/** Every Maker source a phone tool is drawn from — the shell's own folder, the editor's, and the room's constants. */
function makerSources(): { rel: string; code: string }[] {
  const out: { rel: string; code: string }[] = [];
  for (const dir of [LAUNCH, `${LAUNCH}/stage-panel`, 'app/dashboard/[eventId]/website/editor/_components']) {
    for (const f of readdirSync(join(WEB, dir))) if (/\.tsx?$/.test(f) && !f.includes('.test.')) out.push({ rel: `${dir}/${f}`, code: src(`${dir}/${f}`) });
  }
  out.push({ rel: 'lib/maker-phone-room.ts', code: src('lib/maker-phone-room.ts') });
  return out;
}

test('4 · nothing of the Maker stands on the nav — the shell ends on its top; fixed tools lift over it', () => {
  // The shell's foot is the nav's TOP: the measured nav, or the dock's whole published height — never less the inset.
  assert.match(
    MAKER_IN_THE_APP_CSS,
    /--maker-nav:var\(--maker-app-bottom,var\(--sn-bottomdock-h,calc\(env\(safe-area-inset-bottom\) \+ 64px\)\)\);bottom:var\(--maker-nav\);/,
    'the shell does not end on the nav’s top',
  );
  assert.doesNotMatch(MAKER_IN_THE_APP_CSS, /bottom:[^;}]*-\s*env\(safe-area-inset-bottom\)/, 'the shell ends the home indicator BELOW the nav’s top again — its foot covers the nav’s icons');
  assert.match(MAKER_IN_THE_APP_CSS, /--maker-safe-b:max\(0px,calc\(env\(safe-area-inset-bottom\) - var\(--maker-nav\)\)\);/, 'the Maker’s own home-indicator room is not said');
  assert.match(MAKER_IN_THE_APP_CSS, /--maker-lift:max\(0px,calc\(var\(--maker-nav\) - env\(safe-area-inset-bottom\)\)\)/, 'the nav’s lift for a fixed tool is not said');
  // …and measured the same way: the nav's whole height, as px.
  assert.match(SHELL, /el\.style\.setProperty\('--maker-app-bottom', `\$\{nav\}px`\);/, 'useTheAppsRoom no longer says the nav’s whole height');
  assert.doesNotMatch(SHELL, /--maker-app-bottom'[^;]*safe-area-inset-bottom/, 'useTheAppsRoom subtracts the home indicator from the nav again');

  const sources = makerSources();
  assert.ok(sources.length > 60, `precondition: ${sources.length} Maker sources read — this scan is blind`);
  const hits: string[] = [];
  let lifted = 0;
  for (const { rel, code } of sources) {
    // IN the shell: a sum on the lower third's height keeps the Maker's room, not the screen's.
    for (const m of code.matchAll(/var\(--maker-lt-h\)\s*\+\s*env\(safe-area-inset-bottom\)/g)) hits.push(`${rel}: …${m[0]} — use var(--maker-safe-b, env(…))`);
    // FIXED from the screen's foot: a phone tool's bottom (`bottom-[calc(env(…)+N…)]`, the toolbar's FOOT rule) lifts.
    for (const m of code.matchAll(/bottom-\[calc\(env\(safe-area-inset-bottom\)\+[^\]]*\]/g)) {
      if (m[0].includes('var(--maker-lift')) lifted += 1;
      else hits.push(`${rel}: ${m[0]} — a fixed tool placed from the screen's foot stands on the nav; add +var(--maker-lift,0px)`);
    }
    for (const m of code.matchAll(/bottom:(?:calc\()?\$\{STAGE_BAR_FOOT_CSS\}[^!]*!important/g)) {
      if (m[0].includes('var(--maker-lift')) lifted += 1;
      else hits.push(`${rel}: ${m[0]} — the toolbar's rows stand on the nav; add var(--maker-lift,0px)`);
    }
  }
  assert.deepEqual(hits, [], `the Maker stands on the app’s bottom nav again:\n${hits.join('\n')}`);
  // MAKER_LT_TOOL · the scene picker · the toolbar's four FOOT rules — print the count so a lost one is seen.
  assert.ok(lifted >= 6, `only ${lifted} fixed phone tools lift over the nav — expected ≥ 6 (MAKER_LT_TOOL, the scene picker, the toolbar’s four rules)`);
  assert.match(MAKER_LT_TOOL, /max-lg:bottom-\[calc\(env\(safe-area-inset-bottom\)\+4px\+var\(--maker-lift,0px\)\)\]/, 'a lower-third tool stands on the nav');
});

test('5 · the app’s top bar never rides off above the Maker — the document has nothing to scroll', () => {
  assert.match(
    MAKER_IN_THE_APP_CSS,
    /html\.sn-maker-open,html\.sn-maker-open body,html:has\(\[data-maker-shell\]\),html:has\(\[data-maker-shell\]\) body\{height:100%\}/,
    'the document under the Maker is taller than the screen again — a scrollIntoView inside the Maker carries the app’s top bar off and leaves an empty band',
  );
  // The lock it completes: overflow hidden on the same four (maker-shell.tsx).
  assert.match(SHELL, /html\.sn-maker-open,html\.sn-maker-open body,html:has\(\[data-maker-shell\]\),html:has\(\[data-maker-shell\]\) body\{overflow:hidden\}/, 'the Maker’s scroll lock is gone');
});
