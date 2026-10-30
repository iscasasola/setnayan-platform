/**
 * /dev/add-your-own-lab — the SUPPLIER'S half of "Add your own" (and the
 * couple's record sheet) on fixture data, with no sign-in and no database.
 * DEV-ONLY: production builds 404 this route (`the-lab-never-ships.test.ts`).
 *
 * The couple's half — the four-step walk and the rows — is drawn by
 * `/dev/suppliers-lab` (press ＋). This lab exists because the three screens
 * below sit behind a real claim token, a real session or a real booking, so
 * nothing else can show them:
 *
 *   ?s=claim     the door a supplier meets on a couple's own link — who invited
 *                them, and the date (`CoupleLinkDoor`, the page's own component)
 *   ?s=nodate    …the same door when the couple has only decided the month
 *   ?s=card      the first card, seeded from the couple's record — the price
 *                box waits for the photo and what's included (`CanvasMaker`)
 *   ?s=record    the couple's record sheet (`NewManualVendorModal`, edit mode)
 *                `&price=395000` starts it priced · `&booked=1` re-opens the
 *                plan the lock seeds (Setnayan's 50/50 estimate) the way the
 *                real loader does (`planInstancesToRows`, `defaultSeeded`)
 *
 * Names are samples (the prototype's): nobody real.
 */
import { notFound } from 'next/navigation';
import { CoupleLinkDoor } from '@/app/vendor/claim/[token]/_components/claim-parts';
import { claimDatePhrase, inviterFirstNames } from '@/lib/claim-invite-words';
import { coupleCardToCanvasInitial } from '@/lib/couple-card-to-canvas';
import { buildShortlistFolders, coverCatalogFromFolders } from '@/lib/shortlist-taxonomy';
import { planInstancesToRows } from '@/lib/self-added-payment-plan';
import { computePlanInstances, defaultPaymentScheduleRows } from '@/lib/vendor-service-payment-schedules';
import { LabCard, LabRecord } from './lab-client';
import { renderUrlQrSvg } from '@/lib/qr';
import { labSupplierShare } from '../lab-supplier-share';

const LAB_EVENT = '00000000-0000-4000-8000-000000000000';
const LAB_EVENT_VENDOR = '00000000-0000-4000-8000-0000000000aa';
const SUPPLIER = "Tita Baby's Catering";

export default async function AddYourOwnLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const s = typeof sp.s === 'string' ? sp.s : 'claim';

  if (s === 'card') {
    const initial = coupleCardToCanvasInitial(
      {
        vendor_name: SUPPLIER,
        category: 'catering',
        transport_php: null,
        food_allowance_php: null,
        crew_size: null,
        crew_meal_covered: false,
        // `&bare=1` — the couple wrote no inclusions, so the price waits for both.
        host_inclusions: sp.bare === '1' ? [] : ['Buffet for 150 guests', 'Tasting for 4', 'Delivery and set-up'],
        marketplace_vendor_id: null,
      },
      LAB_EVENT_VENDOR,
      'catering',
      197_000,
    );
    return (
      <main className="mx-auto w-full max-w-xl px-4 pb-32 pt-4" data-lab-add-own="card">
        <LabCard initial={initial} />
      </main>
    );
  }

  if (s === 'record') {
    // `&who=dunkin` — the owner's own card (2026-10-20): a doughnut cart filed
    // under Everything else that already "also covers" Guest booths.
    const dunkin = sp.who === 'dunkin';
    const priced = typeof sp.price === 'string' && /^\d+$/.test(sp.price) ? sp.price : '';
    const planRows =
      sp.booked === '1' && priced
        ? planInstancesToRows(
            JSON.parse(
              JSON.stringify(
                computePlanInstances({
                  scheduleRows: defaultPaymentScheduleRows(),
                  totalCostPhp: Number(priced),
                  lockDateIso: '2026-10-29',
                  eventDateIso: '2026-12-18',
                }),
              ),
            ),
            { defaultSeeded: true },
          )
        : [];
    return (
      <main className="min-h-screen" data-lab-add-own="record">
        <LabRecord
          eventId={LAB_EVENT}
          // `&nolink=1` — the link could not be made: the card says so, with Try again.
          link={sp.nolink === '1' ? undefined : { url: 'https://setnayan.com/vendor/claim/lab-sample-token', qrSvg: await renderUrlQrSvg('https://setnayan.com/vendor/claim/lab-sample-token') }}
          coverCatalog={coverCatalogFromFolders(
            buildShortlistFolders({ vendorRows: [], eventType: 'wedding', faithSet: new Set(), eventId: LAB_EVENT }),
          )}
          share={await labSupplierShare(
            {
              shopName: dunkin ? "Dunkin' Donuts" : SUPPLIER,
              contactPerson: 'Maria Santos',
              eventWord: 'wedding',
              eventDate: '2026-12-18',
              datePrecision: 'day',
              service: dunkin ? 'Everything else' : 'Catering',
              hostsName: 'Ana & Paolo',
              services: dunkin ? ['Everything else', 'Guest booths'] : ['Catering'],
            },
            'https://setnayan.com/vendor/claim/lab-sample-token',
          )}
          categoryLabel={dunkin ? 'Everything else' : 'Catering'}
          edit={{
            vendorId: LAB_EVENT_VENDOR,
            category: dunkin ? 'misc' : 'catering',
            name: dunkin ? "Dunkin' Donuts" : SUPPLIER,
            contactPerson: 'Maria Santos',
            contactNumber: '',
            address: '',
            pin: null,
            covers: dunkin ? ['guest_booth', 'tile:food_truck'] : [],
            // `&claim=1` — they claimed the couple's link and wait for Approve (#6709).
            claimAsk: sp.claim === '1',
            inclusions: '',
            price: priced,
            planRows,
            planSaved: planRows.length > 0,
            // The record card's dated rows (2026-10-29): what "after you book" counts from, and the event date.
            planDates: { lockIso: '2026-10-29', eventIso: '2026-12-18' },
            planSeqs: planRows.map((_, i) => i),
            // `&paid=1` — the first payment is logged, so the card keeps it as it is.
            settledSeqs: sp.paid === '1' ? [0] : [],
            // `&replot=1` — a price change already re-plotted this plan once.
            lastReplot: sp.replot === '1' && priced ? { fromPhp: Math.round(Number(priced) * 0.9), toPhp: Number(priced), at: '2026-10-29T00:00:00Z' } : null,
            // `&ways=1` — How to pay them, already added.
            payWays:
              sp.ways === '1'
                ? [
                    { method: 'gcash', details: 'Maria Santos · 0917 555 1234', qr: null, qrUrl: null },
                    { method: 'bank', details: 'BPI · Tita Baby’s Catering · 1234-5678-90', qr: null, qrUrl: null },
                  ]
                : [],
          }}
        />
      </main>
    );
  }

  const month = s === 'nodate';
  return (
    <div data-lab-add-own="claim">
      <CoupleLinkDoor
        eyebrow="Couple invite"
        inviterName={
          inviterFirstNames({ display_name: 'Ana & Paolo', bride_name: 'Ana Reyes', groom_name: 'Paolo Cruz' }) ?? ''
        }
        categoryLabel="Catering"
        eventWord="wedding"
        datePhrase={claimDatePhrase(month ? '2026-12-01' : '2026-12-18', month ? 'month' : 'day')}
        businessName={SUPPLIER}
        contactPerson="Maria Santos"
        contactPhone={null}
        signupUrl="/dev/add-your-own-lab?s=card"
        decline={
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md bg-cream px-6 py-3 text-sm font-medium text-ink/70 ring-1 ring-inset ring-ink/15"
          >
            I&rsquo;m not this supplier
          </button>
        }
      />
    </div>
  );
}
