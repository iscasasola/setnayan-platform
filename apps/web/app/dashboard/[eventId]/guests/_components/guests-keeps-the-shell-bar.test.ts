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
  const page = read('page.tsx');
  const master = page.slice(page.indexOf('const master = ('));
  const section = master.slice(0, master.indexOf('>') + 1);
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

test('the roster\'s sticky view tabs clear the bar by reading its height', () => {
  const page = read('page.tsx');
  const sticky = /sticky top-\[calc\(var\(--fd-bar,0px\)\s*\+\s*0\.5rem\)\]/;
  assert.match(
    page,
    sticky,
    'The phone view tabs are not offset by `--fd-bar`. Pinned at the safe-area ' +
      'inset they sit UNDER the restored top bar; hand-typing 61px instead ' +
      'lets the two drift the first time the account cluster changes height.',
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
