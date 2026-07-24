/**
 * resolveSiteBodyPlan — open-browse branch tests (OPEN-BROWSE PR7 · §1.2/§1.3).
 *
 * site-body-plan.test.ts pins the flag-OFF golden matrix (openBrowse defaults
 * false there, so those goldens are the byte-identical guarantee). This file
 * covers the openBrowse=TRUE path: phases-as-emphasis, the widened lists, the
 * qr/greeting widen, the identity-aware spotlight, and the terminal-state seam.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveSiteBodyPlan,
  pickHomeSpotlight,
  type SiteBodyPlan,
  type SiteIdentityKind,
} from './site-body-plan';
import {
  WIDGET_TYPES,
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

function fullRegistry(): InvitationWidgetRow[] {
  return WIDGET_TYPES.map((type, i) => ({
    widget_id: `w-${type}`,
    event_id: 'e-1',
    widget_type: type,
    display_order: i,
    is_visible: true,
    is_always_on: ALWAYS_ON.includes(type),
    tier: 'basic' as const,
    config_json: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }));
}

function ob(
  identity: SiteIdentityKind,
  phase: LifecyclePhase,
  over: Partial<Parameters<typeof resolveSiteBodyPlan>[0]> = {},
): SiteBodyPlan {
  return resolveSiteBodyPlan({
    identity,
    phasesEnabled: true,
    lifecyclePhase: phase,
    stdFilm: true,
    isSample: false,
    hasHeroMedia: false,
    hasBgMusic: true,
    liveMediaPublic: false,
    widgets: fullRegistry(),
    openBrowse: true,
    ...over,
  });
}

// ---------------------------------------------------------------------------
// Flag-off default: omitting openBrowse must yield the empty new fields.
// ---------------------------------------------------------------------------

test('openBrowse defaults false — new fields inert, existing behavior unchanged', () => {
  const plan = resolveSiteBodyPlan({
    identity: 'guest',
    phasesEnabled: true,
    lifecyclePhase: 'save_the_date',
    stdFilm: true,
    isSample: false,
    hasHeroMedia: false,
    hasBgMusic: true,
    liveMediaPublic: false,
    widgets: fullRegistry(),
  });
  assert.equal(plan.openBrowse, false);
  assert.equal(plan.spotlight, null);
  assert.deepEqual(plan.widgetTerminalStates, {});
  // save_the_date under the flag-off gate strips greeting/qr/rsvp (WIDGET_PHASES).
  assert.equal(plan.greetingShouldRender, false);
  assert.equal(plan.qrCardShouldRender, false);
});

// ---------------------------------------------------------------------------
// qr_card + greeting widen to every phase (council §1.2).
// ---------------------------------------------------------------------------

test('open-browse: qr_card + greeting reachable in ALL phases (both identities)', () => {
  for (const identity of ['anonymous', 'guest'] as const) {
    for (const phase of PHASES) {
      const plan = ob(identity, phase);
      assert.equal(plan.qrCardShouldRender, true, `qr ${identity}/${phase}`);
      assert.equal(plan.greetingShouldRender, true, `greeting ${identity}/${phase}`);
      assert.equal(plan.heroShouldRender, true, `hero ${identity}/${phase}`);
    }
  }
});

test('open-browse: RSVP open through the live window, closed-card excluded post-event', () => {
  for (const phase of ['save_the_date', 'rsvp', 'event'] as const) {
    assert.equal(ob('guest', phase).rsvpShouldRender, true, `rsvp open ${phase}`);
  }
  // editorial → terminal 'closed' → excluded until PR8's copy.
  assert.equal(ob('guest', 'editorial').rsvpShouldRender, false);
  assert.equal(ob('guest', 'editorial').widgetTerminalStates.rsvp, 'closed');
});

// ---------------------------------------------------------------------------
// Widened widget lists — no phase fence, spotlight order, terminal exclusion.
// ---------------------------------------------------------------------------

test('open-browse: guest hideable list is phase-independent except terminal exclusions', () => {
  // rsvp vs event: same evergreen set (no WIDGET_PHASES strip).
  const rsvp = ob('guest', 'rsvp').hideableInOrder.map((w) => w.widget_type);
  const stdate = ob('guest', 'save_the_date').hideableInOrder.map((w) => w.widget_type);
  assert.deepEqual(rsvp, stdate, 'no phase fence pre-event');
  // Under WIDGET_PHASES (flag-off), save_the_date would strip nearly all of
  // these; open-browse keeps every visible widget.
  assert.ok(rsvp.includes('dress_code'));
  assert.ok(rsvp.includes('venue_map'));
  assert.ok(rsvp.includes('what_to_bring'));
  // editorial drops the archive-terminal widgets (what_to_bring / photo_moments
  // / countdown), keeps the evergreens.
  const editorial = ob('guest', 'editorial').hideableInOrder.map((w) => w.widget_type);
  assert.ok(!editorial.includes('what_to_bring'), 'what_to_bring archived-out');
  assert.ok(!editorial.includes('photo_moments'), 'photo_moments archived-out');
  assert.ok(!editorial.includes('countdown'), 'countdown archived-out');
  assert.ok(editorial.includes('our_love_story'), 'evergreen kept');
});

test('open-browse: anonymous list stays inside the allow-list firewall', () => {
  for (const phase of PHASES) {
    const anon = ob('anonymous', phase).publicSafeWidgets.map((w) => w.widget_type);
    // Never a guest-personal type.
    for (const t of ['event_details', 'your_photos'] as const) {
      assert.ok(!anon.includes(t), `${t} must never appear anonymously (${phase})`);
    }
  }
});

test('open-browse: audience=guests_only hides a widget from anonymous, keeps for guest', () => {
  const widgets = fullRegistry().map((w) =>
    w.widget_type === 'venue_map' ? { ...w, audience: 'guests_only' as const } : w,
  );
  const anon = ob('anonymous', 'rsvp', { widgets }).publicSafeWidgets.map(
    (w) => w.widget_type,
  );
  const guest = ob('guest', 'rsvp', { widgets }).hideableInOrder.map((w) => w.widget_type);
  assert.ok(!anon.includes('venue_map'), 'anonymous cannot see guests_only');
  assert.ok(guest.includes('venue_map'), 'guest still sees it');
});

test('open-browse: mode=hidden drops a widget even with is_visible=true', () => {
  const widgets = fullRegistry().map((w) =>
    w.widget_type === 'dress_code' ? { ...w, mode: 'hidden' as const } : w,
  );
  const guest = ob('guest', 'rsvp', { widgets }).hideableInOrder.map((w) => w.widget_type);
  assert.ok(!guest.includes('dress_code'), 'force-hidden section suppressed');
});

test('open-browse: empty content drops the section (menu never points at nothing)', () => {
  const guest = ob('guest', 'rsvp', { content: { schedule: false } }).hideableInOrder.map(
    (w) => w.widget_type,
  );
  assert.ok(!guest.includes('schedule'), 'empty schedule dropped');
});

// ---------------------------------------------------------------------------
// Home spotlight — identity-aware.
// ---------------------------------------------------------------------------

test('spotlight: identity-aware per phase (anonymous rsvp → find-mode, never RSVP)', () => {
  assert.deepEqual(ob('guest', 'rsvp').spotlight, { kind: 'rsvp' });
  assert.deepEqual(ob('anonymous', 'rsvp').spotlight, { kind: 'find_invite' });
  assert.deepEqual(ob('guest', 'event').spotlight, { kind: 'watch_live' });
  assert.deepEqual(ob('guest', 'editorial').spotlight, { kind: 'editorial_cover' });
  assert.deepEqual(ob('guest', 'save_the_date').spotlight, { kind: 'std_film' });
});

test('spotlight: no launched film / null-date save_the_date → countdown, never a dead film door', () => {
  assert.deepEqual(
    ob('anonymous', 'save_the_date', { stdFilm: false }).spotlight,
    { kind: 'countdown' },
  );
  // Direct picker unit for completeness.
  assert.deepEqual(pickHomeSpotlight('guest', 'save_the_date', false), { kind: 'countdown' });
  assert.deepEqual(pickHomeSpotlight('guest', 'save_the_date', true), { kind: 'std_film' });
});

// ---------------------------------------------------------------------------
// Body selection is untouched by open-browse (moments survive).
// ---------------------------------------------------------------------------

test('open-browse: the editorial + STD moments still own the body', () => {
  assert.equal(ob('guest', 'editorial').body, 'editorial');
  assert.equal(ob('anonymous', 'editorial').body, 'editorial');
  assert.equal(ob('guest', 'save_the_date').body, 'save_the_date');
  assert.equal(ob('guest', 'save_the_date').fullBleed, true);
  assert.equal(ob('guest', 'rsvp').body, 'normal');
});
