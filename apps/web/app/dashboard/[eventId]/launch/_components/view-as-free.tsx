'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { EyeOff } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import {
  VIEW_AS_FREE_HELP,
  VIEW_AS_FREE_ON_LABEL,
  viewAsFreeCookieString,
} from '@/lib/view-as-free';

/**
 * 👁 VIEW AS A FREE COUPLE — the Maker's switch and its "it is on" strip.
 *
 * Internal accounts only: `launch/page.tsx` hands the shell `viewAsFree` only
 * when `viewAsFreeSwitch()` says the viewer is internal, so nobody else is ever
 * drawn either half.
 *
 * The switch writes ONE cookie in this browser and asks the server for the page
 * again — no server action, no route, no column. Everything that changes is
 * decided server-side, per request, by `asViewed` (`lib/view-as-free.server.ts`).
 */
export function useViewAsFreeToggle(): (on: boolean) => void {
  const router = useRouter();
  return useCallback(
    (on: boolean) => {
      document.cookie = viewAsFreeCookieString(on, window.location.protocol === 'https:');
      router.refresh();
    },
    [router],
  );
}

/**
 * The state, said on the Maker itself for as long as the switch is on — so the
 * owner can never mistake the free view for his own page. One line, one way
 * out; the why sits behind ⓘ.
 */
export function ViewAsFreeStrip() {
  const setViewAsFree = useViewAsFreeToggle();
  return (
    <div
      role="status"
      data-maker-view-as-free=""
      className="flex shrink-0 items-center justify-between gap-3 border-b border-mulberry/25 bg-mulberry/10 px-3 py-1.5 text-[13px] text-ink"
    >
      <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold">
        <EyeOff aria-hidden className="h-4 w-4 shrink-0 text-mulberry" strokeWidth={2} />
        <InfoTip label={VIEW_AS_FREE_ON_LABEL}>{VIEW_AS_FREE_HELP}</InfoTip>
      </span>
      <button
        type="button"
        onClick={() => setViewAsFree(false)}
        data-maker-view-as-free-stop=""
        className="sn-press inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-[13px] font-semibold text-mulberry hover:bg-mulberry/10 lg:min-h-8"
      >
        Stop
      </button>
    </div>
  );
}
