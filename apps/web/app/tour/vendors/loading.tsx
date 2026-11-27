/**
 * /tour/vendors — the sample wedding's supplier shortlist and chat, while the server answers.
 *
 * Why: speed audit 2026-11-27 marked it ⓛ: no loading boundary at or above it and about 3 reads before paint, so a
 * tap showed nothing until the server answered. The tour layout's sample-wedding note stays on screen above this.
 *
 * Shape it mirrors (page.tsx): a `max-w-5xl` column → the centred header (the heading "The AI did the hard part" +
 * two lines) → the shortlist of supplier cards → "One tap, and you’re talking" with the sample chat. The heading and
 * the chat's name are fixed words in the page, so they show at once; the suppliers are not known here.
 */
import { Ghost, Screen, Sk } from '@/components/skeletons';

export default function TourVendorsLoading() {
  return (
    <Screen className="mx-auto w-full max-w-5xl px-5 pb-20 pt-12 sm:pt-16">
      <div className="mx-auto max-w-2xl text-center">
        <Ghost known="The AI did the hard part" textClassName="mt-3 font-serif text-4xl leading-tight tracking-tight text-ink !whitespace-normal sm:text-5xl" />
        <Sk className="mx-auto mt-4 h-4 w-full max-w-xl rounded" />
        <Sk className="mx-auto mt-2 h-4 w-3/4 rounded" />
      </div>

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="sn-frame space-y-3 p-3">
            <Sk className="h-36 w-full rounded-xl" />
            <Sk className="h-3.5 w-3/4 rounded" />
            <Sk className="h-3 w-1/2 rounded" />
          </div>
        ))}
      </div>

      <div className="mx-auto mt-16 max-w-2xl text-center">
        <Ghost known="One tap, and you’re talking" textClassName="mt-2 font-serif text-3xl text-ink !whitespace-normal" />
        <Sk className="mx-auto mt-3 h-4 w-full max-w-lg rounded" />
        <Sk className="mt-6 h-72 w-full rounded-2xl" />
      </div>
    </Screen>
  );
}
