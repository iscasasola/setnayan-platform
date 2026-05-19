# Hero asset slot

Drop a single hero image at `public/hero/hero-couple.avif` (or `.webp` / `.jpg`)
and set `NEXT_PUBLIC_HERO_IMAGE_URL=/hero/hero-couple.avif` in `.env.local` +
Vercel project env. The homepage `<Hero>` and any other section that uses
`<HeroBackdrop>` (see `app/_components/hero-backdrop.tsx`) will pick it up
automatically — no code change needed.

## What we're looking for

Per the responsive/UX audit + 0015 § Brand:

- **Authentic Filipino wedding moment.** Couple in motion preferred over a
  posed portrait. Aspirational without being staged.
- **Warm tones** that complement the burgundy / cream / gold palette in
  `globals.css` (`#7A1F2B` accent, `#FAF7F2` cream, `#C9A66B` champagne gold).
- **Aspect ratio**: at least 2:1, ideally 16:9 or wider. The backdrop is
  full-bleed; the text overlay sits left-aligned, so leave the right ~40%
  uncluttered or in soft focus.
- **Resolution**: 2400×1200 minimum (target 3840×1920 for retina + 4K).
  `next/image` optimizes downsampling automatically.
- **Format**: AVIF preferred (~50% smaller than WebP at the same quality).
  Generate from a JPG source with `sharp` or any image CDN.

## Source options

1. **Real photoshoot** (preferred) — a local Filipino wedding shoot is the
   single highest-impact way to "de-genericize" the brand. Plan a small
   shoot with a partner photographer.
2. **AI imagery as a fallback** — Higgsfield (cinematic motion frames),
   Flux, or Midjourney can stand in until a shoot is feasible. Generate at
   the highest fidelity the tool offers and downsample to 3840×1920.
3. **Stock** — last resort. PH-specific stock at Unsplash / Pexels with a
   warm-light, candid wedding moment. Avoid generic Western weddings.

## Once the asset lands

- Commit the file to `public/hero/` (or upload to R2 and use a fully-
  qualified URL).
- Set `NEXT_PUBLIC_HERO_IMAGE_URL` in Vercel project env (Production +
  Preview).
- Smoke on mobile + desktop: confirm the overlay keeps the headline
  readable; tweak `overlayClassName` on `<HeroBackdrop>` if the photo's
  exposure clashes with body copy.
