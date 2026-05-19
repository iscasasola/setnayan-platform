import Image from 'next/image';

// Hero backdrop — renders a full-bleed photographic background when one is
// configured, otherwise falls back to the brand radial-gradient wash. Used
// by the homepage Hero (0015 § Section 2) and any other section that wants
// the same "photo or gradient" placeholder pattern (e.g. /features hero).
//
// # How to ship a real photo
//
// 1. Drop a JPG/AVIF/WebP at `public/hero/` (e.g. `hero-couple.avif`) and set:
//
//      NEXT_PUBLIC_HERO_IMAGE_URL=/hero/hero-couple.avif
//
//    Local public/ paths work too — `next/image` optimizes them at build time.
//
// 2. Or host on R2:
//
//      NEXT_PUBLIC_HERO_IMAGE_URL=https://media.setnayan.com/hero/hero-couple.avif
//
//    The R2 hostname is allow-listed via `next.config.ts § remotePatterns`,
//    so next/image will optimize it at request time.
//
// 3. Per the responsive/UX audit, AI imagery (Higgsfield / Flux / Midjourney)
//    is a fallback if a real Filipino-wedding shoot isn't feasible — the
//    consumer of this component doesn't care which source the URL points at.
//
// # Performance contract
//
// - `priority` is set to true so the LCP image preloads
// - `fill` lets the parent control the aspect ratio (works inside any
//   `relative` container — the homepage Hero gives it a 100vh-ish window)
// - `sizes="100vw"` because the backdrop spans the full viewport
// - `quality={75}` is the sweet spot for photographic backgrounds — higher
//   is barely perceptible, lower starts to show banding in skin tones
//
// # Accessibility
//
// The backdrop is purely decorative — text content sits in front of it.
// `alt=""` + `aria-hidden` keeps screen readers from announcing it.
// Provide `alt` via the consumer if the photo is content-bearing (e.g.
// an `<aside>` figure rather than a hero wash).

type HeroBackdropProps = {
  /**
   * Absolute or root-relative URL of the photo to render. When omitted,
   * the gradient fallback renders instead.
   *
   * Defaults to `process.env.NEXT_PUBLIC_HERO_IMAGE_URL` — set once in
   * Vercel and every hero on the site picks it up.
   */
  src?: string;
  /**
   * Alt text. Empty by default (decorative). Set when the photo is
   * content-bearing rather than ambient.
   */
  alt?: string;
  /**
   * Tailwind classes layered over the gradient and photo to tint /
   * desaturate / vignette. Defaults to a soft cream wash that keeps
   * body copy readable on warm-toned wedding photos.
   */
  overlayClassName?: string;
};

export function HeroBackdrop({
  src = process.env.NEXT_PUBLIC_HERO_IMAGE_URL,
  alt = '',
  overlayClassName = 'bg-gradient-to-b from-cream/40 via-cream/20 to-cream/70',
}: HeroBackdropProps) {
  if (src) {
    return (
      <>
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-20">
          <Image
            src={src}
            alt={alt}
            fill
            priority
            sizes="100vw"
            quality={75}
            className="object-cover"
          />
        </div>
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 -z-10 ${overlayClassName}`}
        />
      </>
    );
  }

  // Fallback — the brand radial wash that ships today. Same look as the
  // pre-photo placeholder so the section is never visually broken even
  // when no `NEXT_PUBLIC_HERO_IMAGE_URL` is set (dev, staging, branch
  // previews, or a fresh prod deploy before assets land).
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10"
      style={{
        background:
          'radial-gradient(ellipse at top right, rgb(var(--color-terracotta) / 0.08), transparent 55%), radial-gradient(ellipse at bottom left, rgb(var(--color-terracotta) / 0.05), transparent 50%)',
      }}
    />
  );
}
