## 2026-06-26 · feat(panood): expand PAID multicam-tier presentation to full 9-feature + 4-capability coverage

Owner-set Panood coverage (2026-06-26). FREE tier stays single-camera, live on
YouTube — leading both surfaces. The PAID "Multicam control room" tier
(₱4,999/day, read LIVE from the admin catalog via `formatV2Sku` /
`formatSkuPriceLabel` — never hardcoded) now presents all 9 locked features +
4 capabilities, grouped readably (Cameras · Streaming · Screens · Production):

- **9 features:** multi-cam YouTube live · live streaming · Photowall → screen ·
  LED Wall → screen · extended screen control · multicam controller · overlays ·
  highlight generator · camera switch.
- **4 capabilities:** connect multiple cameras · control multiple screens ·
  broadcast via YouTube · also run an in-house (offline/local) live stream.

Nuance preserved (nothing retired): the highlight generator makes LIVE replays
during the broadcast — the standalone post-event edit SKUs (AI Highlight / SDE /
Thank-You) stay separate; and Panood ROUTES Photowall + LED-Wall content to
screens — the standalone PhotoWall / Live-Background (LED) content SKUs stay
separate. Honest build-state note added: foundation built, real multi-cam video
rolling out as streaming infra comes online.

Files:
- `apps/web/app/dashboard/[eventId]/studio/panood/page.tsx` — hero tagline,
  preview cards (grouped upgrade cards), highlights list, multicam plan scope,
  description paragraphs + nuance lines, ChoosePlanSheet introCopy, notIncluded
  (incl. build-state note).
- `apps/web/app/pricing/page.tsx` — Panood paid card blurb + grouped feature
  list + nuance footnote, and the section intro. Price stays LIVE.

SPEC IMPACT: Pricing.md §2.2 updated to ₱4,999 + the 9 features (catalog row is
the live source of truth; price read live, not hardcoded).
