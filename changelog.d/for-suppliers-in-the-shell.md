## 2026-11-04 · fix(for-suppliers): the supplier page wears the shared shell, and the booking-fee line says it plainly

Owner, on his phone at www.setnayan.com/for-suppliers: *"the page is on the wrong shell"* — and reword the
booking-fee line "Your first booking from Setnayan is on us — after that 5% of the first ₱100,000, then 1%,
minimum ₱50, only on couples we source". Same facts, plainer words.

- **Right shell.** `app/for-suppliers/page.tsx` → `app/(shell)/for-suppliers/page.tsx` (only the page moved;
  its sections stay in `app/for-suppliers/_components/`, the split /features uses). URL unchanged; the
  `/vendors` and `/for-vendors` 308s, metadata, JSON-LD and live prices are untouched. `/for-suppliers` left
  `NAV_ROUTES` in `site-chrome.tsx`, so the old glass nav + reskin footer are no longer drawn — the page gets
  the front-door bar + rail once, from the group layout, which also supplies `force-dynamic` now, plus the null `loading.tsx` every shelled page
  carries (`the-press-commits-now.test.ts`). It runs
  full-bleed (`DOORWAY_BLEED_PATHS`) so the photo hero and dark bands still reach the edges, and joined the
  stacked-bar lint's shelled routes. New guard: `app/(shell)/for-suppliers/for-suppliers-wears-the-shell.test.ts`.
- **The fee line**, in one component (`app/_components/booking-fee-line.tsx`) drawn by the thesis strip and
  "Fair by design" (`vendor-grow-sections.tsx`), the free plan card (`vendor-tier-deltas.tsx`) and the
  supplier's own `/vendor-dashboard/booking-fees` empty state: **"Your first booking through Setnayan is free."
  After that: 5% up to ₱100,000, 1% above — only on couples who found you here.** with an ⓘ (`<InfoTip>`)
  holding "Minimum fee ₱50 per booking. Bookings you bring in yourself are never charged." Every number comes
  from the live schedule the page read (`bookingFeeBandsLine` / `bookingFeeMinimumAmount`, new in
  `lib/booking-fee.ts`, no default schedule); a schedule that could not be read still prints no rate. The
  booking-fees page now reads the live schedule for it. The front door's supplier card and the supplier Help
  row say the same words. New test: `lib/the-fee-line-says-it-plainly.test.ts`.
- **Plans invisible on a phone (found while taking the screenshots).** `useReveal` waited for 15% of a section
  to be on screen; the plan ladder is ~7,400 px tall at 390 px, so that never fit an 844-px screen and every
  plan card stayed at opacity 0. The threshold is now capped by what the screen can show
  (`a-tall-section-still-reveals.test.ts`).
- **True claims (CLOUD_BOARD 5 Nov sweep).** The "In-app video & audio calls" card is gone (calls left chat
  28 Oct; same change, word for word, as #7257 so the two merge cleanly). The Verified row says the
  `REQUIRED_DOC_COUNT` required papers plus a short video call with our team, not "a 12-doc check". The
  "both e-sign in-app" contracts row is gone (contracts are an uploaded PDF on record). The 3D seat-plan logo
  row moved from Pro to Solo, "with the 3D Booth add-on" (paid plans, Solo+). Guard:
  `lib/the-supplier-page-claims-what-ships.test.ts`.
- Regenerated with their generators: `scripts/port-control-baseline.json`, `lib/ugat/screens.generated.json`.

Not changed: the hero paragraph still uses `supplierCommissionPromise()` ("…your first booking from Setnayan
is on us…, minimum ₱50"), shared with /pricing and the JSON-LD — left for the owner to decide.

SPEC IMPACT: None (copy + layout only).
