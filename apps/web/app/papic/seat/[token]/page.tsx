import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CircleAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { asPapicStyle } from '@/lib/papic-photo-styles';
import { resolveFaceMode } from '@/lib/papic-face-mode';
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';
import { PapicSeatCapture } from './_components/papic-seat-capture';
import { CameraBridgePanel } from './_components/camera-bridge-panel';

// Papic · seat capture (public, claimer-only)
//
// A friend who has claimed a seat reaches this on their phone. The page
// validates — purely through RLS — that the signed-in user is THIS seat's
// claimer (paparazzi_seats_claimer_read returns the row only when claimer =
// auth.uid()), then hands off to the client camera. Captures write to
// papic_photos under the friend's own session (papic_photos_claimer_own).
//
// Token-gated; not reachable without a claim. Force-dynamic — per-request auth.

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ bridge?: string }>;
};

export default async function PapicSeatPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { bridge } = await searchParams;
  // Camera Bridge dark launch (build plan U1): mock-driven, no SKU active —
  // visible only via ?bridge=demo or the env flag, never by default.
  const bridgeEnabled =
    bridge === 'demo' || process.env.NEXT_PUBLIC_CAMERA_BRIDGE_ENABLED === 'true';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/papic/claim/${token}`);

  // RLS only returns the row if this user is the claimer — so this read is
  // both the lookup and the authorization. A non-claimer (or pre-claim) gets
  // null and is bounced to the claim page.
  const { data: seat, error } = await supabase
    .from('paparazzi_seats')
    .select('seat_id, event_id, seat_index, revoked_at, claimer_user_id')
    .eq('claim_qr_token', token)
    .maybeSingle();

  if (error || !seat || seat.claimer_user_id !== user.id) {
    redirect(`/papic/claim/${token}`);
  }

  if (seat.revoked_at) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream px-4 py-12 text-ink">
        <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-surface p-7 text-center shadow-sm">
          <CircleAlert aria-hidden className="mx-auto h-7 w-7 text-terracotta" strokeWidth={1.75} />
          <h1 className="mt-3 text-xl font-semibold tracking-tight">This seat was reissued</h1>
          <p className="mt-2 text-sm text-ink/65">
            The couple handed this seat to someone else. Ask them for a fresh
            claim link if you&rsquo;d still like to shoot.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex items-center justify-center rounded-md bg-ink/5 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-ink/10"
          >
            Back to Setnayan
          </Link>
        </div>
      </main>
    );
  }

  // Per-kind counts so the capture UI can show the running tally. Seats are
  // uncapped (caps passed as null below); any per-camera daily cap is enforced
  // server-side in recordSeatCapture + the presign route.
  // superseded_at IS NULL scopes the count to the CURRENT claimer — a reissued
  // seat starts clean (prior captures stay in the couple gallery, uncounted).
  // The locked event-wide look. The claimer isn't an event member, so events
  // is read on the admin client. Defensive: pre-migration the papic_style column
  // is absent → error (not throw) → asPapicStyle falls back to ORIG.
  const admin = createAdminClient();
  const [{ count: photoCount }, { count: clipCount }, { data: styleRow }] =
    await Promise.all([
      supabase
        .from('papic_photos')
        .select('photo_id', { count: 'exact', head: true })
        .eq('paparazzi_seat_id', seat.seat_id)
        .eq('photo_type', 'photo')
        .is('superseded_at', null),
      supabase
        .from('papic_photos')
        .select('photo_id', { count: 'exact', head: true })
        .eq('paparazzi_seat_id', seat.seat_id)
        .eq('photo_type', 'clip')
        .is('superseded_at', null),
      admin
        .from('events')
        .select('papic_style, papic_face_mode, event_type')
        .eq('event_id', seat.event_id as string)
        .maybeSingle(),
    ]);

  const eventStyle = asPapicStyle(
    (styleRow as { papic_style?: string } | null)?.papic_style,
  );
  // Face-tag mode gate (One-Pool spec §3.4). Fail-closed to mode_b: a
  // pre-migration DB (column absent → row read null) yields no embedding.
  const faceMode = resolveFaceMode(
    (styleRow as { papic_face_mode?: string | null } | null)?.papic_face_mode,
    (styleRow as { event_type?: string | null } | null)?.event_type,
  );

  // Geo-stamp gate (papic_geo_metadata, RA 10173). Resolved server-side so the
  // client only requests a location fix when the owner has activated the control;
  // the server re-gates on write (recordSeatCapture). Fail-closed → OFF by default.
  const geoEnabled = await isDataPrivacyControlActive('papic_geo_metadata');

  return (
    <>
      <PapicSeatCapture
        token={token}
        seatIndex={seat.seat_index as number}
        eventId={(seat.event_id as string) ?? ''}
        initialPhotos={photoCount ?? 0}
        initialClips={clipCount ?? 0}
        photoCap={null}
        clipCap={null}
        isAnon={Boolean(user.is_anonymous)}
        eventStyle={eventStyle}
        faceMode={faceMode}
        geoEnabled={geoEnabled}
      />
      {bridgeEnabled ? (
        <CameraBridgePanel
          token={token}
          seatIndex={seat.seat_index as number}
          eventId={(seat.event_id as string) ?? ''}
        />
      ) : null}
    </>
  );
}
