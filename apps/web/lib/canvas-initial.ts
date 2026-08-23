import type {
  BracketDraft,
  DiscountDraft,
  InclusionDraft,
} from '@/app/vendor-dashboard/services/_components/service-list-editors';

/**
 * WHAT THE MAKER OPENS WITH.
 *
 * A type, and nothing else — the canvas is a client component and its seed is
 * built on the server (lib/vendor-card-copy.ts), so the shape needs a home
 * neither of them owns.
 *
 * ── EVERY FIELD IS A STRING WHERE THE INPUT IS UNCONTROLLED ─────────────────
 * The maker's fields are `defaultValue`d, and an uncontrolled input's value IS
 * a string: `''` means "left blank", which is exactly what a fresh card posts.
 * Keeping the seed in the input's own currency means a copied blank and a fresh
 * blank are the same bytes on the wire — so `commitVendorService` cannot tell a
 * copy from a first draft, which is the whole point.
 *
 * The two nested objects (`pricing`, `included`) stay NUMERIC because the
 * editors that consume them already take numbers-or-null; converting them here
 * would be a second spelling of a shape those components own.
 */
export type CanvasInitial = {
  /** The card this one was started from. Carried for the on-screen note only. */
  sourceServiceId: string;
  sourceTitle: string | null;
  /** TRUE when the source card sat in a different category from this route's. */
  sourceWasOtherCategory: boolean;

  title: string;
  exclusivePerkText: string;
  coverageId: string;
  crewSize: string;
  recommendedLeadTimeMonths: string;
  lastMinuteEndMonths: string;
  lastMinuteSurchargePct: string;

  pricing: {
    pricing_basis: 'fixed' | 'per_pax' | 'per_hour';
    starting_price_php: number | null;
    base_pax: number | null;
    added_pax_price_php: number | null;
    per_pax_price_php: number | null;
    min_pax: number | null;
    hour_base_php: number | null;
    min_hours: number | null;
    extra_hour_php: number | null;
  };
  included: {
    crew_meal_included: boolean;
    transport_included: boolean;
    transport_flat_fee_php: number | null;
  };

  brackets: BracketDraft[];
  discounts: DiscountDraft[];
  inclusions: InclusionDraft[];
  /** The vendor's OTHER categories this card comes bundled with. */
  linkedCategories: string[];

  /**
   * MEDIA IS REFERENCED, NOT DUPLICATED — the copy names the SAME R2 objects.
   * `mediaDisplayUrls` maps each ref to a presigned URL, because a raw `r2://`
   * value in an <img> fails silently and shows a broken glyph.
   */
  coverPhotoR2Key: string | null;
  showcaseVideoR2Key: string | null;
  showcasePhotoR2Keys: string[];
  mediaDisplayUrls: Record<string, string>;
};
