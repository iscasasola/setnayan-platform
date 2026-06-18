import { Camera } from 'lucide-react';
import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventPapicGuestActive, fetchGuestQuota } from '@/lib/papic-guest';
import { PapicGuestCapture } from './_components/papic-guest-capture';

// Papic · guest camera (PAPIC_GUEST · ₱2,999 — "Every guest's phone, a candid
// camera"). The public guest-camera surface: a guest who has redeemed their
// invite carries a setnayan_guest_session cookie (guest_id + event_id); this
// page reads it, confirms the event owns the Premium Guest Camera Pack, and
// hands the guest a browser camera with their per-guest 150-credit quota.
//
// No sign-in, no app install — the cookie is the identity. Capture goes through
// POST /api/papic/guest-capture (server-side R2 PUT + the quota-enforcing
// papic_record_guest_capture RPC), so nothing here trusts the client for the
// credit cap. Admin client because this is a public surface with no RLS session.

export const dynamic = 'force-dynamic';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4 py-12 text-ink">
      <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-surface p-7 text-center shadow-sm">
        <Camera aria-hidden className="mx-auto h-7 w-7 text-terracotta" strokeWidth={1.75} />
        {children}
      </div>
    </main>
  );
}

export default async function PapicGuestPage() {
  const session = await readGuestSession();

  if (!session) {
    return (
      <Shell>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Open your invitation first</h1>
        <p className="mt-2 text-sm text-ink/65">
          Scan your personal QR or open your invite link, then come back here to
          start shooting candids for the couple.
        </p>
      </Shell>
    );
  }

  const admin = createAdminClient();

  const owns = await eventPapicGuestActive(admin, session.event_id);
  if (!owns) {
    return (
      <Shell>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Guest cameras aren&rsquo;t on yet</h1>
        <p className="mt-2 text-sm text-ink/65">
          The couple hasn&rsquo;t turned on guest cameras for this wedding. Sit
          back and enjoy the celebration!
        </p>
      </Shell>
    );
  }

  const [{ data: ev }, { data: g }, quota, { data: liveEnrollment }] = await Promise.all([
    admin.from('events').select('display_name').eq('event_id', session.event_id).maybeSingle(),
    admin
      .from('guests')
      .select('first_name, display_name, ugc_terms_accepted_at')
      .eq('guest_id', session.guest_id)
      .maybeSingle(),
    fetchGuestQuota(admin, session.event_id, session.guest_id),
    // Active face enrollment? Drives the in-camera "add your face" fallback for
    // the guest who skipped the optional RSVP selfie.
    admin
      .from('guest_face_enrollments')
      .select('id')
      .eq('event_id', session.event_id)
      .eq('guest_id', session.guest_id)
      .is('revoked_at', null)
      .maybeSingle(),
  ]);

  const guestName =
    (g?.first_name as string | null) || (g?.display_name as string | null) || 'friend';
  const eventName = (ev?.display_name as string | null) || 'the wedding';

  // UGC moderation gate (Apple 1.2 / Google Play UGC): a guest can't be blocked
  // from this event's gallery and must have accepted the objectionable-content
  // terms before their first upload. The terms checkbox is shown when this is
  // null; the block short-circuits the whole surface.
  const termsAccepted = Boolean(
    (g as { ugc_terms_accepted_at?: string | null } | null)?.ugc_terms_accepted_at,
  );

  const { data: blockRow } = await admin
    .from('event_blocked_users')
    .select('id')
    .eq('event_id', session.event_id)
    .eq('blocked_guest_id', session.guest_id)
    .maybeSingle();

  if (blockRow) {
    return (
      <Shell>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Camera unavailable</h1>
        <p className="mt-2 text-sm text-ink/65">
          The couple has turned off your guest camera for this wedding. Photos
          already shared remain in their gallery. If you think this is a
          mistake, reach out to the couple directly.
        </p>
      </Shell>
    );
  }

  return (
    <PapicGuestCapture
      guestName={guestName}
      eventName={eventName}
      initialRemaining={quota.remaining}
      total={quota.total}
      termsAccepted={termsAccepted}
      needsFaceEnroll={!liveEnrollment}
    />
  );
}
