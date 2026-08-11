import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SLUG_FORWARDING_MONTHS, slugForwardingLabel } from './slug-forwarding-window';

const WEB = join(import.meta.dirname, '..');

test('the label is DERIVED, so the copy cannot say a different number', () => {
  assert.equal(slugForwardingLabel(24), '2 years');
  assert.equal(slugForwardingLabel(12), '1 year');
  assert.equal(slugForwardingLabel(36), '3 years');
  assert.equal(slugForwardingLabel(18), '18 months');
  assert.equal(slugForwardingLabel(1), '1 month');
  // The real one, whatever it currently is.
  assert.equal(slugForwardingLabel(), slugForwardingLabel(SLUG_FORWARDING_MONTHS));
});

// ── The promise and the number must stay attached ──────────────────────────
//
// "90 days" was typed into two screens and three comments. When the window
// changed, a correction at one site would have left the others confidently
// stating the old figure to a couple deciding whether to rename. These two
// tests fail if either screen goes back to a hard-typed duration.
const PROMISE_SCREENS = [
  'app/dashboard/[eventId]/invitation/_components/slug-field.tsx',
  'app/dashboard/(account)/profile/page.tsx',
];

test('every screen that promises forwarding derives the window', () => {
  for (const rel of PROMISE_SCREENS) {
    const src = readFileSync(join(WEB, rel), 'utf8');
    assert.ok(
      src.includes('slugForwardingLabel()'),
      `${rel} promises a forwarding window but does not derive it from SLUG_FORWARDING_MONTHS`,
    );
  }
});

test('no promise screen hard-types a duration next to the promise', () => {
  // Matches "for 90 days", "for 24 months", "for 2 years" — a literal duration
  // in the promise sentence. Deliberately narrow: an unrelated "90 days"
  // elsewhere in a big page is not what broke.
  const HARD_TYPED = /redirect(?:ing)?[^.]{0,40}\b\d+\s*(?:day|days|month|months|year|years)\b/i;
  for (const rel of PROMISE_SCREENS) {
    const src = readFileSync(join(WEB, rel), 'utf8');
    const hit = src.match(HARD_TYPED);
    assert.equal(
      hit,
      null,
      `${rel} states a redirect duration as a literal (${hit?.[0]}) — use slugForwardingLabel()`,
    );
  }
});
