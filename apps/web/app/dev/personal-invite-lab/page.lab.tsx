/**
 * /dev/personal-invite-lab — the PERSONAL INVITE on fixture data (prototype `supplier_personal_invite_2026-10-23.html`,
 * owner-approved). No sign-in, no database. DEV-ONLY: production builds 404 this route, the same kill-switch as
 * `/dev/add-your-own-lab`. It draws the REAL components, so what it shows is what ships.
 *
 *   ?f=form      A2 — the admin's invite form with The offer (the dropdown opens on a tap)
 *   ?f=result    A3 — the result: link + Copy, the card, Download the card, the message, Copy message
 *   ?f=door      B1 — the supplier's door with Your offer (Pro until 31 Jan 2027, 100 photos)
 *   ?f=door-bare B1 — the same door for an invite with no offer (no offer rows)
 *
 * The rest of the frames live in the labs that already draw those screens:
 *   B4 /dev/supplier-lab?s=details&invited=1 · B6 /dev/supplier-lab?easy=setup&sup=caterer&rail=service&library=1&gift=running
 *   C2 /dev/supplier-lab?easy=normal&sup=caterer&gift=soon · C1 /dev/supplier-plan-lab?s=plan&gift=running&photos=100
 *   C3 /dev/supplier-plan-lab?s=plan&gift=ended&photos=100
 */
import { notFound } from 'next/navigation';
import { InviteResult, InviteVendorForm } from '@/app/admin/vendors/_components/invite-vendor-form';
import { TeamInviteDoor } from '@/app/vendor/claim/[token]/_components/claim-parts';
import { ActionButton } from '@/components/action-button';
import { personalInviteCardSvg } from '@/lib/personal-invite-card';
import {
  doorOffer,
  offerPill,
  offerResultLine,
  personalInviteMessage,
  type PersonalInviteOffer,
} from '@/lib/personal-invite-offer';
import { displayServiceLabel, VENDOR_CATEGORIES } from '@/lib/vendors';
import { supplierCommissionShort } from '@/lib/commission-promise';
import { BOOKING_FEE } from '@/lib/booking-fee';

/** Lab prices — `vendor_billing_catalog` `<tier>_vendor_monthly` as measured on production 2026-10-23; never read by a real page (the real ones are read from the catalogue). */
const LAB_PRICES = { solo: 1000, pro: 2500, enterprise: 10000 };
const OFFER: PersonalInviteOffer = { tier: 'pro', untilDay: '2027-01-31', photos: 100 };
const URL = 'https://www.setnayan.com/vendor/claim/8fQ2kT-lab-sample-token';
const NAME = 'Tita Nena’s Catering';

export default async function PersonalInviteLabPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { f = 'form' } = await searchParams;

  let body: React.ReactNode = null;
  if (f === 'form') {
    body = (
      <InviteVendorForm
        prices={LAB_PRICES}
        categories={VENDOR_CATEGORIES.map((key) => ({ key, label: displayServiceLabel(key) }))}
      />
    );
  } else if (f === 'result') {
    body = (
      <section className="bg-cream">
        <InviteResult
          result={{
            status: 'ok',
            inviteId: 'lab',
            claimUrl: URL,
            businessName: NAME,
            offer: OFFER,
            offerLine: offerResultLine(OFFER),
            cardSvg: personalInviteCardSvg({ businessName: NAME, categoryLabel: displayServiceLabel('catering'), claimUrl: URL, pill: offerPill(OFFER) }),
            message: personalInviteMessage({ businessName: NAME, offer: OFFER, prices: LAB_PRICES, launchCapWords: '2,000', claimUrl: URL }),
          }}
        />
      </section>
    );
  } else if (f === 'door' || f === 'door-bare') {
    return (
      <TeamInviteDoor
        businessName={NAME}
        categoryLabel={displayServiceLabel('catering')}
        offer={f === 'door' ? doorOffer(OFFER) : null}
        commissionPerk={supplierCommissionShort(BOOKING_FEE)}
        claimHref="/dev/personal-invite-lab?f=door"
        claimLabel="Claim & sign up"
        decline={<ActionButton tone="neutral" icon={<span aria-hidden>✕</span>} label="I’m not this supplier" />}
      />
    );
  }
  return (
    <main className="mx-auto w-full max-w-xl bg-cream px-4 pb-24 pt-6" data-personal-invite-lab={f}>
      {body}
    </main>
  );
}
