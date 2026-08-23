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
 *
 * OWNER-LAYER EXTENSION (2026-07-26). The owner layer added a capability that
 * unlocks host controls on the very same page. It deliberately does NOT live
 * on `SiteIdentity`, so the same three layers now also pin: NEITHER visitor
 * tier — anonymous, nor a cookie-holding guest who is not a host — can carry
 * owner capability. See `OwnerCapability` in _lib/site-identity.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  anonymousIdentity,
  guestIdentity,
  OWNER_CAPABILITY_KEYS,
  VENDOR_CAPABILITY_KEYS,
  resolveVendorCapability,
  type AnonymousSiteIdentity,
  type GuestSiteIdentity,
  type OwnerCapability,
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

// --- Layer 2, owner extension: NEITHER visitor tier shares a key with
// --- OwnerCapability, so owner capability can never ride on an identity.
type OwnerLeak = Extract<
  keyof AnonymousSiteIdentity | keyof GuestSiteIdentity,
  keyof OwnerCapability
>;
const _noOwnerLeakAtTypeLevel: OwnerLeak extends never ? true : false = true;
void _noOwnerLeakAtTypeLevel;

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
// Owner-layer firewall — neither visitor tier may carry owner capability.
// ---------------------------------------------------------------------------

/** The owner capability's own keys — the forbidden set for BOTH tiers. Read
 *  from the module's exported list so this suite can't drift from the type. */
const OWNER_ONLY_FIELDS = OWNER_CAPABILITY_KEYS;

/** A complete, realistic guest-identity input. The nested shapes (GuestRow,
 *  GuestHubData, …) are cast in — this suite is about KEYS, not their values. */
function guestInput(
  extra: Record<string, unknown> = {},
): Parameters<typeof guestIdentity>[0] {
  return {
    guest: {
      first_name: 'Maria',
      last_name: 'Cruz',
      display_name: null,
      qr_token: 'GUESTSECRET',
    },
    qrSvg: '<svg>GUESTSECRET</svg>',
    invitationUrl: 'https://example.com/?t=GUESTSECRET',
    guestLiveGallery: null,
    seatPassActive: false,
    needsFaceEnroll: false,
    guestHubData: { firstName: 'Maria' },
    seatMap: null,
    papicGuest: null,
    showClaimAccountCta: false,
    accountlessPhotosClosed: false,
    eventVendorCredits: [],
    saveFlash: null,
    faceMode: 'mode_a',
    ...extra,
  } as unknown as Parameters<typeof guestIdentity>[0];
}

test('anonymousIdentity() strips smuggled owner capability from a poisoned input', () => {
  // Simulate the future bug this firewall exists for: an owner-layer refactor
  // that spreads a capability-bearing object into the anonymous constructor.
  // The key-pick means no owner key reaches the anonymous branch, so an
  // anonymous visitor can never be handed unlocked host controls.
  const poisoned = {
    reason: null,
    publicCandidCameraActive: false,
    publicAlbumHref: null,
    capability: 'owner',
    ownerUserId: 'user-host',
    ownerEventId: 'event-1',
  } as unknown as Parameters<typeof anonymousIdentity>[0];

  const identity = anonymousIdentity(poisoned);
  for (const field of OWNER_ONLY_FIELDS) {
    assert.ok(
      !(field in identity),
      `owner-capability field '${field}' must never appear on the anonymous identity`,
    );
  }
  assert.deepEqual(Object.keys(identity).sort(), [
    'kind',
    'publicAlbumHref',
    'publicCandidCameraActive',
    'reason',
  ]);
});

test('guestIdentity() output carries exactly the guest keys, and no more', () => {
  const identity = guestIdentity(guestInput());
  assert.deepEqual(Object.keys(identity).sort(), [
    'accountlessPhotosClosed',
    'eventVendorCredits',
    'faceMode',
    'guest',
    'guestHubData',
    'guestLiveGallery',
    'invitationUrl',
    'kind',
    'needsFaceEnroll',
    'papicGuest',
    // profileDetails (renamed from `profileDetails` 2026-08-21) — THIS PERSON'S OWN
    // offered back as the reply card's default. It is per-person data the guest
    // themselves supplied, never anything about the host or the event, and it is
    // `null` for a cookie-only guest with no account. Reasoned about, not
    // absorbed: the key belongs here because it travels WITH the guest.
    'profileDetails',
    'qrSvg',
    'rsvpFlash',
    'saveFlash',
    'seatMap',
    'seatPassActive',
    'showClaimAccountCta',
  ]);
  assert.equal(identity.kind, 'guest');
});

test('guestIdentity() strips smuggled owner capability from a poisoned input', () => {
  // A cookie-holding guest of this event who is NOT a host. Even if a future
  // refactor hands the guest constructor an object that also carries a
  // capability, none of it reaches the object the guest branch receives.
  const identity = guestIdentity(
    guestInput({
      capability: 'owner',
      ownerUserId: 'user-host',
      ownerEventId: 'event-1',
    }),
  );
  for (const field of OWNER_ONLY_FIELDS) {
    assert.ok(
      !(field in identity),
      `owner-capability field '${field}' must never appear on the guest identity`,
    );
  }
  assert.equal(JSON.stringify(identity).includes('user-host'), false);
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

// ── The vendor capability obeys the same firewall as the owner one ───────────
//
// The doorway strip unlocks a link into a supplier's own workspace. It must be
// impossible for a visitor's identity object to carry that grant — the DB is
// the boundary, not the UI. These mirror the owner-capability assertions above.

test('vendor capability · a key-poisoned input cannot smuggle a grant through the anonymous tier', () => {
  const poisoned = {
    reason: null,
    publicCandidCameraActive: false,
    publicAlbumHref: null,
    capability: 'vendor',
    vendorUserId: 'SMUGGLED',
    vendorProfileId: 'SMUGGLED',
    businessName: 'SMUGGLED',
  } as never;
  const identity = anonymousIdentity(poisoned);
  assert.ok(
    !JSON.stringify(identity).includes('SMUGGLED'),
    'the anonymous key-pick let a vendor-capability field through',
  );
  for (const key of VENDOR_CAPABILITY_KEYS) {
    assert.ok(
      !(key in (identity as Record<string, unknown>)),
      `anonymous identity carries "${key}" — the capability must travel BESIDE the identity`,
    );
  }
});

test('vendor capability · resolveVendorCapability denies without an account, and without a booking', async () => {
  const never = async () => null;
  assert.equal(
    await resolveVendorCapability({
      eventId: 'e1',
      viewerUserId: null,
      checkVendorBooking: async () => {
        throw new Error('must not be asked — there is no account');
      },
    }),
    null,
    'a signed-out visitor must never reach the booking probe',
  );
  assert.equal(
    await resolveVendorCapability({
      eventId: 'e1',
      viewerUserId: 'u1',
      checkVendorBooking: never,
    }),
    null,
    'signed in but not booked here must not get a capability',
  );
});

test('vendor capability · the grant is bound to the event it was resolved against', async () => {
  const cap = await resolveVendorCapability({
    eventId: 'event-A',
    viewerUserId: 'u1',
    checkVendorBooking: async () => ({
      vendorProfileId: 'vp1',
      businessName: 'San Marco',
      bookingStatus: 'contracted',
    }),
  });
  assert.equal(cap?.vendorEventId, 'event-A');
  assert.equal(cap?.vendorUserId, 'u1');
  assert.equal(cap?.capability, 'vendor');
  // A capability resolved for event A must be inert on event B — the strip
  // links using vendorEventId, so this is what stops a cross-event link.
  assert.notEqual(cap?.vendorEventId, 'event-B');
});
