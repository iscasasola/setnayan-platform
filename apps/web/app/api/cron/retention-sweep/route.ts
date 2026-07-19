import { NextResponse, type NextRequest } from 'next/server';
import { runRetentionSweep } from '@/lib/retention-sweep';

// Data Retention Schedule enforcement (2026-07-11 · class 1 chat · 5-yr default).
//
// NO LONGER on Vercel Cron — the schedule moved to the CRON-FREE pattern
// (maybeRunRetentionSweep in lib/retention-sweep.ts, fired from admin-layout
// after() + a weekly DB claim). This route is RETAINED as a manual / curl
// trigger for the destructive sweep.
//
// POST /api/cron/retention-sweep
// Auth: EITHER `Authorization: Bearer <CRON_SECRET>` OR `x-cron-secret`.
// Timing-safe, fail-closed.
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

  const { purged } = await runRetentionSweep();
  return NextResponse.json({ purged, retention_years: 5 });
}
