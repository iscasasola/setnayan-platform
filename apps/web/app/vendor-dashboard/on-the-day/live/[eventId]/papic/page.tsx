import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import { isVendorPapicCaptureEnabled } from '@/lib/vendor-dayof-flags';
import { fetchVendorPapicAllowance } from '@/lib/vendor-papic-grants';
import { PapicCaptureController } from '../_components/papic-capture-controller';

export const metadata = { title: 'Papic capture · On the Day · Setnayan' };

/** PH wall-clock today (UTC+8) as 'YYYY-MM-DD'. */
function phToday(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default async function VendorPapicCapturePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const back = `/vendor-dashboard/on-the-day/live/${eventId}`;

  // Counsel gate — fail-closed. Until the DPO/NPC control is approved this route
  // never renders a camera.
  if (!(await isVendorPapicCaptureEnabled())) redirect(back);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`${back}/papic`)}`);
  }

  // Capture writes under the vendor's RLS client (the insert policy requires the
  // caller's OWN vendor profile + a booked event), so this surface is the vendor
  // owner/admin path. A per-event grantee views the console but can't capture.
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect(back);

  const booking =
    (await fetchVendorPoolBookings(supabase, profile.vendor_profile_id)).find(
      (b) => b.eventId === eventId,
    ) ?? null;
  if (!booking || booking.bookedDate !== phToday()) redirect(back);

  // Derive the tier + live capture-point allowance (service-role reads).
  const allowance = await fetchVendorPapicAllowance(
    createAdminClient(),
    profile.vendor_profile_id,
    eventId,
  );

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={back}
          className="inline-flex items-center gap-1.5 text-sm font-medium"
          style={{ color: 'var(--m-slate-2)' }}
        >
          <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Back to the floor
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: 'var(--m-slate-3)' }}>
          Papic capture
        </span>
      </div>

      <PapicCaptureController
        eventId={eventId}
        coupleName={booking.eventName ?? 'this event'}
        tier={allowance.tier}
        allowVideo={allowance.allowVideo}
        pointsCap={allowance.pointsCap}
        pointsSpent={allowance.pointsSpent}
      />
    </section>
  );
}
