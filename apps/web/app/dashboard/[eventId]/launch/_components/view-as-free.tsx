'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import { EyeOff } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import {
  VIEW_AS_FREE_HELP,
  VIEW_AS_FREE_ON_LABEL,
  VIEW_AS_FREE_STOP_LABEL,
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
 * owner can never mistake the free view for his own page. A full-width BAR, not
 * a quiet strip (owner 2026-09-28, via the controller: *"too easy to miss — make
 * it a clear bar reading 'You're seeing the free version' with a prominent
 * 'Back to Pro' button"*). The why sits behind ⓘ.
 */
export function ViewAsFreeStrip() {
  const setViewAsFree = useViewAsFreeToggle();
  return (
    <div
      role="status"
      data-maker-view-as-free=""
      className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-mulberry bg-mulberry/15 px-3 py-1.5 text-[14px] text-ink"
    >
      <span className="inline-flex min-w-0 items-center gap-2 font-semibold">
        <EyeOff aria-hidden className="h-5 w-5 shrink-0 text-mulberry" strokeWidth={2} />
        <InfoTip label={VIEW_AS_FREE_ON_LABEL} ariaLabel="About the free version">
          {VIEW_AS_FREE_HELP}
        </InfoTip>
      </span>
      <button
        type="button"
        onClick={() => setViewAsFree(false)}
        data-maker-view-as-free-stop=""
        className="sn-press inline-flex min-h-11 shrink-0 items-center rounded-full bg-mulberry px-4 text-[14px] font-semibold text-cream hover:bg-mulberry-600"
      >
        {VIEW_AS_FREE_STOP_LABEL}
      </button>
    </div>
  );
}

/**
 * ⏱ THE SWITCH ENDS WITH THE MAKER (owner 2026-09-28, via the controller: it
 * "must switch itself off when the owner leaves the Maker"). Mounted by the
 * Maker shell for an internal viewer whenever the switch is ON:
 *
 *   · leaving by the app's own links unmounts the Maker → the cookie is cleared;
 *   · leaving the page any other way (a typed address, closing the tab) fires
 *     `pagehide` → the cookie is cleared;
 *   · a RELOAD of the Maker keeps it: the reload's request goes out before the
 *     old page hides, so it still carries the cookie, and this component writes
 *     it again as the Maker comes back.
 *
 * It renders nothing. It is a cookie in this browser only — nothing on the
 * server, no route, no action.
 */
export function ViewAsFreeKeeper() {
  useEffect(() => {
    const secure = window.location.protocol === 'https:';
    document.cookie = viewAsFreeCookieString(true, secure);
    const off = () => {
      document.cookie = viewAsFreeCookieString(false, secure);
    };
    window.addEventListener('pagehide', off);
    return () => {
      window.removeEventListener('pagehide', off);
      off();
    };
  }, []);
  return null;
}
