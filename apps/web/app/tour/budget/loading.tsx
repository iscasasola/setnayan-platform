/**
 * /tour/budget — the sample wedding's money page, while the server answers.
 *
 * Why: speed audit 2026-11-27 marked it ⓛ: no loading boundary at or above it and about 4 reads before paint, so a
 * tap showed nothing until the server answered. The tour layout's sample-wedding note stays on screen above this.
 *
 * Shape it mirrors (page.tsx): a `max-w-5xl` column → the centred header (the heading "Money, handled" + two lines)
 * → the three summary stats → "Supplier by supplier" with its rows → "Try the budget planner". The heading and both
 * section names are fixed words in the page, so they show at once; the money is not known here.
 */
import { Ghost, Screen, Sk } from '@/components/skeletons';

export default function TourBudgetLoading() {
  return (
    <Screen className="mx-auto w-full max-w-5xl px-5 pb-20 pt-12 sm:pt-16">
      <div className="mx-auto max-w-2xl text-center">
        <Ghost known="Money, handled" textClassName="mt-3 font-serif text-4xl leading-tight tracking-tight text-ink !whitespace-normal sm:text-5xl" />
        <Sk className="mx-auto mt-4 h-4 w-full max-w-xl rounded" />
        <Sk className="mx-auto mt-2 h-4 w-3/4 rounded" />
      </div>

      <div className="mx-auto mt-12 grid max-w-3xl gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="sn-frame space-y-2 p-4">
            <Sk className="h-3 w-20 rounded" />
            <Sk className="h-7 w-28 rounded" />
            <Sk className="h-3 w-32 rounded" />
          </div>
        ))}
      </div>

      <div className="mx-auto mt-16 max-w-3xl space-y-3">
        <Ghost known="Supplier by supplier" textClassName="font-serif text-2xl text-ink" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Sk key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>

      <div className="mx-auto mt-16 max-w-3xl space-y-3">
        <Ghost known="Try the budget planner" textClassName="font-serif text-2xl text-ink" />
        <Sk className="h-64 w-full rounded-2xl" />
      </div>
    </Screen>
  );
}
