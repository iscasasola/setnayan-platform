/**
 * /papic/pool — everyone's photos (the shared pool gallery), while the server answers.
 *
 * Why: speed audit 2026-11-27 marked it ⓛ: no loading boundary at or above it and about 4 reads before paint, so a
 * tap showed nothing until the server answered.
 *
 * Shape it mirrors (page.tsx + pool-grid.tsx): `bg-cream` page, a `max-w-2xl` column → "Back to my photos" → the
 * heading (it carries the event's name, so it is grey here) → two lines of help → the square photo grid, 3 across
 * on a phone and 6 on a wide screen.
 *
 * page.tsx can call notFound(); with this boundary that answer streams as HTTP 200 — acceptable on a private page,
 * as on the 35 other routes that pair notFound() with a loader.
 */
import { Ghost, Screen, Sk } from '@/components/skeletons';

export default function PapicPoolLoading() {
  return (
    <Screen className="min-h-screen bg-cream px-4 py-8 text-ink">
      <div className="mx-auto w-full max-w-2xl">
        <Ghost
          known="Back to my photos"
          textClassName="mb-4 py-3 text-sm font-medium leading-5 text-ink/70"
        />
        <Ghost className="h-8 w-64 max-w-full rounded-md" />
        <Sk className="mt-3 h-3.5 w-full rounded" />
        <Sk className="mt-2 h-3.5 w-3/5 rounded" />
        <ul className="mt-6 grid grid-cols-3 gap-2 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <li key={i}>
              <Sk className="aspect-square w-full rounded-lg" />
            </li>
          ))}
        </ul>
      </div>
    </Screen>
  );
}
