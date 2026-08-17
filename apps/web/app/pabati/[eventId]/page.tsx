import { Video } from 'lucide-react';
import { DoorShell } from '@/app/_components/door/door-shell';
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

export default async function PabatiGuestPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const session = await readGuestSession();

  if (!session) {
    return (
            <DoorShell
        tone="dead_end"
        eyebrow={
          <>
            <Video aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Video guestbook
          </>
        }
        title="Open your invitation first."
        sub="Scan your personal QR or open your invite link, then come back here to leave the couple a short video greeting."
      />
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
            <DoorShell
        tone="dead_end"
        eyebrow={
          <>
            <Video aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Video guestbook
          </>
        }
        title="The video guestbook isn't on yet."
        sub="The couple hasn't turned on video greetings for this wedding. Sit back and enjoy the celebration!"
      />
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
