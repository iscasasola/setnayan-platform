'use server';

import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enqueueDriveCopy, runDriveCopyBatch } from '@/lib/drive-copy';
import { screenCapture } from '@/lib/nsfw-screen';
import { ingestToWall } from '@/lib/live-wall';

// Papic · paparazzo (claimer) actions — the public photo-crew surface.
//
// These run under the SIGNED-IN FRIEND's session (not a couple), so they lean
// on the iteration-0012 RLS that gives a claimer rights on their OWN seat:
//   • paparazzi_seats_claimer_read — SELECT a seat where claimer = auth.uid()
//   • papic_photos_claimer_own      — INSERT/SELECT photos on a seat they
//     claimed (WITH CHECK also requires the seat is not revoked)
// and the SECURITY DEFINER papic_claim_seat() RPC (migration 20260718000000)
// for the claim itself (the seat isn't theirs yet, so RLS can't grant it —
// the token is the capability, auth.uid() is the claimer).
//
// SAFETY — nothing here runs on an always-rendered page; both actions are
// reached only from the token-gated /papic/claim + /papic/seat routes. Until
// migration 20260718000000 is applied, papic_claim_seat() is absent, so the
// claim action surfaces a friendly error rather than throwing.

type SeatClaimStatus =
  | 'claimed'
  | 'taken'
  | 'invalid'
  | 'unauthenticated'
  | string;

/**
 * Claim the seat a token points at for the signed-in friend. Calls the
 * SECURITY DEFINER papic_claim_seat() RPC and routes to the capture surface
 * on success, or back to the claim page with a state on taken/invalid.
 */
export async function claimPapicSeat(formData: FormData) {
  const rawToken = formData.get('token');
  const token = typeof rawToken === 'string' ? rawToken.trim() : '';
  if (!token) redirect('/dashboard');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/papic/claim/${token}`)}`);
  }

  const { data, error } = await supabase.rpc('papic_claim_seat', {
    p_token: token,
  });

  if (error) {
    // Missing RPC (pre-migration · 42883) or any failure → soft error state.
    redirect(`/papic/claim/${token}?state=error`);
  }

  const status = ((data ?? {}) as { status?: SeatClaimStatus }).status ?? 'error';

  switch (status) {
    case 'claimed':
      redirect(`/papic/seat/${token}`);
      break;
    case 'taken':
      redirect(`/papic/claim/${token}?state=taken`);
      break;
    case 'invalid':
      redirect(`/papic/claim/${token}?state=invalid`);
      break;
    case 'unauthenticated':
      redirect(`/login?next=${encodeURIComponent(`/papic/claim/${token}`)}`);
      break;
    default:
      redirect(`/papic/claim/${token}?state=error`);
  }
}

export type RecordSeatCaptureResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

/**
 * Record one captured photo for a claimed seat. The bytes are already in R2
 * (the client PUT them via /api/upload); this just writes the papic_photos
 * row under the claimer's session — RLS (papic_photos_claimer_own) permits the
 * insert because the friend claimed this seat and it isn't revoked.
 *
 * Returns the friend's new running capture count, or a soft error the capture
 * UI can show without crashing (never throws — the camera should keep working).
 */
export async function recordSeatCapture(
  token: string,
  r2ObjectKey: string,
  kind: 'photo' | 'clip' = 'photo',
): Promise<RecordSeatCaptureResult> {
  const cleanToken = token?.trim();
  const cleanKey = r2ObjectKey?.trim();
  if (!cleanToken || !cleanKey) return { ok: false, error: 'missing_input' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  // RLS (paparazzi_seats_claimer_read) only returns the row when this user is
  // the claimer — so resolving the seat by token doubles as the auth check.
  const { data: seat, error: seatError } = await supabase
    .from('paparazzi_seats')
    .select('seat_id, event_id, revoked_at, claimer_user_id')
    .eq('claim_qr_token', cleanToken)
    .maybeSingle();

  if (seatError) {
    if (seatError.code === '42P01' || seatError.code === '42703') {
      return { ok: false, error: 'unavailable' };
    }
    return { ok: false, error: 'lookup_failed' };
  }
  if (!seat || seat.claimer_user_id !== user.id) {
    return { ok: false, error: 'not_your_seat' };
  }
  if (seat.revoked_at) return { ok: false, error: 'revoked' };

  const { data: inserted, error: insertError } = await supabase
    .from('papic_photos')
    .insert({
      event_id: seat.event_id,
      paparazzi_seat_id: seat.seat_id,
      r2_object_key: cleanKey,
      photo_type: kind === 'clip' ? 'clip' : 'photo',
    })
    .select('photo_id')
    .single();

  if (insertError) {
    return { ok: false, error: insertError.message.slice(0, 80) };
  }
  const insertedPhotoId = (inserted?.photo_id as string) ?? null;

  // Always-on NSFW screen (Apple 1.2 filter · corpus hard constraint) — runs in
  // the BACKGROUND with after() so the camera stays responsive. The bytes are
  // already in R2 (client PUT via /api/upload), so the screen fetches them back
  // by the stored r2:// ref. Fail-open: any error leaves the row 'unscreened'.
  // Salamisim chain: screen FIRST (the wall is an allowlist — only 'clean'
  // projects), THEN run the wall gate. ingestToWall never throws; a non-clean
  // or non-LIVE_WALL event is a silent no-op.
  after(async () => {
    await screenCapture({ table: 'papic_photos', r2ObjectKey: cleanKey }).catch(() => {});
    if (insertedPhotoId) {
      // P2 FaceBlock bake between the screen and the wall gate: a FaceBlock
      // event requires the baked blur derivative before ingest admits the
      // row. Cheap no-op on non-FaceBlock events; FAILS CLOSED on any error.
      const { bakeFaceBlurForCapture } = await import('@/lib/face-blur');
      await bakeFaceBlurForCapture({
        table: 'papic_photos',
        sourceId: insertedPhotoId,
      });
      await ingestToWall('papic_photos', insertedPhotoId);
    }
  });

  // Auto-sync this capture into the couple's Google Drive (Phase 2), cron-free:
  // enqueue the artifact, then copy it in the BACKGROUND with after() so the
  // action returns immediately. No-op until the couple connects Drive;
  // best-effort (a sync hiccup never fails a capture); dedup is per
  // drive_copy_artifacts.r2_object_key. The manual "Release to Drive" backfills
  // anything a dropped background task missed.
  try {
    await enqueueDriveCopy({
      eventId: seat.event_id as string,
      artifactType: 'papic',
      files: [
        {
          r2ObjectKey: cleanKey,
          fileName: cleanKey.split('/').pop() || (kind === 'clip' ? 'papic.webm' : 'papic.jpg'),
          mimeType: kind === 'clip' ? 'video/webm' : 'image/jpeg',
          sourceTable: 'papic_photos',
        },
      ],
    });
    after(() =>
      runDriveCopyBatch({ eventId: seat.event_id as string }).catch(() => {}),
    );
  } catch {
    // best-effort
  }

  const { count } = await supabase
    .from('papic_photos')
    .select('photo_id', { count: 'exact', head: true })
    .eq('paparazzi_seat_id', seat.seat_id);

  return { ok: true, count: count ?? 0 };
}
