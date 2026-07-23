## 2026-07-23 · feat(suite): search box + service tags + refreshed descriptions

Makes the Suite (`/dashboard/[eventId]/suite`) easier to shop.

- **Search box** — a new `SuiteSearch` client shell wraps the browse view. Empty query → the normal Recommended / Yours / Add / Free sections; typing (or tapping a tag chip) → a flat, deduped list of matching service rows with their live pill + tags. Matching is case-insensitive AND across space-separated terms over label + blurb + tags. It reuses the server-rendered `StudioAppRow` nodes (same pattern the Suite already uses for `RevealList`), so live prices + ownership pills come through unchanged — the client only decides which to show.
- **Quick-filter tag chips** — the most common tags render as tappable chips under the search box; tapping one filters to it (tap again to clear).
- **Tags on every service** — a new `AddOnEntry.tags` field (+ tags on the Suite's free-planner tools). A shared `ServiceTags` chip component renders them under the blurb on both the `StudioAppRow` rows and the `SuiteVignetteCard` sellable cards. A new merge-blocking guardrail (`suite-doorway-guardrails.test.ts`, now 15 tests) fails if any catalog service ships untagged or with a tag longer than two words.
- **Refreshed descriptions** — every service's blurb was rewritten to match what's actually live now, notably: Setnayan AI reframed from "the shortlist" to the match/remind/guard planning office (+ CTA "Open your planner"); Save-the-Date (free film · reveal via Website PRO); Website PRO (the umbrella); Monogram Maker / Monogram PRO (free maker · PRO adds animation + LED); LED Background and Live Background (included with Monogram PRO); Panood (free single camera); Photo Delivery (via Papic).

Suite-only — the live `/studio` hub redirects to `/suite` and is otherwise untouched.

Verified: `tsc --noEmit` clean · `next lint` clean · **all 2770 unit tests pass** + the 15 Suite doorway/tags guardrails. (Visual review on the Vercel preview, since the surface is auth-gated.)

SPEC IMPACT: None — additive UI + refreshed on-card copy; no pricing/SKU/schema change (blurbs are display copy; the canonical prices live in `platform_retail_catalog_v2` and are unchanged).
