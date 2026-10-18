/**
 * /dev/spotlight-lab — 🔦 the spotlight tours on the REAL screens, on fixture data: no sign-in, no
 * database. DEV-ONLY: production builds 404 every page under it (`[[...page]]/page.tsx`).
 *
 * The layout holds the tour and a REAL bottom bar (`BottomNav` in the anchored `BottomDock`), so a
 * tap on a lit tab walks to the next lab page and the ring glides on — exactly as the role layouts
 * carry it in the app. The labs' own stand-in docks are hidden here.
 *
 *   /dev/spotlight-lab            the events board's "New event" (host, step 1)
 *   /home · /guests · /vendors    Home (`/dev/home-lab`), Guests (`/dev/guests-lab?part=screen`),
 *                                 Suppliers (`/dev/suppliers-lab`) — host steps 2–8
 *   /launch                       a stand-in Maker shell: the tour waits under it
 *   /day · /after                 the event day and Post Event on Home — the day tour
 *   /vendor-dashboard · /shop · /customers   the supplier's Today, Shop and Customers
 *
 *   ?step=N   start at step N (1-based) — a walk's shortcut; it writes the tour's progress first.
 */
import { notFound } from 'next/navigation';
import { TOURS } from '@/lib/tours';
import { LabSpotlight } from './lab-spotlight';

async function labComplete(): Promise<void> {
  'use server';
  /* A lab records nothing. */
}

export default function SpotlightLabLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <>
      <style>{'[data-bottom-dock]:has([data-lab-dock]){display:none!important}'}</style>
      {children}
      <LabSpotlight
        host={TOURS.host_spotlight_v1.spotlight!}
        day={TOURS.host_day_spotlight_v1.spotlight!}
        supplier={TOURS.supplier_spotlight_v1.spotlight!}
        completeAction={labComplete}
      />
    </>
  );
}
