import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import {
  buildRenewalReminderEmail,
  renewalUnsubscribeHeaders,
} from '@/lib/subscription-renewal-emails';

// Subscription renewal reminders (owner 2026-07-10 · recurring-billing scaffold).
//
// POST /api/cron/renewal-reminders
// Auth: EITHER `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends this)
//   OR `x-cron-secret: <CRON_SECRET>` (manual / external). Timing-safe, fail-closed.
//
// Finds paid subscription orders whose prepaid window (`orders.expires_at`) lapses
// within REMINDER_DAYS and emails the BUYER a "renew before {date}" note. V1 has NO
// auto-charge — renewal is a manual prepaid re-purchase (this is the scaffold the
// gateway/auto-charge webhook plugs into later). Covers every order with an
// expires_at window (Custom Subdomain ₱999/yr + branch/custom-plan add-ons, etc).
//
// Idempotency: per candidate we INSERT the (order_id, reminder_window) lock row
// FIRST; a 23505 (already reminded / race) means skip. Only on a successful insert
// do we build + send. Each candidate is try/caught so one failure can't abort the
// batch. The RPC already excludes previously-logged orders — the insert is the
// atomic race-guard on top.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REMINDER_DAYS = 7;
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/+$/, '');

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Friendly product name from a raw service_key (best-effort). */
function productTitleFor(serviceKey: string): string {
  if (serviceKey === 'EVENT_SUBDOMAIN' || serviceKey === 'vendor_subdomain') return 'Custom Subdomain';
  return 'Setnayan subscription';
}

type RenewalCandidate = {
  order_id: string;
  service_key: string;
  expires_at: string;
  buyer_email: string;
  buyer_name: string | null;
};

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
  const window = `${REMINDER_DAYS}d`;

  const { data, error } = await admin.rpc('subscriptions_due_for_renewal_reminder', {
    p_days: REMINDER_DAYS,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const candidates = (data ?? []) as RenewalCandidate[];
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const c of candidates) {
    try {
      // Atomic idempotency lock — insert first; a duplicate (already reminded this
      // window) trips the UNIQUE (order_id, reminder_window) constraint → skip.
      const { error: lockErr } = await admin
        .from('renewal_reminder_log')
        .insert({ order_id: c.order_id, reminder_window: window });
      if (lockErr) {
        skipped += 1;
        continue;
      }

      const productTitle = productTitleFor(c.service_key);
      const email = buildRenewalReminderEmail({
        name: c.buyer_name,
        productTitle,
        expiresAt: new Date(c.expires_at),
        renewUrl: `${APP_URL}/pricing`,
      });

      await sendEmail({
        to: c.buyer_email,
        subject: email.subject,
        text: email.text,
        html: email.html,
        headers: renewalUnsubscribeHeaders(),
      });
      sent += 1;
    } catch {
      // Release the lock so a later run can retry this candidate.
      await admin
        .from('renewal_reminder_log')
        .delete()
        .eq('order_id', c.order_id)
        .eq('reminder_window', window);
      errors += 1;
    }
  }

  return NextResponse.json({ scanned: candidates.length, sent, skipped, errors });
}
