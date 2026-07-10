import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Data Retention Schedule enforcement (2026-07-11 · class 1 chat · 5-yr default).
//
// POST /api/cron/retention-sweep
// Auth: EITHER `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends this)
//   OR `x-cron-secret: <CRON_SECRET>` (manual / external). Timing-safe, fail-closed.
//
// Calls purge_expired_chat() (migration 20270714177342), which hard-deletes whole
// threads (cascading chat_messages + chat_thread_reads) for events older than
// RETENTION_YEARS, EXCEPT events carrying any orders row — a payment record puts
// the event under the 10-yr BIR/contract legal-hold floor, so its conversation is
// retained past the 5-yr chat default. Anchored to events.event_date (falling back
// to the thread's created_at when the wedding date is unknown).
//
// SCOPE: chat text only. Media (R2) retention is a SEPARATE track — the R2 bucket
// lifecycle is owner-configured in the Cloudflare dashboard (see OWNER_ACTIONS.md),
// not driven from here. See Data_Retention_Schedule_2026-07-11.md for the full
// per-class schedule + the [PENDING COUNSEL] items (esp. the 10-yr floors).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RETENTION_YEARS = 5;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: NextRequest) {
  // Auth — fail closed. Accept Vercel-cron Bearer OR manual x-cron-secret.
  const expected = process.env.CRON_SECRET ?? '';
  if (!expected) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const authz = req.headers.get('authorization') ?? '';
  const bearer = authz.startsWith('Bearer ') ? authz.slice('Bearer '.length) : '';
  const headerSecret = req.headers.get('x-cron-secret') ?? '';
  const ok =
    (bearer.length > 0 && timingSafeEqual(bearer, expected)) ||
    (headerSecret.length > 0 && timingSafeEqual(headerSecret, expected));
  if (!ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('purge_expired_chat', { p_years: RETENTION_YEARS });
  if (error) {
    // Pre-migration (function absent) or a transient error — surface it (500) so
    // the run is visibly skipped rather than silently reporting 0 purged. The
    // sweep is idempotent, so the next scheduled run retries cleanly.
    return NextResponse.json({ error: error.message, retention_years: RETENTION_YEARS }, { status: 500 });
  }

  const purged = typeof data === 'number' ? data : Number(data ?? 0);
  return NextResponse.json({ purged: Number.isFinite(purged) ? purged : 0, retention_years: RETENTION_YEARS });
}
