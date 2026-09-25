/**
 * THE COOKIE BANNER MUST NEVER COVER A ROUTE'S OWN BOTTOM BAR.
 *
 * WHAT WAS WRONG (mobile audit, 2026-09). Below `sm` the banner was a
 * near-full-width floating card — `fixed inset-x-3 bottom-3` — with no idea
 * whether the route it landed on already owned the bottom edge. It covered
 * the countdown + sub-nav on `/cale-ice` at 768px, listing prices on
 * `/explore`, the sticky CTA on `/features`
 * (`app/features/_sections/_StickyMobileCTA.tsx`), the venue tip and pills on
 * `/cale-ice/venue`, and a supplier profile — because it painted OVER
 * content instead of making room for itself.
 *
 * WHY A STRUCTURAL TEST. This package tests with `node:test` and has no
 * DOM/RTL (see `global-banner-capture-gate.test.ts`), so the runtime
 * behaviour — does the banner actually land above a real bar on a real
 * screen — cannot be exercised here. What CAN be pinned is the MECHANISM:
 * that the fix (a) reserves body space instead of floating over it, the
 * same idiom `stale-tab-notice.tsx`'s bar already uses, (b) computes a lift
 * off the true bottom edge from whatever else is already anchored there,
 * and (c) actually uses that lift when it positions itself — and that the
 * defect's exact old value (a bare `inset-x-3 bottom-3`) does not come back.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(join(HERE, p), 'utf8');

const RAW = read('cookie-consent-banner.tsx');
const SRC = stripComments(RAW);

test('the banner RESERVES body space while shown, rather than floating over the page', () => {
  assert.match(
    SRC,
    /body\.style\.paddingBottom\s*=/,
    'the banner no longer grows body.style.paddingBottom — without this the ' +
      'true last thing on a page (a price, a guest row) sits underneath a ' +
      'fixed card instead of scrolling clear of it',
  );
  assert.match(
    SRC,
    /body\.style\.paddingBottom\s*=\s*before/,
    'the reserved padding is never restored — every close would leave the ' +
      "page permanently padded by however tall the banner happened to be",
  );
});

test('the banner MEASURES the route\'s own bottom chrome before positioning itself', () => {
  assert.match(
    SRC,
    /function measureRouteBottomChrome/,
    'the height-of-other-bottom-bars measurement is gone — without it the ' +
      'banner has no way to know a route owns the bottom edge already',
  );
  // The measurement only counts something genuinely ANCHORED to the bottom
  // edge (never a modal/backdrop) — the two guard clauses that make that so.
  assert.match(SRC, /r\.bottom < vh - 4/, 'lost the "touching the bottom edge" check');
  assert.match(SRC, /r\.top < vh \* 0\.5/, 'lost the "not a modal/sheet" check');
});

test('the measured lift is actually APPLIED to the banner\'s own position', () => {
  assert.match(
    SRC,
    /setLiftPx\(measureRouteBottomChrome/,
    'the measurement result is computed but never stored',
  );
  // Applied through a CSS var it sets on itself and reads in its own
  // `bottom-[calc(...)]`, not merely computed and discarded.
  assert.match(SRC, /'--cb-lift':\s*`\$\{liftPx\}px`/, "liftPx never reaches the banner's own style");
  assert.match(
    SRC,
    /bottom-\[calc\(var\(--cb-lift/,
    "the banner's position class does not read the --cb-lift var it publishes",
  );
});

test('the OLD floating-card position is gone — it must not silently come back', () => {
  assert.doesNotMatch(
    SRC,
    /inset-x-3\s+bottom-3\b/,
    'the exact defect (a bare `inset-x-3 bottom-3` card, no lift, no reserved ' +
      'space) is back in the banner',
  );
  // The mobile form must be edge-to-edge (no side gutter of its own) — a
  // `sm:`-scoped exception is fine, that is the untouched desktop card.
  assert.match(SRC, /\binset-x-0\b/, 'the mobile banner is no longer edge-to-edge');
});

test('the Cookie policy link and the Manage / Learn more controls clear 40px', () => {
  // Matched at the TAG BOUNDARY (opening `<Link …>` or `<button …>` directly
  // followed by the label text) rather than a bare substring — `RAW.indexOf`
  // on "Manage" finds `setManage` first, which is not the control at all.
  //
  // 🪤 `[^>]*` ALONE CANNOT SPAN THE TAG: `onClick={() => setManage(true)}`
  // carries a literal `>` inside its own arrow function, so a plain
  // "any-char-but->" class stops there — at the FIRST `>` after the start —
  // and never reaches the tag's real closing `>` a few attributes later. The
  // `=>` alternative lets the scan step over that one specifically.
  for (const label of ['Cookie policy', 'Manage', 'Learn more']) {
    const m = new RegExp(`<(Link|button)((?:[^>]|=>)*)>\\s*${label}`).exec(RAW);
    assert.ok(m, `could not find the "${label}" control at its tag boundary`);
    assert.match(
      m![2]!,
      /min-h-\[40px\]/,
      `"${label}"'s opening tag has no min-h-[40px] — it is a sub-40px tap ` +
        'target again',
    );
  }
});

test('every *-banner mounted in the root layout still reaches the capture gate', () => {
  // Not a re-implementation of global-banner-capture-gate.test.ts — just the
  // one fact this file's rewrite must not have broken: the gate import is
  // still there, reachable directly (not through a child), same as before.
  assert.match(SRC, /isConsentSuppressedRoute/);
  assert.match(SRC, /from '\.\/capture-safe-routes'/);
});
