import type { ReactNode } from 'react';
import { QrCard } from '@/app/_components/qr-card';
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

/** The parts of Your details the six steps mount (`loadDetailsData`, or the lab's fixture). */
export type SetupDetails = Pick<
  DetailsData,
  'vendorId' | 'businessName' | 'isVerified' | 'checklist' | 'profileComplete' | 'fieldsLeft' | 'profileFields' | 'verify' | 'verifyMeasured' | 'docsIn' | 'docsTotal' | 'logoUnavailable'
> &
  // 🏷 Name/address by request (owner 2026-10-29) — optional so a fixture without them draws every row as it was.
  Partial<Pick<DetailsData, 'requestOnly' | 'openCorrections'>>;

/**
 * 🧰 A NEW SHOP'S TODAY — the six steps, each body a SHIPPED editor mounted in place (owner 2026-10-28, DECISION_LOG
 * "SUPPLIER DASHBOARD APPROVED — EVERYTHING IN PLACE, A ⚙ PER PAGE"; prototype `supplier_in_place_2026-10-28`):
 *
 *   1 Name your shop       — Your details' own close-save rows (`ProfileChecklistEditor`), the name rows only
 *   2 Your details         — the same rows: what you do · where · contact
 *   3 Add your logo        — the same editor's logo row (the shared `FileUpload`)
 *   4 What you offer       — Good · Better · Best per service; an empty slot opens the maker as a SHEET (`SetupOfferFold`)
 *   5 Send your documents  — `VerifySection`, exactly as Your details mounts it (the papers, their uploads, the
 *                            admin's reason when they came back)
 *   6 Your QR + days off   — the shop's own QR (`QrCard`: Share · Save) and a day marked off in place
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
}: {
  d: SetupDetails;
  rail: FirstStepsRail;
  /** The shipped maker, drawn (`NewServiceMaker`) — the sheet's body. */
  maker: ReactNode;
  /** The shop's own QR — what a couple scans to reach this shop. Null when it could not be made (no address yet). */
  qr: { svg: string | null; url: string } | null;
  today: string;
  /** The dev lab: the days-off row writes nothing and says so. */
  lab?: boolean;
  gear?: ReactNode;
}) {
  const view = assembleSetup({
    checklist: d.checklist,
    rail,
    offer: rail.offer,
    docs: { status: d.verify.status, docsIn: d.docsIn, docsTotal: d.docsTotal },
    shopName: d.businessName,
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
              }))
            : null
        }
        maker={maker}
      />
    ),
    docs: (
      <div className="space-y-3">
        {!d.verifyMeasured ? <CouldNotLoad what="your documents" /> : null}
        <VerifySection
          businessName={d.businessName}
          vendorProfileId={d.vendorId}
          isVerified={d.isVerified}
          profileComplete={d.profileComplete}
          profileFieldsLeft={d.fieldsLeft}
          verify={d.verify}
        />
      </div>
    ),
    qr: (
      <div className="space-y-2">
        {qr ? (
          <QrCard
            svg={qr.svg}
            url={qr.url}
            title={d.businessName}
            line="They scan, sign up free, and you join their shortlist."
            filename="setnayan-shop-qr.svg"
            data="setup-shop"
          />
        ) : (
          <p className="text-[13px] text-ink/60" data-setup-qr-none="">
            Your QR is made once your shop has its web address.
          </p>
        )}
        <SetupDaysOffRow marked={daysMarked} today={today} lab={lab} />
      </div>
    ),
  };

  return <SupplierSetupFolds view={view} bodies={bodies} gear={gear} />;
}
