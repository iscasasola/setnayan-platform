import { Camera } from 'lucide-react';
import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventPapicGuestActive, fetchGuestQuota } from '@/lib/papic-guest';
import { eventKwentoEnabled } from '@/lib/kwento-access';
import { asPapicStyle } from '@/lib/papic-photo-styles';
import { resolveFaceMode } from '@/lib/papic-face-mode';
import { PapicGuestCapture } from './_components/papic-guest-capture';

// Papic · guest camera (PAPIC_GUEST — "Every guest's phone, a candid camera").
// This is the shared "Papic Pool" pass: unlimited guest phones draw from one
// shared shot pool, so nothing here is priced per-camera. The public
// guest-camera surface: a guest who has redeemed their invite carries a
// setnayan_guest_session cookie (guest_id + event_id); this page reads it,
// confirms the event owns the guest-camera pass, and hands the guest a browser
// camera with their per-guest quota.
//
// No sign-in, no app install — the cookie is the identity. Capture goes through
// POST /api/papic/guest-capture (server-side R2 PUT + the quota-enforcing
// papic_record_guest_capture RPC), so nothing here trusts the client for the
// credit cap. Admin client because this is a public surface with no RLS session.
//
// EVENT-TYPE NEUTRAL (Phase-0 gate 0g, access-scope verdict 2026-07-20): the
// flat pass (PAPIC_GUEST · "Papic Pool") opens beyond weddings, so no copy on
// this page may say "wedding" or assume a couple. Which types may be sold the
// pass is lib/papic-event-access.ts — this page does not decide it.

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
          start shooting candids for the host.
        </p>
      </Shell>
    );
  }

  const admin = createAdminClient();

  // De-wedded copy (Papic access-scope verdict 2026-07-20, Phase-0 gate 0g):
  // this surface is guest-facing on EVERY event type the Buong Araw pass opens
  // (debut · birthday · christening · gender reveal · graduation · personally
  // owned anniversary), so it must not say "wedding" or name an organizer role.
  // The event's OWN display name carries the specificity instead; the neutral
  // "this event" is the only fallback. Read in parallel with the ownership
  // check (same query count as before) so the not-yet-on branch can name the
  // event too.
  const [owns, { data: ev }] = await Promise.all([
    eventPapicGuestActive(admin, session.event_id),
    admin
      .from('events')
      .select('display_name, papic_face_mode, event_type')
      .eq('event_id', session.event_id)
      .maybeSingle(),
  ]);
  const eventName = (ev?.display_name as string | null) || 'this event';
  // Face-tag mode gate (One-Pool spec §3.4). Fail-closed to mode_b: a
  // pre-migration DB (column absent → null) yields no embedding on this camera.
  const faceMode = resolveFaceMode(
    (ev as { papic_face_mode?: string | null } | null)?.papic_face_mode,
    (ev as { event_type?: string | null } | null)?.event_type,
  );

  if (!owns) {
    return (
      <Shell>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Guest cameras aren&rsquo;t on yet</h1>
        <p className="mt-2 text-sm text-ink/65">
          Guest cameras haven&rsquo;t been turned on for {eventName} yet. Sit
          back and enjoy the celebration!
        </p>
      </Shell>
    );
  }

  const [
    { data: g },
    quota,
    { data: liveEnrollment },
    canKwento,
    { data: styleRow },
  ] = await Promise.all([
      admin
        .from('guests')
        // qr_token rides along so the Papic Challenges reward CTA can link the
        // guest into THEIR OWN Story maker (/papic/me/[token]) — resolved
        // server-side from the cookie session, never client-supplied.
        .select('first_name, display_name, ugc_terms_accepted_at, qr_token')
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
      // Kwento is a paid unlock — NEW EVENTS ONLY (grandfathered events stay
      // free; newer events need KWENTO directly or via a bundle). When the event
      // isn't enabled the composer must NOT show the "tell the story" prompt —
      // POST /api/papic/kwento 403s feature_not_owned, so an ungated prompt would
      // just silently fail. Mirror the server gate on the client.
      eventKwentoEnabled(admin, session.event_id),
      // Locked event-wide Papic look. Separate read (not folded into the event
      // select) so a pre-migration DB without papic_style can't break the
      // guest/event name above — asPapicStyle falls back to ORIG on a null.
      admin
        .from('events')
        .select('papic_style')
        .eq('event_id', session.event_id)
        .maybeSingle(),
    ]);

  const guestName =
    (g?.first_name as string | null) || (g?.display_name as string | null) || 'friend';
  const eventStyle = asPapicStyle(
    (styleRow as { papic_style?: string } | null)?.papic_style,
  );

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
          Your guest camera for {eventName} has been turned off. Photos you
          already shared stay in the gallery. If you think this is a mistake,
          reach out to the host directly.
        </p>
      </Shell>
    );
  }

  return (
    <PapicGuestCapture
      guestName={guestName}
      eventName={eventName}
      eventId={session.event_id}
      initialRemaining={quota.remaining}
      total={quota.total}
      termsAccepted={termsAccepted}
      needsFaceEnroll={!liveEnrollment}
      canKwento={canKwento}
      guestUnlimited={quota.unlimited}
      eventStyle={eventStyle}
      faceMode={faceMode}
      storyToken={((g as { qr_token?: string | null } | null)?.qr_token as string | null) ?? null}
    />
  );
}
