# Hero asset slot — ⚠ NOT CURRENTLY WIRED TO ANYTHING

**Corrected 2026-08-06.** This file used to say:

> `hero-couple.avif` is the live homepage hero, served via `<HeroBackdrop />`
> in `app/_components/hero-backdrop.tsx`. […] can be swapped in instantly by
> overriding the env var or by renaming.

**All three claims were false.** `HeroBackdrop` had zero importers — the homepage
reskin replaced the composition that rendered it — so the component was deleted.
It was also the only reader of `NEXT_PUBLIC_HERO_IMAGE_URL`, which therefore
controlled nothing: pointing that variable at a new photo changed no pixel on the
site, while this README insisted it would.

The images below are **kept, not deleted** — they are finished art, and the next
homepage composition is the obvious consumer. But nothing renders them today.

**Before treating any file here as live, grep for its filename** and confirm a
component actually reads it. Do not trust this README, or any README, over the
code.

## The assets

`hero-couple.avif` — Take 1 of the "forehead-touch / golden hour / left-third
composition" prompt set. AI-generated via Higgsfield `z_image` on 2026-05-19.
16:9 (2048×1152), AVIF q=65, ~62 KB on the wire. Five alternate compositions
live under `variants/`.
