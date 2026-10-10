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
 *
 * Names are samples (the prototype's): nobody real.
 */
import { notFound } from 'next/navigation';
import { CoupleLinkDoor } from '@/app/vendor/claim/[token]/_components/claim-parts';
import { claimDatePhrase, inviterFirstNames } from '@/lib/claim-invite-words';
import { coupleCardToCanvasInitial } from '@/lib/couple-card-to-canvas';
import { LabCard, LabRecord } from './lab-client';

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
    return (
      <main className="min-h-screen" data-lab-add-own="record">
        <LabRecord
          eventId={LAB_EVENT}
          edit={{
            vendorId: LAB_EVENT_VENDOR,
            category: 'catering',
            name: SUPPLIER,
            contactPerson: 'Maria Santos',
            contactNumber: '',
            address: '',
            pin: null,
            covers: [],
            inclusions: '',
            price: '',
            planRows: [],
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
