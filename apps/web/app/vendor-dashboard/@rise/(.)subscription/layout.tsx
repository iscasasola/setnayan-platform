import type { ReactNode } from 'react';
import { RiseRoute } from '@/app/_components/rise/rise-route';
import { avatarRowWords } from '../../_components/supplier-avatar-rows';

/**
 * ⤴ The avatar sheet's "Plan" row, RISEN over the page you were on (build-sessions/RISE-AUDIT-2026-11-13.md § H, batch 3).
 * The screen is this LAYOUT, so it stands — and rises out of the row — the moment the tap lands; the page (and its own
 * loading skeleton) streams into it. Headed by the row's own words. A hard load of /vendor-dashboard/subscription is not
 * intercepted and draws the full page.
 */
export default function RisenPlanLayout({ children }: { children: ReactNode }) {
  const { label, sub } = avatarRowWords('plan');
  return (
    <RiseRoute title={label} line={sub} data="avatar-plan">
      {children}
    </RiseRoute>
  );
}
