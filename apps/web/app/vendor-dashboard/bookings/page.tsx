import { ClipboardList } from 'lucide-react';
import { DashboardPlaceholder } from '@/app/_components/dashboard-placeholder';

export const metadata = { title: 'Bookings · Vendor' };

export default function VendorBookingsPage() {
  return (
    <DashboardPlaceholder
      Icon={ClipboardList}
      title="Your inbound bookings."
      blurb="Service requests from couples land here. Each row shows the event date, requested services, the couple's masked contact, and a status (new / quoted / accepted / declined). Accepted bookings flow into 0007 (couple’s budget) and your own earnings tracker."
      features={[
        'Inbox of new + in-progress requests, sortable by event date',
        'Quick-quote workflow — reply with a per-service price + total in one click',
        'Auto-decline cadence (e.g., outside service area, double-booked dates)',
        'Booking history with revenue per couple, sortable + exportable',
      ]}
    />
  );
}
