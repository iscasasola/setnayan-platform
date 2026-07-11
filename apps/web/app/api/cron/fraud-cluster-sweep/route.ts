import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Fraud cluster sweep — Phase E slice 2 (SHADOW mode: flag admin only).
//
// POST /api/cron/fraud-cluster-sweep
// Auth: EITHER `Authorization: Bearer <CRON_SECRET>` (Vercel Cron) OR
//   `x-cron-secret: <CRON_SECRET>`. Timing-safe, fail-closed.
//
// Two steps, in order:
//   1. refresh_identity_clusters() — recompute the account-linkage matview from
//      the (now-populated, once device capture is on) user_devices + address +
//      payment signals.
//   2. detect_inquiry_concentration() — raise an admin integrity_flags WATCH row
//      for each (vendor, linked-cluster) that sprayed one vendor via ≥N distinct
//      accounts. HUMAN review only — this NEVER withholds an inquiry.
//
// Gated on the device-fingerprint flag (read via env — slice 1's flag module
// isn't in this branch): concentration is only meaningful once device edges feed
// the clusters, so the whole pipeline activates with device capture. Idempotent;
// safe to run when off (returns skipped).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET ?? '';
  if (!expected) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const authz = req.headers.get('authorization') ?? '';
  const bearer = authz.startsWith('Bearer ') ? authz.slice('Bearer '.length) : '';
  const headerSecret = req.headers.get('x-cron-secret') ?? '';
  const ok =
    (bearer.length > 0 && timingSafeEqual(bearer, expected)) ||
    (headerSecret.length > 0 && timingSafeEqual(headerSecret, expected));
  if (!ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  // Pipeline activates with device-fingerprint capture (slice 1).
  if (process.env.NEXT_PUBLIC_DEVICE_FINGERPRINT_ENABLED !== 'true') {
    return NextResponse.json({ skipped: true, reason: 'device_fingerprint_disabled' });
  }

  const admin = createAdminClient();

  // Step 1 — refresh the linkage matview (best-effort; never blocks step 2's
  // own error surfacing, but a failure here means step 2 reads stale clusters).
  const { error: refreshErr } = await admin.rpc('refresh_identity_clusters' as never);
  if (refreshErr) {
    return NextResponse.json({ error: `refresh: ${refreshErr.message}` }, { status: 500 });
  }

  // Step 2 — raise admin watch flags for concentration hits.
  const { data, error } = await admin.rpc('detect_inquiry_concentration' as never, {} as never);
  if (error) {
    return NextResponse.json({ error: `detect: ${error.message}` }, { status: 500 });
  }

  const flagged = typeof data === 'number' ? data : Number(data ?? 0);
  return NextResponse.json({ flagged: Number.isFinite(flagged) ? flagged : 0 });
}
