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
  coming_soon: 'Coming soon',
  verified: 'Verified',
  archived: 'Archived',
};

/**
 * Visibilities that surface in the public marketplace (DIY browse, /v/[slug]).
 * `hidden` + `archived` are 404 in the public surface.
 */
export const PUBLIC_SURFACE_VISIBILITIES: ReadonlyArray<VendorPublicVisibility> = [
  'coming_soon',
  'verified',
];

/**
 * Whether a vendor in this state can take bookings. Coming-soon vendors
 * appear in the marketplace but the booking CTA is hidden — couples can
 * see the platform's growing pool but cannot book yet.
 */
export function isBookable(visibility: VendorPublicVisibility | null | undefined): boolean {
  return visibility === 'verified';
}

/**
 * Whether a vendor row should render on the public profile page (/v/[slug]).
 * `hidden` + `archived` return 404 to avoid leaking suspended/closed profiles.
 */
export function isPubliclyVisible(
  visibility: VendorPublicVisibility | null | undefined,
): boolean {
  if (!visibility) return false;
  return PUBLIC_SURFACE_VISIBILITIES.includes(visibility);
}

/**
 * Narrow an unknown value (e.g. from a DB row) to a valid visibility, or
 * fall back to 'coming_soon' if the value is missing/legacy.
 */
export function parseVisibility(value: unknown): VendorPublicVisibility {
  if (typeof value !== 'string') return 'coming_soon';
  if ((VENDOR_PUBLIC_VISIBILITIES as readonly string[]).includes(value)) {
    return value as VendorPublicVisibility;
  }
  return 'coming_soon';
}
