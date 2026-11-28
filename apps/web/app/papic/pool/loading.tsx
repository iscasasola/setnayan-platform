/**
 * /papic/pool — "Everyone's photos" while the server answers. The env / DPO gate and the couple's toggle are decided
 * by `./layout.tsx` before this streams, so a 404 is never sent as a 200 + skeleton.
 *
 * Shape it mirrors (page.tsx): `bg-cream` page, a `max-w-2xl` column → "Back to my photos" → the heading (it names the
 * event, not known here, so grey) → the fixed help line → the photo grid. Fixed words show at once.
 */
import { Ghost, Screen, Sk } from '@/components/skeletons';

export default function PapicPoolLoading() {
  return (
    <Screen className="min-h-screen bg-cream px-4 py-8 text-ink">
      <div className="mx-auto w-full max-w-2xl">
        <Ghost known="Back to my photos" textClassName="mb-4 py-3 text-sm font-medium leading-5 text-ink/70" />
        <Sk className="h-8 w-2/3 rounded" />
        <Ghost
          known="Every photo and clip the crew and guests have captured so far. Spot yourself? Tap I’m in this and the photo joins your Memories and download."
          textClassName="!whitespace-normal mt-2 text-sm text-ink/65"
        />
        <div className="mt-6 grid grid-cols-3 gap-1.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <Sk key={i} className="aspect-square w-full rounded-lg" />
          ))}
        </div>
      </div>
    </Screen>
  );
}
