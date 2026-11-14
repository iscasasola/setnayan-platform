import Link from 'next/link';
import { Notice } from '@/app/_components/notices/notices';
import { NOTICE_ACTION } from '@/app/_components/notices/notice-styles';
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

  // 🔔 A LIVE notice (ONE NOTICE SYSTEM, owner approved 14 Nov 2026) that cannot be hidden: email not arriving
  // affects other people. Its fact is in the key, so a different trouble is a different notice.
  const danger = alert.tone === 'danger';
  return (
    <Notice
      kind="live"
      tone={danger ? 'problem' : 'warning'}
      closable={false}
      noticeKey={`email-delivery:${alert.tone}:${alert.headline}`}
      title={alert.headline}
      detail={alert.detail}
      actions={
        <Link
          href="/admin/settings?tab=notifications#email-delivery"
          data-email-delivery-strip={alert.tone}
          className={NOTICE_ACTION}
        >
          Open email settings
        </Link>
      }
    />
  );
}
