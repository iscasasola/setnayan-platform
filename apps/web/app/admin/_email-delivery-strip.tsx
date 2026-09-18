import Link from 'next/link';
import { MailWarning } from 'lucide-react';
import { isEmailConfigured } from '@/lib/email';
import { readRecentDeliveries } from '@/lib/email-delivery.server';
import { homeAlert } from '@/lib/email-delivery-log';

/**
 * 📬 EVERY EMAIL SAYS WHETHER IT ARRIVED — where a failure becomes VISIBLE.
 *
 * The delivery log (`public.email_deliveries`) is worth nothing if a bounce only
 * lands in a table: a log line never changed a pixel. This strip is the pixel.
 * It sits on the admin home, the page the owner opens, and it renders ONLY for
 * trouble — email switched off, the log unreadable, or an email in the last
 * seven days that did not arrive. A healthy week renders nothing, so the strip
 * never becomes wallpaper. The verdict is decided in `homeAlert`
 * (lib/email-delivery-log.ts), which a test executes.
 */
export async function EmailDeliveryStrip() {
  const [configured, log] = await Promise.all([isEmailConfigured(), readRecentDeliveries()]);
  const alert = homeAlert({
    configured,
    readFailed: !log.ok,
    summary: log.ok ? log.summary : null,
  });
  if (!alert) return null;

  const danger = alert.tone === 'danger';
  return (
    <Link
      href="/admin/settings?tab=notifications#email-delivery"
      data-email-delivery-strip={alert.tone}
      className={`mb-4 flex items-start gap-3 rounded-xl border p-4 transition-colors ${
        danger
          ? 'border-danger-300 bg-danger-50 hover:bg-danger-100'
          : 'border-amber-300 bg-amber-50 hover:bg-amber-100'
      }`}
    >
      <MailWarning
        aria-hidden
        className={`mt-0.5 h-5 w-5 shrink-0 ${
          danger ? 'text-danger-700' : 'text-amber-800'
        }`}
        strokeWidth={1.75}
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{alert.headline}</span>
        <span className="block text-xs text-ink/70">{alert.detail}</span>
      </span>
    </Link>
  );
}
