import DashboardLayout from '@/app/dashboard/layout';

/**
 * `/dashboard` (Home) — the dashboard tree's gate, re-used, plus the add flow's slot.
 *
 * Home moved into `(hub)` on 18 Nov 2026 so it shares ONE layout with Discover (`app/(hub)/layout.tsx` — the top bar,
 * the rail and the account bar stay mounted across the tap; owner: *"yes, unify home and discover on fable"*). Leaving
 * `app/dashboard/` must not cost Home a single rule of that tree, so this renders the SAME `DashboardLayout` every
 * other `/dashboard/*` page wears — the sign-in redirect, the deleted-account sign-out, the Terms re-ask, the tours,
 * the anonymous-draft banner, the pending-inquiry replay — imported, never copied. 🛡 home-and-discover-share-one-layout.test.ts
 *
 * `modal` is the launcher's `@modal` slot, moved with it: `@modal/(.)create-event` intercepts a client navigation to
 * `/dashboard/create-event` from any `/dashboard` page and draws the real create-event page in a panel; `default.tsx`
 * (beside this file) is the main slot when the page under it is not Home (`create-event-opens-from-every-page.test.ts`).
 */
export default function HubDashboardLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <DashboardLayout>
      {children}
      {modal}
    </DashboardLayout>
  );
}
