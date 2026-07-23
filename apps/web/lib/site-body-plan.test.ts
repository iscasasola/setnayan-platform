/**
 * Golden tests for the guest-site phase spine (OPEN-BROWSE PR3 merge gates).
 *
 * `resolveSiteBodyPlan` is the ONE computation site for the 3-way body
 * (editorial | save-the-date | normal) that used to be written twice in
 * app/[slug]/page.tsx. These goldens pin the full 4-phases × identity-tier
 * matrix — the council's "golden snapshots" gate in its CI-runnable form.
 * The third council identity tier (HOST) renders the anonymous body; what
 * makes a host a host is the orchestrator-side `?phase=` preview permission,
 * which is exactly why every phase row here must hold for the anonymous
 * identity too (a host previews all four phases through it).
 *
 * A diff in this file is a product decision, never a refactoring accident.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveSiteBodyPlan,
  type SiteBodyPlan,
  type SiteIdentityKind,
} from './site-body-plan';
import {
  WIDGET_TYPES,
  WIDGET_PHASES,
  type InvitationWidgetRow,
  type LifecyclePhase,
  type WidgetType,
} from './invitation-widgets';
import { PUBLIC_WIDGET_ALLOWLIST } from './public-widget-allowlist';

const ALWAYS_ON: readonly WidgetType[] = ['hero', 'greeting', 'qr_card', 'rsvp'];
const PHASES: readonly LifecyclePhase[] = [
  'save_the_date',
  'rsvp',
  'event',
  'editorial',
];
const IDENTITIES: readonly SiteIdentityKind[] = ['anonymous', 'guest'];

/** A full 16-row registry (every type, all visible), display_order in
 *  catalog order — the post-backfill shape every event has. */
function fullRegistry(): InvitationWidgetRow[] {
  return WIDGET_TYPES.map((type, i) => ({
    widget_id: `w-${type}`,
    event_id: 'e-1',
    widget_type: type,
    display_order: i,
    is_visible: true,
    is_always_on: ALWAYS_ON.includes(type),
    tier: 'basic',
    config_json: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }));
}

function planFor(
  identity: SiteIdentityKind,
  lifecyclePhase: LifecyclePhase,
  overrides: Partial<Parameters<typeof resolveSiteBodyPlan>[0]> = {},
): SiteBodyPlan {
  return resolveSiteBodyPlan({
    identity,
    phasesEnabled: true,
    lifecyclePhase,
    stdFilm: true,
    isSample: false,
    hasHeroMedia: false,
    hasBgMusic: true,
    liveMediaPublic: false,
    widgets: fullRegistry(),
    ...overrides,
  });
}

/** Hideable (non-always-on) types whose phase matrix includes `phase`. */
function hideableTypesInPhase(phase: LifecyclePhase): WidgetType[] {
  return WIDGET_TYPES.filter(
    (t) => !ALWAYS_ON.includes(t) && WIDGET_PHASES[t].includes(phase),
  );
}

// ---------------------------------------------------------------------------
// Gate (c) — golden matrix: 4 phases × both body identities.
// ---------------------------------------------------------------------------

test('golden matrix — body selection per phase is identical for both identity tiers', () => {
  const expectedBody: Record<LifecyclePhase, SiteBodyPlan['body']> = {
    save_the_date: 'save_the_date',
    rsvp: 'normal',
    event: 'normal',
    editorial: 'editorial',
  };
  for (const identity of IDENTITIES) {
    for (const phase of PHASES) {
      assert.equal(
        planFor(identity, phase).body,
        expectedBody[phase],
        `body for ${identity}/${phase}`,
      );
    }
  }
});

test('golden matrix — chrome gates (full-bleed, beacon, reveal, music) per phase', () => {
  for (const identity of IDENTITIES) {
    for (const phase of PHASES) {
      const std = phase === 'save_the_date';
      const plan = planFor(identity, phase);
      // Full-bleed only for the STD film; ?film=0 (stdFilm=false) drops it.
      assert.equal(plan.fullBleed, std, `fullBleed ${identity}/${phase}`);
      assert.equal(
        planFor(identity, phase, { stdFilm: false }).fullBleed,
        false,
        `fullBleed with ?film=0 ${identity}/${phase}`,
      );
      // The STD view beacon fires only in the STD phase, never for samples.
      assert.equal(plan.stdViewBeacon, std, `beacon ${identity}/${phase}`);
      assert.equal(
        planFor(identity, phase, { isSample: true }).stdViewBeacon,
        false,
        `beacon suppressed for sample ${identity}/${phase}`,
      );
      // Reveal overlay is enabled only over the STD phase.
      assert.equal(plan.revealEnabled, std, `reveal ${identity}/${phase}`);
      // Background music mounts in every phase EXCEPT STD (the film owns audio).
      assert.equal(plan.backgroundMusic, !std, `music ${identity}/${phase}`);
      assert.equal(
        planFor(identity, phase, { hasBgMusic: false }).backgroundMusic,
        false,
        `music without a track ${identity}/${phase}`,
      );
    }
  }
});

test('golden matrix — always-on widget gates per phase (guest tree)', () => {
  // Verbatim element×phase matrix: hero=all · greeting=rsvp · qr_card=
  // rsvp+event · rsvp=rsvp. Same for both identities (the plan computes them
  // identity-agnostically; only the guest tree consumes them).
  const expected: Record<
    LifecyclePhase,
    Pick<
      SiteBodyPlan,
      | 'heroShouldRender'
      | 'greetingShouldRender'
      | 'qrCardShouldRender'
      | 'rsvpShouldRender'
    >
  > = {
    save_the_date: {
      heroShouldRender: true,
      greetingShouldRender: false,
      qrCardShouldRender: false,
      rsvpShouldRender: false,
    },
    rsvp: {
      heroShouldRender: true,
      greetingShouldRender: true,
      qrCardShouldRender: true,
      rsvpShouldRender: true,
    },
    event: {
      heroShouldRender: true,
      greetingShouldRender: false,
      qrCardShouldRender: true,
      rsvpShouldRender: false,
    },
    editorial: {
      heroShouldRender: true,
      greetingShouldRender: false,
      qrCardShouldRender: false,
      rsvpShouldRender: false,
    },
  };
  for (const phase of PHASES) {
    const plan = planFor('guest', phase);
    for (const [key, value] of Object.entries(expected[phase])) {
      assert.equal(
        plan[key as keyof SiteBodyPlan],
        value,
        `${key} in ${phase}`,
      );
    }
  }
});

test('golden matrix — widget lists per phase (hideable order + anonymous firewall)', () => {
  for (const phase of PHASES) {
    // Guest tree: every visible hideable widget in the phase, display order.
    assert.deepEqual(
      planFor('guest', phase).hideableInOrder.map((w) => w.widget_type),
      hideableTypesInPhase(phase),
      `hideableInOrder in ${phase}`,
    );
    // Anonymous tree: the same list additionally fenced by the allow-list.
    for (const identity of IDENTITIES) {
      assert.deepEqual(
        planFor(identity, phase).publicSafeWidgets.map((w) => w.widget_type),
        hideableTypesInPhase(phase).filter((t) =>
          PUBLIC_WIDGET_ALLOWLIST.includes(t),
        ),
        `publicSafeWidgets in ${phase} (${identity})`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Gate (a) — the editorial takeover, both identity tiers. Date-gated (the
// phase input) + body-replacing (body === 'editorial' replaces the normal
// tree; the STD view can never render in the editorial phase).
// ---------------------------------------------------------------------------

test('editorial phase yields the editorial body for BOTH identity tiers', () => {
  for (const identity of IDENTITIES) {
    const plan = planFor(identity, 'editorial');
    assert.equal(plan.body, 'editorial', `${identity} editorial body`);
    // The editorial ending replaces the body — no STD chrome bleeds in.
    assert.equal(plan.fullBleed, false);
    assert.equal(plan.revealEnabled, false);
    assert.equal(plan.stdViewBeacon, false);
    // The anonymous hero banner is a normal-body element — never over the
    // editorial takeover.
    assert.equal(plan.anonymousHeroBanner, false);
  }
});

test('editorial is date-gated: it renders ONLY from the editorial phase input', () => {
  for (const identity of IDENTITIES) {
    for (const phase of PHASES.filter((p) => p !== 'editorial')) {
      assert.notEqual(planFor(identity, phase).body, 'editorial');
    }
  }
});

// ---------------------------------------------------------------------------
// STD text-hero + anonymous hero banner (the one deliberate per-identity
// delta inside the shared STD/normal computation sites).
// ---------------------------------------------------------------------------

test('STD text hero: anonymous-without-hero-media only; guest never', () => {
  assert.equal(
    planFor('anonymous', 'save_the_date', { hasHeroMedia: false }).stdShowTextHero,
    true,
  );
  assert.equal(
    planFor('anonymous', 'save_the_date', { hasHeroMedia: true }).stdShowTextHero,
    false,
  );
  assert.equal(
    planFor('guest', 'save_the_date', { hasHeroMedia: false }).stdShowTextHero,
    false,
  );
});

test('anonymous hero banner renders only on the normal body with hero media', () => {
  for (const phase of PHASES) {
    assert.equal(
      planFor('anonymous', phase, { hasHeroMedia: true }).anonymousHeroBanner,
      phase === 'rsvp' || phase === 'event',
      `banner in ${phase}`,
    );
    assert.equal(
      planFor('anonymous', phase, { hasHeroMedia: false }).anonymousHeroBanner,
      false,
    );
    // Never on the guest tree (its hero is widget-gated inside the article).
    assert.equal(
      planFor('guest', phase, { hasHeroMedia: true }).anonymousHeroBanner,
      false,
    );
  }
});

// ---------------------------------------------------------------------------
// PR5 — live-media visibility. Guests always see live media; an anonymous
// (cookie-less) viewer only when the couple opted `events.live_media_public`.
// ---------------------------------------------------------------------------

test('liveMediaVisible: guests always; anonymous only when the couple opts in', () => {
  for (const phase of PHASES) {
    // A guest sees live media in every phase, regardless of the opt-in.
    assert.equal(planFor('guest', phase).liveMediaVisible, true, `guest ${phase}`);
    assert.equal(
      planFor('guest', phase, { liveMediaPublic: true }).liveMediaVisible,
      true,
      `guest opted ${phase}`,
    );
    // Anonymous is gated: default FALSE closed, TRUE only on the couple's opt-in.
    assert.equal(
      planFor('anonymous', phase).liveMediaVisible,
      false,
      `anonymous default-closed ${phase}`,
    );
    assert.equal(
      planFor('anonymous', phase, { liveMediaPublic: true }).liveMediaVisible,
      true,
      `anonymous opted-in ${phase}`,
    );
  }
});

// ---------------------------------------------------------------------------
// Flag-off collapse — when phasesEnabled=false every phase gate is a no-op
// (the pre-Increment-C render): normal body, all visible widgets, no fences
// beyond the anonymous allow-list.
// ---------------------------------------------------------------------------

test('phasesEnabled=false collapses to the un-phased render in every phase', () => {
  for (const identity of IDENTITIES) {
    for (const phase of PHASES) {
      const plan = planFor(identity, phase, { phasesEnabled: false });
      assert.equal(plan.body, 'normal');
      assert.equal(plan.fullBleed, false);
      assert.equal(plan.revealEnabled, false);
      assert.equal(plan.stdViewBeacon, false);
      assert.equal(plan.backgroundMusic, true);
      assert.deepEqual(
        plan.hideableInOrder.map((w) => w.widget_type),
        WIDGET_TYPES.filter((t) => !ALWAYS_ON.includes(t)),
        'all visible hideable widgets, no phase fence',
      );
      assert.deepEqual(
        plan.publicSafeWidgets.map((w) => w.widget_type),
        WIDGET_TYPES.filter(
          (t) => !ALWAYS_ON.includes(t) && PUBLIC_WIDGET_ALLOWLIST.includes(t),
        ),
        'allow-list fence still applies with the flag off',
      );
      assert.equal(plan.heroShouldRender, true);
      assert.equal(plan.greetingShouldRender, true);
      assert.equal(plan.qrCardShouldRender, true);
      assert.equal(plan.rsvpShouldRender, true);
    }
  }
});

// ---------------------------------------------------------------------------
// Registry-shape defensiveness (pre-backfill deploy window).
// ---------------------------------------------------------------------------

test('missing always-on rows fail closed (widgetShouldRender(null) === false)', () => {
  const plan = planFor('guest', 'rsvp', { widgets: [] });
  assert.equal(plan.heroShouldRender, false);
  assert.equal(plan.greetingShouldRender, false);
  assert.equal(plan.qrCardShouldRender, false);
  assert.equal(plan.rsvpShouldRender, false);
  assert.deepEqual(plan.hideableInOrder, []);
  assert.deepEqual(plan.publicSafeWidgets, []);
});

test('hidden hideable rows are excluded from both widget lists', () => {
  const widgets = fullRegistry().map((w) =>
    w.widget_type === 'schedule' || w.widget_type === 'our_photos'
      ? { ...w, is_visible: false }
      : w,
  );
  const plan = planFor('guest', 'rsvp', { widgets });
  assert.ok(!plan.hideableInOrder.some((w) => w.widget_type === 'schedule'));
  assert.ok(!plan.publicSafeWidgets.some((w) => w.widget_type === 'our_photos'));
});
