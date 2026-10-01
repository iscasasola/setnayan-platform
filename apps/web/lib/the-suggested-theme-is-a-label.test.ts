/**
 * the-suggested-theme-is-a-label.test.ts — owner 2026-09-28, verbatim: *"4 keep
 * it"* (the Details theme gallery keeps a "Suggested for you" label on the one
 * theme matching the couple's onboarding feel; it applies nothing).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { HUB_THEMES, themeMatchingFeel } from './invite-themes';

test('the label names the one theme whose feels hold the couple’s feel', () => {
  for (const t of HUB_THEMES.filter((x) => x.ready)) {
    for (const feel of t.feels) {
      const got = themeMatchingFeel(feel);
      assert.ok(got, `feel ${feel} names no theme`);
      assert.ok(HUB_THEMES.find((x) => x.id === got)!.feels.includes(feel));
    }
  }
});

test('no feel or an unknown feel is NO label — never a fallback', () => {
  assert.equal(themeMatchingFeel(null), null);
  assert.equal(themeMatchingFeel(''), null);
  assert.equal(themeMatchingFeel('no-such-feel'), null);
});
