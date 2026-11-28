/**
 * /tour/gallery — the sample wedding's Memory lane and palette, while the server answers.
 *
 * Why: speed audit 2026-11-27 marked it ⓛ: no loading boundary at or above it and about 4 reads before paint, so a
 * tap showed nothing until the server answered. The tour layout's sample-wedding note stays on screen above this.
 *
 * Shape it mirrors (page.tsx): a `max-w-5xl` column → the centred header (the heading "See it come alive" + the
 * intro, 5 lines on a phone) → "Memory lane, live", its fixed line and the wall's opening card → "The palette behind
 * it all", its fixed line and the palette card. The heading, the section names and their lines are fixed words in
 * the page, so they show at once; the couple's names and the photos are not known here.
 */
import { Ghost, Screen, Sk } from '@/components/skeletons';

/* The page's own fixed words, shown at once at the page's own size, so nothing below them moves when it lands. */
const WRAP = '!whitespace-normal';

export default function TourGalleryLoading() {
  return (
    <Screen className="mx-auto w-full max-w-5xl px-5 pb-20 pt-12 sm:pt-16">
      <div className="mx-auto max-w-2xl text-center">
        <Ghost
          known="See it come alive"
          textClassName={`mt-3 font-serif text-4xl leading-tight tracking-tight text-ink ${WRAP} sm:text-5xl`}
        />
        {/* The intro carries the couple's names: grey, at its own line height (5 lines on a phone, 3 on a laptop). */}
        <div className="mx-auto mt-4 max-w-xl space-y-2 sm:space-y-3">
          <Sk className="mx-auto h-4 w-full rounded" />
          <Sk className="mx-auto h-4 w-11/12 rounded" />
          <Sk className="mx-auto h-4 w-full rounded" />
          <Sk className="mx-auto h-4 w-10/12 rounded sm:hidden" />
          <Sk className="mx-auto h-4 w-1/2 rounded sm:hidden" />
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-3xl">
        <Ghost known="Memory lane, live" textClassName="font-serif text-2xl text-ink" />
        <Ghost
          known="Watch new moments drift in. On a wedding day these appear as guests take them — here, tap “Bring Memory lane to life” to see it fill. Nothing is saved; reload to start fresh."
          textClassName={`mt-2 text-sm text-ink/70 ${WRAP}`}
        />
        {/* The wall opens on its "warming up" card until the sample's photos drift in. */}
        <Sk className="mt-6 h-28 w-full rounded-2xl" />
      </div>

      <div className="mx-auto mt-16 max-w-3xl">
        <Ghost known="The palette behind it all" textClassName="font-serif text-2xl text-ink" />
        <Ghost
          known="Every render — the invitation, the Memory lane chrome, the editorial — pulls from one colour story. Drag the preview to recolor it in your own head; it’s a local sketch and nothing here is saved."
          textClassName={`mt-2 text-sm text-ink/70 ${WRAP}`}
        />
        <Sk className="mt-6 h-96 w-full rounded-2xl" />
      </div>
    </Screen>
  );
}
