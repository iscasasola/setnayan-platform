/**
 * POST /api/v1/manpower/verify-telemetry
 *
 * V2 telemetry checkpoint validator. Confirms that a given service's
 * fulfillment criteria are met (per blueprint Part 4 § 2), then calls the
 * `execute_manpower_telemetry_reward()` plpgsql function which:
 *   - Atomically marks `event_software_activations.is_reward_issued = TRUE`
 *   - Counts cumulative service activations for this vendor on this event
 *   - Awards tokens per the 14-token stacking ladder (1·2·2·2·2·2·3 = 14 max)
 *   - Credits `vendor_wallets.earned_tokens` (45-day expiring vouchers)
 *   - Writes immutable audit row to `token_rewards_log`
 *
 * The 8 is_token_able services + their checkpoint criteria:
 *   PAPIC          · ≥3 of 5 devices upload ≥50 valid files >500KB each
 *   PANOOD         · RTMP/HLS continuous transmission >30 min
 *   PATIKTOK       · WASM render writes ≥1 valid reel asset
 *   PABATI         · guests record >15 unique approved 5-sec clips
 *   SDE            · render status callback OK
 *   CAMERA_BRIDGE  · >1 GB uncompressed media transit
 *   LIVE_WALL      · WebSocket continuous >1 hr
 *   PAKANTA        · Suno API audio stream mapping validation OK (added 2026-05-28)
 *
 * Auth: cookie session (vendor team member of `vendor_id`). DEMO_MODE
 * bypasses auth + DB and returns deterministic mock token awards so the
 * walkthrough video can record the full 7-checkpoint stack reaching 14
 * tokens.
 *
 * Spec corpus: V2_Cutover_Plan_2026-05-28.md Phase E (telemetry endpoints
 * + 14-token stacking). Blueprint Part 4 § 2-3.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

type VerifyBody = {
  event_id?: string;
  vendor_id?: string;
  service_code?: string;
  telemetry_payload?: TelemetryPayload;
};

type TelemetryPayload = {
  papic?:        { active_devices: number; valid_files_count: number; min_file_bytes: number };
  panood?:       { continuous_rtmp_minutes: number };
  patiktok?:     { rendered_reel_assets: number };
  pabati?:       { unique_5s_clips: number };
  sde?:          { render_callback_status: 'ok' | 'failed'; render_id?: string };
  camera_bridge?:{ media_transit_bytes: number };
  live_wall?:    { socket_uninterrupted_minutes: number };
  pakanta?:      { suno_audio_url?: string; suno_validation_status: 'ok' | 'failed' };
};

const DEMO_MODE = process.env.SETNAYAN_DEMO_MODE === '1';

const TOKEN_ABLE_CODES = new Set([
  'PATIKTOK_COMPILER',
  'PABATI',
  'PAPIC_SEATS',
  'PAPIC_GUEST',         // tracked under PAPIC family
  'PAPIC_GUEST_STORIES', // tracked under PAPIC family
  'PAPIC_MEDIA_PACK',    // tracked under PAPIC family
  'PANOOD_SYSTEM',
  'SDE',
  'CAMERA_BRIDGE',
  'LIVE_WALL',
  'PAKANTA',
]);

// 14-token stacking ladder. Index 0 = first service completion = +1 token.
// Mirrors the ELSIF chain in execute_manpower_telemetry_reward() exactly.
const LADDER = [1, 2, 2, 2, 2, 2, 3] as const; // sums to 14 at slot 7

const VOUCHER_EXPIRY_DAYS = 45;

export async function POST(req: Request) {
  let body: VerifyBody;
  try {
    body = (await req.json()) as VerifyBody;
  } catch {
    return err(400, 'invalid_json', 'Request body is not valid JSON.');
  }

  const eventId = body.event_id?.trim();
  const vendorId = body.vendor_id?.trim();
  const serviceCode = body.service_code?.trim().toUpperCase();
  const telemetry = body.telemetry_payload;

  if (!eventId) return err(400, 'missing_event_id', 'event_id is required.');
  if (!vendorId) return err(400, 'missing_vendor_id', 'vendor_id is required.');
  if (!serviceCode) return err(400, 'missing_service_code', 'service_code is required.');
  if (!TOKEN_ABLE_CODES.has(serviceCode)) {
    return err(400, 'service_not_token_able',
      `service_code ${serviceCode} is not in the is_token_able catalog.`);
  }
  if (!telemetry || typeof telemetry !== 'object') {
    return err(400, 'missing_telemetry', 'telemetry_payload is required.');
  }

  // ---- Per-service checkpoint validation -------------------------------------
  const checkpointResult = validateCheckpoint(serviceCode, telemetry);
  if (!checkpointResult.passed) {
    return err(422, 'checkpoint_not_met',
      `${serviceCode} checkpoint criteria not met: ${checkpointResult.reason}`);
  }

  // ---- Auth + vendor team membership -----------------------------------------
  if (!DEMO_MODE) {
    const supabase = await createClient();
    const { data: userResult } = await supabase.auth.getUser();
    const userId = userResult?.user?.id;
    if (!userId) return err(401, 'unauthenticated', 'Sign in required.');

    const admin = createAdminClient();
    const { data: vendorMembership } = await admin
      .from('vendor_service_agents')
      .select('member_id')
      .eq('vendor_id', vendorId)
      .eq('member_id', userId)
      .maybeSingle();

    let allowed = !!vendorMembership;
    if (!allowed) {
      const { data: vendorOwner } = await admin
        .from('vendor_profiles')
        .select('owner_user_id')
        .eq('vendor_profile_id', vendorId)
        .maybeSingle();
      allowed = vendorOwner?.owner_user_id === userId;
    }
    if (!allowed) {
      return err(403, 'not_vendor_team', 'You are not on this vendor team.');
    }
  }

  // ---- DEMO MODE short-circuit ------------------------------------------------
  if (DEMO_MODE) {
    const synth = synthesizeRewardForDemo(eventId, vendorId, serviceCode);
    return ok({
      event_id: eventId,
      vendor_id: vendorId,
      service_code: serviceCode,
      checkpoint_passed: true,
      ladder_position: synth.ladderPosition,
      tokens_awarded_this_call: synth.tokensAwardedThisCall,
      cumulative_event_tokens: synth.cumulativeEventTokens,
      cumulative_event_ladder_max: 14,
      wallet_earned_balance: synth.walletEarnedBalance,
      voucher_expires_at: voucherExpiry().toISOString(),
      voucher_expiry_days: VOUCHER_EXPIRY_DAYS,
      ladder: LADDER,
      mode: 'demo',
    });
  }

  // ---- Live mode · DB-side reward via RPC ------------------------------------
  const admin = createAdminClient();

  // Ensure event_software_activations row exists before calling the function
  // (the function does FOR UPDATE which requires the row to exist · the
  // function returns silently if the row is missing OR is_reward_issued is
  // already TRUE).
  const { error: upsertErr } = await admin
    .from('event_software_activations')
    .upsert(
      {
        event_id: eventId,
        vendor_id: vendorId,
        service_code: serviceCode,
        is_reward_issued: false,
      },
      { onConflict: 'event_id,service_code', ignoreDuplicates: true },
    );
  if (upsertErr) {
    return err(500, 'activation_upsert_error', upsertErr.message);
  }

  // Ensure vendor_wallets row exists (the function does UPDATE not UPSERT).
  const { error: walletEnsureErr } = await admin
    .from('vendor_wallets')
    .upsert(
      { vendor_id: vendorId, purchased_tokens: 0, earned_tokens: 0 },
      { onConflict: 'vendor_id', ignoreDuplicates: true },
    );
  if (walletEnsureErr) {
    return err(500, 'wallet_ensure_error', walletEnsureErr.message);
  }

  // Call the plpgsql function · atomic with FOR UPDATE locking.
  const { error: rpcErr } = await admin.rpc('execute_manpower_telemetry_reward', {
    p_vendor_id: vendorId,
    p_event_id: eventId,
    p_service_code: serviceCode,
  });
  if (rpcErr) {
    return err(500, 'reward_rpc_error', rpcErr.message);
  }

  // Read back wallet + ladder state to populate the response.
  const [{ data: wallet }, { count: cumulativeCompleted }, { data: rewardLog }] = await Promise.all([
    admin
      .from('vendor_wallets')
      .select('earned_tokens, purchased_tokens, updated_at')
      .eq('vendor_id', vendorId)
      .maybeSingle(),
    admin
      .from('event_software_activations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('vendor_id', vendorId)
      .eq('is_reward_issued', true),
    admin
      .from('token_rewards_log')
      .select('tokens_awarded, processed_at')
      .eq('event_id', eventId)
      .eq('vendor_id', vendorId)
      .order('processed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const ladderPosition = cumulativeCompleted ?? 0;
  const tokensThisCall = rewardLog?.tokens_awarded ?? 0;

  // Cumulative event tokens · sum of all reward rows for this event_vendor pair.
  const { data: allRewards } = await admin
    .from('token_rewards_log')
    .select('tokens_awarded')
    .eq('event_id', eventId)
    .eq('vendor_id', vendorId);
  const cumulativeEventTokens = (allRewards ?? []).reduce(
    (sum, r) => sum + (r.tokens_awarded ?? 0),
    0,
  );

  return ok({
    event_id: eventId,
    vendor_id: vendorId,
    service_code: serviceCode,
    checkpoint_passed: true,
    ladder_position: ladderPosition,
    tokens_awarded_this_call: tokensThisCall,
    cumulative_event_tokens: cumulativeEventTokens,
    cumulative_event_ladder_max: 14,
    wallet_earned_balance: wallet?.earned_tokens ?? 0,
    wallet_purchased_balance: wallet?.purchased_tokens ?? 0,
    voucher_expires_at: voucherExpiry().toISOString(),
    voucher_expiry_days: VOUCHER_EXPIRY_DAYS,
    ladder: LADDER,
    mode: 'live',
  });
}

// ---------- checkpoint validators ----------

type CheckpointResult = { passed: true } | { passed: false; reason: string };

function validateCheckpoint(serviceCode: string, t: TelemetryPayload): CheckpointResult {
  switch (serviceCode) {
    case 'PAPIC_SEATS':
    case 'PAPIC_GUEST':
    case 'PAPIC_GUEST_STORIES':
    case 'PAPIC_MEDIA_PACK': {
      const p = t.papic;
      if (!p) return { passed: false, reason: 'papic telemetry section missing' };
      if (p.active_devices < 3) {
        return { passed: false, reason: `active_devices=${p.active_devices} (need ≥3 of 5)` };
      }
      if (p.valid_files_count <= 50) {
        return { passed: false, reason: `valid_files_count=${p.valid_files_count} (need >50)` };
      }
      if (p.min_file_bytes <= 500_000) {
        return { passed: false, reason: `min_file_bytes=${p.min_file_bytes} (need >500000 to block bot-burst)` };
      }
      return { passed: true };
    }
    case 'PANOOD_SYSTEM': {
      const p = t.panood;
      if (!p) return { passed: false, reason: 'panood telemetry section missing' };
      if (p.continuous_rtmp_minutes <= 30) {
        return { passed: false, reason: `continuous_rtmp_minutes=${p.continuous_rtmp_minutes} (need >30)` };
      }
      return { passed: true };
    }
    case 'PATIKTOK_COMPILER': {
      const p = t.patiktok;
      if (!p) return { passed: false, reason: 'patiktok telemetry section missing' };
      if (p.rendered_reel_assets < 1) {
        return { passed: false, reason: `rendered_reel_assets=${p.rendered_reel_assets} (need ≥1)` };
      }
      return { passed: true };
    }
    case 'PABATI': {
      const p = t.pabati;
      if (!p) return { passed: false, reason: 'pabati telemetry section missing' };
      if (p.unique_5s_clips <= 15) {
        return { passed: false, reason: `unique_5s_clips=${p.unique_5s_clips} (need >15)` };
      }
      return { passed: true };
    }
    case 'SDE': {
      const p = t.sde;
      if (!p) return { passed: false, reason: 'sde telemetry section missing' };
      if (p.render_callback_status !== 'ok') {
        return { passed: false, reason: `render_callback_status=${p.render_callback_status} (need ok)` };
      }
      return { passed: true };
    }
    case 'CAMERA_BRIDGE': {
      const p = t.camera_bridge;
      if (!p) return { passed: false, reason: 'camera_bridge telemetry section missing' };
      if (p.media_transit_bytes <= 1_000_000_000) {
        return { passed: false, reason: `media_transit_bytes=${p.media_transit_bytes} (need >1GB)` };
      }
      return { passed: true };
    }
    case 'LIVE_WALL': {
      const p = t.live_wall;
      if (!p) return { passed: false, reason: 'live_wall telemetry section missing' };
      if (p.socket_uninterrupted_minutes <= 60) {
        return { passed: false, reason: `socket_uninterrupted_minutes=${p.socket_uninterrupted_minutes} (need >60)` };
      }
      return { passed: true };
    }
    case 'PAKANTA': {
      const p = t.pakanta;
      if (!p) return { passed: false, reason: 'pakanta telemetry section missing' };
      if (p.suno_validation_status !== 'ok') {
        return { passed: false, reason: `suno_validation_status=${p.suno_validation_status} (need ok)` };
      }
      return { passed: true };
    }
    default:
      return { passed: false, reason: `no checkpoint validator for ${serviceCode}` };
  }
}

// ---------- demo synthesis ----------

function synthesizeRewardForDemo(eventId: string, vendorId: string, serviceCode: string) {
  // Deterministic-ish ladder position by hashing the (event, vendor) pair so
  // repeated demo calls with different services walk the ladder predictably.
  const seed = hashToInt(`${eventId}:${vendorId}`) % LADDER.length;
  const ladderPosition = seed + 1; // 1..7
  const tokensAwardedThisCall = LADDER[seed];
  // Cumulative = sum of ladder[0..seed].
  const cumulativeEventTokens = LADDER.slice(0, seed + 1).reduce((a, b) => a + b, 0);
  // Wallet balance = cumulative + a synthetic existing balance based on vendor hash.
  const walletEarnedBalance = cumulativeEventTokens + (hashToInt(vendorId) % 20);
  return {
    ladderPosition,
    tokensAwardedThisCall,
    cumulativeEventTokens,
    walletEarnedBalance,
  };
}

function hashToInt(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
}

function voucherExpiry(): Date {
  return new Date(Date.now() + VOUCHER_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

// ---------- response helpers ----------

function ok(body: unknown): NextResponse {
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function err(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
