# Hero asset slot

`hero-couple.avif` is the live homepage hero, served via `<HeroBackdrop />`
in `app/_components/hero-backdrop.tsx`. Five alternate compositions live
under `variants/` and can be swapped in instantly by overriding the env
var or by renaming.

## Currently live

`hero-couple.avif` — Take 1 of the "forehead-touch / golden hour /
left-third composition" prompt set. AI-generated via Higgsfield `z_image`
on 2026-05-19. 16:9 (2048×1152), AVIF q=65, ~62 KB on the wire.

## Variants on deck

| File | Concept |
|---|---|
| `variants/forehead-touch-2.avif` | Same prompt as live, alternate take |
| `variants/walking-1.avif` | Couple walking through tropical garden, three-quarter view |
| `variants/walking-2.avif` | Same prompt, alternate take |
| `variants/ring-detail-1.avif` | Macro hand-and-ring with capiz bokeh |
| `variants/ring-detail-2.avif` | Same prompt, alternate take |

## How to swap

**Per-deploy (no commit needed):** set `NEXT_PUBLIC_HERO_IMAGE_URL` in
Vercel Production env, e.g. `/hero/variants/walking-1.avif`. Redeploy
picks it up. Same env var also accepts fully-qualified R2 URLs — the
allow-list is already in `next.config.ts § images.remotePatterns`.

**Permanent swap:** rename the chosen variant to `hero-couple.avif` and
move the current one into `variants/`. Commit + auto-merge. The component
default at `hero-backdrop.tsx § DEFAULT_HERO_SRC` doesn't need to change.

## Replacing with a real photoshoot

When a real Filipino-wedding shoot is commissioned (the recommendation
from the responsive/UX audit — AI is the placeholder), follow the same
swap procedure. The new asset should match:

- **Format**: AVIF preferred (sharp `q=65 effort=6` produces ~60-300 KB
  from a 2048×1152 source).
- **Aspect**: 16:9 (2048×1152 minimum, 3840×2160 for retina).
- **Composition**: subject on left third; right two-thirds open negative
  space so the headline overlay stays readable.
- **Tones**: warm, complementary to burgundy `#7A1F2B` / cream
  `#FAF7F2` / champagne gold `#C9A66B`.

## Brief for the eventual real shoot

Refer to the canonical creative brief in the spec corpus iteration 0015
folder. Quick reminders the AI placeholder honors:

- Authentic Filipino wedding moment (couple in motion preferred over
  posed portrait).
- PH cultural markers that read on a thumbnail: barong tagalog,
  Filipiniana butterfly sleeves, capiz/piña texture, sampaguita,
  anthurium, palm.
- Avoid generic Western-wedding stock-photo aesthetic — that's the
  single biggest "generic SaaS" signal.
