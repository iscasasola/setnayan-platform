/**
 * Account NavGroup[] builder — the account-level customer doorway.
 *
 * The non-event customer surfaces (`/dashboard` picker, notifications, profile,
 * create-event) used to render the legacy `OuterDashboardHeader` — a near-empty
 * 240px rail. Owner 2026-06-20 ("universal style of side bar"): these pages now
 * adopt the same <SidebarShell> chrome as the event / vendor / admin doorways,
 * with account-scoped destinations instead of the event nav.
 *
 * ONE header-less group ('root', label: ''), five leaf items. No nesting — the
 * account surface is flat. Icons are all on the curated `lib/nav-icons.ts`
 * allowlist so the registry icon picker can render them.
 *
 * MY EVENTS sentinel matchPrefix — `__home__` prevents the strict-prefix branch
 * from firing. `/dashboard` is a prefix of every other account route
 * (/dashboard/notifications, /dashboard/profile, …), so without the sentinel
 * "My Events" would light on every account page. The sentinel keeps it lit only
 * on the exact `/dashboard` picker — same trick the customer "Home" item uses.
 *
 * Server-Component safe: neutral (non-'use client') module — both the client
 * AccountSidebar and any Server Component can import + call this.
 */

import { CalendarHeart, Bell, Settings, Store, Plus } from 'lucide-react';
import type { NavGroup } from '@/app/_components/nav/types';

export function buildAccountNavGroups(): NavGroup[] {
  return [
    {
      key: 'root',
      label: '', // header-less — SidebarSection skips the heading button
      defaultOpen: true,
      items: [
        {
          // Event picker. Sentinel matchPrefix so the strict-prefix branch
          // never fires (every other account route shares the /dashboard prefix).
          key: 'events',
          label: 'My Events',
          href: '/dashboard',
          icon: CalendarHeart,
          matchPrefix: '__home__',
        },
        {
          key: 'notifications',
          label: 'Notifications',
          href: '/dashboard/notifications',
          icon: Bell,
          matchPrefix: '/dashboard/notifications',
        },
        {
          key: 'profile',
          label: 'Profile & Settings',
          href: '/dashboard/profile',
          icon: Settings,
          matchPrefix: '/dashboard/profile',
        },
        {
          key: 'marketplace',
          label: 'Marketplace',
          href: '/explore',
          icon: Store,
          matchPrefix: '/explore',
        },
        {
          key: 'new-event',
          label: 'New event',
          href: '/dashboard/create-event',
          icon: Plus,
          matchPrefix: '/dashboard/create-event',
        },
      ],
    },
  ];
}
