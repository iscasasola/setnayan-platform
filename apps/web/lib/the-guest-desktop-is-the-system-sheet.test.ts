/**
 * 🖥 THE GUEST'S EVENT HUB ON A DESKTOP IS THE APPROVED SYSTEM SHEET, AND NOTHING REACHES A GUEST UNTIL THE OWNER SAYS
 * (DECISION_LOG 2026-10-15 "ONE-PAGE INVITATION + SAVE THE DATE, THE DESKTOP SYSTEM SHEET, AND FIVE ANSWERS —
 * APPROVED"; `lib/guest-hub-desktop.ts`). Held four ways:
 *
 *   1 · DARK — the desk `<style>` is written only when `guestHubDesktopEnabled` says so (the flag, or an internal
 *       viewer), never in the Maker's canvas; with the flag unset and a guest viewer it is OFF. Sabotage: the style
 *       written without `guestDesk` → red.
 *   2 · NEVER A PHONE — every rule of the rule set is inside `min-width:1024px`. Sabotage: one rule outside → red.
 *   3 · THE SHEET'S PIECES — the rail and the bottom bar retired for the top bar (520 px of slots in the 68-px
 *       header), the 64-rem stage (no 76-rem ceiling), 440-px side panels, the 2-px gold hover ring and the ink focus
 *       ring. Sabotage: the rail left drawn → red.
 *   4 · THE RULES STILL FIND THE SHIPPED PIECES — each selector's anchor is still in the component it places (the bar's
 *       `bottom-0`, the rail's `top-1/2`, the spacer, the four sheets). A rename would leave the desktop silently on
 *       today's layout; this says so. Sabotage: the bar's anchor class renamed → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { GUEST_BAR, GUEST_HUB_DESKTOP_CSS, GUEST_RAIL, GUEST_SHEETS } from './guest-hub-desktop';
import { guestHubDesktopEnabled } from './guest-hub-desktop-flag';

const WEB = join(__dirname, '..');
const read = (f: string) => stripComments(readFileSync(join(WEB, f), 'utf8'));
const KEY = 'NEXT_PUBLIC_GUEST_HUB_DESKTOP_ENABLED';

test('1 · dark — the style is the flag’s (or an internal viewer’s), and never the Maker canvas’s', () => {
  const prev = process.env[KEY];
  delete process.env[KEY];
  try {
    assert.equal(guestHubDesktopEnabled({ internal: false }), false, 'a guest gets the desktop with the flag unset');
    assert.equal(guestHubDesktopEnabled({ internal: true }), true, 'an internal viewer cannot check it');
    process.env[KEY] = 'true';
    assert.equal(guestHubDesktopEnabled({ internal: false }), true);
  } finally {
    if (prev === undefined) delete process.env[KEY];
    else process.env[KEY] = prev;
  }
  const page = read('app/[slug]/page.tsx');
  assert.match(page, /const guestDeskP = isEditorCanvas \? Promise\.resolve\(false\) : viewerIsInternal\(\)\.then\(\(internal\) => guestHubDesktopEnabled\(\{ internal \}\)\)\.catch\(/);
  assert.match(page, /const guestDesk = await guestDeskP;/);
  assert.match(page, /return guestDesk \? \(\s*<>\s*\{worn\}\s*<style data-guest-desk="">\{GUEST_HUB_DESKTOP_CSS\}<\/style>/, 'the desk style is not gated on `guestDesk`');
  assert.equal(page.match(/GUEST_HUB_DESKTOP_CSS/g)?.length, 2, 'the desk style is written somewhere else too (import + one use)');
  /* Every guest render goes through the one wrapper that decides. */
  assert.ok((page.match(/return wearDraft\(/g)?.length ?? 0) >= 3);
});

/** The rule set's top-level blocks: each must be a min-width:1024 media block. */
function topLevelBlocks(css: string): string[] {
  const heads: string[] = [];
  let depth = 0;
  let head = '';
  for (const ch of css) {
    if (ch === '{') {
      if (depth === 0) heads.push(head.trim());
      depth++;
      head = '';
    } else if (ch === '}') {
      depth--;
      head = '';
    } else if (depth === 0) head += ch;
  }
  return heads;
}

test('2 · never a phone — every rule is inside min-width:1024px', () => {
  const heads = topLevelBlocks(GUEST_HUB_DESKTOP_CSS);
  assert.ok(heads.length >= 1, 'precondition: the rule set was read');
  for (const h of heads) assert.match(h, /^@media \(min-width:1024px\)/, `"${h.slice(0, 80)}" can reach a phone`);
});

test('3 · the sheet’s pieces: the top bar, the 64-rem stage, 440-px panels, the two rings', () => {
  const css = GUEST_HUB_DESKTOP_CSS;
  assert.ok(css.includes(`${GUEST_RAIL},`) && /display:none!important\}/.test(css), 'the rail is still drawn');
  assert.ok(css.includes(`${GUEST_BAR}{display:block!important;top:0!important;bottom:auto!important;left:50%!important;right:auto!important;width:520px;`), 'the slots are not the top bar’s centre');
  assert.match(css, /height:68px;transform:translateX\(-50%\)/);
  assert.ok(css.includes('[data-sticky-top]>div,[data-page-column]{max-width:min(64rem,calc(100vw - 64px))!important}'), 'the stage is not 64 rem');
  assert.doesNotMatch(css, /76rem/, 'the 76-rem ceiling is back');
  assert.ok(css.includes(`${GUEST_SHEETS.shared}{width:440px!important`), 'the shared sheet is not a 440-px panel');
  for (const k of ['openInBrowser', 'more', 'storyMoment'] as const) assert.ok(css.includes(GUEST_SHEETS[k]), `${k} is not a side panel`);
  assert.match(css, /:hover\{box-shadow:0 0 0 2px #A9834B\}/, 'no gold hover ring');
  assert.match(css, /:focus-visible[^{]*\{outline:none!important;box-shadow:0 0 0 2px #F7F2EC,0 0 0 4px #2C2A29\}/, 'no ink focus ring');
});

test('4 · the rules still find the shipped pieces', () => {
  const bar = read('app/[slug]/_components/site-menu-bar.tsx');
  assert.match(bar, /<nav\s+aria-label="Site sections"\s+className="fixed inset-x-0 bottom-0 z-30 [^"]*xl:hidden"/, 'the bottom bar lost the anchor the desktop moves it by');
  assert.match(bar, /<nav\s+aria-label="Site sections"\s+className="fixed left-\[[^"]*top-1\/2 [^"]*xl:block[^"]*"/, 'the rail lost its anchor');
  assert.match(bar, /<div ref=\{endRef\} aria-hidden className="h-\[calc\(3\.5rem[^"]*xl:hidden" \/>/, 'the bar’s spacer lost its anchor');
  assert.match(bar, /fixed inset-x-0 bottom-\[calc\(3\.5rem/, 'the locked-slot note lost its anchor');
  assert.match(read('app/_components/sheet.tsx'), /data-sheet-panel/);
  assert.match(read('app/[slug]/_components/copy-my-link.tsx'), /aria-labelledby="open-in-browser-title"/);
  assert.match(read('app/[slug]/_components/hub/hub-shell.tsx'), /aria-label="More event functions"/);
  assert.match(read('app/[slug]/_components/story/story-clock.tsx'), /role="dialog"[\s\S]{0,600}sm:w-\[26rem\]/);
  assert.match(read('app/[slug]/_components/invitation-shell.tsx'), /<header data-sticky-top className="sticky top-0 z-20/);
});
