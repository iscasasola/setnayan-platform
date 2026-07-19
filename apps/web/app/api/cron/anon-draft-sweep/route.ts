import { NextResponse, type NextRequest } from 'next/server';
import { runAnonDraftSweep } from '@/lib/anon-draft-sweep';

// Abandoned anonymous-draft cleanup (RA 10173 data-minimization).
//
// CRON-FREE by default — the schedule runs via maybeRunAnonDraftSweep()
// (lib/anon-draft-sweep.ts), fired from admin-layout after() + a DAILY DB claim.
// This route is retained as a manual / curl trigger for the destructive sweep.
//
// POST /api/cron/anon-draft-sweep
// Auth: EITHER `Authorization: Bearer <CRON_SECRET>` OR `x-cron-secret`.
// Timing-safe, fail-closed.
//
// Deletes UNCONVERTED anon-draft accounts (auth.users.is_anonymous = true, still
// carrying the placeholder email) older than the TTL, event(s) first (cascade)
// then the auth user — EXCLUDING any event with an orders row (BIR/contract
// legal-hold floor). See lib/anon-draft-sweep.ts for the full safety model; the
// TTL is a DPO/counsel sign-off item.

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

  const { scanned, deleted } = await runAnonDraftSweep();
  return NextResponse.json({ scanned, deleted });
}
