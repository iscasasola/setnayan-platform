'use server';

import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { enqueueDriveCopy, runDriveCopyBatch } from '@/lib/drive-copy';
import { screenCapture } from '@/lib/nsfw-screen';
import { ingestToWall } from '@/lib/live-wall';
import { eventSamplerIsKept } from '@/lib/papic-sampler';
import { parsePapicTagScan } from '@/lib/papic-tag';
import { autoTagCapture } from '@/lib/face-match';
import {
  PAPIC_SAMPLER_PHOTO_CAP,
  PAPIC_SAMPLER_CLIP_CAP,
  PAPIC_SAMPLER_RETENTION_DAYS,
  eventOwnsPapicSeats,
  papicSeatAnonEnabled,
} from '@/lib/papic-seats';

// Server-side 5-second clip cap (corpus constraint · not configurable). The
// client enforces 5s with a recorder timer; this tolerance (5.5s) absorbs
// MediaRecorder stop latency while still rejecting clips that are clearly long.
const CLIP_MAX_MS_SERVER_TOLERANCE = 5_500;

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
 * Resolve whether a claim token points at a CLAIMABLE seat — without an account.
 * Runs on the admin client because an unauthenticated visitor can't read
 * paparazzi_seats under RLS. Returns only a verdict (never seat data), and is
 * used solely to decide whether to mint a login-free anonymous session, so an
 * invalid/taken/reissued (or bot-prefetched) link never leaks an orphan anon
 * identity. Graceful-degrade: a missing/legacy table reads as 'invalid'.
 */
async function seatClaimability(
  token: string,
): Promise<'claimable' | 'taken' | 'invalid'> {
  try {
    const admin = createAdminClient();
    const { data: seat, error } = await admin
      .from('paparazzi_seats')
      .select('claimer_user_id, revoked_at')
      .eq('claim_qr_token', token)
      .maybeSingle();
    if (error || !seat) return 'invalid';
    if (seat.revoked_at) return 'invalid';
    if (seat.claimer_user_id) return 'taken';
    return 'claimable';
  } catch {
    return 'invalid';
  }
}

/**
 * Claim the seat a token points at and route to the capture surface. When the
 * login-free flag is ON, a friend with no account never sees a login wall: we
 * mint a Supabase NATIVE anonymous session (a real auth.uid()) right here — but
 * ONLY after confirming the token is a claimable seat, so a stale/taken/
 * prefetched link can't leak an orphan anon row. The minted uid satisfies the
 * authenticated-only papic_claim_seat() RPC and every claimer-keyed RLS policy
 * downstream, so nothing else changes. Flag OFF → unchanged /login bounce.
 */
export async function claimPapicSeat(formData: FormData) {
  const rawToken = formData.get('token');
  const token = typeof rawToken === 'string' ? rawToken.trim() : '';
  if (!token) redirect('/dashboard');

  const supabase = await createClient();
  let {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    if (papicSeatAnonEnabled()) {
      const claimability = await seatClaimability(token);
      if (claimability === 'taken') redirect(`/papic/claim/${token}?state=taken`);
      if (claimability !== 'claimable') {
        redirect(`/papic/claim/${token}?state=invalid`);
      }
      const { data: anon, error: anonError } =
        await supabase.auth.signInAnonymously();
      if (anonError || !anon.user) {
        console.error('[claimPapicSeat] anon sign-in failed:', anonError?.message);
        redirect(`/papic/claim/${token}?state=error`);
      }
      user = anon.user;
    } else {
      redirect(`/login?next=${encodeURIComponent(`/papic/claim/${token}`)}`);
    }
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
  | { ok: true; count: number; photoId: string | null }
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
  posterR2Key?: string,
  durationMs?: number,
): Promise<RecordSeatCaptureResult> {
  const cleanToken = token?.trim();
  const cleanKey = r2ObjectKey?.trim();
  // Poster frame (clips only) — the NSFW screen's image proxy for the video.
  const cleanPoster = kind === 'clip' ? posterR2Key?.trim() || null : null;
  if (!cleanToken || !cleanKey) return { ok: false, error: 'missing_input' };

  // Server-side 5-second clip cap (defense-in-depth · corpus hard constraint).
  // The client enforces it with a recorder timer, but the 5s cap must not rely
  // on the browser alone: a measured duration over the tolerance is rejected
  // here. Spoofable by a hostile direct caller, but raises the bar beyond
  // "client setTimeout only"; the tight per-object byte ceiling on the upload
  // presign (api/upload, papic seat branch) is the backstop against long clips.
  if (
    kind === 'clip' &&
    typeof durationMs === 'number' &&
    Number.isFinite(durationMs) &&
    durationMs > CLIP_MAX_MS_SERVER_TOLERANCE
  ) {
    return { ok: false, error: 'clip_too_long' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  // RLS (paparazzi_seats_claimer_read) only returns the row when this user is
  // the claimer — so resolving the seat by token doubles as the auth check.
  const { data: seat, error: seatError } = await supabase
    .from('paparazzi_seats')
    .select('seat_id, event_id, revoked_at, claimer_user_id, is_free_sampler')
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

  // Entitlement re-check (paid seats only). A claimed seat must not keep
  // accepting captures forever if the event's PAPIC_SEATS order was cancelled /
  // refunded / lapsed. Mirrors the guest disposable-camera path, which gates
  // every insert on ownership. Free-sampler seats are FREE — never gated.
  //
  // Read on the ADMIN client, not the friend's session: a claimer (esp. an
  // anonymous one) is NOT an event member, so the orders RLS read would return
  // nothing under their session and wrongly block every capture. Fail-OPEN on a
  // config/transient error (admin client unavailable) — a refunded event still
  // capturing is far better than the camera breaking for a paying couple.
  if (!seat.is_free_sampler) {
    let owned = true;
    try {
      const admin = createAdminClient();
      owned = await eventOwnsPapicSeats(admin, seat.event_id as string);
    } catch {
      owned = true; // fail-open — never break the camera on an entitlement read
    }
    if (!owned) return { ok: false, error: 'not_owned' };
  }

  // Free Papic sampler — per-seat caps (8 photos + 2 clips) + 30-day expiry.
  // Paid/normal seats are uncapped and permanent (expires_at stays null). The
  // count-then-check is fine here: one claimer = one phone per seat, so there's
  // effectively no concurrency on a single seat's shutter. superseded_at IS NULL
  // scopes the count to the CURRENT claimer — a reissued seat starts clean.
  let expiresAt: string | null = null;
  if (seat.is_free_sampler) {
    const { count: usedOfKind } = await supabase
      .from('papic_photos')
      .select('photo_id', { count: 'exact', head: true })
      .eq('paparazzi_seat_id', seat.seat_id)
      .eq('photo_type', kind === 'clip' ? 'clip' : 'photo')
      .is('superseded_at', null);
    const cap = kind === 'clip' ? PAPIC_SAMPLER_CLIP_CAP : PAPIC_SAMPLER_PHOTO_CAP;
    if ((usedOfKind ?? 0) >= cap) {
      return { ok: false, error: kind === 'clip' ? 'sampler_clip_cap' : 'sampler_photo_cap' };
    }
    // "connect Drive OR upgrade = permanent": if the couple has ALREADY converted
    // (active Drive grant) these shots are born permanent (expires_at stays null);
    // otherwise they roll off in 30 days. The sample-THEN-convert ordering is
    // handled separately by makeSamplerPermanent() at the convert moment.
    expiresAt = (await eventSamplerIsKept(seat.event_id))
      ? null
      : new Date(
          Date.now() + PAPIC_SAMPLER_RETENTION_DAYS * 86_400_000,
        ).toISOString();
  }

  const insertWithoutPoster = () =>
    supabase
      .from('papic_photos')
      .insert({
        event_id: seat.event_id,
        paparazzi_seat_id: seat.seat_id,
        r2_object_key: cleanKey,
        photo_type: kind === 'clip' ? 'clip' : 'photo',
        expires_at: expiresAt,
      })
      .select('photo_id')
      .single();

  let { data: inserted, error: insertError } = cleanPoster
    ? await supabase
        .from('papic_photos')
        .insert({
          event_id: seat.event_id,
          paparazzi_seat_id: seat.seat_id,
          r2_object_key: cleanKey,
          photo_type: 'clip',
          // The poster frame the NSFW screen classifies as the clip's proxy.
          poster_r2_key: cleanPoster,
          expires_at: expiresAt,
        })
        .select('photo_id')
        .single()
    : await insertWithoutPoster();

  // Pre-migration env (poster_r2_key column absent → PostgREST PGRST204):
  // retry without the poster — losing the screen proxy must never lose a clip.
  if (insertError && cleanPoster && insertError.code === 'PGRST204') {
    ({ data: inserted, error: insertError } = await insertWithoutPoster());
  }

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
    // NSFW screen ALWAYS runs (Apple 1.2 / corpus hard constraint) — even for the
    // sampler. The wall gate + FaceBlock bake are SKIPPED for sampler captures:
    // the free sampler is a private "try it", not the day-of live wall, so it
    // stays self-contained (nothing to expire out of wall_feed either).
    await screenCapture({ table: 'papic_photos', r2ObjectKey: cleanKey }).catch(() => {});
    if (insertedPhotoId && !seat.is_free_sampler) {
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
    if (seat.is_free_sampler && expiresAt) {
      // Cron-free expiry warnings: schedule (once per event, self-guarded) the
      // T-7 / T-1 emails with Resend at capture time. Best-effort.
      const { scheduleSamplerExpiryWarnings } = await import(
        '@/lib/papic-sampler-emails'
      );
      await scheduleSamplerExpiryWarnings(seat.event_id as string, expiresAt);
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
    .eq('paparazzi_seat_id', seat.seat_id)
    .is('superseded_at', null);

  // photoId rides back so the capture UI can offer "tag who's in it" on the
  // shot just saved (tagSeatCapture below). Null only in the degraded path
  // where the insert returned no id — tagging is simply unavailable then.
  return { ok: true, count: count ?? 0, photoId: insertedPhotoId };
}

export type TagSeatCaptureResult =
  | {
      ok: true;
      kind: 'guest' | 'table';
      /** How many NEW tags this scan added (0 on a re-scan of the same code). */
      added: number;
      /** Display names of the guest(s) this scan tagged. */
      names: string[];
      /** Running total tags on the photo (cap 10). */
      tagCount: number;
      capReached: boolean;
      /** Table fan-out only: more seated guests existed than the cap could fit. */
      truncated?: boolean;
      totalAtTable?: number;
      tableLabel?: string;
      /** Individual QR re-scan of a guest already on the photo. */
      already?: boolean;
    }
  | { ok: false; error: string };

/**
 * Tag a just-captured photo with whoever a scanned QR points at — one guest
 * (place-card / invitation QR) or a whole table (seating-sign QR, fanned out to
 * the seated guests, alphabetized, capped at 10/photo).
 *
 * The write itself happens in the SECURITY DEFINER papic_tag_capture RPC
 * (migration 20270108000000): photo_tags has no user-facing write policy, so a
 * direct insert under the claimer's session is RLS-blocked. The RPC re-checks
 * seat ownership (claimer + token) and photo ownership before writing, and
 * resolves the guest/table only within the seat's event. Never throws — a tag
 * miss must never break the camera; an un-tagged photo still reaches the gallery.
 */
export async function tagSeatCapture(
  token: string,
  photoId: string,
  scanned: string,
): Promise<TagSeatCaptureResult> {
  const parsed = parsePapicTagScan(scanned ?? '');
  if (!parsed) return { ok: false, error: 'unrecognized' };
  const cleanPhotoId = photoId?.trim();
  if (!cleanPhotoId) return { ok: false, error: 'missing_input' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const { data, error } = await supabase.rpc('papic_tag_capture', {
    p_token: token?.trim() ?? '',
    p_photo_id: cleanPhotoId,
    p_guest_token: parsed.kind === 'guest' ? parsed.token : null,
    p_table_ref: parsed.kind === 'table' ? parsed.ref : null,
  });

  if (error) {
    // Missing RPC (pre-migration · 42883) → soft "unavailable" the UI can show
    // without crashing the camera.
    if (error.code === '42883') return { ok: false, error: 'unavailable' };
    return { ok: false, error: 'tag_failed' };
  }

  const r = (data ?? {}) as Record<string, unknown>;
  if (!r.ok) return { ok: false, error: String(r.error ?? 'tag_failed') };

  return {
    ok: true,
    kind: r.kind === 'table' ? 'table' : 'guest',
    added: Number(r.added ?? 0),
    names: Array.isArray(r.names) ? (r.names as string[]) : [],
    tagCount: Number(r.tag_count ?? 0),
    capReached: Boolean(r.cap_reached),
    truncated: Boolean(r.truncated),
    totalAtTable: r.total_at_table != null ? Number(r.total_at_table) : undefined,
    tableLabel: typeof r.table_label === 'string' ? r.table_label : undefined,
    already: Boolean(r.already),
  };
}

/**
 * Best-effort FACE auto-tag for a just-captured seat photo. The capturing phone
 * detected faces + computed their descriptors ON-DEVICE (lib/face-embed) and
 * sends only the tiny 128-d vectors here — the face IMAGE never leaves the phone.
 *
 * We re-check (under the claimer's RLS session) that the caller owns this seat
 * and that the photo belongs to it, then hand the vectors to the server matcher
 * (autoTagCapture), which compares them to the event's CONSENTED enrollments and
 * writes auto_face photo_tags. The matcher is the only place the small guest
 * vectors are read, and they never leave our server.
 *
 * Dormant until enrollments carry vectors + a face model is hosted
 * (NEXT_PUBLIC_FACE_MODEL_URL): with no enrolled vectors this is a clean no-op.
 * Never throws — a face-tag miss must never break the camera; the photo is
 * already saved (untagged-still-delivered) before this ever runs.
 */
export async function autoTagSeatCapture(
  token: string,
  photoId: string,
  faceVectors: number[][],
): Promise<{ autoTagged: number }> {
  try {
    const cleanToken = token?.trim();
    const cleanPhotoId = photoId?.trim();
    if (
      !cleanToken ||
      !cleanPhotoId ||
      !Array.isArray(faceVectors) ||
      faceVectors.length === 0
    ) {
      return { autoTagged: 0 };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { autoTagged: 0 };

    // RLS (paparazzi_seats_claimer_read) returns the row only for the claimer —
    // resolving the seat by token doubles as the auth check.
    const { data: seat } = await supabase
      .from('paparazzi_seats')
      .select('seat_id, event_id, revoked_at, claimer_user_id')
      .eq('claim_qr_token', cleanToken)
      .maybeSingle();
    if (!seat || seat.claimer_user_id !== user.id || seat.revoked_at) {
      return { autoTagged: 0 };
    }

    // The photo must belong to THIS seat — no cross-photo vector injection.
    const { data: photo } = await supabase
      .from('papic_photos')
      .select('photo_id')
      .eq('photo_id', cleanPhotoId)
      .eq('paparazzi_seat_id', seat.seat_id)
      .maybeSingle();
    if (!photo) return { autoTagged: 0 };

    return await autoTagCapture({
      eventId: seat.event_id as string,
      sourceTable: 'papic_photos',
      photoId: cleanPhotoId,
      faceVectors,
    });
  } catch {
    // best-effort — face tagging never affects the saved photo
    return { autoTagged: 0 };
  }
}
