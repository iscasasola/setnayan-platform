import { NextResponse, type NextRequest } from 'next/server';

import { runSocialFlush } from '@/lib/social/flush';
import { webhookSecretAuthorized } from '@/lib/webhook-secret-auth';

/**
 * POST /api/cron/social-flush — opens each Facebook slot on time (controller review of #8446, 2026-11-28).
 *
 * Posting happens only inside the 08:00 · 12:00 (holiday) · 14:00 · 20:00 Manila slots (lib/social/governor.ts).
 * The flush otherwise rides page traffic through `after()`, so a quiet hour meant a slot nobody opened. This is the
 * clock: `.github/workflows/social-slots.yml` calls it a couple of minutes into each slot and again ~10 minutes
 * later. ⚠ A GitHub Actions schedule, NOT a Vercel cron or pg_cron — the repo's cron-free decision is about those
 * (see the note in `.github/workflows/deploy-prod.yml`), and `vercel.json` keeps `"crons": []`.
 *
 * It is the SAME flush the pages run (`runSocialFlush`), with a 1-minute throttle instead of 10, so the claim on
 * `social_publish_settings.last_flush_at` still stops two runners flushing at once, and the autopublish switch and
 * every per-platform switch still decide whether anything is published.
 *
 * Auth: `x-cron-secret: <CRON_SECRET>` or `Authorization: Bearer <CRON_SECRET>`, timing-safe, fail-closed — the
 * same secret and shape as the other `/api/cron/*` routes. No secret configured → 403, never an open door.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const authz = req.headers.get('authorization') ?? '';
  const bearer = authz.startsWith('Bearer ') ? authz.slice('Bearer '.length) : null;
  const ok =
    webhookSecretAuthorized(req.headers.get('x-cron-secret'), secret) || webhookSecretAuthorized(bearer, secret);
  if (!ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const ran = await runSocialFlush({ scheduled: true });
  // ran=false is not an error: another runner (a page visit, or the retry) flushed within the last minute.
  return NextResponse.json({ ok: true, ran });
}
