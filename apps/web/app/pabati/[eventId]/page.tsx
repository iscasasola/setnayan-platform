import { Video } from 'lucide-react';
import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventPabatiActive, fetchPabatiQuota } from '@/lib/pabati';
import { eventPapicActive } from '@/lib/papic-seats';
import { PabatiPrompt } from '@/app/[slug]/_components/pabati-prompt';

// Pabati · guest video-greeting recorder (PABATI · "Leave the couple a video
// greeting"). The standalone QR / share-link entry: a guest who has opened
// their invite carries a setnayan_guest_session cookie (guest_id + event_id);
// this page reads it, confirms the couple owns the active (admin-approved)
// Pabati pack, and hands the guest a browser camera+mic with the event's
// per-EVENT 300-clip quota.
//
// No sign-in, no app install — the cookie is the identity. Capture goes through
// POST /api/pabati/clip (server-side R2 PUT + the quota-enforcing
// pabati_record_clip RPC, with the 5-second hard cap + NSFW poster screen), so
// nothing here trusts the client for the cap. Admin client because this is a
// public surface with no RLS session.
//
// The [eventId] segment lets a QR/share link target the right event even if the
// guest hasn't opened a specific invite yet — but the cookie's event_id is the
// authoritative identity; a mismatch falls through to the "open your invitation"
// empty state (the recorder POSTs to the guest's own session event).

export const dynamic = 'force-dynamic';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4 py-12 text-ink">
      <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-surface p-7 text-center shadow-sm">
        <Video aria-hidden className="mx-auto h-7 w-7 text-mulberry" strokeWidth={1.75} />
        {children}
      </div>
    </main>
  );
}

export default async function PabatiGuestPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const session = await readGuestSession();

  if (!session) {
    return (
      <Shell>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Open your invitation first</h1>
        <p className="mt-2 text-sm text-ink/65">
          Scan your personal QR or open your invite link, then come back here to
          leave the couple a short video greeting.
        </p>
      </Shell>
    );
  }

  const admin = createAdminClient();

  // The cookie's event is the authoritative identity for the recorder (it POSTs
  // to the guest's own session). Gate on that event's PABATI ownership AND on
  // Papic being active — Pabati is a Papic ADD-ON, so it requires Papic set up
  // first (owner 2026-06-26). eventPapicActive counts bundle owners, so a
  // Complete/Unlock-all buyer is never wrongly blocked. Same friendly empty
  // state for both (the guest needn't know which gate is unmet).
  const active =
    (await eventPabatiActive(admin, session.event_id)) &&
    (await eventPapicActive(admin, session.event_id));
  if (!active) {
    return (
      <Shell>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">
          The video guestbook isn&rsquo;t on yet
        </h1>
        <p className="mt-2 text-sm text-ink/65">
          The couple hasn&rsquo;t turned on video greetings for this wedding. Sit
          back and enjoy the celebration!
        </p>
      </Shell>
    );
  }

  const [{ data: ev }, { data: g }, quota] = await Promise.all([
    admin.from('events').select('display_name').eq('event_id', session.event_id).maybeSingle(),
    admin
      .from('guests')
      .select('first_name, display_name')
      .eq('guest_id', session.guest_id)
      .maybeSingle(),
    fetchPabatiQuota(admin, session.event_id),
  ]);

  const guestName =
    (g?.first_name as string | null) || (g?.display_name as string | null) || 'friend';
  const eventName = (ev?.display_name as string | null) || 'the wedding';

  // eventId param is informational here (the share link's target); the cookie's
  // event is what the recorder records against. Referenced so the unused-var
  // lint stays quiet without changing the contract.
  void eventId;

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4 py-10 text-ink">
      <div className="w-full max-w-md">
        <PabatiPrompt
          guestName={guestName}
          eventName={eventName}
          initialRemaining={quota.remaining}
          total={quota.total}
        />
      </div>
    </main>
  );
}
