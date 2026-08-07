import { Camera } from 'lucide-react';
import Link from 'next/link';
import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventPapicGuestActive, fetchGuestQuota } from '@/lib/papic-guest';
import { guestCaptureGate, GUEST_CAPTURE_GATE_COLUMNS } from '@/lib/papic-guest-window';
import { eventKwentoEnabled } from '@/lib/kwento-access';
import { asPapicStyle } from '@/lib/papic-photo-styles';
import { resolveFaceMode } from '@/lib/papic-face-mode';
import { PapicGuestCapture } from './_components/papic-guest-capture';
import { PapicGuestBuyPanel } from '@/app/papic/_components/papic-guest-buy-panel';

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

export default async function PapicGuestPage({
  searchParams,
}: {
  searchParams?: Promise<{ papic_buy_error?: string }>;
}) {
  const buyError = (await searchParams)?.papic_buy_error ?? null;
  const session = await readGuestSession();

  if (!session) {
    return (
      <Shell>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Open your invitation first</h1>
        <p className="mt-2 text-sm text-ink/65">
          Scan your personal QR or open your invite link, then come back here to
          start shooting candids for the host.
        </p>
        {/* ⚠ THIS PAGE USED TO END HERE — a heading, a sentence, and nothing to
            press. It is reached from the day-of bar by exactly the people who do
            NOT have an invite (the cousin who scanned the poster at the venue),
            so the browser back button was their only way out on the wedding day. */}
        <Link
          href="/"
          className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-full border border-ink/20 px-5 text-sm font-medium text-ink transition-colors hover:bg-ink/[0.04]"
        >
          Back to Setnayan
        </Link>
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
      .select(`display_name, papic_face_mode, event_type, ${GUEST_CAPTURE_GATE_COLUMNS}`)
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

  // WHEN, as distinct from WHETHER (owner 2026-08-07). The check above asks if
  // this event has guest cameras at all; this one asks whether today is a day
  // they may be used. Default is the event day; the host has a button to open
  // them earlier.
  //
  // ⚠ This is a COURTESY, not the enforcement — the upload route runs the same
  // resolver and is what actually refuses. Showing a camera that would reject
  // every shot is how the seat cameras spent weeks telling photographers their
  // photos were saved.
  const gate = guestCaptureGate({
    earlyAllowed: (ev as { papic_guest_capture_early?: boolean | null } | null)
      ?.papic_guest_capture_early,
    eventDate: (ev as { event_date?: string | null } | null)?.event_date,
    windowStart: (ev as { papic_window_start?: string | null } | null)?.papic_window_start,
    windowEnd: (ev as { papic_window_end?: string | null } | null)?.papic_window_end,
  });
  if (gate.state !== 'open') {
    return (
      <Shell>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">
          {gate.state === 'not_open_yet'
            ? 'Guest cameras open on the day'
            : 'Guest cameras have closed'}
        </h1>
        <p className="mt-2 text-sm text-ink/65">
          {gate.state === 'not_open_yet' ? (
            <>
              Your camera for {eventName} switches on
              {gate.eventDay ? ` on ${gate.eventDay}` : ' on the day of the event'}.
              Your host can open it earlier if they&rsquo;d like shots of the
              preparations.
            </>
          ) : (
            <>
              Thanks for shooting at {eventName} — the cameras are closed now.
              Your photos are still in your gallery.
            </>
          )}
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
    <>
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
    {/* Guest "Add shots" doorway (owner-locked 2026-07-29), flag-dark behind
        NEXT_PUBLIC_PAPIC_GUEST_BUY — self-gates to null when off, so this page
        is byte-identical today. No seat token: this surface's identity is the
        signed setnayan_guest_session cookie, which the buy action re-reads. The
        guest camera shoots from the SHARED pool by definition, so only the pool
        rungs are on offer (canReloadOwnCamera stays false). */}
    {/* canReloadOwnCamera TRUE here since 2026-08-02: this surface has no seat,
        but the buy action mints the guest a camera of their own at purchase
        (paparazzi_seats.guest_id — the shape host-bought Limited cameras already
        use), so the "this camera only" rungs now have somewhere to land. Before
        this the event-site guest — the free-pool guest the owner asked about —
        could only top up the HOST's pool. */}
    <PapicGuestBuyPanel
      returnTo="/papic/guest"
      error={buyError}
      eventId={session.event_id}
      canReloadOwnCamera
    />
    </>
  );
}
