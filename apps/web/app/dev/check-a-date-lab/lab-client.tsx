'use client';

import { CheckADateOverShopView } from '@/app/v/[slug]/_components/check-a-date-over-shop-view';
import { checkDateWindow } from '@/lib/check-a-date';

const TODAY = '2026-11-14';
const NOT_BOOKABLE = ['2026-11-21', '2026-11-28', '2026-12-05', '2026-12-06', '2026-12-19', '2026-12-24', '2026-12-25', '2026-12-31', '2027-01-01', '2027-01-02'];

/** A drawn shop underneath, and the real Check a date sheet over it. Samples only — nobody real. */
export function CheckADateLabClient() {
  return (
    <main className="min-h-dvh bg-cream">
      <div className="h-44 bg-gradient-to-br from-ink/10 to-ink/20" />
      <div className="mx-auto max-w-3xl px-4">
        <span className="-mt-8 block h-16 w-16 rounded-full border-4 border-cream bg-ink" />
        <p className="mt-2 text-xl font-bold">Liwanag Lights &amp; Bar (sample)</p>
        <p className="text-sm text-ink/60">Lights &amp; sound · Quezon City</p>
      </div>
      <CheckADateOverShopView
        shopHref="/dev/check-a-date-lab"
        shop={{ vendorProfileId: 'lab', slug: 'liwanag-sample', name: 'Liwanag Lights & Bar (sample)', initials: 'LL', verified: true }}
        logoUrl={null}
        inquirySource="shop_page"
        services={[
          { serviceId: 'a', label: 'Wedding lights', price: '', category: null },
          { serviceId: 'b', label: 'Sound system', price: '', category: null },
          { serviceId: 'c', label: 'Mobile bar', price: '', category: null },
        ]}
        today={TODAY}
        to={checkDateWindow(TODAY).to}
        notBookable={NOT_BOOKABLE}
        perService={{ c: ['2026-11-22', '2026-11-29'] }}
        signedIn={false}
        events={[]}
        initialDay={null}
        initialServices={[]}
        initialStep={null}
      />
    </main>
  );
}
