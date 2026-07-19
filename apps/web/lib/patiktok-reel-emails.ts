import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEmailConfigured, sendEmail } from '@/lib/email';
import { renderBrandedEmail } from '@/lib/email-template';

// Iteration 0017 PR4 — "your Patiktok reel is ready" delivery email.
//
// Called from finalizePatiktokRenderJob via after() (cron-free — fires after
// the response, never blocks the render finalize). Resolves the couple's email,
// sends a branded "reel ready" notice linking back to the Patiktok dashboard
// (durable — the in-page download resolves a fresh URL there), and stamps
// delivered_at on the job. Self-guards on RESEND config and NEVER throws: a
// hiccup here must not surface as a failed render.

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(
  /\/+$/,
  '',
);

export async function sendPatiktokReelReadyEmail(input: {
  eventId: string;
  jobId: string;
  templateName?: string | null;
}): Promise<void> {
  try {
    if (!(await isEmailConfigured())) return;

    const admin = createAdminClient();

    // Resolve the couple's email (first couple member on the event).
    const { data: coupleRow } = await admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', input.eventId)
      .eq('member_type', 'couple')
      .limit(1)
      .maybeSingle();
    const coupleUserId = coupleRow?.user_id as string | undefined;
    if (!coupleUserId) return;

    const { data: userRow } = await admin
      .from('users')
      .select('email, display_name')
      .eq('id', coupleUserId)
      .maybeSingle();
    const to = ((userRow?.email as string | null) ?? '').trim();
    if (!to) return;
    const name = ((userRow?.display_name as string | null) ?? '').trim();

    const link = `${APP_URL}/dashboard/${input.eventId}/studio/patiktok`;
    const reel = (input.templateName ?? '').trim() || 'Patiktok reel';
    const subject = 'Your Patiktok reel is ready 🎬';
    const text =
      `${name ? `Hi ${name},\n\n` : ''}Your ${reel} just finished rendering — ` +
      `it's ready to watch and download.\n\nOpen it here:\n${link}\n\n— Setnayan`;
    const html = renderBrandedEmail({
      heading: 'Your Patiktok reel is ready',
      paragraphs: [
        `${name ? `Hi ${name} — ` : ''}your ${reel} just finished rendering. It's ready to watch and download from your dashboard.`,
      ],
      ctaLabel: 'Watch & download',
      ctaHref: link,
      footnote: 'Rendered right in your browser · 9:16 · 1080×1920.',
    });

    const res = await sendEmail({ to, subject, text, html });
    if (res.ok) {
      await admin
        .from('patiktok_render_jobs')
        .update({ delivered_at: new Date().toISOString() })
        .eq('job_id', input.jobId);
    }
  } catch {
    // best-effort — delivery must never break finalize
  }
}
