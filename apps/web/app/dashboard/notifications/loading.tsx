/* Loading shell for dashboard/notifications.
 *
 * Was a bare `export { ListPageSkeleton }` — generic pulsing blocks with no
 * "what we're doing" cue, so a quick load read as "no load" (owner 2026-06-07,
 * customer report). This mirrors the actual page (back link + header + a few
 * notification rows) and adds the branded <LoadingNarration> strip so any wait
 * is clearly visible + on-brand. The page itself fetches auth + the
 * notifications list, so this is a real Suspense fallback (not dead weight). */
import { Screen, Sk, SkLine } from '@/components/skeletons';
import { LoadingNarration } from '@/components/loading-status';

export default function NotificationsLoading() {
  return (
    <Screen label="Loading notifications" className="">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Back link */}
        <Sk className="mb-4 h-7 w-32 rounded-md" />
        {/* Header (title + subtitle) */}
        <div className="mb-6 space-y-2">
          <Sk className="h-9 w-52 max-w-full rounded-lg" />
          <SkLine w="w-80" className="max-w-full" />
        </div>
        {/* Branded "what we're doing" strip */}
        <LoadingNarration
          className="mb-6 justify-start"
          messages={[
            'Loading your notifications…',
            'Checking for new messages and updates…',
          ]}
        />
        {/* Notification rows */}
        <ul className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-xl border border-ink/10 bg-cream p-4"
            >
              <Sk className="mt-0.5 h-5 w-16 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <SkLine w="w-2/3" />
                <SkLine w="w-1/2" />
                <SkLine w="w-20" className="opacity-70" />
              </div>
              <Sk className="h-7 w-14 shrink-0 rounded-md" />
            </li>
          ))}
        </ul>
      </div>
    </Screen>
  );
}
