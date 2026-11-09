import { notFound } from 'next/navigation';
import type { NotificationRow } from '@/lib/notifications';
import { formatPhp } from '@/lib/php';
import { refundDayWords } from '@/lib/client-refunds';
import { VideoLinks } from '@/app/vendor-dashboard/collections/_components/portfolio-groups';
import { ShopMakers } from '@/app/vendor-dashboard/shop/_components/shop-makers';
import { NotificationsList } from '@/app/_components/notifications/notifications-list';
import { SupplierRefundsView, type SupplierRefundRow } from '@/app/admin/payments/supplier-refunds/supplier-refunds-view';

/**
 * 🧪 THE BUILD 2 LEFTOVERS LAB — the four changed screens drawn through their REAL components on fixtures, for the
 * 390 px light/dark proof (no sign-in, no database; a save here is refused by the server, which is fine for a picture).
 * DEV-ONLY: production builds 404 this route.
 *
 *   ?part=videos   Portfolio › Video links — titled rows (?state=filled), no links (?state=empty), titles unread (?state=fail)
 *   ?part=makers   Shop › Makers — the Forms Maker tile: "3 saved" · "None yet" · "Couldn't load"
 *   ?part=refunds  Admin › Payments › Supplier refunds — rows · none yet · couldn't read
 *   ?part=notice   the couple's in-app refund notice in the notifications list (filled / empty)
 */
export const dynamic = 'force-dynamic';

const LINKS = ['https://www.youtube.com/watch?v=aqz-KE-bpKQ', 'https://vimeo.com/76979871', 'https://www.facebook.com/watch/?v=10153231379946729'];

const REFUNDS: SupplierRefundRow[] = [
  { refund_id: 'r1', event_id: 'e1', vendor_profile_id: 's1', amount_php: 5000, refunded_on: '2026-11-08', reason: 'Second shooter could not come — refunded the add-on.', proof_r2_key: 'r2://x', created_at: '2026-11-08T09:00:00Z', removed_at: null },
  { refund_id: 'r2', event_id: 'e2', vendor_profile_id: 's2', amount_php: 1500, refunded_on: '2026-11-06', reason: 'Late delivery of the printed menus.', proof_r2_key: null, created_at: '2026-11-06T12:00:00Z', removed_at: null },
  { refund_id: 'r3', event_id: 'e1', vendor_profile_id: 's1', amount_php: 2000, refunded_on: '2026-11-05', reason: 'Recorded twice by mistake.', proof_r2_key: null, created_at: '2026-11-05T08:00:00Z', removed_at: '2026-11-05T08:10:00Z' },
];

export default async function B2FinishLabPage({
  searchParams,
}: {
  searchParams: Promise<{ part?: string; state?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const q = await searchParams;
  const state = q.state === 'empty' ? 'empty' : q.state === 'fail' ? 'fail' : 'filled';
  const part = q.part ?? 'videos';

  if (part === 'refunds') {
    return (
      <div className="min-h-screen bg-[var(--sn-paper,var(--m-paper))] text-ink" data-b2-lab="refunds">
        <SupplierRefundsView
          rows={state === 'fail' ? null : state === 'empty' ? [] : REFUNDS}
          readError={state === 'fail' ? { message: 'lab: refused' } : null}
          shopName={new Map([['s1', 'Lumina Photo Co.'], ['s2', 'Casa Verde Catering']])}
          eventName={new Map([['e1', 'Cale & Ice'], ['e2', 'Ana & Ben']])}
        />
      </div>
    );
  }

  if (part === 'notice') {
    const now = Date.now();
    const items: NotificationRow[] =
      state === 'empty'
        ? []
        : [
            {
              notification_id: 'n1',
              user_id: 'lab',
              type: 'client_refund_recorded',
              title: 'Lumina Photo Co. recorded a refund to you',
              body: `${formatPhp(5000)} given back on ${refundDayWords('2026-11-08')}: Second shooter could not come — refunded the add-on.`,
              related_url: null,
              read_at: null,
              created_at: new Date(now - 600_000).toISOString(),
            },
            {
              notification_id: 'n2',
              user_id: 'lab',
              type: 'payment_confirmed',
              title: 'Lumina Photo Co. confirmed your payment',
              body: `Lumina Photo Co. confirmed receiving your ${formatPhp(20000)} payment.`,
              related_url: null,
              read_at: new Date(now - 86_000_000).toISOString(),
              created_at: new Date(now - 90_000_000).toISOString(),
            },
          ];
    return (
      <div className="min-h-screen bg-cream text-ink" data-b2-lab="notice">
        <div className="mx-auto w-full max-w-3xl pb-10 pt-4">
          <NotificationsList items={items} returnTo="/dev/b2-finish-lab?part=notice" emptyState={{ title: 'No notifications yet.', body: 'You’ll see notifications here.' }} />
        </div>
      </div>
    );
  }

  if (part === 'makers') {
    return (
      <div className="min-h-screen bg-cream pb-40 text-ink" data-shop-tab-lab="">
        <div className="mx-auto w-full max-w-3xl">
          <ShopMakers
            scanners={[{ coverageId: 1, label: 'Photography', choice: 'once' }]}
            formsBody={null}
            formsSaved={state === 'fail' ? null : state === 'empty' ? 0 : 3}
            categories={['Photography']}
            services={['photography']}
            booked={[]}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream pb-40 text-ink" data-portfolio-tab-lab="">
      <div className="mx-auto w-full max-w-3xl space-y-3 px-4 pt-4">
        <VideoLinks
          initial={state === 'empty' ? [] : LINKS}
          initialTitles={state === 'fail' ? null : { [LINKS[0]!]: 'Ana & Ben · same-day edit', [LINKS[1]!]: 'Teaser, Tagaytay garden' }}
        />
      </div>
    </div>
  );
}
