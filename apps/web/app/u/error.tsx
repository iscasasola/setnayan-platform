'use client';

/**
 * A person page that could not be read (final check A1-070). `resolvePublicProfile` throws `PublicProfileReadError`
 * on a refused read rather than answering "no such profile", so this boundary says so in the page's own words with a
 * Try again, instead of the root boundary's generic "something went wrong".
 *
 * 🔁 Try again re-asks the server: in Next 15 `reset()` alone re-renders the failed page the browser already holds, so
 * the press runs `router.refresh()` and `reset()` together (the same reason as `app/[slug]/error.tsx`).
 */
import { startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCw } from 'lucide-react';
import { ErrorState } from '@/app/_components/states/error-state';
import { actionButtonClass } from '@/components/action-button-class';

export default function PersonPageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  return (
    <main className="mx-auto w-full max-w-md px-4 pb-10 pt-6" data-person-unread="">
      <ErrorState
        title="Couldn’t read this profile"
        broke="This person’s page did not load just now."
        survived="Their profile and yours are unchanged."
        todo="Try again in a moment."
        actions={
          <button
            type="button"
            className={actionButtonClass('neutral')}
            onClick={() =>
              startTransition(() => {
                // one-render: keep (retry) — the page failed to render; this asks for it once more. No write came before it.
                router.refresh();
                reset();
              })
            }
          >
            <RotateCw aria-hidden strokeWidth={1.9} />
            <span className="lbl">Try again</span>
          </button>
        }
      />
    </main>
  );
}
