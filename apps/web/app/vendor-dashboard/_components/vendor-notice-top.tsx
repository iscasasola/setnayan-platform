'use client';

import { usePathname } from 'next/navigation';
import { NoticeSlot } from '@/app/_components/notices/notices';

/**
 * 🔔 The supplier pages' top slot (one notice system, owner approved 14 Nov 2026). A page has exactly ONE top slot, and
 * Today already draws its own under the photo (owner 13 Nov, `badge-earned-line.tsx`) — so the layout's stands down
 * there. Everywhere else in the supplier dashboard the top notices draw here, under the header.
 */
export function VendorNoticeTop() {
  const path = usePathname();
  if (path === '/vendor-dashboard') return null;
  return <NoticeSlot place="top" className="px-4 pt-3 sm:px-6" />;
}
