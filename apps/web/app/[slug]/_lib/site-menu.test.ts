/**
 * Unit suite for the open-browse site-menu model (PR6 shell). Invariants: the
 * five tabs are Home · Details · Story · Gallery · Me; "Gallery" is the owner
 * rename (never "Photos"); Home + Me are always present; a middle tab appears
 * ONLY when its section rendered (no dead anchors — the rejected Program Board
 * bug); and the enable gate is flag-dark but always-on for the sample event.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { siteMenuTabs, siteMenuEnabled, SITE_MENU_ANCHORS } from './site-menu';

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

test('enable gate: flag-dark by default, always on for the sample event', () => {
  assert.equal(siteMenuEnabled({ flag: undefined, isSample: false }), false, 'off by default');
  assert.equal(siteMenuEnabled({ flag: 'false', isSample: false }), false, 'explicit off');
  assert.equal(siteMenuEnabled({ flag: 'true', isSample: false }), true, 'flag flips it on');
  assert.equal(siteMenuEnabled({ flag: undefined, isSample: true }), true, 'sample always on');
});
