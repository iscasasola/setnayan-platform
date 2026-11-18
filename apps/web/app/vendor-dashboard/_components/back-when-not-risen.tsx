'use client';

import type { ReactNode } from 'react';
import { useRiseClose } from '@/app/_components/rise/rise-screen';

/**
 * ↩ THE BACK A RISEN PAGE NEEDS ONLY WHEN IT IS NOT RISEN (owner 16 Nov, DECISION_LOG "NEVER LOSE THE BACK BUTTON").
 *
 * Your details · Settings · Team open from the avatar as a rise (`@rise/(.)…`), and the rise already carries its ✕ and
 * returns in place. The SAME page body is drawn on a cold arrival (a deep link, a reload, the installed app opening
 * straight onto it) — and there it had no way back at all. This draws its children (the shipped `BackButton`) only
 * outside a `RiseScreen`, so a risen sheet never shows two ways out.
 * 🔒 app/vendor-dashboard/a-cold-arrival-has-a-back.test.ts
 */
export function BackWhenNotRisen({ children }: { children: ReactNode }) {
  return useRiseClose() ? null : <>{children}</>;
}
