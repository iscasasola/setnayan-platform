/**
 * Anonymous zero-guest-bytes firewall (OPEN-BROWSE PR3 merge gate b).
 *
 * The council gate: the anonymous identity tier of the unified SiteBody must
 * be STRUCTURALLY unable to carry guest-derived data — enforced by
 * construction, not discipline. Three layers, each pinned here:
 *
 *   1. Runtime — `anonymousIdentity()` builds its result by explicit
 *      key-pick, so even a poisoned input (guest fields smuggled past TS via
 *      a cast) cannot reach the anonymous branch.
 *   2. Type level — `AnonymousSiteIdentity` shares no non-discriminant key
 *      with `GuestSiteIdentity`. (Enforced by the `Leak extends never`
 *      assertion in _lib/site-identity.ts, which fails `tsc --noEmit` — the
 *      CI typecheck job — if a guest key is ever added. Restated here so the
 *      suite documents it; tsx strips types, so the RUNTIME teeth for this
 *      file are the key-pick assertions below.)
 *   3. Widget firewall — the anonymous widget list is derived from
 *      PUBLIC_WIDGET_ALLOWLIST (PR1's exported constant) and can never emit
 *      a guest-personal widget type, whatever the registry contains.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  anonymousIdentity,
  type AnonymousSiteIdentity,
  type GuestSiteIdentity,
} from '../app/[slug]/_lib/site-identity';
import { resolveSiteBodyPlan } from './site-body-plan';
import { PUBLIC_WIDGET_ALLOWLIST } from './public-widget-allowlist';
import {
  WIDGET_TYPES,
  type InvitationWidgetRow,
  type LifecyclePhase,
  type WidgetType,
} from './invitation-widgets';

// --- Layer 2 (type level, enforced by tsc): the anonymous identity type
// --- shares no key with the guest identity beyond the discriminant.
type GuestOnlyKeys = Exclude<keyof GuestSiteIdentity, 'kind'>;
type Leak = Extract<keyof AnonymousSiteIdentity, GuestOnlyKeys>;
const _noLeakAtTypeLevel: Leak extends never ? true : false = true;
void _noLeakAtTypeLevel;

/** Every guest-derived field of the guest identity — the forbidden set. */
const GUEST_ONLY_FIELDS = [
  'guest',
  'qrSvg',
  'invitationUrl',
  'guestLiveGallery',
  'seatPassActive',
  'needsFaceEnroll',
  'guestHubData',
  'seatMap',
  'papicGuest',
  'pabati',
  'showClaimAccountCta',
  'accountlessPhotosClosed',
  'eventVendorCredits',
  'saveFlash',
  'faceMode',
] as const satisfies readonly GuestOnlyKeys[];

test('anonymousIdentity() output carries exactly the four anonymous keys', () => {
  const identity = anonymousIdentity({
    reason: null,
    publicCandidCameraActive: false,
    publicAlbumHref: null,
  });
  assert.deepEqual(Object.keys(identity).sort(), [
    'kind',
    'publicAlbumHref',
    'publicCandidCameraActive',
    'reason',
  ]);
  assert.equal(identity.kind, 'anonymous');
});

test('anonymousIdentity() strips smuggled guest fields from a poisoned input', () => {
  // Simulate a future refactor bug: an object that ALSO carries guest data is
  // cast past the compiler and handed to the constructor. The key-pick means
  // none of it reaches the object the anonymous branch receives.
  const poisoned = {
    reason: 'wrong_event',
    publicCandidCameraActive: true,
    publicAlbumHref: '/x/hub',
    guest: { first_name: 'Maria', qr_token: 'SECRET' },
    qrSvg: '<svg>SECRET</svg>',
    invitationUrl: 'https://example.com/?t=SECRET',
    guestHubData: { firstName: 'Maria' },
    eventVendorCredits: [{ vendorProfileId: 'v1' }],
    faceMode: 'mode_a',
  } as unknown as Parameters<typeof anonymousIdentity>[0];

  const identity = anonymousIdentity(poisoned);
  for (const field of GUEST_ONLY_FIELDS) {
    assert.ok(
      !(field in identity),
      `guest-derived field '${field}' must never appear on the anonymous identity`,
    );
  }
  assert.equal(JSON.stringify(identity).includes('SECRET'), false);
});

// ---------------------------------------------------------------------------
// Layer 3 — the anonymous widget filter is the allow-list, exactly.
// ---------------------------------------------------------------------------

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
    tier: 'basic',
    config_json: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }));
}

test('anonymous widget filter === PUBLIC_WIDGET_ALLOWLIST (flag-off render)', () => {
  // With every widget type visible and the phase engine collapsed
  // (phasesEnabled=false), the anonymous list is EXACTLY the allow-list —
  // same members, registry display order.
  const plan = resolveSiteBodyPlan({
    identity: 'anonymous',
    phasesEnabled: false,
    lifecyclePhase: 'rsvp',
    stdFilm: true,
    isSample: false,
    hasHeroMedia: false,
    hasBgMusic: false,
    liveMediaPublic: false,
    widgets: fullRegistry(),
  });
  assert.deepEqual(
    plan.publicSafeWidgets.map((w) => w.widget_type),
    WIDGET_TYPES.filter((t) => PUBLIC_WIDGET_ALLOWLIST.includes(t)),
  );
  assert.equal(plan.publicSafeWidgets.length, PUBLIC_WIDGET_ALLOWLIST.length);
});

test('guest-personal widget types never pass the anonymous filter in ANY phase', () => {
  // Poisoned registry: guest-personal types forced visible AND hideable (a
  // hypothetical bad backfill flips is_always_on off). They still never
  // reach the anonymous list — the allow-list is the fence, not row flags.
  const poisonedRegistry = fullRegistry().map((w) => ({
    ...w,
    is_always_on: false,
    is_visible: true,
  }));
  const guestPersonal: readonly WidgetType[] = [
    'hero',
    'greeting',
    'qr_card',
    'rsvp',
    'event_details',
    'your_photos',
  ];
  for (const phase of PHASES) {
    for (const phasesEnabled of [true, false]) {
      const plan = resolveSiteBodyPlan({
        identity: 'anonymous',
        phasesEnabled,
        lifecyclePhase: phase,
        stdFilm: true,
        isSample: false,
        hasHeroMedia: false,
        hasBgMusic: false,
        liveMediaPublic: false,
        widgets: poisonedRegistry,
      });
      for (const w of plan.publicSafeWidgets) {
        assert.ok(
          PUBLIC_WIDGET_ALLOWLIST.includes(w.widget_type),
          `'${w.widget_type}' leaked past the allow-list (${phase}, flag=${phasesEnabled})`,
        );
        assert.ok(
          !guestPersonal.includes(w.widget_type),
          `guest-personal '${w.widget_type}' leaked to the anonymous tree`,
        );
      }
    }
  }
});
