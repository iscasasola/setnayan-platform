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
 *   PUBLIC  — anyone may open it when ALL of:
 *               1. `public_visibility = 'verified'`  (listed by Setnayan — `/admin/verify` writes it), AND
 *               2. `verification_state = 'verified'` (documents approved), AND
 *               3. `is_demo` is not true             (a demo shop never reads as a real supplier).
 *             An admin with demo mode on skips 2 and 3 (unchanged — that is how demo inventory is dogfooded).
 *             This is `isShopLive` (lib/vendor-visibility.ts) plus the demo half, the same three filters the vendor
 *             sitemap applies — so "the page opens for a stranger" and "the sitemap lists it" cannot disagree.
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

export type ShopPageGateRow = {
  public_visibility?: unknown;
  verification_state?: unknown;
  is_demo?: unknown;
};

/** What couples are waiting on — the banner's "Couples will see it once …". */
export type ShopPreviewReason =
  /** `is_demo = true` — a demo shop; only Setnayan can make it a real one. */
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
  viewer: { isTeam: boolean; adminDemoMode: boolean },
): ShopPageGate {
  const visibility = parseVisibility(row.public_visibility);
  if (visibility === 'archived') return { open: 'nobody' };

  const demo = row.is_demo === true;
  const documentsApproved = row.verification_state === 'verified';

  // Derived, never re-typed: the live half IS `isShopLive`. Demo mode (an admin) needs only the listing.
  if (viewer.adminDemoMode ? visibility === 'verified' : isShopLive(row) && !demo) {
    return { open: 'public' };
  }
  if (!viewer.isTeam) return { open: 'nobody' };

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
    line: 'Couples will see it once Setnayan makes it a real shop — today it is a demo shop.',
    action: { label: 'Open your shop', href: '/vendor-dashboard/shop' },
  },
};
