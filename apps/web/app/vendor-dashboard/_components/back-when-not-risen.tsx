'use client';

import type { ReactNode } from 'react';
import { useRiseClose } from '@/app/_components/rise/rise-screen';
import { useInRiseRoute } from '@/app/_components/rise/rise-route';

/**
 * ↩ THE BACK A RISEN PAGE NEEDS ONLY WHEN IT IS NOT RISEN (owner 16 Nov, DECISION_LOG "NEVER LOSE THE BACK BUTTON").
 *
 * Your details · Settings · Team open from the avatar as a rise (`@rise/(.)…`), and the rise already carries its ✕ and
 * returns in place. The SAME page body is drawn on a cold arrival (a deep link, a reload, the installed app opening
 * straight onto it) — and there it had no way back at all. This draws its children (the shipped `BackButton`) only
 * outside a `RiseScreen`, so a risen sheet never shows two ways out. A page risen as the centred DIALOG from 701 (`RiseRoute
 * page` — the card maker, Theft Watch, Track record; final check B8 · B15 · B16) is not a RiseScreen there, so the
 * route's own mark counts too: one piece for both frames.
 * 🔒 app/vendor-dashboard/a-cold-arrival-has-a-back.test.ts
 */
export function BackWhenNotRisen({ children }: { children: ReactNode }) {
  const inRiseRoute = useInRiseRoute();
  const outsideRise = useRiseClose() ? null : <>{children}</>;
  return inRiseRoute ? null : outsideRise;
}
