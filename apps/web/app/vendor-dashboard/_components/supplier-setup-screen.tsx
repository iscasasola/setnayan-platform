import type { ReactNode } from 'react';
import { Fold } from '@/app/_components/fold';
import type { SpotlightScript } from '@/lib/tours';
import { ProfileChecklistEditor } from '../shop/_components/profile-checklist-editor';
import { VerifySection } from '../shop/_components/verify-section';
import { CouldNotLoad } from '../shop/_components/could-not-load';
import type { DetailsData } from '../profile/details-data';
import type { FirstStepsRail } from '@/lib/vendor-first-steps';
import { assembleSetup, setupChecklistKeys, type SetupFoldKey } from '@/lib/supplier-setup';
import { displayServiceLabel } from '@/lib/vendors';
import { SupplierSetupFolds } from './supplier-setup-folds';
import { SetupOfferFold } from './setup-offer-fold';
import { SetupDaysOffRow } from './setup-days-off-row';
import { SetupPapers } from './setup-papers';
import { SetupQrStep } from './setup-qr-step';

/** The id of Today's papers list — the "Get verified" fold's documents step links to it (F-W1-11). */
const SETUP_PAPERS_ID = 'setup-papers';

/** The parts of Your details the six steps mount (`loadDetailsData`, or the lab's fixture). */
export type SetupDetails = Pick<
  DetailsData,
  'vendorId' | 'businessName' | 'isVerified' | 'checklist' | 'profileComplete' | 'fieldsLeft' | 'profileFields' | 'verify' | 'verifyMeasured' | 'papers' | 'docsIn' | 'docsTotal' | 'logoUnavailable'
> &
  // 🏷 Name/address by request (owner 2026-10-29) — optional so a fixture without them draws every row as it was.
  Partial<Pick<DetailsData, 'requestOnly' | 'openCorrections' | 'slug'>>;

/**
 * 🧰 A NEW SHOP'S TODAY — the six steps, each body a SHIPPED editor mounted in place (owner 2026-10-28, DECISION_LOG
 * "SUPPLIER DASHBOARD APPROVED — EVERYTHING IN PLACE, A ⚙ PER PAGE"; prototype `supplier_in_place_2026-10-28`):
 *
 *   1 Name your shop       — Your details' own close-save rows (`ProfileChecklistEditor`), the name rows only
 *   2 Your details         — the same rows: what you do · where · contact
 *   3 Add your logo        — the same editor's logo row (the shared `FileUpload`)
 *   4 What you offer       — Good · Better · Best per service; an empty slot opens the maker as a SHEET (`SetupOfferFold`)
 *   5 Send your documents  — one row per required paper (`SetupPapers`, 7 Nov 2026: the shipped upload, each file
 *                            saved on its own, each row's state read honestly); under them, `VerifySection` exactly as
 *                            Your details mounts it, folded — the details beside the papers, the contacts, Send for
 *                            review
 *   6 Download your QR     — the shop's own page, `/v/<slug>` (`SetupQrStep` → `QrCard`, Download first), then the
 *                            tour once; the days-off row stays under it
 *
 * ⛔ NO STEP 7. "How many a day" sat under the six (Build 6 Lane E) and LEFT Today on the owner's ruling (13 Nov 2026,
 *    DECISION_LOG d8ec0922): the daily limit is PER SERVICE — each service card's own `vendor_services.daily_capacity`,
 *    asked in the card maker — not one number for the whole shop.
 *
 * Nothing is redrawn: each editor carries its own server action and saves itself. Server component — the page (and
 * the dev lab) hand in what was read.
 */
export function SupplierSetupScreen({
  d,
  rail,
  maker,
  qr,
  today,
  lab = false,
  gear,
  tour = null,
  paperUrls,
}: {
  d: SetupDetails;
  rail: FirstStepsRail;
  /** The shipped maker, drawn (`NewServiceMaker`) — the sheet's body. */
  maker: ReactNode;
  /** The shop's own QR — its Setnayan page, `/v/<slug>` (`myPageUrl`). Null when it could not be made (no address yet). */
  qr: { svg: string | null; url: string } | null;
  /** The tour after step 6 (`SETUP_TOUR_KEY`): its words, and whether it is on record (null: the read was refused). */
  tour?: { script: SpotlightScript; seen: boolean | null; lab?: boolean } | null;
  today: string;
  /** The dev lab: the days-off row writes nothing and says so. */
  lab?: boolean;
  gear?: ReactNode;
  /** The lab's paper previews (ref → URL). Today leaves it out: the papers are private and signed on demand. */
  paperUrls?: Record<string, string>;
}) {
  const view = assembleSetup({
    checklist: d.checklist,
    rail,
    offer: rail.offer,
    docs: { status: d.verify.status, docsIn: d.docsIn, docsTotal: d.docsTotal },
    shopName: d.businessName,
    slug: d.slug ?? null,
    // "Photography · no card yet" — the shop's first service, by the name couples read.
    serviceLabel: rail.offer?.services[0] ? displayServiceLabel(rail.offer.services[0].service) : null,
    qrSaved: tour ? tour.seen : null,
  });
  const rows = (k: 'name' | 'details' | 'logo') => {
    const keys = setupChecklistKeys(k);
    return d.checklist.filter((i) => keys.includes(i.key));
  };
  const editor = (k: 'name' | 'details' | 'logo') => (
    <ProfileChecklistEditor
      items={rows(k)}
      data={d.profileFields}
      isVerified={d.isVerified}
      showProgress={false}
      flat
      asks={d.requestOnly ? { requestOnly: d.requestOnly, pending: (d.openCorrections ?? []).map((r) => r.field_key) } : undefined}
    />
  );
  const daysMarked = rail.steps.find((s) => s.key === 'not_available')?.meter ?? null;

  const bodies: Record<SetupFoldKey, ReactNode> = {
    name: editor('name'),
    details: editor('details'),
    logo: (
      <>
        {d.logoUnavailable ? <CouldNotLoad what="your logo" /> : null}
        {editor('logo')}
      </>
    ),
    offer: (
      <SetupOfferFold
        services={
          rail.offer
            ? rail.offer.services.map((s) => ({
                service: s.service,
                label: displayServiceLabel(s.service),
                cards: s.cards.map((c) => ({ id: c.id, title: c.title, pricePhp: c.pricePhp })),
                toGo: s.toGo,
                target: s.target,
              }))
            : null
        }
        maker={maker}
      />
    ),
    docs: (
      <div className="space-y-3">
        <div id={SETUP_PAPERS_ID} className="scroll-mt-20">
          <SetupPapers papers={d.papers} vendorProfileId={d.vendorId} reason={d.verify.decisionReason} displayUrls={paperUrls} />
        </div>
        <Fold
          data="setup-papers-more"
          title="Get verified"
          line="The details beside your papers, then send them for review"
        >
          <div className="space-y-3 pb-2">
            {!d.verifyMeasured ? <CouldNotLoad what="your documents" /> : null}
            <VerifySection
              businessName={d.businessName}
              vendorProfileId={d.vendorId}
              isVerified={d.isVerified}
              profileComplete={d.profileComplete}
              profileFieldsLeft={d.fieldsLeft}
              verify={d.verify}
              // 📄 F-W1-11: the papers are the list just above — asked once, pointed to here.
              papersAbove={SETUP_PAPERS_ID}
            />
          </div>
        </Fold>
      </div>
    ),
    qr: (
      <div className="space-y-2">
        {qr ? (
          <SetupQrStep svg={qr.svg} url={qr.url} title={d.businessName} />
        ) : (
          <p className="text-[13px] text-ink/60" data-setup-qr-none="">
            Your QR is made once your shop has its web address.
          </p>
        )}
        <SetupDaysOffRow marked={daysMarked} today={today} lab={lab} />
      </div>
    ),
  };

  return <SupplierSetupFolds view={view} bodies={bodies} gear={gear} tour={tour} />;
}
