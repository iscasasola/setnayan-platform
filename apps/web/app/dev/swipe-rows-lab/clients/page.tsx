/**
 * /dev/swipe-rows-lab/clients — the REAL Bookings prep-schedule rows (`bookings/_components/vendor-prep-add.tsx`) on
 * fixture items, for the swipe-to-delete screenshots (owner 2026-11-03). Dev only — 404s in production (first
 * statement); the swipe's Delete would call the shipped action, which refuses with no session.
 */
import { notFound } from 'next/navigation';
import { VendorPrepForBooking, type VendorPrepItem } from '@/app/vendor-dashboard/bookings/_components/vendor-prep-add';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';

const ITEMS: VendorPrepItem[] = [
  { itemId: 'lab-p1', dueDate: '2026-12-01', label: 'Send the shot list', notes: null, kind: 'task', amountPhp: null },
  { itemId: 'lab-p2', dueDate: '2026-12-08', label: 'Food tasting', notes: null, kind: 'meeting', amountPhp: null },
  { itemId: 'lab-p3', dueDate: '2026-12-15', label: 'Second payment', notes: null, kind: 'payment', amountPhp: 25000 },
];

export default function SwipeRowsClientsLab() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div className="mx-auto min-h-screen w-full max-w-xl bg-cream px-4 pb-32 pt-6 text-ink">
      <div className="sn-row overflow-hidden">
        <div className="border-t border-ink/10 px-4 py-3">
          <VendorPrepForBooking eventId="lab-event" vendorProfileId="lab-vendor" eventName="Ana & Ben" items={ITEMS} />
        </div>
      </div>
      <UndoToastHost />
    </div>
  );
}
