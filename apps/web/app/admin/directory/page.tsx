/**
 * /admin/directory — mobile overflow landing for the Directory group.
 *
 * WHY: CLAUDE.md 2026-05-23 row 2 admin doorway mobile lock — the directory
 * surfaces compress into a card grid behind the Directory bottom-nav tab.
 * Per [[feedback_setnayan_orphan_prevention]] every NavItem here maps 1:1
 * to a sidebar entry in apps/web/app/admin/_components/admin-sidebar.tsx
 * Directory group.
 */

import {
  Users,
  Briefcase,
  TestTube,
  CalendarDays,
  MapPin,
} from 'lucide-react';
import { MobileLandingGrid, type LandingItem } from '../_components/mobile-landing-grid';

export const metadata = { title: 'Directory · Admin' };

const DIRECTORY_ITEMS: LandingItem[] = [
  {
    key: 'users',
    label: 'Users',
    href: '/admin/users',
    icon: Users,
    description:
      'All accounts across customer, vendor, and admin roles. Issue comp grants, reset passwords, suspend.',
  },
  {
    key: 'vendors',
    label: 'Vendors',
    href: '/admin/vendors',
    icon: Briefcase,
    description:
      'Vendor profiles directory. Edit business details, override visibility, and review tier state.',
  },
  {
    key: 'demo-vendors',
    label: 'Demo vendors',
    href: '/admin/demo-vendors',
    icon: TestTube,
    description:
      'Demo / placeholder vendor records used for pilot showcase. Manage seeded entries here.',
  },
  {
    key: 'events',
    label: 'Events',
    href: '/admin/events',
    icon: CalendarDays,
    description:
      'All weddings on the platform with host roster, date, and venue. Drill into individual event state.',
  },
  {
    key: 'venues',
    label: 'Venues',
    href: '/admin/venues',
    icon: MapPin,
    description:
      'Venue directory. Add a new venue, edit existing, or open a venue page for review.',
  },
  // Wedding types + Wedding traditions moved to More → Platform (governance +
  // content, not record-lookup) per the ops-shaped nav redesign A.4.
];

export default function AdminDirectoryLanding() {
  return (
    <MobileLandingGrid
      title="Directory"
      subtitle="People and places on the platform. Search users, vendors, events, and venues."
      items={DIRECTORY_ITEMS}
    />
  );
}
