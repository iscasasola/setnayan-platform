/**
 * Unit suite for the open-browse site-menu model (PR6 shell). Invariants: the
 * five tabs are Home · Details · Story · Gallery · Me; "Gallery" is the owner
 * rename (never "Photos"); Home + Me are always present; a middle tab appears
 * ONLY when its section rendered (no dead anchors — the rejected Program Board
 * bug); and the enable gate is ON by default, opt-out via env (PR11).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  siteMenuTabs,
  siteMenuEnabled,
  browsableBodyRenders,
  SITE_MENU_ANCHORS,
} from './site-menu';

test('all sections present → the full five tabs in order', () => {
  const tabs = siteMenuTabs({ details: true, story: true, gallery: true });
  assert.deepEqual(
    tabs.map((t) => t.key),
    ['home', 'details', 'story', 'gallery', 'me'],
  );
  assert.deepEqual(
    tabs.map((t) => t.label),
    ['Home', 'Details', 'Story', 'Gallery', 'Me'],
  );
});

test('"Gallery" is the label — never "Photos"', () => {
  const tabs = siteMenuTabs({ details: true, story: true, gallery: true });
  const gallery = tabs.find((t) => t.key === 'gallery');
  assert.equal(gallery?.label, 'Gallery');
  assert.ok(!tabs.some((t) => t.label === 'Photos'), 'no tab is labelled Photos');
});

test('Home and Me are always present; middle tabs only when their section is', () => {
  const none = siteMenuTabs({ details: false, story: false, gallery: false });
  assert.deepEqual(none.map((t) => t.key), ['home', 'me'], 'sparse page → just Home + Me');

  const storyOnly = siteMenuTabs({ details: false, story: true, gallery: false });
  assert.deepEqual(storyOnly.map((t) => t.key), ['home', 'story', 'me']);
});

test('no tab ever anchors to nothing — every anchor is a #site- id', () => {
  for (const tab of siteMenuTabs({ details: true, story: true, gallery: true })) {
    assert.equal(tab.anchor, `#${SITE_MENU_ANCHORS[tab.key]}`);
    assert.match(tab.anchor, /^#site-[a-z]+$/);
  }
});

// The gate FLIPPED on 2026-08-05 (PR11). It used to be `isSample || flag ===
// 'true'`, which this test pinned as "flag-dark by default, always on for the
// sample event" — and that reading was the problem, not the assertion. There is
// exactly ONE row with `is_sample = TRUE`, and the env flag was never set, so
// the menu rendered on the demo wedding and nowhere else. A month of navigation
// work — the resolver, the phase-aware labels, the stranger's Join destination —
// was live only on the one event every verification pass was run against.
// Meanwhile the guests of real couples got the legacy bar, which is also why
// nobody ever saw the two bars stack on top of each other.
//
// The flag is now an opt-OUT. See bottom-edge.test.ts for the composition guard.
test('enable gate: on by default for real events, never off for the sample', () => {
  assert.equal(
    siteMenuEnabled({ flag: undefined, isSample: false }),
    true,
    'a real event with nothing set gets the menu — this is the whole point of the flip',
  );
  assert.equal(siteMenuEnabled({ flag: 'true', isSample: false }), true, 'explicit on');
  assert.equal(
    siteMenuEnabled({ flag: 'false', isSample: false }),
    false,
    'the escape hatch still works — one env value switches the bar back off',
  );
  assert.equal(siteMenuEnabled({ flag: undefined, isSample: true }), true, 'sample always on');
  assert.equal(
    siteMenuEnabled({ flag: 'false', isSample: true }),
    true,
    'and the sample cannot be switched off by a stray env value',
  );
});

// ── browsableBodyRenders — the no-dead-anchors guard ─────────────────────────
//
// Details and Story anchor inside `normalBody()`. `phasedBody` does not call it
// in every phase, so a tab offered when it did not render is a tap that goes
// nowhere. This is the predicate the callers ask before offering either tab.
//
// The bug it closes: open browse forced both tabs on regardless of phase, and
// the save-the-date phase renders the film INSTEAD of the body. It bites on any
// event more than STD_THRESHOLD_DAYS out — i.e. nearly every new wedding.

test('browsableBodyRenders · the save-the-date film replaces the body — UNLESS open browse keeps it below', () => {
  // Flag off: the film IS the page, nothing to anchor into.
  assert.equal(browsableBodyRenders({ body: 'save_the_date', openBrowse: false }), false);
  // Open browse: since the film handoff, `phasedBody` renders the browsable body
  // BENEATH the film, so the anchors exist and the tabs are honest.
  //
  // ⚠ THIS ASSERTION USED TO SAY `false`, AND WAS RIGHT WHEN WRITTEN. The film
  // handoff changed what phasedBody does, and this test — asserting the OLD
  // truth — kept passing while the bar silently lost two tabs on a rich page.
  // It was caught by the owner opening the sample wedding on his phone, not by
  // anything here. If phasedBody changes again, change this with it.
  assert.equal(browsableBodyRenders({ body: 'save_the_date', openBrowse: true }), true);
});

test('browsableBodyRenders · both takeover phases follow the SAME rule', () => {
  // The drift above happened because the two were written as separate cases.
  // Pinning them as equal means a future change to one cannot silently diverge.
  for (const openBrowse of [true, false]) {
    assert.equal(
      browsableBodyRenders({ body: 'save_the_date', openBrowse }),
      browsableBodyRenders({ body: 'editorial', openBrowse }),
      `the film and the editorial cover disagree at openBrowse=${openBrowse} — ` +
        `phasedBody treats them identically, so this must too`,
    );
  }
});

test('browsableBodyRenders · the editorial cover replaces the body UNLESS open browse keeps it below', () => {
  assert.equal(browsableBodyRenders({ body: 'editorial', openBrowse: false }), false);
  assert.equal(browsableBodyRenders({ body: 'editorial', openBrowse: true }), true);
});

test('browsableBodyRenders · the normal body always renders', () => {
  assert.equal(browsableBodyRenders({ body: 'normal', openBrowse: false }), true);
  assert.equal(browsableBodyRenders({ body: 'normal', openBrowse: true }), true);
});

test('browsableBodyRenders · every phase is answered — a new one must not default to true', () => {
  // If a fourth body kind is added, this sweep still passes only because the
  // helper returns a value for it. The point of the assertion is that someone
  // adding a phase has to come here and decide, rather than inheriting `true`.
  const phases = ['normal', 'save_the_date', 'editorial'] as const;
  const seen = phases.map((body) => ({
    body,
    off: browsableBodyRenders({ body, openBrowse: false }),
    on: browsableBodyRenders({ body, openBrowse: true }),
  }));
  assert.deepEqual(seen, [
    { body: 'normal', off: true, on: true },
    { body: 'save_the_date', off: false, on: true },
    { body: 'editorial', off: false, on: true },
  ]);
});
