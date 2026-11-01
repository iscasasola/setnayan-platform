## 2026-10-30 · feat(inspiration): a supplier's inspiration photo is connected four ways — its card · the event · its page · the pool [migration]

Owner ruling 2026-10-30 (DECISION_LOG "A SUPPLIER'S INSPIRATION PHOTO IS CONNECTED FOUR WAYS — ITS SERVICE CARD · THE
EVENT · THE SUPPLIER'S WEBSITE · THE CATEGORY/SERVICE POOL" → "Yes").

- **Card.** Migration `20271297295494_inspiration_photo_links_its_card.sql`: nullable `vendor_service_id` on
  `moodboard_library_assets` and `event_inspiration_suggestions` (FK → vendor_services, ON DELETE SET NULL), held to
  the row's OWN shop by the trigger `inspiration_card_is_the_shops_own` (never raises on a NULL, so SET NULL stays SET
  NULL); SELECT granted to anon/authenticated on the library column, no write grant. RLS unchanged.
- **One dropdown** "Which of your services is this?" (`app/_components/inspiration-card-pick.tsx`, the shipped
  PickMenu) on the library upload, the "From events you worked" import and the Mood Board suggestion sheet — only the
  shop's live cards whose Service links that Part (`lib/inspiration-card-link.ts`: `vendor_services.category` ∈
  `canonicalServicesForSlot`), preselected when exactly one fits, "None of these — just my shop" otherwise. Every door
  re-checks it server-side (`verifyCardForPart`).
- **Event.** Imports keep `source_event_id`; a suggestion keeps `event_id`; a suggestion's pool copy carries
  `source_event_id` = that event plus the new `source_suggestion_id` (one per suggestion, partial UNIQUE, withheld from
  every public role).
- **Pool.** A Mood Board suggestion (waiting, kept or declined) is ALSO offered to the library — only when the
  supplier ticks the rights warranty on the sheet (never pre-ticked) — through the library's one door
  (`importEditorialMediaToGallery` → `importSuggestionToGallery` → `storeScreenedAsset`: rights · screen · watermark ·
  theft scan), with the per-category quota (suggestion copies now count — `countSuggestionPool`), the booking re-checked,
  and an event-album ref refused first. It lands PENDING (approved_at NULL) for the admin queue as today. Taking the
  suggestion back removes a still-pending copy.
- **Page.** `/v/[slug]` gets an Inspiration section (after Packages, as the approved website-by-plan design places it)
  of the shop's ADMIN-APPROVED, not-retired, not-refused library photos — one batched read paged past PostgREST's 1,000
  cap (`lib/shop-inspiration.server.ts`); each look with a card links to that card ("Card · from ₱X"). Each live
  service card carries its looks strip (`ServiceCard.inspirationLooks`, three thumbnails + "+N", "No looks yet"). Looks
  of a card that is not live on the page are not shown (the design's `liveLooks`).
- Not built: the design's full-screen look viewer (♥ Save · Ask), and the looks inside Find's bench cards (Find's
  inspiration is the R5 / step ④ build; `shortlist-categories.tsx` has three PRs in flight). Ugat joint J59.

SPEC IMPACT: DECISION_LOG row "A SUPPLIER'S INSPIRATION PHOTO IS CONNECTED FOUR WAYS …" (2026-10-30) is now BUILT
(draft PR, not merged) — status line to be added to that row. Open questions for the owner listed in the PR body.
