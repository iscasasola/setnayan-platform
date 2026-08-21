/**
 * Simulated "already replied" guest preview — the editor's RSVP'd tab.
 *
 * `shouldSimulateRepliedGuest()` + `buildSimulatedGuestIdentity()` are the whole
 * decision + data surface behind that tab; `app/[slug]/page.tsx` is an `if` and
 * a `<SiteBody>`. So this suite carries the two claims the PR is accountable for.
 *
 *   1. THE GATE. Substitution happens for exactly one viewer — the one holding a
 *      server-verified `OwnerCapability` for THIS event, on the `rsvp` phase,
 *      who asked for it with `?as=replied`. Every other combination renders the
 *      ordinary page. `?as=replied` on its own is inert.
 *   2. THE GUEST IS FABRICATED. The identity carries no value that could have
 *      come from a real `guests` row — no borrowed name, no meal preference, no
 *      dietary note, no usable QR token — and it carries exactly the fifteen
 *      declared guest keys (never an owner capability).
 *
 * Gate-neutralisation check (2026-07-26): forcing the `ownerCapability` guard to
 * pass (`if (!ownerCapability) return true`) in `shouldSimulateRepliedGuest`
 * makes the negative tests below fail, which is the proof that they test the
 * gate rather than merely coexisting with it. See the report for the run.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSimulatedGuestIdentity,
  shouldSimulateRepliedGuest,
  SIMULATED_GUEST_DISPLAY_NAME,
  SIMULATED_GUEST_ID,
  SIMULATED_GUEST_PARAM,
  SIMULATED_GUEST_PARAM_VALUE,
} from './simulated-guest-preview';
import type { OwnerCapability } from '../app/[slug]/_lib/site-identity';
import type { LifecyclePhase } from './invitation-widgets';

const EVENT_ID = 'S89E-ABCDEFGHJK';
const OTHER_EVENT_ID = 'S89E-ZZZZZZZZZZ';
const SLUG = 'maria-and-jose';

/** A capability shaped exactly as `resolveOwnerCapability` produces one. */
const ownerOf = (eventId: string): OwnerCapability => ({
  capability: 'owner',
  ownerUserId: 'user-host',
  ownerEventId: eventId,
});

function decide(
  overrides: Partial<Parameters<typeof shouldSimulateRepliedGuest>[0]> = {},
) {
  return shouldSimulateRepliedGuest({
    ownerCapability: ownerOf(EVENT_ID),
    asParam: 'replied',
    lifecyclePhase: 'rsvp',
    eventId: EVENT_ID,
    ...overrides,
  });
}

// ── 1. The gate ─────────────────────────────────────────────────────────────

test('host capability + rsvp phase + as=replied → substitutes', () => {
  assert.equal(decide(), true);
});

test('null capability + as=replied → NO substitution (the gate)', () => {
  assert.equal(decide({ ownerCapability: null }), false);
});

test('null capability is denied on every phase, param spelling and event', () => {
  for (const lifecyclePhase of [
    'save_the_date',
    'rsvp',
    'event',
    'editorial',
  ] satisfies LifecyclePhase[]) {
    for (const asParam of ['replied', 'REPLIED', 'attending', '1', '']) {
      assert.equal(
        decide({ ownerCapability: null, lifecyclePhase, asParam }),
        false,
        `expected denial for phase=${lifecyclePhase} as=${asParam}`,
      );
    }
  }
});

test('capability present but phase is not rsvp → NO substitution', () => {
  for (const lifecyclePhase of [
    'save_the_date',
    'event',
    'editorial',
  ] satisfies LifecyclePhase[]) {
    assert.equal(
      decide({ lifecyclePhase }),
      false,
      `expected denial on phase=${lifecyclePhase}`,
    );
  }
});

test('capability for a DIFFERENT event → NO substitution', () => {
  assert.equal(decide({ ownerCapability: ownerOf(OTHER_EVENT_ID) }), false);
  // ...and symmetrically: right capability, page rendering another event.
  assert.equal(decide({ eventId: OTHER_EVENT_ID }), false);
});

test('capability + rsvp but a wrong/absent ?as= value → NO substitution', () => {
  for (const asParam of [undefined, '', 'yes', '1', 'true', 'attending', 'reply']) {
    assert.equal(decide({ asParam }), false, `expected denial for as=${String(asParam)}`);
  }
});

test('a repeated ?as= param (array) is never a match', () => {
  assert.equal(decide({ asParam: ['replied'] }), false);
  assert.equal(decide({ asParam: ['replied', 'replied'] }), false);
});

test('?as= matching is case-insensitive for the host', () => {
  assert.equal(decide({ asParam: 'REPLIED' }), true);
  assert.equal(decide({ asParam: 'Replied' }), true);
});

test('the exported param name/value are what the editor and route agree on', () => {
  assert.equal(SIMULATED_GUEST_PARAM, 'as');
  assert.equal(SIMULATED_GUEST_PARAM_VALUE, 'replied');
  assert.equal(decide({ asParam: SIMULATED_GUEST_PARAM_VALUE }), true);
});

// ── 2. The fabricated guest ─────────────────────────────────────────────────

test('simulated identity is the guest tier, replied "attending"', () => {
  const identity = buildSimulatedGuestIdentity({ slug: SLUG });
  assert.equal(identity.kind, 'guest');
  // The whole point of the tab: this is what puts the body tree on the
  // keepsake side of the RSVPed fork.
  assert.equal(identity.guest.rsvp_status, 'attending');
  assert.equal(identity.guestHubData.rsvpStatus, 'attending');
});

test('simulated identity carries exactly the guest keys, and no more', () => {
  // Same claim lib/anonymous-zero-guest.test.ts pins for the real path: going
  // through guestIdentity() means no extra key — and never an owner capability
  // — can ride along on the simulated object either.
  //
  // `rsvpFlash` joined the list on 2026-08-05: the guest's reply either landed
  // or it did not, and both outcomes used to render the same page with no
  // message. The simulated guest is a literal, so its value is null — there is
  // no real render outcome to report. The COUNT deliberately left the test name
  // when it did, because pinning a number in the title is how this assertion
  // gets "fixed" by editing the title instead of thinking about the key.
  const identity = buildSimulatedGuestIdentity({ slug: SLUG });
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
    'pabati',
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
  ].sort());
  for (const key of ['capability', 'ownerUserId', 'ownerEventId']) {
    assert.ok(!(key in identity), `owner key ${key} leaked onto the simulated identity`);
  }
});

test('the simulated guest is obviously a sample, not a borrowed person', () => {
  const identity = buildSimulatedGuestIdentity({ slug: SLUG });
  assert.equal(identity.guest.display_name, SIMULATED_GUEST_DISPLAY_NAME);
  assert.match(identity.guest.display_name ?? '', /sample/i);
  assert.match(identity.guestHubData.displayName, /sample/i);
  assert.match(identity.guestHubData.tableLabel ?? '', /sample/i);
  assert.match(identity.qrSvg, /SAMPLE/);
  assert.match(identity.invitationUrl, /sample/i);
});

test('no real-guest-derived value can appear on the simulated identity', () => {
  const identity = buildSimulatedGuestIdentity({ slug: SLUG });
  // The three fields a preview borrowing a real row would leak, per the PII
  // rationale in the module doc — all null, none fetched.
  assert.equal(identity.guest.meal_preference, null);
  assert.equal(identity.guest.dietary_restrictions, null);
  assert.equal(identity.guest.guest_note, null);
  assert.equal(identity.guestHubData.mealPreference, null);
  assert.equal(identity.guestHubData.dietaryRestrictions, null);
  // No photo of anybody.
  assert.equal(identity.guest.photo_url, null);
  assert.equal(identity.guest.photo_source, null);
  // No per-guest lookups were performed, so every lookup-backed field is empty.
  assert.equal(identity.guestLiveGallery, null);
  assert.equal(identity.seatMap, null);
  assert.equal(identity.papicGuest, null);
  assert.equal(identity.pabati, null);
  assert.equal(identity.saveFlash, null);
  assert.deepEqual(identity.eventVendorCredits, []);
  assert.deepEqual(identity.guest.custom_tags, []);
  assert.equal(identity.guestHubData.nextScheduleBlock, null);
  // Conservative face mode: no embedding for a guest who does not exist.
  assert.equal(identity.faceMode, 'mode_b');
});

test('the simulated guest carries no usable QR token or guest id', () => {
  const identity = buildSimulatedGuestIdentity({ slug: SLUG });
  // Empty rather than invented: a token that LOOKED real could be scanned.
  assert.equal(identity.guest.qr_token, '');
  assert.equal(identity.guest.guest_id, SIMULATED_GUEST_ID);
  // Not an S89G- public id and not a UUID — it can match no row that exists.
  assert.doesNotMatch(identity.guest.guest_id, /^S89/);
  assert.doesNotMatch(
    identity.guest.guest_id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );
});

test('slug is the ONLY caller input, and it is event data not guest data', () => {
  const a = buildSimulatedGuestIdentity({ slug: SLUG });
  const b = buildSimulatedGuestIdentity({ slug: 'someone-else' });
  assert.equal(a.guestHubData.slug, SLUG);
  assert.equal(b.guestHubData.slug, 'someone-else');
  // Nothing else moves with it — the guest is identical between the two.
  assert.deepEqual(a.guest, b.guest);
});

test('each call returns a fresh guest row (the shared constant is not handed out)', () => {
  const a = buildSimulatedGuestIdentity({ slug: SLUG });
  const b = buildSimulatedGuestIdentity({ slug: SLUG });
  assert.notEqual(a.guest, b.guest);
  assert.notEqual(a.guest.custom_tags, b.guest.custom_tags);
  a.guest.custom_tags.push('mutated');
  assert.deepEqual(b.guest.custom_tags, []);
});
