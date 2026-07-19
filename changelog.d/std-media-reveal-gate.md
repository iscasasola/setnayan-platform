## 2026-07-10 · feat(save-the-date): music/video/photos unlock with the Cinematic Reveal

Owner ("these 3 will unlock when they purchase the save the date reveal"). The Save-the-Date's own media beats — background music, the closing video, and the photo gallery — now require ownership of the **Cinematic Reveal** (`STD_PREMIUM_OPENINGS` ₱999). Free Save-the-Date = the text-only content film (monogram · names · date · venues · sentiment · calendar).

- **Public gate (`app/[slug]/page.tsx`):** compute `eventStdOpeningsActive` once; the `SaveTheDateView` render in BOTH film paths (`PublicLanding` + `InvitationSite`) now passes `musicUrl`/`videoUrl`/`videoPosterUrl`/`galleryUrls` only when the couple owns the Reveal (threaded as a required `ownsStdReveal` prop). Scoped to the STD film — the couple's full website (later phases) still shows their photos/music free.
- **Builder note:** a "Unlocks with the Cinematic Reveal" banner above the Video/Photos + Music steps when the Reveal isn't owned — couples can configure the media now; it goes live on purchase.
- **Copy:** the Cinematic Reveal SKU description (llms.txt) now states it unlocks the couple's own music/video/photos on the Save-the-Date.

Makes the ₱999 Cinematic Reveal a stronger bundle (premium opening + your own media), and keeps the free tier a clean text film.

Verified: typecheck · 1388 unit tests · llms drift guard · production build (343/343 pages).

SPEC IMPACT: Logged in DECISION_LOG 2026-07-10.
