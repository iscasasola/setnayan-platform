/**
 * Vendor public-visibility state machine — Decision 6 (2026-05-15).
 *
 * Each vendor profile carries a `public_visibility` ENUM controlling how the
 * marketplace surfaces it. See:
 *   • 0022_vendor_dashboard § 2.1c
 *   • 0006_vendors_management § DIY-mode filter popup
 *   • CLAUDE.md decision log 2026-05-15
 *
 * The legacy `is_published` column is preserved (coexists for now) but the
 * new column is authoritative for marketplace + profile read paths.
 */

export type VendorPublicVisibility =
  | 'hidden'
  | 'coming_soon'
  | 'verified'
  | 'archived';

export const VENDOR_PUBLIC_VISIBILITIES: ReadonlyArray<VendorPublicVisibility> = [
  'hidden',
  'coming_soon',
  'verified',
  'archived',
];

export const VENDOR_PUBLIC_VISIBILITY_LABEL: Record<VendorPublicVisibility, string> = {
  hidden: 'Hidden',
  // RETIRED 2026-07-27. Kept only so historical rows and audit-log entries
  // still render a label instead of a raw enum token. Nothing writes it.
  coming_soon: 'Coming soon (retired)',
  verified: 'Verified',
  archived: 'Archived',
};

/**
 * Visibilities an admin may SET. `coming_soon` is deliberately absent — it is
 * retired, and offering it would let the console recreate the state the
 * 2026-07-27 ruling removed.
 */
export const ASSIGNABLE_VISIBILITIES: ReadonlyArray<VendorPublicVisibility> = [
  'hidden',
  'verified',
  'archived',
];

/**
 * The ONLY visibility that surfaces publicly (marketplace browse, /v/[slug]).
 *
 * 🔒 OWNER RULING 2026-07-27 — "we only show shops that are ready", then
 * "demote. remove coming soon entirely." This SUPERSEDES Decision 6's
 * listed-but-not-bookable intent: `coming_soon` is no longer a public state,
 * and `hidden` is the resting state for anything not approved.
 *
 * ⚠ Adding a value back here is a PRIVACY change, not a display tweak. Until
 * 2026-07-27 this array also contained 'coming_soon', and the RLS policy
 * `vendor_profiles_public_read` mirrored it — so an unapproved vendor's
 * business name, contact email and phone were readable by anyone holding the
 * anon key (confirmed against prod that day). Migration
 * 20271013500000 narrowed the policy to verified-AND-verified; this array must
 * not drift back open. `vendor-visibility.test.ts` fails if it does.
 */
export const PUBLIC_SURFACE_VISIBILITIES: ReadonlyArray<VendorPublicVisibility> = [
  'verified',
];

/**
 * The state an unapproved, demoted, rejected or un-frozen shop rests in.
 * Everything that used to demote to `coming_soon` now demotes to this.
 */
export const DEFAULT_PRIVATE_VISIBILITY: VendorPublicVisibility = 'hidden';

/**
 * Whether a vendor in this state can take bookings.
 *
 * Now co-extensive with `isPubliclyVisible` — a shop is either ready (listed
 * AND bookable) or private. The gap between the two existed only to serve
 * `coming_soon`, which is retired.
 */
export function isBookable(visibility: VendorPublicVisibility | null | undefined): boolean {
  return visibility === 'verified';
}

/**
 * Whether a vendor row should render on the public profile page (/v/[slug]).
 * Everything except `verified` returns 404.
 */
export function isPubliclyVisible(
  visibility: VendorPublicVisibility | null | undefined,
): boolean {
  if (!visibility) return false;
  return PUBLIC_SURFACE_VISIBILITIES.includes(visibility);
}

/**
 * Narrow an unknown value (e.g. from a DB row) to a valid visibility.
 *
 * Falls back to `hidden` — FAIL CLOSED. The old fallback was 'coming_soon',
 * which under the pre-2026-07-27 rules was publicly readable, so a null,
 * malformed or unrecognised value silently produced a PUBLIC vendor. An
 * unreadable state must never resolve to an exposed one.
 */
export function parseVisibility(value: unknown): VendorPublicVisibility {
  if (typeof value !== 'string') return DEFAULT_PRIVATE_VISIBILITY;
  if ((VENDOR_PUBLIC_VISIBILITIES as readonly string[]).includes(value)) {
    return value as VendorPublicVisibility;
  }
  return DEFAULT_PRIVATE_VISIBILITY;
}

/**
 * ─── THE ONE DEFINITION OF "THIS SHOP IS LIVE" ──────────────────────────────
 *
 * Mirrors the database's own rule EXACTLY. `vendor_profiles_public_read`
 * (20271013500000) reads:
 *
 *     public_visibility = 'verified' AND verification_state = 'verified'
 *
 * Both columns, deliberately: `public_visibility` is the marketplace/moderation
 * state and `verification_state` is the readiness decision, so no single
 * mis-set column can expose an unapproved shop. `/admin/verify` writes the two
 * together and is the only path that should.
 *
 * ─── WHY THIS FUNCTION EXISTS ───────────────────────────────────────────────
 * Because there was a SECOND definition, and it was dead. `is_published` is a
 * legacy column this module's own docblock has described as superseded since
 * 2026-05-15 — but seven live code paths were still gating on it, and NOTHING
 * in the approval flow ever sets it. Its only writer is a tick-box on
 * `/admin/vendors/[id]/edit`; `/admin/verify` never touches it. Measured
 * 2026-08-11: the owner's own fully-verified shop sits at is_published = false.
 *
 * So approving a shop listed it on /explore and left these seven dead:
 *   • the vendor's invite landing page — 404 for EVERY vendor
 *   • the invite's claim action — the same refusal one step later
 *   • the couple's add-a-vendor-by-name search — found nothing, ever
 *   • ghost-listing detection — scanned an empty set and returned "0 scanned"
 *   • fraud detection — the same empty set
 *   • the admin population count — "vendors published" was permanently 0
 *   • the admin Published/Draft tabs — Published always empty
 *
 * 🔑 THE FAILURE SHAPE: none of the seven errored. A dead gate and a genuinely
 * empty result are the same value. This is the same disease as the phantom
 * column, the phantom enum value and the phantom RPC argument — the query is
 * REFUSED or returns nothing, and the only symptom is an absence.
 *
 * 🔑 AND IT IS THE 2026-08-09 OUTAGE AGAIN: two definitions of "is a vendor"
 * pointed the dashboards at each other. Two definitions of "this shop is live"
 * pointed a vendor's own customers at a 404.
 *
 * ⚠ DERIVE, NEVER RE-TYPE. If you find yourself writing `is_published` or
 * spelling out both columns at a call site, use this instead —
 * `lib/one-definition-of-live.test.ts` fails on either shape.
 */
export function isShopLive(row: {
  public_visibility?: unknown;
  verification_state?: unknown;
} | null | undefined): boolean {
  if (!row) return false;
  // Fail closed on both halves: parseVisibility resolves anything unreadable to
  // `hidden`, and the state half is an explicit equality rather than a parse, so
  // a null/absent/misspelled state can never read as verified.
  return (
    parseVisibility(row.public_visibility) === 'verified' &&
    row.verification_state === 'verified'
  );
}

/**
 * The columns `isShopLive` needs, for a PostgREST `.select()`.
 *
 * A select that omits one of these makes the predicate silently fail closed —
 * an absent column is `undefined`, which is not 'verified'. Naming the pair
 * once is what stops a call site selecting only half of it.
 */
export const SHOP_LIVE_COLUMNS = 'public_visibility, verification_state' as const;
