'use server';

import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { enqueueDriveCopy, runDriveCopyBatch } from '@/lib/drive-copy';
import { screenCapture } from '@/lib/nsfw-screen';
import { ingestToWall } from '@/lib/live-wall';
import { parsePapicTagScan } from '@/lib/papic-tag';
import { autoTagCapture } from '@/lib/face-match';
import {
  eventOwnsPapicSeats,
  papicSeatAnonEnabled,
} from '@/lib/papic-seats';
import {
  papicPerCameraTier,
  papicRungForTier,
  isPaidCameraTier,
  papicCameraOrderPaid,
  papicCaptureCost,
  resolvePointsGate,
  type PointsGateVerdict,
  eventUnliFreeViaUnlock,
  eventLtdFreeViaUnlock,
} from '@/lib/papic-cameras';
import {
  combinePointsGates,
  fetchEventPoolStatus,
  type EventPoolStatus,
} from '@/lib/papic-event-pool';
import { eventHasPapicUnlock } from '@/lib/entitlements';
import { captchaOptions, captchaTokenFromForm } from '@/lib/turnstile';

// Server-side 10-second clip cap (owner 2026-07-22 · §0 · not configurable). The
// client enforces 10s with a recorder timer; this tolerance (10.5s) absorbs
// MediaRecorder stop latency while still rejecting clips that are clearly long.
const CLIP_MAX_MS_SERVER_TOLERANCE = 10_500;

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
        await supabase.auth.signInAnonymously({
          // Global Supabase captcha gates anonymous sign-in too. The claim form
          // carries a <TurnstileField> once captcha is on; empty → {} → no-op.
          options: captchaOptions(captchaTokenFromForm(formData)),
        });
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

/**
 * The event-scoped pass pool's live state, returned on a successful capture so
 * the camera can show a SOFT-STOP warning before the hard stop. `undefined`
 * (omitted) for every event without a flat per-event pass — those have no fence.
 */
export type EventPoolSignal = {
  /** Capture points left in the event pool. */
  remaining: number;
  /** The pool's total (base + top-up grants). */
  total: number;
  /** True once usage crosses the admin-set soft-stop line (default 85%). */
  soft: boolean;
};

export type RecordSeatCaptureResult =
  | {
      ok: true;
      count: number;
      photoId: string | null;
      eventPool?: EventPoolSignal;
    }
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

  // Server-side 10-second clip cap (defense-in-depth · owner 2026-07-22 · §0).
  // The client enforces it with a recorder timer, but the 10s cap must not rely
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
    .select(
      'seat_id, event_id, revoked_at, claimer_user_id, tier, sku_code, paid_order_id, valid_from, valid_until',
    )
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

  // Per-camera seats (sku_code PAPIC_CAMERA_*) have their OWN paid-gate + daily
  // quota (below) and are NOT the legacy PAPIC_SEATS pack — so they skip the
  // pack ownership check. null for legacy pack seats (unchanged).
  const cameraTier = papicPerCameraTier(
    seat.sku_code as string | null,
    seat.tier as string | null,
  );

  // Entitlement re-check (legacy PAPIC_SEATS pack only). A claimed seat must not
  // keep accepting captures forever if the event's PAPIC_SEATS order was
  // cancelled / refunded / lapsed. Mirrors the guest disposable-camera path,
  // which gates every insert on ownership.
  //
  // Read on the ADMIN client, not the friend's session: a claimer (esp. an
  // anonymous one) is NOT an event member, so the orders RLS read would return
  // nothing under their session and wrongly block every capture. Fail-OPEN on a
  // config/transient error (admin client unavailable) — a refunded event still
  // capturing is far better than the camera breaking for a paying couple.
  if (!cameraTier) {
    let owned = true;
    try {
      const admin = createAdminClient();
      owned = await eventOwnsPapicSeats(admin, seat.event_id as string);
    } catch {
      owned = true; // fail-open — never break the camera on an entitlement read
    }
    if (!owned) return { ok: false, error: 'not_owned' };
  }

  // ── Per-CAMERA enforcement (per-camera model · PR3) ─────────────────────
  // Applies ONLY to per-camera seats (sku_code PAPIC_CAMERA_*) — the legacy
  // PAPIC_SEATS pack stays uncapped (feature-loss firewall). A paid camera
  // (roll/unlimited) only shoots once its order is PAID; the daily capture-
  // POINTS budget is reserved atomically at the record layer (the
  // authoritative gate; the presign probe in /api/upload is the orphan-byte
  // leak guard). Free cameras (tier 'free' · provisionFreeCamerasAdmin) meter
  // through the same points gate at the free budget.
  {
    if (cameraTier) {
      // ── Capture WINDOW gate (owner 2026-06-26) ──────────────────────────
      // The camera only shoots inside the event's chosen window
      // (paparazzi_seats.valid_from/valid_until, stamped from the event window).
      // Closing the window ends CAPTURE only — the gallery + delivery stay open
      // forever. Fail-OPEN on absent/null bounds (legacy seats had none) so a
      // pre-window camera is never broken. Applies to per-camera seats only.
      const nowMs = Date.now();
      const validFrom = seat.valid_from
        ? Date.parse(seat.valid_from as string)
        : NaN;
      const validUntil = seat.valid_until
        ? Date.parse(seat.valid_until as string)
        : NaN;
      if (Number.isFinite(validFrom) && nowMs < validFrom) {
        return { ok: false, error: 'capture_not_started' };
      }
      if (Number.isFinite(validUntil) && nowMs > validUntil) {
        return { ok: false, error: 'capture_window_closed' };
      }

      // Papic Unlock (the "Unlock all of Papic" pass · PR9 #2269 grants the
      // FEATURES; this is the deferred ALLOWANCE half): every camera on the event
      // shoots UNLIMITED with NO per-camera payment — skip both the paid-gate and
      // the daily reservation. Fail toward the normal metered gate on a read
      // error (a paying couple is never worse off than today).
      let unlocked = false;
      try {
        unlocked = await eventHasPapicUnlock(
          createAdminClient(),
          seat.event_id as string,
        );
      } catch {
        unlocked = false;
      }
      // Every PAID rung (mini · legacy roll · ltd · unlimited) is gated; only the
      // free tier skips. Expressed as "not free" so a new rung can never slip
      // through the paid-gate by being missing from an allow-list.
      if (!unlocked && isPaidCameraTier(cameraTier)) {
        let paid = false;
        try {
          const admin = createAdminClient();
          paid = await papicCameraOrderPaid(
            admin,
            seat.paid_order_id as string | null,
          );
          // Unlock umbrellas (money-gated · TRUE only on an ACTIVE order, so a
          // non-owner's camera is never freed): PAPIC_UNLOCK (₱15,000) frees
          // Unli; PAPIC_UNLOCK_LTD (₱9,000, owner 2026-07-11) frees the ₱30 rung
          // it was sold against — legacy 'roll', today's Mini. The new ₱50 Ltd
          // rung is covered by NO pass (owner pricing call) and stays gated.
          const rung = papicRungForTier(cameraTier);
          if (!paid && rung === 'unlimited') {
            paid = await eventUnliFreeViaUnlock(admin, seat.event_id as string);
          }
          if (!paid && rung === 'mini') {
            paid = await eventLtdFreeViaUnlock(admin, seat.event_id as string);
          }
        } catch {
          paid = false;
        }
        if (!paid) return { ok: false, error: 'awaiting_payment' };
      }
      // Capture-POINTS reserve (Papic v3 · brief PR-3) — the AUTHORITATIVE,
      // race-safe gate: 1 photo = 1 pt · 1 clip = 7 pts, atomically booked by
      // papic_reserve_camera_points against the tier's daily budget from
      // papic_tier_config (roll 20 · ltd 70 · free/mini/unlimited NULL=∞
      // passthrough — free + Papic One draw ONLY the shared event pool per the
      // one-pool model; admin-editable, never hardcoded here). Fail-CLOSED on any RPC failure
      // EXCEPT function-not-found (resolvePointsGate — the seam-cutover
      // carve-out): metering is money logic now, so an outage must block, not
      // silently un-meter. The presign probe (api/upload) is only the
      // orphan-byte leak guard; this reserve is the gate of record.
      {
        const cost = papicCaptureCost(kind === 'clip' ? 'clip' : 'photo');
        let seatGate: PointsGateVerdict = 'allow';
        let seatBooked = false;
        if (!unlocked) {
          try {
            const admin = createAdminClient();
            const { data: reserveOk, error: reserveErr } = await admin.rpc(
              'papic_reserve_camera_points',
              {
                p_seat_id: seat.seat_id,
                p_event_id: seat.event_id,
                p_cost: cost,
              },
            );
            seatGate = resolvePointsGate(
              reserveErr ? (reserveErr.code ?? 'unknown') : null,
              reserveOk === true ? true : reserveOk === false ? false : null,
            );
            // Only a TRUE from the RPC actually spent points — a fn-not-found
            // 'allow' booked nothing, so there'd be nothing to unwind.
            seatBooked = reserveOk === true;
          } catch {
            seatGate = 'blocked'; // thrown ≠ identifiable fn-not-found → fail-CLOSED
          }
        }

        // ── EVENT-SCOPED capture fence (Phase 0c) ────────────────────────
        // The flat per-event PASS (PAPIC_UNLOCK / PAPIC_UNLOCK_LTD / the
        // ₱1,499 flat pass) used to bypass metering entirely — this is the
        // missing bound. Pool = clamp(guests × 150, 5,000, 30,000) points,
        // event-LIFETIME, admin-tunable in papic_event_pool_config; top-ups add
        // via papic_event_point_grants. The RPC allows unconditionally for
        // every NON-pass event, so today's behaviour is unchanged there. Same
        // fail-CLOSED posture as the seat reserve — money logic.
        let eventGate: PointsGateVerdict = 'allow';
        let eventBooked = false;
        if (seatGate !== 'blocked') {
          try {
            const admin = createAdminClient();
            const { data: poolOk, error: poolErr } = await admin.rpc(
              'papic_reserve_event_points',
              { p_event_id: seat.event_id, p_cost: cost },
            );
            eventGate = resolvePointsGate(
              poolErr ? (poolErr.code ?? 'unknown') : null,
              poolOk === true ? true : poolOk === false ? false : null,
            );
            eventBooked = poolOk === true;
          } catch {
            eventGate = 'blocked';
          }
        }

        // The TIGHTER of the two budgets wins.
        const gate = combinePointsGates(seatGate, eventGate);

        // A refused capture must never leave points spent. Whichever ledger was
        // booked before the other refused gets released. Best-effort + never
        // fatal — a failed unwind costs the couple points, not a broken camera.
        if (gate !== 'allow') {
          const admin = (() => {
            try {
              return createAdminClient();
            } catch {
              return null;
            }
          })();
          if (admin && seatBooked) {
            await admin
              .rpc('papic_release_camera_points', {
                p_seat_id: seat.seat_id,
                p_cost: cost,
              })
              .then(
                () => undefined,
                () => undefined,
              );
          }
          if (admin && eventBooked) {
            await admin
              .rpc('papic_release_event_points', {
                p_event_id: seat.event_id,
                p_cost: cost,
              })
              .then(
                () => undefined,
                () => undefined,
              );
          }
        }

        if (gate === 'exhausted') {
          return { ok: false, error: 'camera_points_exhausted' };
        }
        if (gate === 'blocked') {
          return { ok: false, error: 'points_check_failed' };
        }
      }
    }
  }

  // Captures are uncapped and permanent (expires_at stays null). The retired
  // free sampler was the only path that ever set an expiry.
  const expiresAt: string | null = null;

  let insertedPhotoId: string | null = null;

  {
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
    insertedPhotoId = (inserted?.photo_id as string) ?? null;
  }

  // Always-on NSFW screen (Apple 1.2 filter · corpus hard constraint) — runs in
  // the BACKGROUND with after() so the camera stays responsive. The bytes are
  // already in R2 (client PUT via /api/upload), so the screen fetches them back
  // by the stored r2:// ref. Fail-open: any error leaves the row 'unscreened'.
  // Salamisim chain: screen FIRST (the wall is an allowlist — only 'clean'
  // projects), THEN run the wall gate. ingestToWall never throws; a non-clean
  // or non-LIVE_WALL event is a silent no-op.
  after(async () => {
    // Per-event fidelity tier (brief PR-4): the ingest READ seam of the single
    // `events.papic_quality_tier` column the setup surface writes. Runs FIRST
    // so the screen, derivatives, Drive sync, and downloads all flow from the
    // tiered original. STILLS only (clips are never transcoded server-side);
    // full_res / legacy / pre-migration rows are a strict no-op. Best-effort —
    // the module never throws.
    if (kind !== 'clip') {
      try {
        const { applyEventFidelityToOriginal } = await import(
          '@/lib/papic-ingest-fidelity'
        );
        await applyEventFidelityToOriginal(seat.event_id as string, cleanKey);
      } catch {
        // best-effort — fidelity never breaks a capture
      }
    }
    // NSFW screen ALWAYS runs (Apple 1.2 / corpus hard constraint), then the
    // FaceBlock bake + wall gate.
    await screenCapture({ table: 'papic_photos', r2ObjectKey: cleanKey }).catch(() => {});
    // Cheap display + thumbnail derivatives (best-effort, AFTER the screen) so
    // the gallery serves compressed tiles instead of full-res originals.
    // Dynamic import keeps the sharp/R2 cost off the capture hot path. Never
    // throws (the module wraps everything) — a missing thumb falls back to the
    // original at read time. Clips have no transcode; derive the thumb from the
    // poster.
    if (insertedPhotoId) {
      try {
        const { generatePhotoDerivatives, generateClipThumb } = await import(
          '@/lib/papic-derivatives'
        );
        if (kind === 'clip') {
          if (cleanPoster) {
            await generateClipThumb(cleanPoster, 'papic_photos', 'photo_id', insertedPhotoId);
          }
        } else {
          await generatePhotoDerivatives(cleanKey, 'papic_photos', 'photo_id', insertedPhotoId);
        }
      } catch {
        // best-effort — derivatives never break a capture
      }
    }
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
    .eq('paparazzi_seat_id', seat.seat_id)
    .is('superseded_at', null);

  // SOFT-STOP signal (Phase 0c): the event-scoped pass pool's live state rides
  // back on every successful capture so the camera can warn BEFORE the hard
  // stop ("running low on this event's shots") instead of only discovering the
  // fence when a shot is refused. Absent (applies=false) for every non-pass
  // event, and a pure display read — degrades to "no fence" on any error, which
  // can never widen the actual gate (the reserve RPC above is the gate).
  let eventPool: EventPoolSignal | undefined;
  if (cameraTier) {
    try {
      const status: EventPoolStatus = await fetchEventPoolStatus(
        createAdminClient(),
        seat.event_id as string,
      );
      if (status.applies) {
        eventPool = {
          remaining: status.remainingPoints,
          total: status.totalPoints,
          soft: status.soft,
        };
      }
    } catch {
      eventPool = undefined;
    }
  }

  // photoId rides back so the capture UI can offer "tag who's in it" on the
  // shot just saved (tagSeatCapture below). Null only in the degraded path
  // where the insert returned no id — tagging is simply unavailable then.
  return { ok: true, count: count ?? 0, photoId: insertedPhotoId, eventPool };
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
