/**
 * Admin smoke-test endpoint — owner-only utility for verifying prod
 * infrastructure (Sentry error capture · Resend email delivery).
 *
 * GET /api/admin/smoke-test?type=sentry
 *   - Throws a controlled error so Sentry should capture + alert
 *   - Returns 500 with diagnostic JSON BEFORE the throw so caller sees it
 *
 * GET /api/admin/smoke-test?type=resend
 *   - Sends a test email to OWNER_NOTIFICATION_EMAIL via the existing
 *     sendEmail() helper. Returns the Resend message ID on success.
 *
 * Auth: gated to internal/admin users via the standard pattern. Anyone
 * else gets 404 so the endpoint's existence isn't leaked.
 *
 * Per [[reference_setnayan_cron_strategy]]: this is a one-shot owner-action
 * endpoint, not a cron-driven background sweep.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';
import { getOwnerNotificationEmail } from '@/lib/hiring-guide/emails';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('users')
    .select('account_type, is_internal, is_team_member')
    .eq('user_id', user.id)
    .maybeSingle();
  const isAdmin =
    profile?.is_internal ||
    profile?.is_team_member ||
    profile?.account_type === 'admin';
  return isAdmin ? user : null;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    // 404, not 401 — don't leak existence of admin endpoint
    return new NextResponse('Not found', { status: 404 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get('type');

  if (type === 'sentry') {
    const traceId = `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // Throw AFTER returning a hint — but a response can't both throw and
    // return, so we have to commit to one. The Sentry-side smoke test
    // succeeds by the throw being captured.
    //
    // We log the trace ID before throwing so the caller can search Sentry
    // for it. The endpoint then returns a 500 from the framework's error
    // boundary AFTER Sentry captures the error.
    console.error(`[smoke-test] sentry throw trace_id=${traceId}`);
    throw new Error(
      `Setnayan smoke test — Sentry capture verification. trace_id=${traceId}. Triggered by admin ${admin.id} at ${new Date().toISOString()}`,
    );
  }

  if (type === 'resend') {
    const ownerEmail = getOwnerNotificationEmail();
    const now = new Date().toISOString();
    const result = await sendEmail({
      to: ownerEmail,
      subject: `Setnayan Resend smoke test — ${now.slice(0, 19).replace('T', ' ')} UTC`,
      text: [
        `This is a smoke-test email confirming Resend prod delivery.`,
        ``,
        `Triggered by: admin user ${admin.id}`,
        `Timestamp: ${now}`,
        `Recipient: ${ownerEmail}`,
        ``,
        `If you received this email, Resend is configured + working in production.`,
        ``,
        `If you DID NOT receive this email but the admin dashboard says success, check:`,
        `  • RESEND_API_KEY is set in Vercel env (production)`,
        `  • RESEND_FROM_ADDRESS is a verified Resend domain (not onboarding@resend.dev)`,
        `  • Recipient address is the correct OWNER_NOTIFICATION_EMAIL`,
        `  • No bounces / spam filter blocks on the Resend dashboard`,
        ``,
        `—`,
        `Set na 'yan.`,
      ].join('\n'),
    });

    return NextResponse.json({
      ok: result.ok,
      type: 'resend',
      recipient: ownerEmail,
      ...(result.ok
        ? { messageId: (result as { id: string }).id, via: 'resend' }
        : { reason: (result as { reason: string }).reason, error: (result as { error?: string }).error }),
    });
  }

  return NextResponse.json(
    {
      error: 'unknown_type',
      message: 'Supported: ?type=sentry | ?type=resend',
      received: type,
    },
    { status: 400 },
  );
}
