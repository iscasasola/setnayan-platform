import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { NotificationRow } from '@/lib/notifications';
import { formatPhp } from '@/lib/php';
import { LabShell } from '@/app/dev/_components/lab-shell';
import { NotificationsHead, NotificationsList } from '@/app/_components/notifications/notifications-list';

/**
 * 🔔 THE NOTIFICATIONS LAB — the bell's pop-over and its "View all" page (owner 2026-10-25: "shouldn't it be a pop up
 * to see the notifications and an option to view all?" · "view all notifications simpler" · "Build it"), drawn through
 * the REAL `UnreadBellBadge` in the REAL shared bar (`LabShell`) and the REAL `NotificationsHead` + `NotificationsList`
 * the couple page mounts, on the approved prototype's sample notices (the shipped emitters' own words). No sign-in, no
 * database. DEV-ONLY: production builds 404 this route.
 *
 *   (default)     a page behind the bell — press the bell for the pop-over (desktop) or the sheet (phone)
 *   ?view=all     "View all": the couple's notifications page body
 *   ?empty=1      nothing at all: "You're all caught up" in the pop-over, the page's own empty words on View all
 *   ?fail=1       the pop-over's read fails (a lab cannot read): it says so, never "all caught up"
 */
export const dynamic = 'force-dynamic';

const ME = '00000000-0000-4000-8000-0000000000aa';

function ago(hours: number, now: number): string {
  return new Date(now - hours * 3_600_000).toISOString();
}

/** The prototype's sample order amount — formatted, never typed (`public-price-literals.test.ts`). */
const SAMPLE_ORDER = formatPhp(2500);

function notices(now: number): NotificationRow[] {
  const n = (
    id: string,
    type: NotificationRow['type'],
    hours: number,
    unread: boolean,
    title: string,
    body: string,
    related_url: string | null,
  ): NotificationRow => ({
    notification_id: id,
    user_id: ME,
    type,
    title,
    body,
    related_url,
    read_at: unread ? null : ago(hours - 1, now),
    created_at: ago(hours, now),
  });
  return [
    n('n1', 'rsvp_received', 18, true, "Maria Santos RSVP'd: Attending", 'Meal preference: Fish. They left you a note.', '/dev/notifications-lab?view=all'),
    n('n2', 'chat_message', 2, true, 'New message from Lumina Photo Co.', 'Yes to the 3pm slot — sending the contract tonight.', '/dev/notifications-lab?view=all'),
    n('n3', 'guest_claim_pending', 5, true, 'Someone asked to join your guest list', 'Ana Reyes asked to join. They are not inside yet — Keep, Link or Remove them in Requests.', null),
    n('n4', 'order_quoted', 9, true, `Order S89O-3F7K2M9QXT quoted at ${SAMPLE_ORDER}`, 'Open the order to view payment instructions.', null),
    n('n5', 'payment_matched', 48, false, `Payment of ${SAMPLE_ORDER} matched · order S89O-3F7K2M9QXT`, 'The Setnayan team confirmed your payment.', null),
    n('n6', 'event_auto_surfaced', 72, false, 'You were added to Cale & Ice', 'A couple added you to their event on Setnayan. You can leave any time from your events.', null),
    n('n7', 'rsvp_received', 96, false, 'Jose Dela Cruz updated their details', 'They added their mobile number.', null),
    n('n8', 'chat_message', 144, false, 'New message from Bloom & Vine', 'Thank you! See you on the day.', null),
    n('n9', 'rsvp_received', 192, false, "Liza Ocampo RSVP'd: Not attending", 'They left you a note.', null),
    n('n10', 'chat_message', 216, false, 'New message from Casa Verde Catering', 'Tasting confirmed for Saturday 10am.', null),
  ];
}

export default async function NotificationsLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const all = sp.empty === '1' ? [] : notices(Date.now());
  const view = sp.view === 'all' ? 'all' : 'page';
  const unread = all.filter((x) => !x.read_at).length;
  const returnTo = view === 'all' ? '/dev/notifications-lab?view=all' : '/dev/notifications-lab';

  return (
    <LabShell
      eventId="lab"
      gutter={false}
      notices={sp.fail === '1' ? undefined : all.slice(0, 8)}
      bellUnread={sp.empty === '1' ? 0 : 12}
    >
      {view === 'all' ? (
        <div className="mx-auto w-full max-w-3xl pb-10 pt-4 lg:pt-7" data-notifications-page="">
          <NotificationsHead unreadCount={unread} returnTo={returnTo} level="page" />
          <NotificationsList
            items={all}
            returnTo={returnTo}
            emptyState={{
              title: 'No notifications yet.',
              body: (
                <>
                  You&rsquo;ll see notifications when a supplier replies to a thread, when the Setnayan team confirms
                  an order quote, or when a payment is matched. While you&rsquo;re here — head to the dashboard and add a
                  supplier or start a thread to kick things off.
                </>
              ),
              footer: (
                <Link href="/dev/notifications-lab" className="button-secondary">
                  Back to events
                </Link>
              ),
            }}
          />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-6" data-lab-behind="">
          <p className="font-display text-[34px] font-semibold leading-tight text-ink">Cale &amp; Ice</p>
          <p className="mt-1 text-sm text-[var(--m-slate-2)]">Sat 14 Feb 2027 · Tagaytay</p>
          <p className="mt-6 text-sm text-[var(--m-slate-2)]">Press the bell.</p>
        </div>
      )}
    </LabShell>
  );
}
