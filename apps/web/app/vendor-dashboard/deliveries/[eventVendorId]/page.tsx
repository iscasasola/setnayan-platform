import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, PackageCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { DeliveryDesk } from './_components/delivery-desk';

export const metadata = { title: 'Confirm deliveries' };

type Props = { params: Promise<{ eventVendorId: string }> };

type BookingRow = {
  event_vendor_id: string;
  event_label: string;
  service_title: string;
  delivered: number;
};

export default async function DeliveryScanPage({ params }: Props) {
  const { eventVendorId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  // The DEFINER list is the authorization gate: it only returns bookings the
  // caller's vendor org owns whose service has per_guest_delivery on. If the
  // requested booking isn't in it, the vendor isn't allowed (or it isn't a
  // delivery service) — bounce back to the index.
  const { data } = await supabase.rpc('list_vendor_delivery_bookings');
  const bookings = (data ?? []) as BookingRow[];
  const booking = bookings.find((b) => b.event_vendor_id === eventVendorId);
  if (!booking) redirect('/vendor-dashboard/deliveries');

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <Link
        href="/vendor-dashboard/deliveries"
        className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> All deliveries
      </Link>

      <header className="mt-3 space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <PackageCheck className="h-6 w-6 text-terracotta" /> {booking.service_title}
        </h1>
        <p className="text-sm text-ink/60">
          {booking.event_label} · scan each guest&rsquo;s QR as you hand off the
          item to confirm they received it. No names, no list — just the count.
        </p>
      </header>

      <div className="mt-5">
        <DeliveryDesk eventVendorId={eventVendorId} initialTotal={booking.delivered} />
      </div>
    </div>
  );
}
