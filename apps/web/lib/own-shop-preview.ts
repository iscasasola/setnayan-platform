/**
 * WHO MAY OPEN A SHOP'S PAGE — `setnayan.com/{business_slug}` (and the legacy `/v/{slug}`).
 *
 * Owner, 23 Oct 2026: *"why can't i see setnaprod's website?"* — he opened his own shop's address and got the
 * not-found page. Until this module the owner carve-out in `renderVendorBySlug` sat BELOW two earlier 404s, so it
 * only ever helped a shop whose `public_visibility` was already `verified` and that was not a demo shop: a shop
 * resting `hidden` (every shop not yet approved — owner ruling 2026-07-27) and a shop marked `is_demo` (SetnaProd and
 * Saysay, owner ruling 2026-09-29 "LANE 2 §2C" (1)) 404'd for their own owner. Helpers were never let in at all.
 *
 * ─── THE RULE (pure — {@link shopPageGate}) ───────────────────────────────────────────────────────────────────────
 *   PUBLIC  — anyone may open it when BOTH of:
 *               1. `public_visibility = 'verified'`  (listed by Setnayan — `/admin/verify` writes it), AND
 *               2. `verification_state = 'verified'` (documents approved).
 *             That is `isShopLive` (lib/vendor-visibility.ts), exactly. An admin with demo mode on skips 2 (unchanged —
 *             that is how unverified demo inventory is dogfooded).
 *             🧪 A DEMO SHOP (`is_demo`) IS PUBLIC TOO, since 2026-11-06 (owner, DECISION_LOG "DEMO SHOPS + DEMO
 *             EVENTS": demo suppliers *"will show on with the rest of suppliers … but has a marking of (DEMO ONLY)"*).
 *             This supersedes the 2026-09-29 third half ("`is_demo` is not true"). The page wears `DemoOnlyMarker`
 *             and is `noindex`; the vendor sitemap still leaves demo shops out (never index a demo), so "the page
 *             opens for a stranger" and "the sitemap lists it" now differ by exactly the demo shops, on purpose.
 *   PUBLIC  — ALSO (DECISION_LOG 2026-11-07, ruling 3) a shop Setnayan has NOT DECIDED yet (`unverified` ·
 *             `pending_review`), locked out of Find or not, when it is not archived, not fraud-frozen and not a
 *             demo shop — `ownLinkOpensUnverified` (lib/findable-shop.ts). The page then says "This shop is not
 *             yet verified by Setnayan". Rejected and demoted shops stay TEAM-only.
 *   TEAM    — otherwise, the shop's OWNER (`vendor_profiles.user_id`) and its HELPERS (a `vendor_team_members` seat)
 *             see the page with a banner saying who can see it and what couples are waiting on ({@link ShopPreviewReason}).
 *   NOBODY  — everybody else gets the not-found page, which never says whether a shop exists. An `archived` (closed)
 *             shop is NOBODY for everyone, the team included: it is not a page "before it is public", it is a page
 *             that was taken down.
 *
 * Held by `lib/own-shop-preview.test.ts` (this rule, every corner) and `app/v/[slug]/the-team-sees-its-own-page.test.ts`
 * (the renderer asks this and nothing else, the banner is drawn for TEAM only, a preview is never counted as a visit).
 */
import { isShopLive, parseVisibility } from '@/lib/vendor-visibility';
import { ownLinkOpensUnverified, type FindableInput } from '@/lib/findable-shop';

export type ShopPageGateRow = FindableInput & {
  public_visibility?: unknown;
  verification_state?: unknown;
  is_demo?: unknown;
  /** 🏪 The shop chose to show its page before it is verified (`setShopPublished`, owner 2026-11-02). */
  self_published_at?: unknown;
};

/**
 * 🏪 A SHOP SHOWS ITS PAGE BEFORE IT IS VERIFIED — WHILE BOOKINGS ARE CLOSED (owner 2026-11-02: "we offer them space to
 * create their website … and apply for verified account"; controller: "the website can go live; verified stays a
 * badge"). True when the shop pressed Show my page (`self_published_at`), is not archived and not a demo shop, and
 * bookings are closed (`platform_settings.bookings_open`, `lib/bookings-open.ts`) — so nothing on the page can be
 * booked. The page only: the marketplace, search and every database door stay verified-only (migration
 * 20271303245624). When bookings open, such a page goes back to its team until Setnayan verifies the shop.
 */
export function selfPublishedLive(row: ShopPageGateRow, bookingsOpen: boolean): boolean {
  return (
    !bookingsOpen &&
    typeof row.self_published_at === 'string' &&
    row.self_published_at.length > 0 &&
    parseVisibility(row.public_visibility) !== 'archived' &&
    row.is_demo !== true
  );
}

/** What couples are waiting on — the banner's "Couples will see it once …". */
export type ShopPreviewReason =
  /** `is_demo = true` and not live yet — a demo shop only Setnayan lists (and verifies). */
  | 'demo'
  /** Documents not sent, turned down, or the badge was lost (`unverified` · `rejected` · `demoted` · unreadable). */
  | 'documents'
  /** Documents are in and waiting for Setnayan (`pending_review`). */
  | 'in_review'
  /** Documents approved, but Setnayan has not listed the shop yet (`public_visibility` is not `verified`). */
  | 'listing';

export type ShopPageGate =
  | { open: 'public' }
  | { open: 'team'; reason: ShopPreviewReason }
  | { open: 'nobody' };

export function shopPageGate(
  row: ShopPageGateRow,
  viewer: {
    isTeam: boolean;
    adminDemoMode: boolean;
    /** 🚪 `areBookingsOpen()`. Omitted = open — today's rule exactly, so no caller changes unless it passes it. */
    bookingsOpen?: boolean;
  },
): ShopPageGate {
  const visibility = parseVisibility(row.public_visibility);
  if (visibility === 'archived') return { open: 'nobody' };

  const demo = row.is_demo === true;
  const documentsApproved = row.verification_state === 'verified';

  // Derived, never re-typed: the live half IS `isShopLive` — for a demo shop too (2026-11-06). Demo mode (an admin)
  // needs only the listing.
  if (viewer.adminDemoMode ? visibility === 'verified' : isShopLive(row)) {
    return { open: 'public' };
  }
  // 🔗 DECISION_LOG 2026-11-07 ruling (3): a shop Setnayan has not decided yet opens for anyone — found in a list
  // until its first inquiry, and by its own link and QR after it — with "This shop is not yet verified by Setnayan"
  // on the page. Never a demo shop (its own rule, above), never archived or fraud-frozen (`ownLinkOpensUnverified`).
  if (!demo && ownLinkOpensUnverified(row)) return { open: 'public' };
  if (selfPublishedLive(row, viewer.bookingsOpen ?? true)) return { open: 'public' };
  if (!viewer.isTeam) return { open: 'nobody' };

  // A demo shop that is not live yet waits on Setnayan listing it, like any shop — but its banner says it is a demo.
  if (demo) return { open: 'team', reason: 'demo' };
  if (row.verification_state === 'pending_review') return { open: 'team', reason: 'in_review' };
  if (!documentsApproved) return { open: 'team', reason: 'documents' };
  return { open: 'team', reason: 'listing' };
}

/** The banner's words and its one next step, per reason. Owner's own first line, 23 Oct 2026. */
export const TEAM_PREVIEW_HEAD = 'Only you and your team can see this.';

export const TEAM_PREVIEW_COPY: Record<ShopPreviewReason, { line: string; action: { label: string; href: string } }> = {
  documents: {
    line: 'Couples will see it once your documents are approved.',
    action: { label: 'Send your documents', href: '/vendor-dashboard/profile#docs' },
  },
  in_review: {
    line: 'Couples will see it once Setnayan finishes checking your documents.',
    action: { label: 'See your documents', href: '/vendor-dashboard/profile#docs' },
  },
  listing: {
    line: 'Couples will see it once Setnayan lists your shop.',
    action: { label: 'Open your shop', href: '/vendor-dashboard/shop' },
  },
  demo: {
    line: 'Couples will see it once Setnayan lists this demo shop — it will show marked (DEMO ONLY).',
    action: { label: 'Open your shop', href: '/vendor-dashboard/shop' },
  },
};
