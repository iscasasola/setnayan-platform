/**
 * /tour/vendors — the sample wedding's supplier shortlist and chat, while the server answers.
 *
 * Why: speed audit 2026-11-27 marked it ⓛ: no loading boundary at or above it and about 3 reads before paint, so a
 * tap showed nothing until the server answered. The tour layout's sample-wedding note stays on screen above this.
 *
 * Shape it mirrors (page.tsx): a `max-w-5xl` column → the centred header (the heading "The AI did the hard part" +
 * the intro, 4 lines on a phone) → the shortlist: the sort switch row, then one block per service (name, line,
 * suppliers), one column at every width. The chat sits below the fold. The heading is fixed words in the page, so
 * it shows at once; the services and suppliers are not known here.
 */
import { Ghost, Screen, Sk } from '@/components/skeletons';

/* The page's own fixed words, shown at once at the page's own size, so nothing below them moves when it lands. */
const WRAP = '!whitespace-normal';

export default function TourVendorsLoading() {
  return (
    <Screen className="mx-auto w-full max-w-5xl px-5 pb-20 pt-12 sm:pt-16">
      <div className="mx-auto max-w-2xl text-center">
        <Ghost
          known="The AI did the hard part"
          textClassName={`mt-3 font-serif text-4xl leading-tight tracking-tight text-ink ${WRAP} sm:text-5xl`}
        />
        {/* The intro opens with the couple's names: grey, at its own line height (4 lines on a phone, 3 on a laptop). */}
        <div className="mx-auto mt-4 max-w-xl space-y-2 sm:space-y-3">
          <Sk className="mx-auto h-4 w-full rounded" />
          <Sk className="mx-auto h-4 w-11/12 rounded" />
          <Sk className="mx-auto h-4 w-full rounded" />
          <Sk className="mx-auto h-4 w-2/3 rounded sm:hidden" />
        </div>
      </div>

      {/* The shortlist: the sort switch row, then one block per service (its name, line and suppliers). */}
      <div className="mt-12">
        <Sk className="h-16 w-full rounded-xl" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="mt-10 space-y-2">
            <Ghost className="h-6 w-40 rounded" />
            <Sk className="h-3.5 w-2/3 rounded" />
            <Sk className="!mt-3 h-16 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </Screen>
  );
}
