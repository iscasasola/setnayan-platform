/**
 * /tour/budget — the sample wedding's money page, while the server answers.
 *
 * Why: speed audit 2026-11-27 marked it ⓛ: no loading boundary at or above it and about 4 reads before paint, so a
 * tap showed nothing until the server answered. The tour layout's sample-wedding note stays on screen above this.
 *
 * Shape it mirrors (page.tsx): a `max-w-5xl` column → the centred header (the heading "Money, handled" + the intro, 5 lines on a phone)
 * → the three summary stats → "Supplier by supplier", its fixed line and the first two supplier cards (the planner sits below the fold). The heading, the stat labels and that line
 * are fixed words in the page, so they show at once; the money is not known here.
 */
import { Ghost, Screen, Sk } from '@/components/skeletons';

/* The page's own fixed words, shown at once at the page's own size, so nothing below them moves when it lands. */
const WRAP = '!whitespace-normal';

export default function TourBudgetLoading() {
  return (
    <Screen className="mx-auto w-full max-w-5xl px-5 pb-20 pt-12 sm:pt-16">
      <div className="mx-auto max-w-2xl text-center">
        <Ghost
          known="Money, handled"
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

      <div className="mx-auto mt-12 grid max-w-3xl gap-3 sm:grid-cols-3">
        {['Committed', 'Paid so far', 'Left to pay'].map((label) => (
          <div key={label} className="sn-frame p-5 text-center">
            <Ghost known={label} textClassName="font-mono text-sn-11 uppercase tracking-widest text-ink/60" />
            <Sk className="mx-auto mt-2 h-9 w-32 rounded" />
            <Sk className="mx-auto mt-2 h-3 w-36 rounded" />
          </div>
        ))}
      </div>

      <div className="mx-auto mt-16 max-w-3xl">
        <Ghost known="Supplier by supplier" textClassName="font-serif text-2xl text-ink" />
        <Ghost
          known="Each supplier shows the agreed total, what’s been paid, and every line item — so nothing slips through."
          textClassName={`mt-2 text-sm text-ink/70 ${WRAP}`}
        />
        <div className="mt-6 space-y-4">
          <Sk className="h-80 w-full rounded-2xl" />
          <Sk className="h-80 w-full rounded-2xl" />
        </div>
      </div>
    </Screen>
  );
}
