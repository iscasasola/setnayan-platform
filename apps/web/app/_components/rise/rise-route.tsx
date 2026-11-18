'use client';

/**
 * ⤴ A PAGE THAT RISES — the ONE `RiseScreen` around a page reached by a soft tap (owner 2026-11-10 *"fullscreen
 * everything"*; build-sessions/RISE-AUDIT-2026-11-13.md § H, batch 3).
 *
 * An intercepted route (`@rise/(.)<page>`) draws the SAME page inside this wrapper, over the page you were on, which
 * never unmounts — so ✕ falls back into the row you tapped and the page under it keeps its scroll. A hard load of the
 * URL is not intercepted and draws the full page, as it always did.
 *
 * Two Back entries, in order: `RiseScreen`'s own (✕ · Esc · the phone's Back pop it, then the fall plays), then the
 * route's — popped here with `router.back()` once the fall has finished. A tab re-tap closes the screen WITHOUT popping
 * ours (RiseScreen's `sn:tab-reselect`), so then both entries go at once (`history.go(-2)`) and the page under it is the
 * page again; a tab that navigates instead lands on its own page, and the slot's catch-all clears the slot.
 * 🔒 app/_components/rise/the-rise-screen-is-one-full-screen.test.ts § 7
 */
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { RiseScreen } from '@/app/_components/rise/rise-screen';

/** `useBackCloses`' mark on the history entry it pushes (lib/use-back-closes.ts). */
const LAYER_MARK = 'snLayer';

export function RiseRoute({ title, line, data, children }: { title: string; line?: string; data: string; children: ReactNode }) {
  const router = useRouter();
  const leave = () => {
    const st = window.history.state as Record<string, unknown> | null;
    // Our own entry is still on top: closed by a tab re-tap, not by ✕ / Back — step over both entries at once.
    if (st?.[LAYER_MARK]) window.history.go(-2);
    else router.back();
  };
  return (
    <RiseScreen title={title} line={line} onClose={leave} data={data}>
      {children}
    </RiseScreen>
  );
}
