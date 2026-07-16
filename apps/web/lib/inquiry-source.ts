/**
 * Inquiry-source taxonomy (Creator Economy PR-C · owner 2026-07-17 — "tell the
 * vendor what type of customer sent an inquiry").
 *
 * One `inquiry_source` value on chat_threads, stamped ONCE at inquiry creation
 * (CTA-click / last-touch — consistent with the chapter-attribution paper lock).
 * NULL = "Website Inquiry" (the default). `is_returning` is a COMPANION flag —
 * it combines with any origin, never overwrites it.
 *
 * The source is PRIVATE to the vendor (thread header chip · clients list ·
 * the "Inquiries by source" breakdown). It never renders on a public surface;
 * the only public derivative is the aggregate "inquiries driven" count.
 *
 * Wired in PR-C (trigger surface LIVE):
 *   influencer — the chapter Book CTA (/u/[slug]/c/[id] → /v?ref_chapter=…)
 *   editorial  — a /realstories editorial credit chip (→ /v?src=editorial)
 *   first_pick — the dashboard "Unlock more categories" best-fit inquiry
 *   auto_build — the onboarding "reach my best matches" fan-out (+ its
 *                held-picks flush)
 *   website    — the bare /v/[slug] composer (left NULL — the default)
 *
 * UNWIRED (enum value + label only — no trigger surface exists; no fake
 * stamping, per the owner's taxonomy note):
 *   shortlist  — no shortlist/saved-workspace surface creates inquiries today
 *                (Merkado/shortlist surfaces are read-only over thread status)
 *   favorites  — the saved-vendors/favorites lists never create inquiries
 *   degree     — "Degree Recommendation": the vendor was surfaced because
 *                someone within 5 degrees of the inquirer's connection tree has
 *                USED or FAVORITED the vendor; FRIENDS count as FIRST-DEGREE
 *                connections (the tree = the full People/connections graph,
 *                family + friends). Both signals are cross-person disclosures
 *                (booking = transaction data; favorite = preference data — see
 *                the standing guest_saved_vendors consent-gate finding), so the
 *                trigger stays People-layer + counsel-gated
 *                (NEXT_PUBLIC_DEPENDENT_PEOPLE). The surface must NEVER
 *                identify who used/favorited the vendor — copy says only
 *                "vendors used around your circle" (no names, no relationship
 *                labels, no degree number) — and wiring requires a
 *                minimum-circle / k-anonymity threshold (suppress the rec when
 *                the circle/signal count is small enough that the person is
 *                inferable).
 *
 * Client-safe: labels only, no server imports.
 */

export const INQUIRY_SOURCES = [
  'shortlist',
  'first_pick',
  'favorites',
  'influencer',
  'website',
  'editorial',
  'auto_build',
  'degree',
] as const;

export type InquirySource = (typeof INQUIRY_SOURCES)[number];

/** The owner's labels, verbatim. */
export const INQUIRY_SOURCE_LABEL: Record<InquirySource, string> = {
  shortlist: 'Shortlist Inquiry',
  first_pick: 'First Pick Recommendation',
  favorites: 'Favorites',
  influencer: 'Influencer Recommendation',
  website: 'Website Inquiry',
  editorial: 'Editorial Inquiry',
  auto_build: 'Auto Build Recommendation',
  degree: 'Degree Recommendation',
};

/** Companion chip label when chat_threads.is_returning is TRUE. */
export const RETURNING_CUSTOMER_LABEL = 'Returning Customer';

export function isInquirySource(v: unknown): v is InquirySource {
  return (
    typeof v === 'string' && (INQUIRY_SOURCES as readonly string[]).includes(v)
  );
}

/** Resolve a stored value (or NULL) to the vendor-facing chip label. */
export function inquirySourceLabel(source: string | null | undefined): string {
  return isInquirySource(source)
    ? INQUIRY_SOURCE_LABEL[source]
    : INQUIRY_SOURCE_LABEL.website;
}
