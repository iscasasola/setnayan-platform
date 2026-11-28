/**
 * /papic/decorate — a guest's photo decorator, while the server answers.
 *
 * Why: speed audit 2026-11-27 marked it ⓛ: no loading boundary at or above it and about 4 reads before paint, so a
 * tap showed nothing until the server answered.
 *
 * Shape it mirrors (kwento-decorator.tsx): `bg-cream` page, a `max-w-md` column → "Back to my photos" → the
 * heading "Decorate a photo" → one line of help → the big "Choose a photo" drop area. The back link and the heading
 * are fixed words, so they show at once; the help line names the event, which is not known here.
 */
import { Ghost, Screen, Sk } from '@/components/skeletons';

export default function PapicDecorateLoading() {
  return (
    <Screen className="min-h-screen bg-cream px-4 py-8 text-ink">
      <div className="mx-auto w-full max-w-md">
        <Ghost
          known="Back to my photos"
          textClassName="mb-4 py-3 text-sm font-medium leading-5 text-ink/70"
        />
        <Ghost known="Decorate a photo" textClassName="text-xl font-semibold tracking-tight" />
        <Sk className="mt-2 h-3.5 w-4/5 rounded" />
        <Sk className="mt-6 h-48 w-full rounded-2xl" />
      </div>
    </Screen>
  );
}
