'use client';

import { useEffect, useRef, useState } from 'react';
import { MOTION_TABLE } from '@/lib/motion-table';

/**
 * 📶 THE OFFLINE BAR (MOTION_STANDARD_2026-11-18 § 4 #28; drawing `motion_standard_2026-11-18_fable.html` Part H
 * "Offline bar"; owner 18 Nov "Add all 10" — "Nothing shared exists today").
 *
 * A slim bar on every screen when the connection drops: it slides in from the top in Quick on Settle and says so; when
 * the connection returns the words cross-fade to "Back online ✓", it stays a moment, and leaves in Quick. It takes no
 * tap and moves nothing under it. Reduced motion: appears and leaves at once.
 *
 * It is drawn ONLY after the browser has said `offline` on this page — never on load from `navigator.onLine` alone
 * (that flag is wrong often enough on a waking phone that a bar on every cold start would be a false alarm), and a
 * page that loaded offline says so through its own offline copy. Mounted once, in the root layout.
 * The look and the motion are `.sn-m-offline` in globals.css. 🔒 lib/the-moments-move-by-the-standard.test.ts
 */
export const OFFLINE_WORDS = "You're offline — changes will save when you're back";
export const BACK_ONLINE_WORDS = 'Back online ✓';

type Phase = 'hidden' | 'off' | 'back' | 'leaving';

export function OfflineBar() {
  const [phase, setPhase] = useState<Phase>('hidden');
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const clear = () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
    const off = () => {
      clear();
      setPhase('off');
    };
    const on = () => {
      clear();
      // Only a bar that is up can say "Back online".
      setPhase((p) => (p === 'off' ? 'back' : p));
      timers.current.push(
        window.setTimeout(() => setPhase((p) => (p === 'back' ? 'leaving' : p)), MOTION_TABLE.offlineBackStayMs),
        window.setTimeout(() => setPhase((p) => (p === 'leaving' ? 'hidden' : p)), MOTION_TABLE.offlineBackStayMs + MOTION_TABLE.offlineMs + 40),
      );
    };
    window.addEventListener('offline', off);
    window.addEventListener('online', on);
    return () => {
      clear();
      window.removeEventListener('offline', off);
      window.removeEventListener('online', on);
    };
  }, []);

  if (phase === 'hidden') return null;
  const back = phase === 'back' || phase === 'leaving';
  return (
    <div
      className="sn-m-offline"
      role="status"
      aria-live="polite"
      data-offline-bar={phase}
      data-back={back ? '' : undefined}
      data-leaving={phase === 'leaving' ? '' : undefined}
    >
      <span data-offline-words="off" aria-hidden={back}>
        {OFFLINE_WORDS}
      </span>
      <span data-offline-words="back" aria-hidden={!back}>
        {BACK_ONLINE_WORDS}
      </span>
    </div>
  );
}
