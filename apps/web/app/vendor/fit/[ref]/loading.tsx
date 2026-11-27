/**
 * /vendor/fit/[ref] — the wait before a supplier's fit check answers.
 *
 * Why: speed audit 2026-11-27, Group J. A tap showed nothing until the server answered (11 reads before paint).
 *
 * Shape: the page's 512 px column (`px-4 py-10`) → the supplier's identity frame, centred: the logo, "Fit check"
 * (the page always prints those words, so they show at once), the supplier's name (the visible heading — grey),
 * city · rating, the starting price → the action zone: one line of copy, the one main button, the quiet link.
 *
 * page.tsx can call notFound(); with this boundary that answer streams as HTTP 200 — acceptable on a private
 * link page, as on the 35 other routes that pair notFound() with a loader.
 */
import { Ghost, Screen, Sk, SkLine } from '@/components/skeletons';

export default function VendorFitLoading() {
  return (
    <Screen className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6">
      <div className="sn-frame flex flex-col items-center p-6 text-center">
        <Sk className="h-20 w-20 rounded-2xl" />
        <Ghost
          known="Fit check"
          className="mt-4 h-3.5 w-20 rounded"
          textClassName="mt-4 text-sn-md font-semibold leading-5 text-ink/60"
        />
        <Sk className="mt-2 h-8 w-3/5 rounded-md" />
        <Sk className="mt-2 h-3 w-2/5 rounded" />
        <Sk className="mt-3 h-4 w-1/3 rounded" />
      </div>
      <div className="mt-6 flex flex-col items-center">
        <SkLine w="w-4/5" />
        <SkLine w="w-3/5" className="mt-2" />
        <Sk className="mt-4 h-11 w-full rounded-md" />
        <Sk className="mt-3 h-3.5 w-40 rounded" />
      </div>
    </Screen>
  );
}
