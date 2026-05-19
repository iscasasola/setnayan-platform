# Add-ons tile imagery

11 banner photos for the homepage `Section 7 — In-app services` cards in
`_InAppServices.tsx`. Each file maps 1:1 to a `SERVICES[].image` entry.

## Files

| File | Card name | Tagline |
|---|---|---|
| `papic.avif` | Papic | Designated Paparazzi |
| `panood.avif` | Panood | Multi-Cam Live Stream |
| `pamahiya.avif` | Pamahiya | Personal Souvenir Reels |
| `pakulay.avif` | Pakulay | Mood Board & Palette Engine |
| `pailaw.avif` | Pailaw | LED Background Maker |
| `pareto.avif` | Pareto | Pro Camera Bridge |
| `custom-monogram.avif` | Custom Monogram Pack | Your brand on every output |
| `pro-invitation-widgets.avif` | Pro Invitation Widgets | Hero · Story · Schedule |
| `ai-video.avif` | AI Video / Edited Highlight | Same-day reels |
| `photo-delivery.avif` | Photo Delivery | Full-res handoff after the day |
| `supplies-marketplace.avif` | Supplies Marketplace | Wedding-day supplies, one bill |

## Source

AI-generated via Higgsfield `z_image` on 2026-05-19. Prompts emphasized
Filipino wedding context, warm cinematic tones, burgundy / cream /
champagne-gold palette. All 16:9 at 2048×1152, encoded as AVIF q=65
effort=6 via `sharp@0.34.4`. Average file size ~110 KB (range 32–267 KB).

## Replacing with real photography

Once Setnayan books its first real events, swap each placeholder for an
authentic Filipino-wedding photograph. The contract:

- **Aspect**: 16:9 (the card uses `aspect-[16/9]`)
- **Format**: AVIF preferred (~50% smaller than WebP)
- **Size budget**: < 300 KB on the wire so the grid lazy-loads cleanly
  on mobile networks
- **Composition**: subject in middle of frame, no important detail in
  the bottom-edge ~15% (the card's icon + name overlap the lower part
  visually after the image)
- **Tone**: complement the burgundy `#7A1F2B` / cream `#FAF7F2` /
  champagne gold `#C9A66B` palette; avoid cool blues or stark whites
  that fight the page's warm palette

To swap: replace the file at the same path, commit, auto-merge. No code
change needed — the `SERVICES[].image` pointer is stable.
