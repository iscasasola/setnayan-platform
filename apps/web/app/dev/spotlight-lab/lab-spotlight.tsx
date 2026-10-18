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

function roleOf(path: string): 'host' | 'day' | 'supplier' {
  const seg = path.slice(L.length).split('/').filter(Boolean)[0] ?? '';
  if (seg === 'day' || seg === 'after') return 'day';
  if (seg === 'vendor-dashboard' || seg === 'shop' || seg === 'customers') return 'supplier';
  return 'host';
}

const KEY: Record<'host' | 'day' | 'supplier', TourKey> = {
  host: 'host_spotlight_v1',
  day: 'host_day_spotlight_v1',
  supplier: 'supplier_spotlight_v1',
};

export function LabSpotlight({
  host,
  day,
  supplier,
  completeAction,
}: {
  host: SpotlightScript;
  day: SpotlightScript;
  supplier: SpotlightScript;
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
  const script = role === 'host' ? host : role === 'day' ? day : supplier;
  return (
    <>
      {role === 'day' ? null : (
        <BottomDock>
          <BottomNav items={role === 'supplier' ? SUPPLIER : HOST} />
        </BottomDock>
      )}
      {ready ? <SpotlightMount key={role} tourKey={KEY[role]} script={script} seen={false} replay completeAction={completeAction} /> : null}
    </>
  );
}
