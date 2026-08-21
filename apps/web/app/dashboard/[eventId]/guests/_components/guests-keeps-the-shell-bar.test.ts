/**
 * guests-keeps-the-shell-bar.test.ts — THE GUEST LIST MAY NOT DELETE THE APP'S
 * ONLY TOP BAR, AND MAY NOT PUT ITS OWN CHROME UNDERNEATH IT.
 *
 * Owner, 2026-08-21, two screenshots side by side: *"the top nav disappeared
 * also … Seems like the top nav changed when we are inside the dashboard of an
 * event. we still want to have the same top nav of the shell."*
 *
 * ── WHAT WENT WRONG, BECAUSE THE SHAPE REPEATS ─────────────────────────────
 * `page.tsx` injected `<style>{'.shell-topbar{display:none}'}</style>` under a
 * 2026-06-01 owner directive. That directive was CORRECT WHEN IT WAS WRITTEN:
 * `.shell-topbar` was then `SidebarShell`'s own event-tree strip, so hiding it
 * cost the page a duplicated event header and nothing else.
 *
 * The one-shell move (2026-08-14/15) handed the SAME class the product's only
 * top bar — identity, the ⌘K palette, the unread bell, and the account switcher
 * that is this surface's only route to sign-out, profile and Setnayan AI. From
 * that day the rule no longer meant "no event chrome on Guests". It meant "no
 * way out of Guests", at EVERY width, because the injected rule carried no
 * media query at all. Nothing failed; the page simply had less on it.
 *
 * 🔑 A DIRECTIVE IS SCOPED TO THE THING IT WAS WRITTEN ABOUT. The words did not
 * change. What they pointed at did.
 *
 * ── AND THE OFFSET IS HALF THE BUG ─────────────────────────────────────────
 * Restoring the bar is not enough on a phone: the roster's own sticky view tabs
 * were pinned at `env(safe-area-inset-top)+0.5rem`, an offset that is only
 * right while nothing is above them. With the bar back they park underneath it.
 * So the guard asks for BOTH — the bar exists, and this page's sticky chrome
 * clears it by reading the shell's measured `--fd-bar`, never a hand-typed 61.
 *
 * Source scan, comment-stripped via the one string-aware stripper: the hazard
 * is a rule that is ABSENT, and the page's own comments name every string
 * below, so a raw-source match would report the defect it just fixed.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const GUESTS = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests');
const read = (...p: string[]) => stripComments(readFileSync(join(GUESTS, ...p), 'utf8'));

test('the guest list does not hide the shared top bar', () => {
  const page = read('page.tsx');
  assert.ok(
    !/shell-topbar/.test(page),
    'The Guests page names `shell-topbar` in live code again. That class is ' +
      'the app\'s ONLY top bar — hiding it strips identity, ⌘K, the bell and ' +
      'the account switcher (the page\'s only route to sign-out) at every ' +
      'width, because an injected rule carries no breakpoint.',
  );
  assert.ok(
    !/display:\s*none/.test(page),
    'The Guests page injects a `display:none` rule. Whatever it names, a page ' +
      'reaching up into shared chrome is how the top bar vanished once.',
  );
});

test('the page does not claw back the space the bar occupies', () => {
  /*
    🪤 THE SLICE IS ANCHORED, AND THE FIRST CUT WAS NOT. It read
    `page.slice(page.indexOf('const master = ('))` with no check. Rename that
    const — which the live design-port programme could do to a 1,700-line
    component any week — and `indexOf` returns -1, `slice(-1)` yields the file's
    last character, the second `indexOf('>')` returns -1, and `section` becomes
    the EMPTY STRING. Both negatives below then pass over nothing at all.

    MEASURED: restoring the `-mt-6` + safe-area section alone → RED; the same
    restore PLUS renaming the const → 5 pass, 0 fail, with the hazard verified
    present by occurrence count. A guard that a rename disarms is not a guard.
  */
  const page = read('page.tsx');
  const start = page.indexOf('const master = (');
  assert.ok(
    start > -1,
    'The `master` section is gone or renamed — this guard cannot see what it ' +
      'is asked to guard, so it must fail rather than pass over an empty slice.',
  );
  const master = page.slice(start);
  const gt = master.indexOf('>');
  assert.ok(gt > -1, 'The master section’s opening tag is unreadable.');
  const section = master.slice(0, gt + 1);
  assert.match(
    section,
    /className="sn-col/,
    'The slice no longer lands on the master <section>. Anchor on the class ' +
      'the regression would have to touch, not on a renameable symbol.',
  );
  assert.ok(
    !/-mt-6/.test(section),
    'The master section still cancels the layout\'s top padding. That `-mt-6` ' +
      'existed only to fill the hole the hidden bar left; with the bar back it ' +
      'pulls the page up underneath it.',
  );
  assert.ok(
    !/safe-area-inset-top/.test(section),
    'The master section still reserves the notch itself. The shared bar sits ' +
      'above it now and owns that space.',
  );
});

test('EVERY phone sticky on this route clears the bar by reading its height', () => {
  /*
    🪤 THE FIRST CUT CHECKED ONE FILE AND WAS TITLED AFTER A DIFFERENT ELEMENT.
    It read `page.tsx` only, and called what it found "the roster's view tabs" —
    which it is not: the element in `page.tsx` is the ACTIVE-FILTERS chip strip,
    and it renders only while a filter is set. The real phone masthead — the
    title, the headcount, Invite, the red Needs-you, the pax meter and the
    stage ribbon — lives in `mobile-guest-carousel.tsx`, renders on EVERY phone
    visit, and was still pinned at `env(safe-area-inset-top)`.

    That inset is **0** in every mobile browser tab, on Android, on iPad and on
    any non-notched install, so it sat 4px inside the restored bar's 0–61px
    band. Whichever of the two won the stacking contest, a person lost controls
    they needed — including the account switcher, this surface's only route to
    sign-out.

    🔑 A GUARD NAMED AFTER THE THING IT IS NOT CHECKING IS WORSE THAN NO GUARD:
    it reads as covered. So this asserts the RULE across both files, and any
    third phone sticky added here has to satisfy it too.
  */
  const files: Array<[string, string]> = [
    ['page.tsx', read('page.tsx')],
    ['_components/mobile-guest-carousel.tsx', read('_components', 'mobile-guest-carousel.tsx')],
  ];
  for (const [name, src] of files) {
    const stickies = src.match(/sticky top-\[[^\]]*\]/g) ?? [];
    for (const s of stickies) {
      assert.ok(
        !/safe-area-inset-top/.test(s),
        `${name} pins a sticky at the notch inset (${s}). That is 0px in a ` +
          'mobile browser tab, so it lands on the restored shared top bar. ' +
          'Offset by `var(--fd-bar,0px)` instead.',
      );
      assert.ok(
        /var\(--fd-bar/.test(s),
        `${name} pins a sticky (${s}) without reading the shell's own bar ` +
          'height. Hand-typing 61px lets the two drift the first time the ' +
          'account cluster changes height.',
      );
    }
  }
  assert.ok(
    files.every(([, src]) => /sticky top-\[calc\(var\(--fd-bar,0px\)/.test(src)),
    'One of the two phone stickies stopped existing — if it was deliberately ' +
      'removed, delete its half of this guard in the same commit.',
  );
});

test('the add row and the facet bar draw no frame of their own', () => {
  const capture = read('_components', 'capture-bar.tsx');
  assert.ok(
    !/--sn-glass-bg/.test(capture),
    'The capture bar is a glass card again. Owner 2026-08-21: "remove the ' +
      'framings so it moves cleanly" — the input has its own border, so the ' +
      'panel was a second edge 8px outside the first.',
  );

  const page = read('page.tsx');
  assert.ok(
    !/gl-settle rounded-tile border/.test(page),
    'The summary + facet bar is a panel again. Its four sections already ' +
      'separate themselves with hairlines; the outer edge only inset every ' +
      'row from the measure the roster below sits flush with.',
  );
  assert.ok(
    !/border-dashed/.test(page),
    'An empty state is back inside a dashed rectangle — which reads as a drop ' +
      'zone, and makes the emptiest state on the page the most drawn thing on it.',
  );
});

test('the refusal state KEEPS its edge — unframing is not universal', () => {
  /*
    The counter-assertion, and it is the point of the whole change: the frames
    that carried MEANING stay. "We couldn't load your guest list" is a refusal
    and has to stop the eye, so it keeps its mulberry top edge. A sweep that
    deleted every border on the page would pass the four tests above and be
    wrong here.
  */
  const page = read('page.tsx');
  assert.match(
    page,
    /border-t-\[3px\] border-mulberry\/70/,
    'The load-failure state lost its edge. It is a refusal, not a blank slate.',
  );
});
