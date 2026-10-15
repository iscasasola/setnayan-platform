import { GlimpseRail } from './glimpse-rail';

/**
 * ✍ THE COUPLE'S OWN HEADING (owner 2026-10-15, "Add a heading field" — `lib/photos-heading.ts`), under the small
 * "Our photos" line, in the theme's display face. Nothing at all when they typed none: the scene is then exactly
 * today's.
 */
export function PhotosHeading({ heading, centred = false }: { heading?: string | null; centred?: boolean }) {
  if (!heading) return null;
  return (
    <h2
      className={`font-pahina font-light italic leading-[1.05] tracking-tight text-gild ${centred ? 'text-center text-[2.6rem] sm:text-6xl' : 'text-4xl sm:text-5xl'}`}
      data-photos-heading=""
    >
      {heading}
    </h2>
  );
}

/**
 * THE SAVE THE DATE PHOTOS' OTHER STYLES — Grid, Film strip and Glimpse
 * (prototype `every_scene_three_styles_2026-09-29.html` §13). They carry the
 * Post Event gallery's NAMES and ids (`grid`, `film-strip`) — the photos row
 * is the `gallery` scene type — so one pick carries across stages. A · Mosaic
 * is `OurPhotosWidget` itself.
 *
 * Same photos, same order: the presigned URLs the page resolved from
 * `events.our_photos`. Raw `<img>` for the reason the mosaic gives — the URLs
 * expire, and the optimizer would cache an expired one.
 */

/** Grid — three across, square; every photo the same weight. */
export function OurPhotosGrid({ urls, heading = null }: { urls: readonly string[]; heading?: string | null }) {
  return (
    <section className="space-y-4" data-scene-style="grid">
      <p className="pahina-eyebrow">
        <span>Our photos</span>
      </p>
      <PhotosHeading heading={heading} />
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {urls.map((url, i) => (
          <div key={`${i}-${url.slice(0, 24)}`} className="relative aspect-square overflow-hidden bg-ink/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          </div>
        ))}
      </div>
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-ink/70">
        {urls.length} {urls.length === 1 ? 'photo' : 'photos'}
      </p>
    </section>
  );
}

/**
 * Film strip — sprocketed strips that slide sideways; the second strip starts
 * offset so the eye keeps moving. One strip when there are few photos.
 */
export function OurPhotosFilmStrip({ urls, heading = null }: { urls: readonly string[]; heading?: string | null }) {
  const rows = urls.length > 4 ? [urls.filter((_, i) => i % 2 === 0), urls.filter((_, i) => i % 2 === 1)] : [urls];
  return (
    <section className="space-y-4" data-scene-style="film-strip">
      <p className="pahina-eyebrow">
        <span>Our photos</span>
      </p>
      <PhotosHeading heading={heading} />
      <div className="space-y-2">
        {rows.map((row, ri) => (
          <div key={ri} className="overflow-x-auto bg-ink py-3">
            <ol className={`flex snap-x gap-2 px-3 ${ri === 1 ? 'pl-16' : ''}`} aria-label={ri === 0 ? 'Our photos, as a film strip' : undefined}>
              {row.map((url, i) => (
                <li key={`${i}-${url.slice(0, 24)}`} className="relative aspect-[3/2] w-40 shrink-0 snap-start overflow-hidden bg-ink/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-ink/70">Slides sideways</p>
    </section>
  );
}

/**
 * Glimpse — one 3:4 photo at a time, centred; the previous and next peek in at both edges, and the rail drifts slowly
 * sideways (owner 2026-10-15, DECISION_LOG "GLIMPSE PHOTO STYLE APPROVED" + "…A SLOW CONTINUOUS DRIFT"; prototype
 * `photos_glimpse_style_2026-10-15_fable.html`). Save the Date only — its own id, not one of Post Event's. The rail,
 * its drift, the dots and the full-screen photo are the small client leaf `glimpse-rail.tsx`; the server draws it as a
 * plain snap rail, every photo once, so the page reads before any JavaScript.
 */
export function OurPhotosGlimpse({ urls, heading = null }: { urls: readonly string[]; heading?: string | null }) {
  return (
    <section className="space-y-4" data-scene-style="glimpse">
      <p className="pahina-eyebrow justify-center">
        <span>Our photos</span>
      </p>
      <PhotosHeading heading={heading} centred />
      <GlimpseRail urls={urls} label={heading ?? 'Our photos'} />
    </section>
  );
}
