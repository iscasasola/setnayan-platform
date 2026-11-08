'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 🎁 BADGE REWARD SWEEP — pays a newly earned badge's reward AFTER the badge page has drawn (8 Nov release gate).
 *
 * A page render never writes. The Shop and Performance renders used to call `grantOwedBadgeRewards` (a service-role
 * write of real Event Plus / Papic stock) inside `readBadgeRewardTracker`, before the page could draw. Now the render
 * only READS, and this asks the ONE paying door — `GET /api/vendor/badges?view=facts`, the same one Today's
 * `badge-earned-line.tsx` uses (owner 2026-11-05: *"where a newly earned badge pays its reward"*) — once per visit. So
 * the same visit pays the same reward, a beat later. Exactly once is the database's key, not this component.
 *
 * When this call paid something (`granted > 0` — rare: once per badge step, ever), the page redraws ONCE so the
 * reward shows on the badge row it was earned on. Otherwise nothing happens and nothing is drawn.
 */
export function BadgeRewardSweep({ url = '/api/vendor/badges?view=facts' }: { url?: string }) {
  const router = useRouter();
  useEffect(() => {
    let live = true;
    fetch(url, { credentials: 'same-origin', headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? (r.json() as Promise<{ granted?: number }>) : null))
      .then((j) => {
        if (!live || !j || typeof j.granted !== 'number' || j.granted <= 0) return;
        // one-render: keep (fetch) — it follows a `fetch()` to /api/vendor/badges that just paid a reward; redraw once to show it.
        router.refresh();
      })
      // A failed sweep pays nothing and shows nothing; the next visit (or Today) pays it.
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // Once per mount — the router is stable; the URL never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
