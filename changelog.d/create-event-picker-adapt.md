## 2026-07-11 · fix(create-event): adapt the choose-your-event picker to 14 types on desktop + mobile

Now that all 14 active event types are couple-facing (PR #3127), the picker had two gaps: the four newly-enabled types (Anniversary, Graduation, Reunion, Gala Night) have no hero photo, so both picker surfaces fell them back to `wedding.webp` — showing the same photo up to five times — and the in-chrome carousel rendered a 14-dot indicator that overflows a narrow sheet.

- **Branded placeholder, never a wrong photo.** New `eventTypePlaceholderGradient(key)` in `event-types.ts` — a deterministic, hashed warm-muted gradient. When a tile's photo 404s (missing repo asset OR broken admin `heroPhotoUrl`), both `event-type-photo-picker.tsx` (full-page grid) and `event-type-carousel.tsx` (sheet) now render `gradient + oversized emoji + the usual serif label` instead of `wedding.webp`. Fixes the duplicate-photo bug and makes every future admin-created type look intentional the instant it exists. `EVENT_TYPE_PHOTO_FALLBACK` kept exported but deprecated.
- **Denser desktop grid.** Full-page picker gains `xl:grid-cols-5` (was max 4-up) and the page container widened `max-w-5xl → max-w-6xl`, so 14 tiles fit in fewer rows on wide screens. Phone/tablet unchanged (2-up / 3-up).
- **Carousel controls that scale.** Above `DOTS_MAX` (8) types the per-card dot row is replaced by a compact `"n / total · <label>"` counter that can never overflow the sheet.

Verified in-browser at desktop (1280) and mobile (375): 5-up/2-up reflow, no horizontal overflow, all four placeholders render distinct cohesive tiles, popup counter reads "3 / 14 · Reunion".

SPEC IMPACT: None (UI robustness; no schema, pricing, or roster change). Real hero photos for the four new types remain a follow-up (Recraft once `RECRAFT_API_KEY` is configured, or an admin hero-photo upload).
