/**
 * /onboarding/simple — the Simple Event setup (a name and a date), while the server answers.
 *
 * WHY: the speed audit of 2026-11-27 (Group J) found a tap here showed nothing until the server answered —
 * 5 reads in 5 steps before paint (the account, the type's row and profile, the setup engine, the services step).
 *
 * SHAPE: the page's own column (`max-w-xl`, `py-10`) — the SETNAYAN wordmark, "‹ Back" (the page's own words, shown
 * at once), the heading and its line (which heading depends on the setup engine, so it stays grey), the two labelled
 * boxes (Event name, Date), then the Create event / Cancel row.
 */
import { Ghost, Screen, Sk } from '@/components/skeletons';

export default function SimpleOnboardingLoading() {
  return (
    <Screen className="mx-auto w-full max-w-xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <Sk className="h-3.5 w-24 rounded" />
        <Ghost
          known="‹ Back"
          className="h-3 w-12 rounded"
          textClassName="min-h-4 font-mono text-sn-sm uppercase leading-4 tracking-widest text-ink/50"
        />
        <Ghost className="h-9 w-64 max-w-full rounded-md" />
        <Sk className="h-4 w-full rounded" />
      </header>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Sk className="h-3.5 w-24 rounded" />
          <Sk className="h-11 w-full rounded-md" />
        </div>
      ))}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Sk className="h-11 w-full rounded-md sm:w-36" />
        <Sk className="h-11 w-full rounded-md sm:w-28" />
      </div>
    </Screen>
  );
}
