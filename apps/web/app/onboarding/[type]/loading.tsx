/**
 * /onboarding/[type] — the generic (non-wedding) setup wizard, while the server answers.
 *
 * WHY: the speed audit of 2026-11-27 (Group J) found a tap here showed nothing until the server answered —
 * 9 reads in 7 steps before paint (the type's vocab row and profile, the account, the tiles, the content spec, the
 * entrance check, the self facts, the services step).
 *
 * SHAPE: `GenericOnboarding`'s full screen on its first ("welcome") step — the header row (the ✕ ring and the
 * SETNAYAN wordmark), the thin progress bar across the page, the centred welcome (the type's emoji, the two-line
 * headline, the line under it — all the type's own, so grey), then the sticky bottom bar with Continue on the right.
 * The wedding wizard keeps its own loader (`onboarding/wedding/loading.tsx`).
 *
 * page.tsx can call notFound(); with this boundary that answer streams as HTTP 200 — acceptable on a private page,
 * as on the 35 other routes that pair notFound() with a loader. (The route is also `noindex`.)
 */
import { Ghost, Screen, Sk, SkCircle } from '@/components/skeletons';

export default function GenericOnboardingLoading() {
  return (
    <Screen className="flex min-h-screen flex-col bg-page">
      <header className="mx-auto flex w-full max-w-xl items-center gap-2 px-5 pb-3 pt-5">
        <SkCircle size="h-9 w-9" />
        <Sk className="h-3.5 w-24 rounded" />
      </header>
      <Sk className="h-1 w-full" />
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-3 px-5 py-10">
        <SkCircle size="mb-2 h-12 w-12" />
        <Ghost className="h-7 w-4/5 rounded-md" />
        <Sk className="h-7 w-3/5 rounded-md" />
        <Sk className="mt-2 h-4 w-2/3 rounded" />
      </div>
      <div className="sticky bottom-0">
        <div className="mx-auto flex w-full max-w-xl items-center justify-end gap-3 px-5 py-4">
          <Sk className="h-11 w-32 rounded-full" />
        </div>
      </div>
    </Screen>
  );
}
