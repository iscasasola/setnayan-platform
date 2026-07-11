import { NextResponse, type NextRequest } from 'next/server';
import { sweepGhostedLeadHolds } from '@/lib/lead-token-holds';

// Ghosted lead-token-hold sweep — Phase B of fake-inquiry protection.
//
// POST /api/cron/lead-hold-sweep
// Auth: EITHER `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends this)
//   OR `x-cron-secret: <CRON_SECRET>` (manual / external). Timing-safe, fail-closed.
//
// Calls sweep_ghosted_lead_holds() (migration 20270726988829), which RELEASES
// every hold still 'held' past the 7-day ghost window. A hold flips to 'consumed'
// the instant the couple replies, so anything still 'held' after the window means
// the couple never replied = a fake / dead lead → the vendor's token is returned
// (it was never debited; release just drops it from the held sum, so available
// recovers automatically). Idempotent; safe to run even when the hold FLAG is off
// (no holds exist → 0 released). Vendor "token returned" notify is a follow-up.

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

  const released = await sweepGhostedLeadHolds('7 days');
  return NextResponse.json({ released });
}
