## 2026-06-26 · refactor(panood): restructure About page to FREE single-cam + PAID multicam packaging

Rebuilt the Panood About surface (`apps/web/app/dashboard/[eventId]/studio/panood/page.tsx`)
to present the LOCKED two-tier packaging honestly instead of framing Panood as one
₱2,499/day "Daily Broadcast" paid product:

- **FREE (first-class, the hook):** single-camera livestream — go live on your own
  YouTube (phone or laptop) → embeds on the event page in the couple's colours →
  auto-archived forever. ₱0, available now to everyone, no purchase. The PRIMARY hero
  CTA is now "Go live — free" → `./setup` (was a paid "Add ₱2,499" lead, which
  mis-framed the free tool as a paywall). Honours the locked "every service free to
  use" positioning.
- **PAID upgrade — Multicam control room (`PANOOD_SYSTEM`):** multiple cameras, live
  switching, one-tap moments (Cake / First Dance / …), overlays, and venue-screen
  routing. Priced LIVE from the admin catalog via `formatV2Sku(PANOOD_SYSTEM)` (no
  hardcoded price). Buy reuses the existing `AddOnStateCta` / `InlineCheckoutDrawer`;
  when OWNED the CTA flips to "Open control room" → `./broadcast` (the resolved
  `launch` href now points at the control room, not `./setup`).
- Updated hero tagline (free livestream + multicam upgrade), CTAs (free primary +
  paid-multicam secondary), stats ("Pricing → Free + multicam from <live price>"),
  Plans (two rows: "Single-camera livestream — Free" ₱0 + "Multicam control room"
  live price), description paragraphs, highlights, preview cards, and notIncluded.
- AppStoreLayout API, brand `--m-*` tokens, and the apply-then-pay state machinery
  left intact. No hardcoded prices.

SPEC IMPACT: None (UI copy/structure aligns to the already-locked packaging in
`Panood_Multicam_Architecture_2026-06-26.md` § "Packaging LOCKED" + the free-vs-paid
boundary memory; no new corpus decision).
