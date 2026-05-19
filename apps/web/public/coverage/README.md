# Coverage-map city placeholders

8 cinematic 1:1 city vignettes for the homepage `Section 10 — PH coverage
map` photo-tile grid in `_CoverageMap.tsx`. Each file maps 1:1 to a
`PIN_PLACEHOLDERS[].image` entry.

## Files

| File | City | Approx PH region |
|---|---|---|
| `manila.avif` | Metro Manila | Luzon (NCR) |
| `tagaytay.avif` | Tagaytay | Luzon (Cavite) — wedding-destination favorite |
| `baguio.avif` | Baguio | Luzon (CAR) |
| `iloilo.avif` | Iloilo | Visayas |
| `cebu.avif` | Cebu City | Visayas |
| `bohol.avif` | Bohol | Visayas — Chocolate Hills |
| `cagayan-de-oro.avif` | Cagayan de Oro | Mindanao |
| `davao.avif` | Davao | Mindanao |

## Source

AI-generated via Higgsfield `soul_location` on 2026-05-19. Prompts asked
for warm cinematic editorial travel photography with burgundy + champagne-
gold accents to match the Setnayan palette. `soul_location` auto-injected
specific PH landmarks (Roxas Boulevard, Basilica Minore del Santo Niño,
Mount Apo, Taal Lake overlook, Baguio Cathedral, Plaza Libertad,
Macahambus Gorge, Bohol Chocolate Hills) for geographic specificity.

All 2048×2048 at AVIF q=65 effort=6 via `sharp@0.34.4`. Average file size
~127 KB.

## Replacing with real photography

When Setnayan ships its first real events in each location, swap each
placeholder for an authentic photograph of an actual Setnayan venue or
location:

- **Aspect**: 1:1 (the grid uses `aspect-square`)
- **Format**: AVIF preferred
- **Size budget**: < 250 KB per tile so the grid loads quickly on mobile
- **Composition**: scenic landmark or wedding-friendly venue; the photo
  hover-scales to 1.04× so leave a small margin around the focal point
- **Tones**: complement the burgundy / cream / champagne-gold palette;
  golden-hour or warm-evening light works best

## Privacy invariant

Per iteration 0015 § Section 10: only **city-level** photography. Never
barangay-level photos, never photos of identifiable couples or
ceremonies in this surface — those belong on the eventual Real Wedding
showcase (iteration 0046) with explicit couple consent.
