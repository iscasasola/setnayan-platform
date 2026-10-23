import { NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isR2Configured } from '@/lib/r2';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { isVendorPapicCaptureEnabled } from '@/lib/vendor-dayof-flags';
import {
  deriveVendorPapicTier,
  fetchVendorPapicPointsSpent,
  fetchVendorPapicCreditsGranted,
} from '@/lib/vendor-papic-grants';
import { canCapture, pointsForMedia } from '@/lib/vendor-papic-tier';
import { getMenuLifecyclePhase } from '@/lib/day-of-mode';
import { readClientCaptureId, CLIENT_CAPTURE_ID_FIELD } from '@/lib/papic-client-capture-id';
import {
  discardFinalObjects,
  dropStagingObjects,
  eventKeepsFullRes,
  loadUploadedTiers,
  promoteTier,
  readCaptureIntents,
  screenTierBytes,
  settleCaptureIntents,
  signCaptureTierPut,
  type IntentRow,
} from '@/lib/papic-upload-intents.server';
import { isCaptureTier, type CaptureTier } from '@/lib/papic-upload/tiers';

// POST /api/vendor/papic-capture
//
// The vendor ON-THE-DAY Papic capture lane (owner-locked 2026-07-18). A signed-in
// vendor working a booked event shoots photos (and, on Ltd/Unli, ≤10s clips) into
// their OWN capture lane (public.vendor_papic_captures). validate → enforce the
// tier's capture-point budget → the phone PUTs straight to R2 → insert the row
// under the vendor's RLS client (the insert policy is the hard booked/own-profile
// gate) → NSFW-screen.
//
// ── 🚫 NO FILE BYTES COME THROUGH HERE (2026-10-23) ─────────────────────────
// This lane took the photo as a multipart POST and PUT it to R2 itself — the
// same shape that answered 413 FUNCTION_PAYLOAD_TOO_LARGE on the guest lane in
// production (Vercel refuses request bodies over 4.5 MB before our code runs;
// a supplier's clip was allowed up to 25 MB). It now takes a small JSON body
// with three ops, exactly like /api/papic/guest-capture:
//   sign   — check the gate, the window, the consent and the budget, then mint
//            one presigned PUT for one piece of one shot (lib/papic-upload/).
//   record — the shot's first piece landed: check it, write the row ONCE per
//            shutter (client_capture_id, migration 20271285508020), screen it.
//   attach — a later piece (tile + display, the original) landed: check it,
//            SCREEN it, then write its key.
//
// ⚠️ THIS SURFACE IS LIVE. It is gated by isVendorPapicCaptureEnabled() (the
// admin Data Privacy control `vendor_papic_capture`), and that control has been
// **ACTIVE IN PRODUCTION SINCE 2026-07-16 04:51 UTC**, approved by the owner.
// A privacy control's state lives in the DATABASE; a comment describing it is
// a claim with an expiry date. Geo is never stored; the 10s clip cap is a
// product lock; NSFW is always-on.
//
// ⏱ AND THE LANE CLOSES WITH THE CELEBRATION — owner 2026-08-28: *"they get
// to use it until event day."* See THE WINDOW below.

export const runtime = 'nodejs';

// 10-SECOND CLIP CAP — owner override 2026-07-22 · §0. Mirrors the guest route;
// the DB CHECK on vendor_papic_captures was relaxed to 10000 in the same PR.
const MAX_CLIP_MS = 10000;
const MAX_JSON_BYTES = 16_000;

type Admin = ReturnType<typeof createAdminClient>;
type Body = Record<string, unknown>;
const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status });

type VendorRow = {
  capture_id: string;
  media_type: string | null;
  r2_object_key: string | null;
  poster_r2_key: string | null;
  display_r2_key: string | null;
  tile_r2_key: string | null;
  thumb_r2_key: string | null;
};

// ── THE WINDOW ────────────────────────────────────────────────────────────
// Owner 2026-08-28: *"they get to use it until event day."* A supplier's
// camera documents their own work, so it is open through the celebration and
// shut once the celebration is over.
//
// 🔑 IT REUSES THE ONE RESOLVER RATHER THAN DEFINING "OVER" A SECOND TIME.
// `getMenuLifecyclePhase` already answers it for the whole product — 06:00 in
// the VENUE's clock on the day after `COALESCE(event_end_date, event_date)`,
// or the moment the host presses "Close out the day".
//
// ⚠ FAILS OPEN, deliberately. An unreadable event, a missing date or an
// unrecognised timezone leaves the phase at 'plan' and the lane open.
async function eventOver(admin: Admin, eventId: string): Promise<boolean> {
  const { data: eventRow } = await admin
    .from('events')
    .select('event_date, event_end_date, timezone, cleared_at')
    .eq('event_id', eventId)
    .maybeSingle();
  const ev = eventRow as {
    event_date: string | null;
    event_end_date: string | null;
    timezone: string | null;
    cleared_at: string | null;
  } | null;
  if (!ev) return false;
  const phase = getMenuLifecyclePhase(
    ev.event_date,
    ev.cleared_at,
    ev.timezone ?? undefined,
    undefined,
    ev.event_end_date,
  );
  return phase === 'after';
}

// Tier + capture-points enforcement (service-role reads — the tier must be
// authoritative). Each tier's point budget is the ceiling (photo=1, clip=7).
// ⚠ THE CREDITS THEY HOLD ARE PART OF THE ALLOWANCE — owner 2026-09-05: an
// unread ledger is `null`, which grants nothing.
async function budgetRefusal(
  admin: Admin,
  vendorProfileId: string,
  eventId: string,
  mediaType: 'photo' | 'clip',
): Promise<NextResponse | null> {
  const [tier, spent, creditsGranted] = await Promise.all([
    deriveVendorPapicTier(admin, vendorProfileId, eventId),
    fetchVendorPapicPointsSpent(admin, vendorProfileId, eventId),
    fetchVendorPapicCreditsGranted(admin, vendorProfileId, eventId),
  ]);
  const check = canCapture(tier, spent, mediaType, creditsGranted);
  if (!check.ok) {
    return json(
      { error: check.reason, tier, pointsSpent: spent },
      check.reason === 'video_not_allowed' ? 403 : 409,
    );
  }
  return null;
}

const intentFor = (intents: readonly IntentRow[], tier: CaptureTier) => intents.find((i) => i.tier === tier);
type Loaded = Awaited<ReturnType<typeof loadUploadedTiers>>['loaded'][number];

async function loadOrRedo(
  intents: readonly IntentRow[],
  tiers: readonly CaptureTier[],
): Promise<{ ok: true; byTier: Map<CaptureTier, Loaded> } | { ok: false; res: NextResponse }> {
  const missing = tiers.filter((t) => !intentFor(intents, t));
  if (missing.length > 0) return { ok: false, res: json({ error: 'object_missing', missing }, 409) };
  const { loaded, redo } = await loadUploadedTiers(tiers.map((t) => intentFor(intents, t)!));
  if (redo.length > 0) return { ok: false, res: json({ error: 'object_rejected', missing: redo }, 409) };
  return { ok: true, byTier: new Map(loaded.map((l) => [l.intent.tier, l])) };
}

async function promoteAll(byTier: Map<CaptureTier, Loaded>): Promise<Map<CaptureTier, string> | null> {
  try {
    const out = new Map<CaptureTier, string>();
    for (const [tier, loaded] of byTier) out.set(tier, await promoteTier(loaded));
    return out;
  } catch (err) {
    console.error('[papic-upload] vendor promote failed', err instanceof Error ? err.message : err);
    return null;
  }
}

// ── THE COUPLE'S COPY GOES OUT BEFORE THE ORIGINAL CAN GO AWAY ────────────
// 🔑 THE INVERSE COMES FIRST. Compression is destructive: after the retention
// window the full-res original is deleted and the web copy becomes the
// photograph. Drive is the ONLY way a couple keeps originals, so the sweep
// refuses to drop anything whose key is not confirmed in the couple's Drive
// copy (`isDriveDeferred`). A supplier's captures land in the COUPLE'S gallery,
// so they belong in the couple's hand-off like any other photograph in it.
// Best-effort: a hand-off that fails leaves the key unconfirmed, which makes the
// sweep DEFER rather than drop. Handed off ONCE, with the final full copy.
async function handOffToDrive(eventId: string, captureId: string, ref: string, isClip: boolean): Promise<void> {
  try {
    // 🧼 Only a shot the screen PASSED (and nobody took down) leaves for Drive.
    const { data: row } = await createAdminClient()
      .from('vendor_papic_captures')
      .select('nsfw_checked, hidden_at')
      .eq('capture_id', captureId)
      .maybeSingle();
    const r = row as { nsfw_checked?: boolean; hidden_at?: string | null } | null;
    if (r?.nsfw_checked !== true || r.hidden_at) return;
    const { enqueueDriveCopy, runDriveCopyBatch } = await import('@/lib/drive-copy');
    await enqueueDriveCopy({
      eventId,
      artifactType: 'papic',
      files: [
        {
          r2ObjectKey: ref,
          fileName: ref.split('/').pop() || (isClip ? 'capture.mp4' : 'capture.jpg'),
          mimeType: isClip ? 'video/mp4' : 'image/jpeg',
          sourceTable: 'vendor_papic_captures',
          sourceRef: captureId,
        },
      ],
    });
    after(() => runDriveCopyBatch({ eventId }).catch(() => {}));
  } catch {
    // best-effort — an unconfirmed key makes the sweep defer, never drop.
  }
}

/** The screen's verdict on a still, written the way this lane always wrote it. */
async function writeVerdict(admin: Admin, captureId: string, bytes: Uint8Array | null, ref: string, eventId: string) {
  // A capture only surfaces once nsfw_checked=TRUE; a block also soft-hides it.
  // Fail-open: a classifier error leaves nsfw_checked=false (excluded), never
  // surfacing an unscreened photo. The clean verdict only records that the
  // screen RAN — the takedown switch is not its to move (TD-1, 2026-09-14).
  if (!bytes) return;
  const verdict = await screenTierBytes({ subjectTable: 'vendor_papic_captures', ref, eventId, bytes });
  if (verdict === 'error') return;
  const patch: { nsfw_checked: true; hidden_at?: string } = { nsfw_checked: true };
  if (verdict === 'nsfw_blocked') patch.hidden_at = new Date().toISOString();
  await admin
    .from('vendor_papic_captures')
    .update(patch)
    .eq('capture_id', captureId)
    .eq('nsfw_checked', false);
}

export async function POST(req: Request) {
  // 1. Auth — the vendor is a signed-in Supabase user.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 });
  }

  // 2. Counsel gate — fail-closed. No capture surface runs until the DPO ruling.
  if (!(await isVendorPapicCaptureEnabled())) {
    return NextResponse.json({ error: 'disabled' }, { status: 403 });
  }

  // 🚫 JSON ONLY — see the header.
  if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return json({ error: 'bytes_not_accepted' }, 415);
  }
  let body: Body;
  try {
    const raw = await req.text();
    if (raw.length > MAX_JSON_BYTES) return json({ error: 'bad_request' }, 413);
    body = JSON.parse(raw) as Body;
    if (!body || typeof body !== 'object') throw new Error('shape');
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const eventId = typeof body.event_id === 'string' ? body.event_id.trim() : '';
  if (!eventId) return json({ error: 'no_event' }, 400);
  const clientCaptureId = readClientCaptureId(body[CLIENT_CAPTURE_ID_FIELD]);
  if (!clientCaptureId) return json({ error: 'bad_request' }, 400);
  const mediaType = body.media_type === 'clip' ? 'clip' : 'photo';
  const isClip = mediaType === 'clip';

  // 3. Guest-consent attestation (RA 10173). The controller's consent gate sends
  // consent=true; absent → refuse. The lawful basis is recorded on the row.
  if (body.consent !== true) {
    return json({ error: 'consent_required' }, 403);
  }
  if (!isR2Configured()) {
    return json({ error: 'uploads_unavailable' }, 503);
  }

  // 4. Resolve the vendor profile the caller owns/admins.
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return json({ error: 'no_vendor' }, 403);
  const vendorProfileId = profile.vendor_profile_id;

  const admin = createAdminClient();
  const { data: priorRow, error: priorErr } = await admin
    .from('vendor_papic_captures')
    .select('capture_id, media_type, r2_object_key, poster_r2_key, display_r2_key, tile_r2_key, thumb_r2_key')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('client_capture_id', clientCaptureId)
    .maybeSingle();
  if (priorErr) {
    console.error('[supabase-error] app/api/vendor/papic-capture/route.ts · from:vendor_papic_captures.select(client_capture_id)', priorErr);
    return json({ error: 'record_failed' }, 503);
  }
  const prior = (priorRow as VendorRow | null) ?? null;
  const op = body.op;

  // ── sign ──────────────────────────────────────────────────────────────────
  if (op === 'sign') {
    const tier = body.tier;
    // A supplier's clip has no web copy here (vendor_papic_captures carries no
    // clip_web column): poster + the clip itself.
    const allowed: CaptureTier[] = isClip ? ['poster', 'clip_raw'] : ['thumb', 'tile', 'display', 'original'];
    if (!isCaptureTier(tier) || !allowed.includes(tier)) return json({ error: 'bad_tier' }, 400);
    if (prior) {
      if (tier === 'thumb' || tier === 'poster' || tier === 'clip_raw') return json({ status: 'ok', already: true });
      if ((tier === 'tile' && prior.tile_r2_key) || (tier === 'display' && prior.display_r2_key)) {
        return json({ status: 'ok', already: true });
      }
      if (tier === 'original') {
        if (prior.r2_object_key?.includes('-original.')) return json({ status: 'ok', already: true });
        if (!(await eventKeepsFullRes(admin, eventId))) return json({ error: 'full_not_wanted' }, 409);
      }
    } else {
      if (tier === 'tile' || tier === 'display') return json({ error: 'not_recorded_yet' }, 409);
      // A supplier may only upload toward an event they are BOOKED on — the
      // same set the insert policy checks at record. Asked here too so an
      // unbooked caller cannot fill storage with uploads that will never record.
      // Fails OPEN on a read error: the insert policy is still the hard gate.
      {
        const { data: booked, error: bookedErr } = await supabase.rpc('current_vendor_booked_event_ids');
        if (!bookedErr && Array.isArray(booked) && !(booked as unknown[]).includes(eventId)) {
          return json({ error: 'not_allowed' }, 403);
        }
      }
      if (await eventOver(admin, eventId)) return json({ error: 'event_over' }, 403);
      const refused = await budgetRefusal(admin, vendorProfileId, eventId, mediaType);
      if (refused) return refused;
    }
    const signed = await signCaptureTierPut(admin, {
      lane: 'vendor',
      eventId,
      ownerId: vendorProfileId,
      clientCaptureId,
      tier,
      contentType: typeof body.content_type === 'string' ? body.content_type : '',
      sizeBytes: typeof body.size_bytes === 'number' ? body.size_bytes : NaN,
    });
    if (!signed.ok) {
      return json({ error: signed.error }, signed.error === 'sign_failed' ? 503 : signed.error === 'too_large' ? 413 : 400);
    }
    return json({ status: 'ok', uploadUrl: signed.uploadUrl, expiresIn: signed.expiresInSeconds });
  }

  // ── record ────────────────────────────────────────────────────────────────
  if (op === 'record') {
    if (prior) {
      // 🔁 THIS SHUTTER ALREADY LANDED — answer with the first row, count nothing.
      return json({
        status: 'ok',
        duplicate: true,
        captureId: prior.capture_id,
        wantFull: await eventKeepsFullRes(admin, eventId),
      });
    }
    if (await eventOver(admin, eventId)) return json({ error: 'event_over' }, 403);
    const refused = await budgetRefusal(admin, vendorProfileId, eventId, mediaType);
    if (refused) return refused;

    let durationMs: number | null = null;
    if (isClip) {
      const n = Number(body.duration_ms);
      if (Number.isFinite(n) && n > 0) {
        if (n > MAX_CLIP_MS) return json({ error: 'too_long' }, 400);
        durationMs = Math.round(n);
      }
    }
    const deviceModel = typeof body.device_model === 'string' ? body.device_model.slice(0, 120) : null;

    const intents = await readCaptureIntents(admin, vendorProfileId, clientCaptureId);
    if (!intents) return json({ error: 'record_failed' }, 503);
    const photoFirst: CaptureTier = intentFor(intents, 'thumb') ? 'thumb' : 'original';
    const needed: CaptureTier[] = isClip ? ['poster', 'clip_raw'] : [photoFirst];
    const checked = await loadOrRedo(intents, needed);
    if (!checked.ok) return checked.res;
    const finals = await promoteAll(checked.byTier);
    if (!finals) return json({ error: 'record_failed' }, 503);
    const r2Ref = finals.get(isClip ? 'clip_raw' : photoFirst)!;
    const posterRef = isClip ? finals.get('poster')! : null;

    // 7. Record the capture under the vendor's RLS client. The insert policy
    // (vendor_papic_captures_vendor_insert) is the authoritative gate: it requires
    // event_id IN current_vendor_booked_event_ids() AND the caller's own vendor
    // profile — so an unbooked event or a non-owner is rejected here (42501).
    const { data: inserted, error: insErr } = await supabase
      .from('vendor_papic_captures')
      .insert({
        vendor_profile_id: vendorProfileId,
        event_id: eventId,
        r2_object_key: r2Ref,
        poster_r2_key: posterRef,
        media_type: mediaType,
        clip_duration_ms: isClip ? durationMs : null,
        device_model: deviceModel,
        consent_basis: 'event_consent',
        nsfw_checked: false,
        client_capture_id: clientCaptureId,
      })
      .select('capture_id')
      .maybeSingle();
    if (insErr?.code === '23505') {
      // The same shutter raced past the read above: the first row stands.
      const { data: again } = await admin
        .from('vendor_papic_captures')
        .select('capture_id')
        .eq('vendor_profile_id', vendorProfileId)
        .eq('client_capture_id', clientCaptureId)
        .maybeSingle();
      return json({ status: 'ok', duplicate: true, captureId: again?.capture_id ?? null, wantFull: await eventKeepsFullRes(admin, eventId) });
    }
    if (insErr || !inserted) {
      // No row points at the promoted copies — they go; the uploads stay for a retry.
      await discardFinalObjects(needed.map((t) => intentFor(intents, t)!));
      // RLS rejection (not booked / not your profile) → 403; anything else → 500.
      const rls = insErr?.code === '42501';
      return json({ error: rls ? 'not_allowed' : 'record_failed' }, rls ? 403 : 500);
    }
    const captureId = (inserted as { capture_id: string }).capture_id;
    const sizeOf = (t: CaptureTier) => checked.byTier.get(t)?.size ?? null;
    await admin
      .from('vendor_papic_captures')
      .update(
        isClip
          ? { display_r2_key: posterRef, display_bytes: sizeOf('poster') }
          : photoFirst === 'thumb'
            ? { thumb_r2_key: r2Ref, thumb_bytes: sizeOf('thumb') }
            : { orig_bytes: sizeOf('original') },
      )
      .eq('capture_id', captureId);
    await settleCaptureIntents(admin, needed.map((t) => intentFor(intents, t)!.r2_ref));
    await dropStagingObjects(needed.map((t) => intentFor(intents, t)!));

    // 8. Always-on NSFW screen, BEFORE answering now that this call is off the
    // shutter (the phone's queue makes it). The photo's thumbnail, or a clip's
    // poster — never the video bytes.
    const proxy = checked.byTier.get(isClip ? 'poster' : photoFirst);
    await writeVerdict(admin, captureId, proxy?.bytes ?? null, proxy?.intent.r2_ref ?? r2Ref, eventId);

    // ── THE COMPRESSED WEB COPY (owner 2026-08-24: "compress it as well") ──────
    // The phone now makes the display/tile/thumbnail itself (attach, below). The
    // SAME shared generator stays the FALLBACK — a clip's still, and a photo that
    // arrived with its original only. Best-effort by contract: a failure leaves
    // `display_r2_key` NULL, the row is never a drop candidate, and the original
    // is simply kept.
    after(async () => {
      try {
        const { generatePhotoDerivatives, generateClipThumb } = await import(
          '@/lib/papic-derivatives'
        );
        if (isClip) {
          if (posterRef) {
            await generateClipThumb(
              posterRef,
              'vendor_papic_captures',
              'capture_id',
              captureId,
            );
          }
        } else if (photoFirst === 'original') {
          await generatePhotoDerivatives(
            r2Ref,
            'vendor_papic_captures',
            'capture_id',
            captureId,
          );
        }
      } catch {
        // Best-effort: no web copy means the original is kept, never dropped.
      }
    });
    const wantFull = await eventKeepsFullRes(admin, eventId);
    if (isClip || photoFirst === 'original') await handOffToDrive(eventId, captureId, r2Ref, isClip);

    return json({
      status: 'ok',
      captureId,
      mediaType,
      points: pointsForMedia(mediaType),
      wantFull,
    });
  }

  // ── attach ────────────────────────────────────────────────────────────────
  if (op === 'attach') {
    if (!prior) return json({ error: 'not_recorded_yet' }, 409);
    if (prior.media_type === 'clip') return json({ error: 'bad_tier' }, 400);
    const asked = Array.isArray(body.tiers) ? (body.tiers as unknown[]).filter(isCaptureTier) : [];
    const tiers = asked.filter((t): t is CaptureTier => t === 'tile' || t === 'display' || t === 'original');
    if (tiers.length === 0) return json({ error: 'bad_tier' }, 400);
    // The record's own screen must have RUN before more of this shot is accepted
    // (a classifier outage leaves nsfw_checked false — hidden from the couple);
    // the phone's retry of this call is what heals it.
    {
      const { data: v } = await admin
        .from('vendor_papic_captures')
        .select('nsfw_checked, hidden_at')
        .eq('capture_id', prior.capture_id)
        .maybeSingle();
      const verdictRow = v as { nsfw_checked?: boolean; hidden_at?: string | null } | null;
      if (verdictRow?.hidden_at) return json({ status: 'ok', blocked: true });
      if (verdictRow?.nsfw_checked !== true && prior.r2_object_key) {
        const { readCaptureObject } = await import('@/lib/papic-upload-intents.server');
        const bytes = await readCaptureObject(prior.r2_object_key);
        await writeVerdict(admin, prior.capture_id, bytes, prior.r2_object_key, eventId);
        const { data: v2 } = await admin
          .from('vendor_papic_captures')
          .select('nsfw_checked, hidden_at')
          .eq('capture_id', prior.capture_id)
          .maybeSingle();
        const after2 = v2 as { nsfw_checked?: boolean; hidden_at?: string | null } | null;
        if (after2?.nsfw_checked !== true) return json({ error: 'screen_unavailable' }, 503);
        if (after2.hidden_at) return json({ status: 'ok', blocked: true });
      }
    }
    const intents = await readCaptureIntents(admin, vendorProfileId, clientCaptureId);
    if (!intents) return json({ error: 'attach_failed' }, 503);
    const checked = await loadOrRedo(intents, tiers);
    if (!checked.ok) return checked.res;

    // 🧼 SCREEN EVERY STILL BEFORE ITS KEY IS WRITTEN — a display copy or an
    // original is a different file from the thumbnail the record screened.
    for (const tier of tiers) {
      const loaded = checked.byTier.get(tier)!;
      const verdict = await screenTierBytes({
        subjectTable: 'vendor_papic_captures',
        ref: loaded.intent.r2_ref,
        eventId,
        bytes: loaded.bytes!,
      });
      if (verdict === 'error') return json({ error: 'screen_unavailable' }, 503);
      if (verdict === 'nsfw_blocked') {
        await admin
          .from('vendor_papic_captures')
          .update({ nsfw_checked: true, hidden_at: new Date().toISOString() })
          .eq('capture_id', prior.capture_id);
        await settleCaptureIntents(admin, tiers.map((t) => intentFor(intents, t)!.r2_ref));
        return json({ status: 'ok', blocked: true });
      }
    }
    const finals = await promoteAll(checked.byTier);
    if (!finals) return json({ error: 'attach_failed' }, 503);
    const sizeOf = (t: CaptureTier) => checked.byTier.get(t)?.size ?? null;
    const patch: Record<string, unknown> = {};
    if (tiers.includes('tile')) {
      patch.tile_r2_key = finals.get('tile');
      patch.tile_bytes = sizeOf('tile');
    }
    if (tiers.includes('display')) {
      patch.display_r2_key = finals.get('display');
      patch.display_bytes = sizeOf('display');
      if (!prior.r2_object_key || prior.r2_object_key === prior.thumb_r2_key) {
        patch.r2_object_key = finals.get('display');
      }
    }
    if (tiers.includes('original')) {
      patch.r2_object_key = finals.get('original');
      patch.orig_bytes = sizeOf('original');
    }
    const { error: updErr } = await admin
      .from('vendor_papic_captures')
      .update(patch)
      .eq('capture_id', prior.capture_id)
      .eq('vendor_profile_id', vendorProfileId);
    if (updErr) {
      console.error('[supabase-error] app/api/vendor/papic-capture/route.ts · from:vendor_papic_captures.update(attach)', updErr);
      return json({ error: 'persist_failed' }, 500);
    }
    await settleCaptureIntents(admin, tiers.map((t) => intentFor(intents, t)!.r2_ref));
    await dropStagingObjects(tiers.map((t) => intentFor(intents, t)!));
    const wantFull = await eventKeepsFullRes(admin, eventId);
    if (tiers.includes('display') && !tiers.includes('tile') && !prior.tile_r2_key) {
      const displayRef = finals.get('display')!;
      after(async () => {
        try {
          const { generateTileDerivative } = await import('@/lib/papic-derivatives');
          await generateTileDerivative(displayRef, 'vendor_papic_captures', 'capture_id', prior.capture_id);
        } catch {
          // best-effort
        }
      });
    }
    if (tiers.includes('display') && !wantFull) await handOffToDrive(eventId, prior.capture_id, finals.get('display')!, false);
    if (tiers.includes('original')) await handOffToDrive(eventId, prior.capture_id, finals.get('original')!, false);
    return json({ status: 'ok' });
  }

  return json({ error: 'bad_request' }, 400);
}
