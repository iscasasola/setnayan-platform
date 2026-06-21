## 2026-06-21 · fix(share): a shared couple link shows THEIR monogram card, not the generic brand image

Owner: "why is the cover photo of the link like this and not the look of the page with the logo?"

A shared `/[slug]` link rendered the generic `/brand/og-card.webp` ("Set na 'yan." brand card) instead of the couple's page. Cause: the OG-image route `/api/og/realstory-slug/[slug]` only rendered a couple-specific card when their **editorial was published**, and 302-redirected to the static brand card otherwise — so during the invitation / Save-the-Date phase (no editorial yet) every share fell back to the brand image.

Fix:
- **New couple monogram card** (`lib/social/realstory-card.tsx` → `renderCoupleMonogramOgJpeg`): mirrors the page hero — the couple's **monogram initials** (in their monogram colour, brand mulberry fallback) + a gold rule + their **names** + the **date**, on cream, under a "SETNAYAN · INVITATION" header and over the SETNAYAN wordmark + `www.setnayan.com`. Same satori + sharp + bundled-font pipeline as the existing editorial card.
- **Route fallback** (`route.ts`): a published editorial still renders the editorial card (hero photo + scrim); otherwise it now renders the **couple monogram card** from the event's `display_name` / `event_date` / `monogram_text` / `monogram_color` — so a shared invitation always shows the couple. Only a missing event / render failure still 302s to the static brand image.

So `www.setnayan.com/cale-ice` shared anywhere now previews as **CI · Cale & Ice · December 18, 2026**, matching the page.

Verified: `tsc --noEmit` exit 0; the new tree mirrors the existing known-good `cardTree` (same `el`/fonts/flex structure). A standalone satori render couldn't run in the sandbox (ESM module resolution), so the *image look* is owner-verified by re-sharing the link; CI production build + Vercel preview are the gate.

SPEC IMPACT: iter 0024 / share cards — the couple's own `/[slug]` OG image is their monogram card pre-editorial, the editorial card once published. → DECISION_LOG row.
