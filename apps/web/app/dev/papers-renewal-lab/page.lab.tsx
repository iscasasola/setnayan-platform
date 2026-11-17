/**
 * /dev/papers-renewal-lab — the approved "Papers renewal" design (`Setnayan-specs/prototypes/supplier_papers_renewal_
 * 2026-11-14_fable.html`) on fixture data. No sign-in, no database. DEV-ONLY: production builds 404 this route first
 * thing. It mounts the REAL pieces — Today's `PapersRenewalLineView` in the real notice slot, the verification page's
 * `RenewalStateCard` over the real `PaperUploadPlace`, the shop page's `NotYetVerifiedNotice`, the admin's
 * `RenewalsTable` and `RenewalRecordFacts` — with words from the real `lib/papers-renewal.ts`. Press nothing that
 * saves: the upload place posts to the real action, which refuses here.
 *
 *   ?f=today&at=60|30|7|lapsed|renewed   Today, on 29 Jan · 28 Feb · 23 Mar · 31 Mar · after a clean renewal
 *   ?f=verify&at=lapsed|waiting|renewed  the verification page: Free · Unverified · a person must look · verified again
 *   ?f=couple                            a new couple opens the lapsed shop
 *   ?f=admin-list · ?f=admin-shop        Suppliers › Renewals · one shop's Renewal fold
 */
import { notFound } from 'next/navigation';

import { NoticeSlot } from '@/app/_components/notices/notices';
import { PapersRenewalLineView } from '@/app/vendor-dashboard/_components/papers-renewal-line';
import { PayoutMethodNudge } from '@/app/vendor-dashboard/_components/payout-method-nudge';
import { RenewalStateCard } from '@/app/vendor-dashboard/shop/_components/renewal-state-card';
import { LabUploadPlace } from './lab-upload-place';
import { NotYetVerifiedNotice } from '@/app/v/[slug]/_components/not-yet-verified-notice';
import { RenewalsTable } from '@/app/admin/accounts/_surfaces/renewals-list';
import { RenewalRecordFacts } from '@/app/admin/vendors/[vendorProfileId]/_components/renewal-record';
import { RecordFold, RecordFolds } from '@/app/admin/_components/record-kit';
import type { InlineDocsPayload } from '@/app/vendor-dashboard/shop/inline-docs-actions';
import { papersDueIn } from '@/lib/papers-due';
import { adminPaperLines, renewalNotice, renewedNotice, seedRenewalDraft, type RenewalPageFacts } from '@/lib/papers-renewal';

const DUE = papersDueIn(2027);
const SHOP = '00000000-0000-4000-8000-0000000e1a55';
const AT: Record<string, string> = {
  '60': '2027-01-29T09:00:00+08:00',
  '30': '2027-02-28T09:00:00+08:00',
  '7': '2027-03-23T09:00:00+08:00',
  lapsed: '2027-03-31T09:00:00+08:00',
  renewed: '2027-04-03T09:00:00+08:00',
};

const read = (registry: string, expirationDate: string | null, registrationNumber: string, accountName = 'LIWANAG LIGHTS AND SOUND') => ({
  r2_key: `vendors/${SHOP}/verification/papers/${registry}.jpg`,
  uploaded_at: '2026-11-14T02:00:00Z',
  attempts: 1,
  kind: registry,
  sig: 'lab',
  evidence: {
    read_at: '2026-11-14T02:00:00Z',
    qrTexts: [],
    model: {
      registry,
      accountName,
      ownerName: null,
      registrationNumber,
      expirationDate,
      address: 'Unit 4, 88 Dr. Sixto Antonio Ave., Brgy. Caniogan',
      barangay: 'Caniogan',
      city: 'Pasig City',
      couldNotRead: [],
      unsure: [],
      readAs: null,
    },
  },
});

const LAST_YEAR = {
  dti_certificate: read('dti', '2031-03-04', '3456789'),
  bir_2303: read('bir', null, '123-456-789-000'),
  mayors_permit: read('lgu', '2026-12-31', '2026-04417'),
};

const payload = (docMap: Record<string, unknown>, editable: boolean, status: InlineDocsPayload['status']): InlineDocsPayload => ({
  applicationId: 'lab',
  status,
  editable,
  docMap: docMap as InlineDocsPayload['docMap'],
  seedDisplayUrls: {},
  vendorComplete: 0,
  vendorTotal: 8,
  allComplete: false,
  registrationNumberRaw: null,
  registrationNumberNeedsReview: false,
  identityValues: { registered_address: 'Unit 4, 88 Dr. Sixto Antonio Ave., Brgy. Caniogan' },
});

const FACTS: RenewalPageFacts = {
  verified: true,
  dueAt: DUE,
  lapsedAt: '2027-03-31T00:05:00+08:00',
  lastVerifiedAt: '2026-11-14T02:00:00Z',
  renewed: false,
  bookings: 4,
};

function Placeholder({ children }: { children: string }) {
  return (
    <div className="rounded-xl px-4 py-6 text-center text-xs" style={{ background: 'var(--m-line-soft)', color: 'var(--m-slate)' }}>
      {children}
    </div>
  );
}

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--m-slate)' }}>
        {title}
      </p>
      {children}
    </main>
  );
}

export default async function PapersRenewalLabPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const f = sp.f ?? 'today';
  const at = sp.at ?? '60';

  if (f === 'today') {
    const now = new Date(AT[at] ?? AT['60']!);
    const spec =
      at === 'renewed'
        ? renewedNotice({ renewedAt: '2027-04-03T08:00:00+08:00', nextDueAt: papersDueIn(2028), verified: true, lapsedAt: null }, now)
        : renewalNotice({ verified: true, dueAt: DUE, lapsedAt: at === 'lapsed' ? FACTS.lapsedAt : null }, now, { bookings: 4, asksBefore: 1 });
    return (
      <>
        <NoticeSlot place="top" className="px-4 pt-3 sm:px-6" />
        <Frame title={`Today · ${at === 'renewed' ? 'verified again' : at === 'lapsed' ? '31 Mar · the day after' : `${at} days`}`}>
          {spec ? <PapersRenewalLineView spec={spec} /> : null}
          {sp.second ? <PayoutMethodNudge readiness="none" context="today" /> : null}
          <Placeholder>Today’s list (unchanged)</Placeholder>
          <Placeholder>Bookings (unchanged)</Placeholder>
        </Frame>
      </>
    );
  }

  if (f === 'verify') {
    const today = '2027-03-31';
    const seeded = seedRenewalDraft(LAST_YEAR, today, 'lab-approved');
    const card = at === 'waiting' ? 'waiting' : at === 'renewed' ? 'verified_again' : 'free_unverified';
    const docMap =
      at === 'waiting'
        ? { ...seeded, mayors_permit: { ...read('lgu', null, ''), manual: true, attempts: 3, typed: { permit_number: '2027-03158', valid_until: '2027-12-31' }, renewal: { ended_on: '2026-12-31' } } }
        : at === 'renewed'
          ? { ...seeded, mayors_permit: { ...read('lgu', '2027-12-31', '2027-03158'), renewal: { ended_on: '2026-12-31' } } }
          : seeded;
    const facts = at === 'renewed' ? { ...FACTS, lapsedAt: null, renewed: true, dueAt: papersDueIn(2028), lastVerifiedAt: '2027-04-03T00:00:00Z' } : FACTS;
    return (
      <Frame title="Verification and documents">
        <RenewalStateCard card={card} facts={facts} />
        <LabUploadPlace
          payload={payload(docMap, at === 'lapsed' || !sp.at, at === 'lapsed' || !sp.at ? 'draft' : at === 'waiting' ? 'pending_review' : 'approved')}
          vendorProfileId={SHOP}
        />
      </Frame>
    );
  }

  if (f === 'couple') {
    return (
      <Frame title="Shop · a new couple opens it">
        <h1 className="font-serif text-4xl italic text-ink">Liwanag Lights &amp; Sound</h1>
        <p className="text-sm text-ink/70">Lights and sound · Pasig City</p>
        <NotYetVerifiedNotice renewing />
        <Placeholder>Services, reviews, where — unchanged</Placeholder>
      </Frame>
    );
  }

  if (f === 'admin-list') {
    return (
      <Frame title="Suppliers · Renewals">
        <RenewalsTable
          list={{ more: false, rows: [
            { vendorProfileId: SHOP, name: 'Liwanag Lights & Sound', city: 'Pasig', bucket: 'lapsed', dueAt: DUE, lapsedAt: FACTS.lapsedAt, lastVerifiedAt: FACTS.lastVerifiedAt, papers: adminPaperLines(LAST_YEAR, '2027-03-31') },
            { vendorProfileId: `${SHOP.slice(0, -1)}2`, name: 'Sayaw Events Hosting', city: 'Cebu City', bucket: 'due_week', dueAt: DUE, lapsedAt: null, lastVerifiedAt: '2026-06-01T00:00:00Z', papers: adminPaperLines(LAST_YEAR, '2027-03-24') },
            {
              vendorProfileId: `${SHOP.slice(0, -1)}3`,
              name: 'Tahanan Florals',
              city: 'Quezon City',
              bucket: 'renewed',
              dueAt: papersDueIn(2028),
              lapsedAt: null,
              lastVerifiedAt: '2027-03-02T02:00:00Z',
              papers: adminPaperLines({ ...LAST_YEAR, mayors_permit: read('lgu', '2027-12-31', '2027-01120') }, '2027-03-24'),
            },
          ] }}
        />
      </Frame>
    );
  }

  return (
    <Frame title="Liwanag Lights & Sound · admin">
      <RecordFolds>
        <RecordFold title="Renewal" anchor="renewal" defaultOpen summary="Free · Unverified">
          <RenewalRecordFacts
            stage="lapsed"
            dueAt={DUE}
            lastVerifiedAt={FACTS.lastVerifiedAt}
            record={{
              bookings: 4,
              asksBefore: 1,
              contactEmail: 'hello@liwanag.example',
              papers: adminPaperLines(LAST_YEAR, '2027-03-31'),
              reminders: [
                { at: '2027-01-29T01:00:00Z', stage: 60 },
                { at: '2027-02-28T01:00:00Z', stage: 30 },
                { at: '2027-03-23T01:00:00Z', stage: 7 },
                { at: '2027-03-30T16:05:00Z', stage: 'lapse' },
              ],
            }}
          />
        </RecordFold>
      </RecordFolds>
    </Frame>
  );
}
