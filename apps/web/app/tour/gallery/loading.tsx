/**
 * /tour/gallery — the sample wedding's Memory lane and palette, while the server answers.
 *
 * Why: speed audit 2026-11-27 marked it ⓛ: no loading boundary at or above it and about 4 reads before paint, so a
 * tap showed nothing until the server answered. The tour layout's sample-wedding note stays on screen above this.
 *
 * Shape it mirrors (page.tsx): a `max-w-5xl` column → the centred header (the heading "See it come alive" + two
 * lines) → "Memory lane, live" with its photo wall → "The palette behind it all" with its swatches. The heading and
 * both section names are fixed words in the page, so they show at once; the photos are not known here.
 */
import { Ghost, Screen, Sk } from '@/components/skeletons';

export default function TourGalleryLoading() {
  return (
    <Screen className="mx-auto w-full max-w-5xl px-5 pb-20 pt-12 sm:pt-16">
      <div className="mx-auto max-w-2xl text-center">
        <Ghost known="See it come alive" textClassName="mt-3 font-serif text-4xl leading-tight tracking-tight text-ink !whitespace-normal sm:text-5xl" />
        <Sk className="mx-auto mt-4 h-4 w-full max-w-xl rounded" />
        <Sk className="mx-auto mt-2 h-4 w-3/4 rounded" />
      </div>

      <div className="mx-auto mt-12 max-w-3xl">
        <Ghost known="Memory lane, live" textClassName="font-serif text-2xl text-ink" />
        <Sk className="mt-2 h-3.5 w-4/5 rounded" />
        <div className="mt-6 grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <Sk key={i} className="aspect-square w-full rounded-md" />
          ))}
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-3xl">
        <Ghost known="The palette behind it all" textClassName="font-serif text-2xl text-ink" />
        <Sk className="mt-2 h-3.5 w-3/5 rounded" />
        <div className="mt-6 flex flex-wrap gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Sk key={i} className="h-12 w-12 rounded-full" />
          ))}
        </div>
      </div>
    </Screen>
  );
}
