/**
 * SiteBody identity union (OPEN-BROWSE PR3 — council build plan §3 row 3).
 *
 * The unified body tree renders for two identity tiers; this module is the
 * privacy boundary between them. The rule the council named as a merge gate:
 * the ANONYMOUS tier must be structurally unable to carry guest-derived data
 * — not by discipline, by construction. Three layers enforce it:
 *
 *   1. Type level — `AnonymousSiteIdentity` declares exactly four fields,
 *      none guest-derived; the compile-time assertion at the bottom of this
 *      file fails `tsc` if a guest-only key ever appears on it.
 *   2. Runtime level — `anonymousIdentity()` builds the object by picking
 *      the allowed keys one by one, so even a poisoned input object (extra
 *      guest fields smuggled past TS's excess-property check via a cast)
 *      cannot flow through: the output object never has those keys.
 *   3. Test level — `lib/anonymous-zero-guest.test.ts` pins both of the
 *      above plus the widget firewall (PUBLIC_WIDGET_ALLOWLIST).
 *
 * The GUEST tier's fields mirror the old InvitationSite guest-specific props
 * verbatim; their values come from `loadGuestContext` (the only loader that
 * may select guest columns) plus three orchestrator-computed flags.
 *
 * Host tier note: hosts render the anonymous body (as they always have) —
 * what makes a host a host is the orchestrator-side `?phase=` preview
 * permission, not a body variant. See lib/site-body-plan.ts.
 *
 * OWNER LAYER (2026-07-26, owner-locked role-surface model): the event owner
 * opens `/[slug]` like anyone else and gets owner controls unlocked ON TOP of
 * whatever body their identity tier renders. That capability is modelled here
 * as `OwnerCapability` — see its doc block for why it is a SEPARATE, additive
 * field and not a third arm of `SiteIdentity`.
 */
import type {
  GuestRow,
  GuestPapicCamera,
  GuestPabatiQuota,
  GuestSeatMap,
} from './types';
import type { GuestLiveGallery } from '@/lib/guest-live-gallery';
import type { VendorCard } from '@/lib/vendor-cards';
import type { GuestHubData } from '../_components/guest-hub-card';
import type { PapicFaceMode } from '@/lib/papic-face-mode';
import { COMMITTED_BOOKING_STATUSES } from '@/lib/vendor-addon-first5-free';

/**
 * Why an anonymous visitor is seeing the public landing despite arriving
 * with (or after) some guest signal:
 *   - `invalid_invite` — their invite token / stale cookie no longer maps to
 *     a guest of this event (`?invite_error=invalid_token` on the URL, or
 *     `loadGuestContext` → `not_found` for a cookie-holder whose guest row
 *     was replaced). The stale-cookie messaging depends on this variant.
 *   - `wrong_event` — a valid guest cookie for a DIFFERENT event.
 *   - `null` — a plain visitor with no guest signal at all.
 */
export type AnonymousReason = 'invalid_invite' | 'wrong_event' | null;

export type AnonymousSiteIdentity = {
  kind: 'anonymous';
  reason: AnonymousReason;
  /** Couple's PAPIC_GUEST candid camera is open (live window) — drives the
   *  public event-day bar's center Camera action. */
  publicCandidCameraActive: boolean;
  /** Public album destination (Live Wall / recap), or null — drives the
   *  public event-day bar's Photos action. */
  publicAlbumHref: string | null;
};

export type GuestSiteIdentity = {
  kind: 'guest';
  guest: GuestRow;
  qrSvg: string;
  invitationUrl: string;
  /** This guest's tagged photos so far — live window only, clean-screened. */
  guestLiveGallery: GuestLiveGallery | null;
  /** Event owns CUSTOM_QR_GUEST → advertise the personalized seat pass link
   *  (seat-finding PR4). Additive; the find-my-table link is unaffected. */
  seatPassActive: boolean;
  /** True in the live window when the guest has no active face enrollment —
   *  drives the day-of "add your face" prompt so their photos auto-find them. */
  needsFaceEnroll: boolean;
  /** Pre-assembled data bundle for the persistent GuestHubCard. */
  guestHubData: GuestHubData;
  /** "Your seat" inline wayfinding map (free 2D seat plan), or null. */
  seatMap: GuestSeatMap | null;
  /** Inline Papic guest camera (PAPIC_GUEST) — non-null only when the event
   *  owns the active (admin-approved) pack and this guest isn't blocked. */
  papicGuest: GuestPapicCamera | null;
  /** Inline Pabati video-greeting recorder (PABATI) — non-null only when the
   *  event owns the active (admin-approved) pack. */
  pabati: GuestPabatiQuota | null;
  /** Invite/Join v2: show the accountless guest a "claim your account by
   *  email" prompt (never Save the Date). True only when there's no signed-in
   *  account for this viewer. */
  showClaimAccountCta: boolean;
  /** Invite/Join v2: the no-login photo grace has ended (>~24h after the
   *  wedding) for this accountless viewer. */
  accountlessPhotosClosed: boolean;
  /** Invite/Join v2: the couple's booked marketplace vendors ("vendors who
   *  made this day"), each savable to the guest's own account. */
  eventVendorCredits: VendorCard[];
  /** Invite/Join v2: flash after a guest saves a vendor. */
  saveFlash: string | null;
  /** The guest's reply either landed or it did not — and until 2026-08-05 both
   *  outcomes rendered the same page with no message at all, so a failed write
   *  was indistinguishable from never having tapped Save. */
  rsvpFlash: { tone: 'ok' | 'error'; text: string } | null;
  /** Server-resolved effective face-tag mode (One-Pool spec §3.4) for the
   *  RSVP selfie + day-of enroll surfaces. mode_b ⇒ no descriptor computed. */
  faceMode: PapicFaceMode;
  /**
   * This person's OWN saved meal + dietary answers, from their Setnayan account
   * (owner 2026-08-21). Offered as the reply card's DEFAULT when they have not
   * answered for THIS event — never as an override of what they already said
   * here. Null for a cookie-only guest with no account.
   */
  profileDetails: {
    mealPreference: string | null;
    dietaryRestrictions: string | null;
    email: string | null;
    phone: string | null;
    displayName: string | null;
  } | null;
};

export type SiteIdentity = AnonymousSiteIdentity | GuestSiteIdentity;

/**
 * The owner layer's server-verified grant.
 *
 * SHAPE CHOICE — a separate additive value, NOT a third `SiteIdentity` arm.
 * Three reasons, in the order they mattered:
 *
 *   1. Owner-ness is ORTHOGONAL to identity tier, not a replacement for it.
 *      A host can open their own site with a guest cookie (they RSVP'd) or
 *      without one; the body they render is still the guest / anonymous body.
 *      The role-surface model is "the guest site WITH an owner layer on top",
 *      so the owner layer is a second axis, not a third value on the first.
 *   2. Blast radius. A third arm would force every `identity.kind` switch and
 *      every `SiteIdentityKind` consumer (lib/site-body-plan.ts, its two
 *      golden-test suites, both SiteBody trees) to grow a branch — in a PR
 *      whose whole point is to be inert.
 *   3. The firewall gets STRONGER, not weaker. Because the capability lives
 *      off the union, "the anonymous tier can never carry owner capability"
 *      and "the guest tier can never carry owner capability" are both
 *      provable — as a key-disjointness assertion below (compile time) and as
 *      key-pick assertions in lib/anonymous-zero-guest.test.ts (runtime). Had
 *      it been a union arm, the honest statement would only have been "the
 *      other arms happen not to set it".
 *
 * A capability is bound to ONE event and ONE auth user: it is never portable.
 * It is produced ONLY by `resolveOwnerCapability` below, which requires a real
 * `event_members` / `event_moderators` row. There is no client input on this
 * path — the UI is not the boundary, the DB is (2026-07-26 security review).
 */
export type OwnerCapability = {
  /** Literal discriminant, so a capability object can never be mistaken for
   *  an identity arm (whose discriminant key is `kind`). */
  capability: 'owner';
  /** The auth user whose host membership the server verified. */
  ownerUserId: string;
  /** The event that membership was verified AGAINST. A capability resolved
   *  for event A must never be honoured on event B. */
  ownerEventId: string;
};

/**
 * The vendor layer's server-verified grant.
 *
 * SAME SHAPE CHOICE AS `OwnerCapability`, for the same three reasons — and one
 * more that is specific to vendors:
 *
 *   4. A person can hold TWO roles at one event. The owner already ruled it
 *      (2026-08-01, "there is a stylist and an emcee both in 1 service"), and
 *      `familiesForServices()` already returns a Set. A `kind: 'vendor'` arm on
 *      the identity union could not express a guest who is ALSO the booked
 *      florist — the discriminant admits one answer. A capability composes; an
 *      arm replaces. That alone rules out the union.
 *
 * ⚠ It is also why `site-body.tsx:1524` must stay a two-arm ternary: a third
 * arm would fall into the guest branch rather than fail to compile.
 *
 * Bound to ONE event and ONE auth user, produced ONLY by
 * `resolveVendorCapability` below. No client input reaches this path.
 */
export type VendorCapability = {
  /** Literal discriminant — never `kind`, so it cannot be mistaken for an
   *  identity arm. */
  capability: 'vendor';
  /** The auth user whose booking the server verified. */
  vendorUserId: string;
  /** The event that booking was verified AGAINST. A capability resolved for
   *  event A must never be honoured on event B. */
  vendorEventId: string;
  /** The vendor profile that is booked here — used to build the link into
   *  their own workspace for THIS event. */
  vendorProfileId: string;
  /** Their trading name, for the strip's copy. */
  businessName: string;
};

/** Every key of `VendorCapability` — the forbidden set for both identity tiers.
 *  Exported so the firewall test asserts against the real key list. */
export const VENDOR_CAPABILITY_KEYS = [
  'capability',
  'vendorUserId',
  'vendorEventId',
  'vendorProfileId',
  'businessName',
] as const satisfies readonly (keyof VendorCapability)[];

/**
 * Booked-vendor probe, injected — same reason as `HostMembershipCheck`:
 * loaders.ts pulls `server-only` transitively and would make this module
 * unloadable outside a Next server runtime.
 *
 * Returns the booked vendor profile for this user on this event, or null.
 */
export type VendorBookingCheck = (
  userId: string,
) => Promise<{
  vendorProfileId: string;
  businessName: string;
  /** `event_vendors.status` of the row that linked them — see
   *  `vendorBookingIsCommitted` for why the status has to travel. */
  bookingStatus: string | null;
} | null>;

/**
 * Is this link a REAL BOOKING, or merely a listing?
 *
 * Two different questions get answered off one column, and conflating them is
 * the whole reason this predicate exists:
 *
 *   - "which of this person's businesses is on this event?" — `linked_…_id`;
 *   - "has the couple actually booked them?" — `status`.
 *
 * `lib/reusable-bookings.server.ts` mints a linked row at **'shortlisted'** for
 * a reuse-accept the couple has still to lock, so a link alone does not mean a
 * decision was made. Anything that DISCLOSES the couple's celebration must ask
 * this question, never the link.
 *
 * The status set is imported, never re-typed: `COMMITTED_BOOKING_STATUSES` is
 * pinned by a drift test to the booking-fee RPC's own list, so "booked enough
 * to read the page" cannot quietly drift away from "booked enough to be
 * charged for".
 */
export function vendorBookingIsCommitted(bookingStatus: string | null): boolean {
  if (!bookingStatus) return false;
  return (COMMITTED_BOOKING_STATUSES as readonly string[]).includes(bookingStatus);
}

/**
 * THE vendor gate. Returns a capability ONLY for an auth user the database
 * confirms is booked on THIS event.
 *
 * Denies, in order:
 *   - no signed-in account (a guest cookie is not an account);
 *   - signed in, but not booked here.
 *
 * Nothing about the request can shortcut the booking read.
 */
export async function resolveVendorCapability(input: {
  eventId: string;
  viewerUserId: string | null;
  checkVendorBooking: VendorBookingCheck;
}): Promise<VendorCapability | null> {
  if (!input.viewerUserId) return null;
  const booked = await input.checkVendorBooking(input.viewerUserId);
  if (!booked) return null;
  return {
    capability: 'vendor',
    vendorUserId: input.viewerUserId,
    vendorEventId: input.eventId,
    vendorProfileId: booked.vendorProfileId,
    businessName: booked.businessName,
  };
}

/**
 * IS THIS VIEWER A VERIFIED HOST OF *THIS* EVENT?
 *
 * The ONE derivation of that question, because it was being answered in two
 * places from the same two facts: `buildOwnerRibbon` (lib/owner-ribbon.ts) and
 * the host body copy in `_components/site-body.tsx`. Two implementations of one
 * rule is how a later edit tightens the ribbon and leaves the body speaking to
 * a host it no longer recognises — or worse, the reverse.
 *
 * 🔒 THE EVENT CHECK IS NOT OPTIONAL AND IS NOT A FORMALITY. A capability is
 * resolved against ONE event; honouring it on another would let somebody who
 * hosts event A be addressed as the host of event B. `resolveOwnerCapability`
 * already refuses to mint one without a database-confirmed membership, so this
 * is the second half of the same guarantee: minted for A, spendable only on A.
 *
 * ⚠ NOT derived from `buildOwnerRibbon(...) !== null` — that also returns null
 * for the unrelated reason of a missing slug, so a host of a slugless event
 * would silently lose the body variant along with the ribbon.
 */
export function viewerIsEventHost(
  ownerCapability: OwnerCapability | null,
  eventId: string,
): boolean {
  if (!ownerCapability) return false;
  return ownerCapability.ownerEventId === eventId;
}

/** Every key of `OwnerCapability` — the forbidden set for both identity tiers.
 *  Exported so the firewall test asserts against the real key list rather than
 *  a hand-copied one that could drift. */
export const OWNER_CAPABILITY_KEYS = [
  'capability',
  'ownerUserId',
  'ownerEventId',
] as const satisfies readonly (keyof OwnerCapability)[];

/**
 * Host-membership probe, injected. The real implementation is
 * `loadHostMembership` (_lib/loaders.ts) — the SAME React.cache'd
 * `event_members` + `event_moderators` query pair that already gates the
 * private-event view, the `?phase=` preview and `?editor=1`. It is passed in
 * rather than imported because loaders.ts pulls `server-only` transitively,
 * which would make this module (and the firewall suite that imports it)
 * unloadable outside a Next server runtime.
 */
export type HostMembershipCheck = (userId: string) => Promise<boolean>;

/**
 * THE owner gate. Returns a capability ONLY for an auth user whose host
 * membership of THIS event the database confirmed.
 *
 * Denies, in order:
 *   - no signed-in account (plain visitor, or a guest holding only the
 *     guest-session cookie — a guest cookie is not an account and can never
 *     stand in for one);
 *   - signed in, but not a member/moderator of this event.
 *
 * Nothing about the request — no query param, no header, no cookie, no prop —
 * can shortcut the membership read.
 */
export async function resolveOwnerCapability(input: {
  eventId: string;
  /** The viewer's Supabase auth user id, or null when there is no account
   *  session. Read by the orchestrator from the cookie-scoped client; auth
   *  reads never happen inside cached loaders. */
  viewerUserId: string | null;
  checkHostMembership: HostMembershipCheck;
}): Promise<OwnerCapability | null> {
  if (!input.viewerUserId) return null;
  const isHost = await input.checkHostMembership(input.viewerUserId);
  if (!isHost) return null;
  return {
    capability: 'owner',
    ownerUserId: input.viewerUserId,
    ownerEventId: input.eventId,
  };
}

/**
 * Build the anonymous identity by explicit key-pick — the runtime half of the
 * zero-guest-bytes firewall. Whatever object a caller hands in, the value the
 * anonymous branch receives has exactly these four keys.
 */
export function anonymousIdentity(input: {
  reason: AnonymousReason;
  publicCandidCameraActive: boolean;
  publicAlbumHref: string | null;
}): AnonymousSiteIdentity {
  return {
    kind: 'anonymous',
    reason: input.reason,
    publicCandidCameraActive: input.publicCandidCameraActive,
    publicAlbumHref: input.publicAlbumHref,
  };
}

/**
 * Build the guest identity by explicit key-pick — the same runtime firewall
 * the anonymous tier has had, now mirrored on the guest tier so the owner
 * layer cannot ride in on a guest object either. The orchestrator used to
 * spread an inline literal here; the field list and values are unchanged.
 */
/**
 * `profileDetails` is OPTIONAL at the input and REQUIRED on the result: every
 * consumer can read it without a null-check, while the callers that have no
 * account to read from (the simulated `?as=replied` preview) need not invent
 * one. Absent ⇒ null ⇒ the card behaves exactly as it did before this existed.
 */
export function guestIdentity(
  input: Omit<GuestSiteIdentity, 'kind' | 'profileDetails'> &
    Partial<Pick<GuestSiteIdentity, 'profileDetails'>>,
): GuestSiteIdentity {
  return {
    kind: 'guest',
    guest: input.guest,
    qrSvg: input.qrSvg,
    invitationUrl: input.invitationUrl,
    guestLiveGallery: input.guestLiveGallery,
    seatPassActive: input.seatPassActive,
    needsFaceEnroll: input.needsFaceEnroll,
    guestHubData: input.guestHubData,
    seatMap: input.seatMap,
    papicGuest: input.papicGuest,
    pabati: input.pabati,
    showClaimAccountCta: input.showClaimAccountCta,
    accountlessPhotosClosed: input.accountlessPhotosClosed,
    eventVendorCredits: input.eventVendorCredits,
    saveFlash: input.saveFlash,
    rsvpFlash: input.rsvpFlash,
    faceMode: input.faceMode,
    profileDetails: input.profileDetails ?? null,
  };
}

// --- Compile-time proof: the anonymous identity can never carry a
// --- guest-derived field. If a guest-only key is ever added to
// --- AnonymousSiteIdentity, `Leak` stops being `never` and this line
// --- fails typecheck.
type GuestOnlyKeys = Exclude<keyof GuestSiteIdentity, 'kind'>;
type Leak = Extract<keyof AnonymousSiteIdentity, GuestOnlyKeys>;
const _anonymousNeverCarriesGuestFields: Leak extends never ? true : false =
  true;
void _anonymousNeverCarriesGuestFields;

// --- Compile-time proof: NEITHER identity tier can carry the owner
// --- capability. The capability travels beside the identity, never on it, so
// --- "unlocked owner controls" can never be smuggled into the body tree by a
// --- field on a visitor's identity object. If an owner key is ever added to
// --- either arm, `OwnerLeak` stops being `never` and this line fails `tsc`.
type OwnerLeak = Extract<
  keyof AnonymousSiteIdentity | keyof GuestSiteIdentity,
  keyof OwnerCapability
>;
const _identityNeverCarriesOwnerCapability: OwnerLeak extends never
  ? true
  : false = true;
void _identityNeverCarriesOwnerCapability;

// --- The same proof for the vendor capability. A booked supplier's grant must
// --- never ride on a visitor's identity object either: the strip that links
// --- into their own workspace is unlocked by the DB, not by a field someone
// --- could smuggle through the tree.
type VendorLeak = Extract<
  keyof AnonymousSiteIdentity | keyof GuestSiteIdentity,
  keyof VendorCapability
>;
const _identityNeverCarriesVendorCapability: VendorLeak extends never
  ? true
  : false = true;
void _identityNeverCarriesVendorCapability;
