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
  /** Server-resolved effective face-tag mode (One-Pool spec §3.4) for the
   *  RSVP selfie + day-of enroll surfaces. mode_b ⇒ no descriptor computed. */
  faceMode: PapicFaceMode;
};

export type SiteIdentity = AnonymousSiteIdentity | GuestSiteIdentity;

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

// --- Compile-time proof: the anonymous identity can never carry a
// --- guest-derived field. If a guest-only key is ever added to
// --- AnonymousSiteIdentity, `Leak` stops being `never` and this line
// --- fails typecheck.
type GuestOnlyKeys = Exclude<keyof GuestSiteIdentity, 'kind'>;
type Leak = Extract<keyof AnonymousSiteIdentity, GuestOnlyKeys>;
const _anonymousNeverCarriesGuestFields: Leak extends never ? true : false =
  true;
void _anonymousNeverCarriesGuestFields;
