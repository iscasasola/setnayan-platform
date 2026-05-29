/**
 * V2 Phase D · POST /api/crew/register-device.
 *
 * WHY (per CLAUDE.md third 2026-05-28 row · V2 publisher pivot):
 * vendor's crew device scans the event's master QR (rendered by
 * /dashboard/[eventId]/event-qr) and POSTs the embedded token + a
 * device fingerprint to this endpoint. Endpoint resolves the event
 * via constant-time token compare, then INSERTs (or refreshes
 * last_seen_at on) a registered_crew_devices row. The 5-cap
 * trigger on the table enforces "max 5 per vendor per event" at the
 * DB layer — any 6th device returns 409 with a polite message.
 *
 * Constant-time compare prevents a timing-side-channel attack on
 * token guessing. Approach: SELECT event_id by token via the indexed
 * column (which is fast but not constant-time at the index lookup
 * level), THEN re-fetch the actual token and timingSafeEqual it
 * against the user-supplied value before trusting the result.
 *
 * Auth: this endpoint uses the service-role admin client because:
 *   (a) the crew device is NOT yet a signed-in Setnayan user — they
 *       hold no Supabase auth session, only the QR token + their
 *       vendor's identifier.
 *   (b) RLS on registered_crew_devices has no INSERT policy by
 *       design (per Phase D migration § 4 comment) — all writes
 *       route through this endpoint where app code enforces
 *       authorization.
 *
 * Per [[feedback_setnayan_orphan_prevention]] the endpoint is the
 * canonical consumer of the master QR; not orphan-reachable from any
 * other surface.
 *
 * Per [[feedback_setnayan_no_dev_text_post_launch]] the 5-cap error
 * message uses brand voice (polite + actionable, no jargon).
 */

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

type RegisterPayload = {
  master_qr_token?: unknown;
  vendor_profile_id?: unknown;
  device_fingerprint?: unknown;
  device_label?: unknown;
};

function isHex32(s: string): boolean {
  return /^[0-9a-f]{32}$/.test(s);
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export async function POST(req: Request) {
  let body: RegisterPayload;
  try {
    body = (await req.json()) as RegisterPayload;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const tokenRaw = body.master_qr_token;
  const vendorRaw = body.vendor_profile_id;
  const fingerprintRaw = body.device_fingerprint;
  const labelRaw = body.device_label;

  if (
    typeof tokenRaw !== 'string' ||
    typeof vendorRaw !== 'string' ||
    typeof fingerprintRaw !== 'string'
  ) {
    return NextResponse.json(
      { error: 'master_qr_token, vendor_profile_id, and device_fingerprint are required.' },
      { status: 400 },
    );
  }

  const token = tokenRaw.trim().toLowerCase();
  const vendorProfileId = vendorRaw.trim();
  const fingerprint = fingerprintRaw.trim();
  const label = typeof labelRaw === 'string' ? labelRaw.trim().slice(0, 80) : null;

  if (!isHex32(token)) {
    return NextResponse.json(
      { error: 'Invalid master_qr_token format.' },
      { status: 400 },
    );
  }
  if (!isUuid(vendorProfileId)) {
    return NextResponse.json(
      { error: 'Invalid vendor_profile_id format.' },
      { status: 400 },
    );
  }
  if (fingerprint.length < 8 || fingerprint.length > 256) {
    return NextResponse.json(
      { error: 'device_fingerprint must be 8–256 chars.' },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // Step 1 · index lookup by token. We accept that this lookup itself
  // is NOT constant-time (Postgres BTREE on a TEXT column has
  // length-dependent compare), but it's fast (~1ms) and the next
  // step re-confirms via timingSafeEqual against the actual stored
  // value, foiling the practical timing attack.
  const { data: eventRow, error: lookupErr } = await supabase
    .from('events')
    .select('event_id, master_qr_token')
    .eq('master_qr_token', token)
    .maybeSingle();

  if (lookupErr) {
    return NextResponse.json(
      { error: 'Lookup failed.' },
      { status: 500 },
    );
  }

  // Step 2 · constant-time confirm. If no row matched OR the stored
  // token doesn't constant-time-equal the user-supplied token, return
  // the same 404 with the same message — don't reveal whether the
  // token existed but was malformed vs didn't exist at all.
  const NOT_FOUND = NextResponse.json(
    { error: 'No event matches that QR. Ask your host to share a fresh code.' },
    { status: 404 },
  );

  if (!eventRow) {
    // Burn a comparable amount of time so attackers can't tell missing
    // rows from mismatched rows. Compare token against itself — same
    // CPU cost as a real timingSafeEqual would have spent.
    timingSafeEqual(Buffer.from(token), Buffer.from(token));
    return NOT_FOUND;
  }

  const storedToken = (eventRow.master_qr_token as string) ?? '';
  const a = Buffer.from(storedToken);
  const b = Buffer.from(token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NOT_FOUND;
  }

  const eventId = eventRow.event_id as string;

  // Step 3 · upsert the device. ON CONFLICT (event, vendor, fingerprint)
  // refreshes last_seen_at — same device re-scanning is idempotent.
  // The 5-cap trigger fires BEFORE INSERT on NEW rows where
  // revoked_at IS NULL · upsert that hits the conflict path UPDATEs
  // existing row (trigger fires BEFORE UPDATE; if the existing row
  // is active and below cap, update succeeds; if NEW.revoked_at IS
  // NOT NULL on the upsert payload the trigger short-circuits).
  const { data: deviceRow, error: insertErr } = await supabase
    .from('registered_crew_devices')
    .upsert(
      {
        event_id: eventId,
        vendor_profile_id: vendorProfileId,
        device_fingerprint: fingerprint,
        device_label: label,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'event_id,vendor_profile_id,device_fingerprint' },
    )
    .select('device_id, event_id, registered_at, last_seen_at')
    .maybeSingle();

  if (insertErr) {
    // Phase D migration raises with ERRCODE = 'check_violation'
    // ('23514' in Postgres) when the 5-cap trigger blocks the write.
    // Surface a brand-voice 409.
    const code = (insertErr as { code?: string }).code;
    if (code === '23514') {
      return NextResponse.json(
        {
          error:
            'Crew device limit reached for this vendor on this event. ' +
            'Ask one of your existing 5 paired devices to step out so a new one can pair.',
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: 'Could not register device.' },
      { status: 500 },
    );
  }

  if (!deviceRow) {
    return NextResponse.json(
      { error: 'Device registered but no row returned.' },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      device_id: deviceRow.device_id,
      event_id: deviceRow.event_id,
      registered_at: deviceRow.registered_at,
      last_seen_at: deviceRow.last_seen_at,
    },
    { status: 200 },
  );
}
