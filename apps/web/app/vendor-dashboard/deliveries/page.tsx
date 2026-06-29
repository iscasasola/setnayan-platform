import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRight, PackageCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

export const metadata = { title: 'Deliveries' };

type BookingRow = {
  event_vendor_id: string;
  event_label: string;
  service_title: string;
  delivered: number;
};

export default async function DeliveriesIndexPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const { data } = await supabase.rpc('list_vendor_delivery_bookings');
  const bookings = (data ?? []) as BookingRow[];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <PackageCheck className="h-6 w-6 text-terracotta" /> Deliveries
        </h1>
        <p className="text-sm text-ink/60">
          For services you mark as delivered per guest, scan each guest&rsquo;s QR
          at the event to confirm hand-off. Operational only — you see a count,
          never guest details.
        </p>
      </header>

      {bookings.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-ink/20 bg-ink/[0.02] p-6 text-center">
          <p className="text-sm font-medium text-ink">No per-guest delivery services yet</p>
          <p className="mx-auto mt-1 max-w-prose text-sm text-ink/60">
            Turn on &ldquo;delivered per guest&rdquo; on a service (in{' '}
            <Link href="/vendor-dashboard/services" className="text-terracotta hover:underline">
              Services
            </Link>
            ) and its event bookings will show up here with a scan station.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {bookings.map((b) => (
            <li key={b.event_vendor_id}>
              <Link
                href={`/vendor-dashboard/deliveries/${b.event_vendor_id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-cream px-4 py-3 transition hover:border-terracotta"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-ink">{b.event_label}</p>
                  <p className="truncate text-xs text-ink/55">{b.service_title}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-sm tabular-nums text-ink/70">
                    {b.delivered} given
                  </span>
                  <ChevronRight className="h-4 w-4 text-ink/30" strokeWidth={1.75} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
