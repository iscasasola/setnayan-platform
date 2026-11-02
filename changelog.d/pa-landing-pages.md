## 2026-06-28 · feat(marketing): five "Pa-" feature landing pages (/panood, /pa3d, /palogo, /pawebsite, /patiktok)

Added five force-static public marketing landing pages, mirroring the existing
`/papic` + `/setnayan-ai` pattern exactly (owner-approved 2026-06-27; Pa- naming
LOCKED):

- `/panood` — live broadcast / "presence across distance" for guests who can't attend
- `/pa3d` — walk your reception in 3D before the day (the 2D seating plan stays free; Pa3D is the premium walk)
- `/palogo` — your animated monogram (the Animated Monogram) carried across the whole wedding
- `/pawebsite` — your editorial wedding website (save-the-date + RSVP + event page + love story under one address)
- `/patiktok` — short-form, shareable highlight reels from the day

Each page is a force-static Server Component (`dynamic = 'force-static'` +
`revalidate`) with static `metadata` (title / description / canonical / OG /
Twitter), `SoftwareApplication` + `FAQPage` JSON-LD, a hero, a "How it works"
panel, a before/after differentiator list, an FAQ, and a Mulberry-accent primary
CTA. NO prices anywhere — secondary CTAs link to `/pricing` (or `/monogram` for
Palogo's free preview); primary CTAs send to `/onboarding/wedding?from=<feature>`,
matching how `/papic` + `/setnayan-ai` route. Public copy sells the human benefit,
never implementation/model names (public-surface hygiene; positioning locks
honoured for Panood/Editorial/seat-plan).

Shared motion island `app/_components/marketing/_pa-motion.tsx` factors out the
same premium primitives `/papic` uses (LineRevealHeading / RevealBand / RevealList
/ HowItWorksPanel) so the five pages share one island instead of duplicating it.

Registered all five in `NAV_ROUTES` (site-chrome.tsx) so the persistent marketing
nav renders, and added all five to `sitemap-static.xml` with `lastmod 2026-06-28`.

This PR is the static pages + nav + sitemap only — the interactive "free-testing"
demo widgets are a deferred follow-up wave (each page still ships a clear primary
CTA).

SPEC IMPACT: None. New public marketing routes only — no schema, no SKU, no
pricing change; prices remain admin-catalog managed and are never quoted.
