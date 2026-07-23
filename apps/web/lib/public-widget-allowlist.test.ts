/**
 * Firewall test for the public-widget allow-list (OPEN-BROWSE PR1).
 *
 * The anonymous public landing renders ONLY the widget types in
 * PUBLIC_WIDGET_ALLOWLIST. This suite pins the privacy boundary: the
 * guest-personal / always-on widget types must NEVER appear in the list —
 * a failure here means an anonymous visitor could be served guest-personal
 * surface (QR card, RSVP form, personalized greeting, tagged photos…).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PUBLIC_WIDGET_ALLOWLIST } from './public-widget-allowlist';
import { WIDGET_TYPES, type WidgetType } from './invitation-widgets';

/**
 * Guest-personal or always-on widget types that must never render on the
 * anonymous path: the 4 always-on widgets (hero · greeting · qr_card · rsvp)
 * and the 2 guest-personalized hideable widgets (event_details · your_photos).
 */
const GUEST_PERSONAL_OR_ALWAYS_ON: readonly WidgetType[] = [
  'hero',
  'greeting',
  'qr_card',
  'rsvp',
  'event_details',
  'your_photos',
];

test('allow-list never contains a guest-personal or always-on widget type', () => {
  for (const type of GUEST_PERSONAL_OR_ALWAYS_ON) {
    assert.ok(
      !PUBLIC_WIDGET_ALLOWLIST.includes(type),
      `PUBLIC_WIDGET_ALLOWLIST must not contain guest-personal/always-on type '${type}'`,
    );
  }
});

test('allow-list is exactly the 10 event-level widget types (PR1 zero-behavior pin)', () => {
  // Byte-exact pin of the extracted inline list — content AND order. A diff
  // here is a deliberate product decision, never an accident of refactoring.
  assert.deepEqual(PUBLIC_WIDGET_ALLOWLIST, [
    'countdown',
    'schedule',
    'venue_map',
    'dress_code',
    'photo_moments',
    'tier_comparison',
    'special_message',
    'what_to_bring',
    'our_photos',
    'our_love_story',
  ]);
});

test('every allow-listed type is a real catalog widget type', () => {
  for (const type of PUBLIC_WIDGET_ALLOWLIST) {
    assert.ok(
      (WIDGET_TYPES as readonly string[]).includes(type),
      `'${type}' is not in the invitation-widgets catalog`,
    );
  }
});

test('allow-list + excluded set covers the full catalog with no overlap', () => {
  // Completeness guard: a NEW widget type must be explicitly classified —
  // either added to the allow-list (a privacy decision) or to the excluded
  // set here. Silent drift fails this test.
  const classified = new Set<WidgetType>([
    ...PUBLIC_WIDGET_ALLOWLIST,
    ...GUEST_PERSONAL_OR_ALWAYS_ON,
  ]);
  assert.equal(
    classified.size,
    PUBLIC_WIDGET_ALLOWLIST.length + GUEST_PERSONAL_OR_ALWAYS_ON.length,
    'allow-list and excluded set must not overlap',
  );
  for (const type of WIDGET_TYPES) {
    assert.ok(
      classified.has(type),
      `widget type '${type}' is unclassified — add it to PUBLIC_WIDGET_ALLOWLIST (privacy decision) or the excluded set`,
    );
  }
});
