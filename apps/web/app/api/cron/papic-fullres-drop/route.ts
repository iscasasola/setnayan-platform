import { NextResponse, type NextRequest } from 'next/server';
import { runFullResDropSweep } from '@/lib/papic-fullres-drop';

// 3-month full-res drop sweep (owner 2026-07-11). Weekly Vercel cron.
//
// ⚠ DESTRUCTIVE when enabled: deletes OUR R2 copy of full-res photo originals
// past the free window, keeping the forever web copy (the couple's Drive copy is
// never touched). Ships DRY-RUN by default — deletes NOTHING unless
// PAPIC_FULLRES_DROP_ENABLED='true'. Pass ?dry=1 to force a preview even when
// enabled (safe to hit manually to see the eligible count first).
//
// Auth: EITHER `Authorization: Bearer <CRON_SECRET>` (Vercel Cron) OR
//   `x-cron-secret: <CRON_SECRET>` (manual). Timing-safe, fail-closed.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function handle(req: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET ?? '';
  if (!expected) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const authz = req.headers.get('authorization') ?? '';
  const bearer = authz.startsWith('Bearer ') ? authz.slice('Bearer '.length) : '';
  const headerSecret = req.headers.get('x-cron-secret') ?? '';
  const ok =
    (bearer.length > 0 && timingSafeEqual(bearer, expected)) ||
    (headerSecret.length > 0 && timingSafeEqual(headerSecret, expected));
  if (!ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const forceDry = req.nextUrl.searchParams.get('dry') === '1';
  const summary = await runFullResDropSweep(forceDry ? { dryRun: true } : {});
  return NextResponse.json({ ok: true, ...summary });
}

// Vercel Cron issues GET; support POST too for manual/programmatic calls.
export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
