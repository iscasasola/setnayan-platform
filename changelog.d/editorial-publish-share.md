## 2026-06-28 · feat(editorial): co-locate publish + share + Real Stories opt-in

Owner intent ("each event has an editorial to showcase, share on social, and read across events"). PR2 of 2 — completes the publish-and-share path for the editorial PR1 provisions per event.

The pieces existed but were scattered: publish lived on the editorial editor; the Real Stories showcase consent + landing visibility lived on a separate privacy page. A couple had to visit two surfaces to actually get a shareable, featured story. This co-locates them.

- **Editorial editor → "Share your story" panel** (shown once published): the canonical public link with a copy button, the existing `<ShareButtons>` (Facebook / Pinterest / copy — the published OG card previews the story), and a **"Feature our story in Real Stories"** toggle.
- New `setStoryShowcase(eventId, optIn)` server action (mirrors `setShowcaseConsent`, host-gated, writes the caller's own `users.public_summary_consent_at`). **RA 10173 boundary held:** explicit, reversible opt-in; it does NOT auto-publish and does NOT silently change `landing_page_visibility`. If the page is Private, the panel surfaces a caveat + a link to Privacy settings instead of flipping it.
- Editor page now reads the couple's consent flag + landing visibility and passes an absolute `shareUrl` (via `siteUrl()`).

Reuses `useToast`, `<ShareButtons>`, the existing toggle styling. Verified: tsc 0 errors · next lint clean · prod build green.

SPEC IMPACT: None on locked scope. Logged in DECISION_LOG (2026-06-28, same row as PR1). No price/SKU/schema change — pure dashboard-UX co-location of existing publish + consent levers.
