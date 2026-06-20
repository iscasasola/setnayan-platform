/**
 * vendor-experience.ts — public, framework-free helper for the vendor
 * "experience tier" badge.
 *
 * Single source of truth for the finalized-booking → tier mapping defined in
 * `Vendor_Quality_Rating_System_2026-06-17.md` §5. Shared by both public
 * surfaces that render the badge:
 *   - the public vendor profile  (`app/v/[slug]/page.tsx`)
 *   - the explore/search card    (`app/explore/_components/vendor-card.tsx`)
 *
 * Pure + dependency-free (no `server-only`, no React) so it can be imported
 * from any server component, client component, or unit test.
 *
 * Spec §5 ladder (Setnayan-only finalized bookings — work that flowed through
 * the platform and completed):
 *
 *   | Tier            | Finalized bookings |
 *   |-----------------|--------------------|
 *   | New to Setnayan | 0                  |
 *   | Established     | 1–10               |
 *   | Experienced     | 11–50              |
 *   | Expert          | 51–200             |
 *   | Elite           | 200+               |
 *
 * "New to Setnayan" is explicitly NOT a negative — many excellent vendors are
 * new to the platform. Surfaces may choose to suppress the New tier on dense
 * cards (`isNew` is exposed for exactly that decision) but should keep it on
 * the profile so the count is honest.
 */

export type ExperienceTierKey = 'new' | 'established' | 'experienced' | 'expert' | 'elite';

export type ExperienceTier = {
  key: ExperienceTierKey;
  /** Short label for dense surfaces (cards). */
  label: string;
  /** Fuller label for the profile hero ("New to Setnayan"). */
  longLabel: string;
  /** True only for the 0-booking tier — lets dense surfaces suppress it. */
  isNew: boolean;
};

/**
 * Map a finalized-booking count to its experience tier (spec §5).
 *
 * Accepts `null`/`undefined`/negative as 0 (no scored row yet) → New tier.
 * Always returns a tier — callers decide whether to render `New` or hide it.
 */
export function experienceTier(finalizedBookingCount: number | null | undefined): ExperienceTier {
  const n = typeof finalizedBookingCount === 'number' && finalizedBookingCount > 0
    ? Math.floor(finalizedBookingCount)
    : 0;

  if (n >= 200) return { key: 'elite', label: 'Elite', longLabel: 'Elite', isNew: false };
  if (n >= 51) return { key: 'expert', label: 'Expert', longLabel: 'Expert', isNew: false };
  if (n >= 11) return { key: 'experienced', label: 'Experienced', longLabel: 'Experienced', isNew: false };
  if (n >= 1) return { key: 'established', label: 'Established', longLabel: 'Established', isNew: false };
  return { key: 'new', label: 'New', longLabel: 'New to Setnayan', isNew: true };
}
