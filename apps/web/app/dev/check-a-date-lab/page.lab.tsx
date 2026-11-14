/**
 * /dev/check-a-date-lab — 📅 CHECK A DATE OVER THE SHOP (SHOP-02 v7), on fixture data: no sign-in, no database.
 * DEV-ONLY: production builds 404 this route (`the-lab-never-ships.test.ts`). Draws the REAL sheet and calendar
 * (`CheckADateOverShopView`) over a drawn shop. Today is fixed at Nov 14, 2026; the shop and its closed days are samples.
 */
import { notFound } from 'next/navigation';

export default async function CheckADateLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  else {
    const { CheckADateLabClient } = await import('./lab-client');
    return <CheckADateLabClient />;
  }
}
