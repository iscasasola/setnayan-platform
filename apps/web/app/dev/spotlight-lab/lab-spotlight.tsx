'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { BookUser, Grip, House, AppWindow, Store, Sun, Users, Briefcase } from 'lucide-react';
import { BottomDock, BottomNav } from '@/app/_components/nav/bottom-nav';
import type { BottomNavItem } from '@/app/_components/nav/types';
import { SpotlightMount } from '@/app/_components/spotlight-mount';
import type { SpotlightScript, TourKey } from '@/lib/tours';

const L = '/dev/spotlight-lab';

const HOST: BottomNavItem[] = [
  { key: 'home', label: 'Home', href: `${L}/home`, icon: House, activeMatch: `${L}/home` },
  { key: 'guests', label: 'Guests', href: `${L}/guests`, icon: BookUser, activeMatch: `${L}/guests` },
  { key: 'vendors', label: 'Suppliers', href: `${L}/vendors`, icon: Store, activeMatch: `${L}/vendors` },
  { key: 'launch', label: 'Hub', href: `${L}/launch`, icon: AppWindow, activeMatch: `${L}/launch` },
  { key: 'more', label: 'More', href: `${L}/home`, icon: Grip, activeMatch: `${L}/more` },
];
const SUPPLIER: BottomNavItem[] = [
  { key: 'today', label: 'Today', href: `${L}/vendor-dashboard`, icon: Sun, activeMatch: `${L}/vendor-dashboard` },
  { key: 'customers', label: 'Customers', href: `${L}/customers`, icon: Users, activeMatch: `${L}/customers` },
  { key: 'shop', label: 'Shop', href: `${L}/shop`, icon: Briefcase, activeMatch: `${L}/shop` },
  { key: 'more', label: 'More', href: `${L}/vendor-dashboard`, icon: Grip, activeMatch: `${L}/more` },
];

type Role = 'host' | 'day' | 'supplier' | 'shop-tour' | 'dates-tour' | 'money-tour';

function roleOf(path: string): Role {
  const seg = path.slice(L.length).split('/').filter(Boolean)[0] ?? '';
  if (seg === 'day' || seg === 'after') return 'day';
  if (seg === 'vendor-dashboard' || seg === 'shop' || seg === 'customers') return 'supplier';
  // 🔦 The supplier page tours (owner 2026-10-22) on their real lab screens — the Hub has no lab.
  if (seg === 'shop-tour' || seg === 'dates-tour' || seg === 'money-tour') return seg;
  return 'host';
}

const KEY: Record<Role, TourKey> = {
  host: 'host_spotlight_v1',
  day: 'host_day_spotlight_v1',
  supplier: 'supplier_spotlight_v1',
  'shop-tour': 'vendor_shop_v1',
  'dates-tour': 'vendor_dates_v1',
  'money-tour': 'vendor_money_v1',
};

export function LabSpotlight({
  host,
  day,
  supplier,
  pages,
  completeAction,
}: {
  host: SpotlightScript;
  day: SpotlightScript;
  supplier: SpotlightScript;
  /** Shop · Dates · Money page tours, keyed by lab role. */
  pages: Record<'shop-tour' | 'dates-tour' | 'money-tour', SpotlightScript>;
  completeAction: (k: TourKey) => Promise<void>;
}) {
  const path = usePathname() ?? L;
  const q = useSearchParams();
  const role = roleOf(path);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const step = Number(q?.get('step') ?? '');
    if (step > 0) {
      try {
        window.localStorage.setItem(`setnayan.spotlight.${KEY[role]}`, String(step - 1));
      } catch {
        /* private mode */
      }
    }
    setReady(true);
    // Once per load — the tour carries itself from here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const script = role === 'host' ? host : role === 'day' ? day : role === 'supplier' ? supplier : pages[role];
  return (
    <>
      {role === 'day' ? null : (
        <BottomDock>
          <BottomNav items={role === 'host' ? HOST : SUPPLIER} />
        </BottomDock>
      )}
      {ready ? <SpotlightMount key={role} tourKey={KEY[role]} script={script} seen={false} replay completeAction={completeAction} /> : null}
    </>
  );
}
