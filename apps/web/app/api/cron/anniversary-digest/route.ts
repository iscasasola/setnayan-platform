import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import {
  buildAnniversaryEmail,
  anniversaryUnsubscribeHeaders,
} from '@/lib/anniversary-emails';

// Anniversary "on this day" re-engagement digest (PR-G).
//
// POST /api/cron/anniversary-digest
// Auth: EITHER `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends this)
//   OR `x-cron-secret: <CRON_SECRET>` (manual / external scheduler). Timing-safe
//   compare, fail-closed: an unset CRON_SECRET → 403.
//
// Finds couples whose wedding anniversary is TODAY in Asia/Manila (the audience
// timezone — PH wedding dates are stored as plain DATE, so we anchor "today" to
// Manila local, not UTC) via the couples_with_anniversary_today RPC, then emails
// each a warm "N years ago today — relive your day" recap.
//
// Idempotency: per candidate we INSERT the (event_id, anniversary_year) lock row
// FIRST. A 23505 (already sent — same day re-run, retry, or a duplicate from a
// race) means skip. Only on a successful insert do we build + send, then stamp
// the resend_id back. Each candidate is wrapped in try/catch so one failure can't
// abort the batch. Bounded at MAX_BATCH per invocation.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BATCH = 200;
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/+$/, '');

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Today's date as YYYY-MM-DD in Asia/Manila (UTC+8, no DST). */
function manilaTodayIso(): string {
  // en-CA renders ISO-shaped YYYY-MM-DD; the timeZone makes the day boundary
  // Manila-local so a wedding date matches on the PH calendar day, not UTC's.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

type AnniversaryCandidate = {
  event_id: string;
  display_name: string | null;
  slug: string | null;
  event_date: string;
  years_ago: number;
  couple_user_id: string;
  couple_email: string;
  couple_name: string | null;
};

export async function POST(req: NextRequest) {
  // Auth — fail closed. Accept Vercel-cron Bearer OR manual x-cron-secret.
  const expected = process.env.CRON_SECRET ?? '';
  if (!expected) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const authz = req.headers.get('authorization') ?? '';
  const bearer = authz.startsWith('Bearer ') ? authz.slice('Bearer '.length) : '';
  const headerSecret = req.headers.get('x-cron-secret') ?? '';
  const ok =
    (bearer.length > 0 && timingSafeEqual(bearer, expected)) ||
    (headerSecret.length > 0 && timingSafeEqual(headerSecret, expected));
  if (!ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const pToday = manilaTodayIso();
  const anniversaryYear = Number(pToday.slice(0, 4));
  const admin = createAdminClient();

  const { data, error } = await admin.rpc('couples_with_anniversary_today', {
    p_today: pToday,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const candidates = ((data ?? []) as AnniversaryCandidate[]).slice(0, MAX_BATCH);

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const c of candidates) {
    try {
      // Claim the per-anniversary lock FIRST. A unique-violation (23505) means
      // it's already been sent this year — skip without sending.
      const { error: lockErr } = await admin
        .from('anniversary_email_log')
        .insert({ event_id: c.event_id, anniversary_year: anniversaryYear });
      if (lockErr) {
        if (lockErr.code === '23505') {
          skipped += 1;
        } else {
          errors += 1;
        }
        continue;
      }

      const to = (c.couple_email ?? '').trim();
      if (!to) {
        // No reachable address — the lock is already claimed, so we won't retry
        // a couple we can't email. Count it as skipped.
        skipped += 1;
        continue;
      }

      const { subject, text, html } = buildAnniversaryEmail({
        coupleName: (c.couple_name ?? '').trim() || (c.display_name ?? '').trim(),
        eventName: (c.display_name ?? '').trim(),
        yearsAgo: c.years_ago,
        ctaHref: `${APP_URL}/dashboard/library?tab=photos`,
      });

      const result = await sendEmail({
        to,
        subject,
        text,
        html,
        headers: anniversaryUnsubscribeHeaders(),
      });

      if (result.ok) {
        sent += 1;
        await admin
          .from('anniversary_email_log')
          .update({ resend_id: result.id })
          .eq('event_id', c.event_id)
          .eq('anniversary_year', anniversaryYear);
      } else {
        // Send failed (or Resend unconfigured) — release the lock so a later run
        // can retry this couple. A possible duplicate beats a silently-dropped
        // anniversary.
        errors += 1;
        await admin
          .from('anniversary_email_log')
          .delete()
          .eq('event_id', c.event_id)
          .eq('anniversary_year', anniversaryYear);
      }
    } catch (e) {
      errors += 1;
      console.error('[anniversary-digest] candidate failed:', c.event_id, e);
    }
  }

  return NextResponse.json({
    scanned: candidates.length,
    sent,
    skipped,
    errors,
  });
}
