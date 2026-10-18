/** /dev/spotlight-lab/<page> — see `../layout.tsx`. DEV-ONLY. */
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import HomeLab from '@/app/dev/home-lab/page';
import GuestsLabPage from '@/app/dev/guests-lab/page';
import SuppliersLabPage from '@/app/dev/suppliers-lab/page';
import SupplierLabPage from '@/app/dev/supplier-lab/page';
import { NewThingTile } from '@/app/_components/collection-card';
import { FinishedEventSummary } from '@/app/dashboard/[eventId]/_components/after/finished-event-summary';
import { DatesRow } from '@/app/vendor-dashboard/customers/_components/dates-row';

export const dynamic = 'force-dynamic';

const E = '00000000-0000-4000-8000-000000000000';

export default async function SpotlightLabPage({
  params,
}: {
  params: Promise<{ page?: string[] }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const page = (await params).page?.[0] ?? 'launcher';
  const none = Promise.resolve({});
  switch (page) {
    case 'launcher':
      return (
        <main className="sn-ambient min-h-screen px-4 pb-28 pt-6">
          <h1 className="mb-4 text-[22px] font-semibold text-ink">Your events</h1>
          <div className="grid gap-3">
            <NewThingTile href="/dev/spotlight-lab/home" label="New event" tour="create-event" />
          </div>
        </main>
      );
    case 'home':
      return <HomeLab searchParams={none} />;
    case 'guests':
      return <GuestsLabPage searchParams={Promise.resolve({ part: 'screen' })} />;
    case 'vendors':
      return <SuppliersLabPage searchParams={none} />;
    case 'launch':
      return (
        <div data-maker-shell="" className="fixed inset-x-0 top-0 z-[80] grid h-[100dvh] place-items-center bg-cream p-6 text-center">
          <div>
            <p className="text-[15px] text-ink/70">A stand-in for the Event Hub Maker — the tour waits under it.</p>
            <Link href="/dev/spotlight-lab/home" className="button-primary mt-4 inline-flex">Exit</Link>
          </div>
        </div>
      );
    case 'day':
      /* The day-of block of `app/dashboard/[eventId]/page.tsx`, its markup copied for the lab (it is inline there). */
      return (
        <main className="sn-ambient min-h-screen space-y-3 px-4 pb-10 pt-6">
          <Link href="/dev/spotlight-lab/after" className="sn-tile sn-press flex items-center justify-between gap-3 text-left" data-tour="day-live">
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold text-ink">Open the live desk</span>
              <span className="mt-0.5 block text-[12.5px] text-ink/55">Announcements, the photo wall and what is happening now.</span>
            </span>
            <ArrowRight aria-hidden className="h-4 w-4 flex-none text-ink/40" />
          </Link>
          <details className="sn-tile">
            <summary className="cursor-pointer list-none text-[13.5px] font-semibold text-ink/70" data-tour="day-planning">
              Planning tools — still here if you need them
            </summary>
          </details>
        </main>
      );
    case 'after':
      return (
        <main className="sn-ambient min-h-screen px-4 pb-10 pt-6">
          <FinishedEventSummary
            eventId={E}
            noun="wedding"
            dateLabel="March 13, 2027"
            slug="ana-and-miguel"
            summary={{ guests: 180, guestsAttending: 152, checkedIn: 140, suppliers: 6, services: 2, photos: 1240, editorial: 'none', editorialMeasured: true }}
          />
        </main>
      );
    case 'vendor-dashboard':
      return <SupplierLabPage searchParams={Promise.resolve({ easy: 'normal', sup: 'studio' })} />;
    case 'customers':
      return <SupplierLabPage searchParams={Promise.resolve({ s: 'people' })} />;
    case 'shop':
      /* Shop's first rows (`ShopHome` in app/vendor-dashboard/shop/page.tsx) with the REAL row, and the
         services manager's empty-state button — the page itself reads the database. */
      return (
        <main className="sn-ambient min-h-screen space-y-4 px-4 pb-28 pt-6">
          <h1 className="text-[22px] font-semibold text-ink">Lumina Studio</h1>
          <div>
            <DatesRow data="shop-details" tour="shop-details" title="Your details" line="Name, photos, where you work" badge={{ tone: 'wait', word: '3 fields left' }} href="/dev/spotlight-lab/shop" />
            <DatesRow data="shop-page" title="Your page" line="As couples see it · edit · share" badge={{ tone: 'quiet', word: 'Not shown yet' }} href="/dev/spotlight-lab/shop" />
          </div>
          <section className="sn-tile">
            <p className="text-[15px] font-semibold text-ink">Services</p>
            <p className="mt-1 text-[13.5px] text-ink/60">No services yet.</p>
            <Link href="/dev/spotlight-lab/shop" className="button-primary mt-3 inline-flex" data-tour="shop-add-service">
              Add a service
            </Link>
          </section>
        </main>
      );
    default:
      notFound();
  }
}
