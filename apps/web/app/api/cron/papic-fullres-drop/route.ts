import { NextResponse, type NextRequest } from 'next/server';
import { runFullResDropSweep } from '@/lib/papic-fullres-drop';

// 6-month full-res drop sweep (owner 2026-07-11).
//
// ⚠ NOT a Vercel cron — vercel.json has `"crons": []`. It is driven by the
// cron-free after() claim on admin traffic. This line said "Weekly Vercel cron"
// and there is no such schedule.
//
// ⚠ DESTRUCTIVE when enabled: deletes OUR R2 copy of full-res photo originals
// past the free window, keeping the forever web copy (the couple's Drive copy is
// never touched). ⚠ IT IS SWITCHED ON: the gate is `!== 'false'`, i.e. deletes
// UNLESS PAPIC_FULLRES_DROP_ENABLED='false'. This comment said "Ships DRY-RUN by
// default" — the same false sentence that was in the library header, in a second
// place, which is why correcting one copy was never going to be enough.
// Pass ?dry=1 to force a preview even when enabled (safe to hit manually to see
// the eligible count first).
//
// CLIPS (Papic storage PR-2) are swept only when PAPIC_CLIP_DROP_ENABLED='true'
// (a separate go-live gate, OFF by default); a clip's raw is dropped only after
// its HEAD-verified, grace-aged web copy is confirmed, and only the raw is
// deleted (the poster still + web copy are kept). Summary carries clipsDropped +
// clipWebUnverified for that path.
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
