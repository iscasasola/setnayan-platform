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
