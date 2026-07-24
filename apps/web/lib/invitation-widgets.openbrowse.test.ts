/**
 * Open-browse engine tests (OPEN-BROWSE PR7 · council verdict §1.3).
 *
 * WIDGET_SPOTLIGHT / hasContent / terminal states / mode+audience
 * reconciliation / the widened-list builder. All pure — the node:test suite
 * exercises them directly. `WIDGET_PHASES` (the flag-off gate) is unchanged and
 * covered by site-body-plan.test.ts; these cover the new emphasis path only.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  WIDGET_TYPES,
  WIDGET_PHASES,
  WIDGET_SPOTLIGHT,
  OPEN_BROWSE_ALL_PHASES,
  hasContent,
  resolveWidgetTerminalState,
  isTerminalRenderable,
  openBrowseSectionVisible,
  openBrowseWidgetVisibleTo,
  openBrowseWidgetsInOrder,
  type InvitationWidgetRow,
  type LifecyclePhase,
  type WidgetType,
} from './invitation-widgets';

const ALWAYS_ON: readonly WidgetType[] = ['hero', 'greeting', 'qr_card', 'rsvp'];
const PHASES: readonly LifecyclePhase[] = [
  'save_the_date',
  'rsvp',
  'event',
  'editorial',
];

function row(
  type: WidgetType,
  over: Partial<InvitationWidgetRow> = {},
): InvitationWidgetRow {
  return {
    widget_id: `w-${type}`,
    event_id: 'e-1',
    widget_type: type,
    display_order: WIDGET_TYPES.indexOf(type),
    is_visible: true,
    is_always_on: ALWAYS_ON.includes(type),
    tier: 'basic',
    config_json: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

// ---------------------------------------------------------------------------
// WIDGET_SPOTLIGHT — exhaustive + coexists with WIDGET_PHASES.
// ---------------------------------------------------------------------------

test('WIDGET_SPOTLIGHT is exhaustive over WIDGET_TYPES (no missing entry)', () => {
  for (const t of WIDGET_TYPES) {
    assert.ok(WIDGET_SPOTLIGHT[t], `missing spotlight spec for ${t}`);
    assert.equal(typeof WIDGET_SPOTLIGHT[t].weight, 'number');
    assert.ok(Array.isArray(WIDGET_SPOTLIGHT[t].spotlightPhases));
  }
});

test('WIDGET_PHASES is left intact (flag-off gate unchanged by PR7)', () => {
  // The known live defect the council fixes ON THE OPEN-BROWSE PATH must still
  // be present in WIDGET_PHASES (proof PR7 did not mutate the flag-off gate).
  assert.deepEqual(WIDGET_PHASES.qr_card, ['rsvp', 'event']);
  assert.deepEqual(WIDGET_PHASES.greeting, ['rsvp']);
});

// ---------------------------------------------------------------------------
// hasContent — fail-open on unknown, honors explicit false.
// ---------------------------------------------------------------------------

test('hasContent fails open for unmapped types, honors explicit flags', () => {
  assert.equal(hasContent('schedule', {}), true, 'unknown → present');
  assert.equal(hasContent('schedule', { schedule: false }), false);
  assert.equal(hasContent('schedule', { schedule: true }), true);
});

// ---------------------------------------------------------------------------
// Terminal states — the §1.3 time-bound widgets.
// ---------------------------------------------------------------------------

test('terminal states: time-bound widgets degrade only post-event (editorial)', () => {
  // Pre-event + event day: everything active (RSVP stays open through live).
  for (const phase of ['save_the_date', 'rsvp', 'event'] as const) {
    for (const t of WIDGET_TYPES) {
      assert.equal(resolveWidgetTerminalState(t, phase), 'active', `${t}/${phase}`);
    }
  }
  // Editorial (post-event): the four called-out widgets degrade.
  assert.equal(resolveWidgetTerminalState('rsvp', 'editorial'), 'closed');
  assert.equal(resolveWidgetTerminalState('countdown', 'editorial'), 'archive');
  assert.equal(resolveWidgetTerminalState('what_to_bring', 'editorial'), 'archive');
  assert.equal(resolveWidgetTerminalState('photo_moments', 'editorial'), 'archive');
  // Evergreen widgets stay active even in editorial.
  assert.equal(resolveWidgetTerminalState('our_love_story', 'editorial'), 'active');
  assert.equal(resolveWidgetTerminalState('venue_map', 'editorial'), 'active');
});

test('isTerminalRenderable: only active renders in PR7 (archive/closed are PR8)', () => {
  assert.equal(isTerminalRenderable('active'), true);
  assert.equal(isTerminalRenderable('archive'), false);
  assert.equal(isTerminalRenderable('closed'), false);
});

// ---------------------------------------------------------------------------
// mode / is_visible / audience reconciliation.
// ---------------------------------------------------------------------------

test('openBrowseSectionVisible: is_visible OR mode drives hideable rows', () => {
  // always-on renders regardless of is_visible / mode.
  assert.equal(openBrowseSectionVisible(row('rsvp', { is_visible: false })), true);
  // hideable: mode=hidden always hides.
  assert.equal(
    openBrowseSectionVisible(row('schedule', { is_visible: true, mode: 'hidden' })),
    false,
  );
  // mode=shown force-shows even if a legacy is_visible=false lingers.
  assert.equal(
    openBrowseSectionVisible(row('schedule', { is_visible: false, mode: 'shown' })),
    true,
  );
  // mode=auto (or unset) falls back to is_visible.
  assert.equal(
    openBrowseSectionVisible(row('schedule', { is_visible: false, mode: 'auto' })),
    false,
  );
  assert.equal(
    openBrowseSectionVisible(row('schedule', { is_visible: true })),
    true,
    'unset mode → is_visible',
  );
});

test('openBrowseWidgetVisibleTo: guests_only hides from anonymous only', () => {
  const guestsOnly = row('schedule', { audience: 'guests_only' });
  assert.equal(openBrowseWidgetVisibleTo(guestsOnly, 'guest'), true);
  assert.equal(openBrowseWidgetVisibleTo(guestsOnly, 'anonymous'), false);
  const pub = row('schedule', { audience: 'public' });
  assert.equal(openBrowseWidgetVisibleTo(pub, 'anonymous'), true);
  // unset audience defaults public.
  assert.equal(openBrowseWidgetVisibleTo(row('schedule'), 'anonymous'), true);
});

// ---------------------------------------------------------------------------
// openBrowseWidgetsInOrder — the widened list.
// ---------------------------------------------------------------------------

test('openBrowseWidgetsInOrder: no phase fence — a visible widget renders every phase', () => {
  const widgets = [row('schedule'), row('dress_code'), row('our_love_story')];
  for (const phase of PHASES) {
    const got = openBrowseWidgetsInOrder({
      widgets,
      identity: 'guest',
      phase,
      content: {},
    }).map((w) => w.widget_type);
    // save_the_date under WIDGET_PHASES would strip all three; open-browse keeps
    // them (except post-event terminal exclusions, none of these three are).
    assert.deepEqual(got, ['schedule', 'dress_code', 'our_love_story'], `phase ${phase}`);
  }
});

test('openBrowseWidgetsInOrder: orders by WIDGET_SPOTLIGHT.weight', () => {
  // Feed out of catalog order; expect spotlight-weight order back.
  const widgets = [row('our_photos'), row('venue_map'), row('countdown')];
  const got = openBrowseWidgetsInOrder({
    widgets,
    identity: 'guest',
    phase: 'rsvp',
    content: {},
  }).map((w) => w.widget_type);
  assert.deepEqual(got, ['countdown', 'venue_map', 'our_photos']);
});

test('openBrowseWidgetsInOrder: drops empty (hasContent=false) and terminal (archive) widgets', () => {
  const widgets = [row('schedule'), row('what_to_bring'), row('dress_code')];
  // schedule has no content this event → dropped; the rest kept (rsvp phase).
  const rsvp = openBrowseWidgetsInOrder({
    widgets,
    identity: 'guest',
    phase: 'rsvp',
    content: { schedule: false },
  }).map((w) => w.widget_type);
  // Order is WIDGET_SPOTLIGHT.weight: dress_code (14) before what_to_bring (15).
  assert.deepEqual(rsvp, ['dress_code', 'what_to_bring']);
  // editorial phase: what_to_bring degrades to archive → dropped (PR7 seam).
  const editorial = openBrowseWidgetsInOrder({
    widgets,
    identity: 'guest',
    phase: 'editorial',
    content: {},
  }).map((w) => w.widget_type);
  // schedule (12) + dress_code (14) stay active; what_to_bring archives out.
  assert.deepEqual(editorial, ['schedule', 'dress_code'], 'what_to_bring archived-out');
});

test('openBrowseWidgetsInOrder: anonymous drops guests_only, hidden, and always-on', () => {
  const widgets = [
    row('hero'),
    row('rsvp'),
    row('schedule', { audience: 'guests_only' }),
    row('venue_map'),
    row('dress_code', { mode: 'hidden' }),
  ];
  const got = openBrowseWidgetsInOrder({
    widgets,
    identity: 'anonymous',
    phase: 'rsvp',
    content: {},
  }).map((w) => w.widget_type);
  // hero/rsvp always-on (excluded from hideable list); schedule guests_only;
  // dress_code hidden. Only venue_map survives.
  assert.deepEqual(got, ['venue_map']);
});

test('OPEN_BROWSE_ALL_PHASES lists every lifecycle phase (qr/greeting widen target)', () => {
  assert.deepEqual([...OPEN_BROWSE_ALL_PHASES].sort(), [...PHASES].sort());
});
