// The body of avatar › Email delivery (owner go 14 Nov 2026; the approved drawing is `Setnayan-specs`
// `prototypes/admin_five_tabs_2026-11-13/admin.html` `page('email-delivery' …)` + `page('notifications' …)`).
// It was the Settings studio's Notifications tab (`/admin/settings?tab=notifications`, and before that
// `/admin/notifications`); both old addresses forward to `/admin/email-delivery`. Nothing was dropped — the delivery
// log, the morning digest's switch beside its last send, push on this device, and the bell's own list.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCheck } from 'lucide-react';
import { PushToggle } from '@/app/_components/push-toggle';
import { createClient } from '@/lib/supabase/server';
import {
  fetchOwnNotifications,
  NOTIFICATION_TYPE_LABEL,
  NOTIFICATION_TYPE_TONE,
  relativeTime,
} from '@/lib/notifications';
import {
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/notification-actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { formatCount } from '@/lib/format-number';
import { TemplateEmpty, TemplateRows, TemplateSection, TEMPLATE_SUBLINE } from '@/app/_components/template-rows';
import { EmailDeliverySection } from '../_components/email-delivery-section';
import { MorningDigestCard } from '../_components/morning-digest-card';

/**
 * The admin in-app notification reader (cross-actor audit 2026-06-07). Admin users RECEIVE notification rows
 * (force_majeure_filed fan-out, help-intake) via emitNotification; this is their bell and reader. Same reader shape
 * as the supplier/couple surfaces; auth is enforced at the admin layout level.
 */
export async function NotificationsSurface({ error }: { error?: string } = {}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const items = await fetchOwnNotifications(supabase, user.id);
  const unreadCount = items.filter((n) => !n.read_at).length;
  // returnTo drives revalidatePath+redirect in the shared mark-read actions; it lands back on this screen.
  const returnTo = '/admin/email-delivery';

  return (
    <>
      {/* A failed save from this screen (the digest switch) says so here. */}
      {error ? (
        <p role="alert" className="py-2 text-[14px]" style={{ color: 'rgb(var(--color-warn))' }}>
          {error.slice(0, 300)}
        </p>
      ) : null}

      {/* 📬 Did the emails arrive? The Work strip links here (#email-delivery). */}
      <EmailDeliverySection />

      {/* 📨 The morning digest's switch, next to whether it actually went out (row 38). */}
      <MorningDigestCard />

      {/* 🔔 THE CONSOLE CAN REACH YOUR PHONE — added 2026-08-26.
       *
       * Everything else in this admin assumes you OPEN it. Nothing made you. In-app notices fan out correctly, but prod
       * held **zero** push subscriptions and the only toggles lived on the couple and supplier doorways — so the person
       * running Setnayan had no control anywhere to turn on phone alerts for admin work. Same component the couple's
       * profile uses, not a third copy. It asks for browser permission only when you flip it ON, and where push cannot
       * work it renders a quiet "not available" note rather than a dead switch. */}
      <TemplateSection label="This device">
        <div className="py-2">
          <PushToggle audience="admin" />
        </div>
      </TemplateSection>

      <TemplateSection label="The bell" right={unreadCount > 0 ? `${formatCount(unreadCount)} unread` : undefined}>
        {unreadCount > 0 ? (
          <form action={markAllNotificationsRead} className="flex justify-end">
            <input type="hidden" name="return_to" value={returnTo} />
            <SubmitButton className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-mulberry" pendingLabel="Marking…">
              <CheckCheck aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Mark all read
            </SubmitButton>
          </form>
        ) : null}
        {items.length === 0 ? (
          <TemplateEmpty data="bell-empty">
            No notifications yet. Dispute flags, help-center messages, and other team alerts land here.
          </TemplateEmpty>
        ) : (
          <TemplateRows label="Notifications">
            {items.map((n) => {
              const unread = !n.read_at;
              return (
                <li key={n.notification_id} data-notification-unread={unread ? 'true' : 'false'} className="flex min-h-14 items-start gap-2.5 py-2.5">
                  {unread ? <i aria-hidden className="mt-1 block h-9 w-1 flex-none rounded-sm" style={{ background: 'var(--m-orange)' }} /> : null}
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-semibold ${NOTIFICATION_TYPE_TONE[n.type]}`}>
                        {NOTIFICATION_TYPE_LABEL[n.type]}
                      </span>
                      <b className="text-[15px] font-semibold leading-tight text-ink">{n.title}</b>
                    </span>
                    {n.body ? <span className={`mt-0.5 block ${TEMPLATE_SUBLINE}`}>{n.body}</span> : null}
                    <span className={`mt-0.5 block ${TEMPLATE_SUBLINE}`}>{relativeTime(n.created_at)}</span>
                  </span>
                  <span className="flex flex-none flex-col items-end gap-1">
                    {n.related_url ? (
                      <Link href={n.related_url} className="inline-flex min-h-11 items-center text-[13px] font-semibold text-mulberry">
                        Open ›
                      </Link>
                    ) : null}
                    {unread ? (
                      <form action={markNotificationRead}>
                        <input type="hidden" name="notification_id" value={n.notification_id} />
                        <input type="hidden" name="return_to" value={returnTo} />
                        <SubmitButton className="inline-flex min-h-11 items-center text-[13px] text-[color:var(--m-slate-2)]" pendingLabel="…">
                          Mark read
                        </SubmitButton>
                      </form>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </TemplateRows>
        )}
      </TemplateSection>
    </>
  );
}
