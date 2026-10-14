import type { ReactNode } from 'react';
import { FileText, ListChecks, MapPin, MessageSquareWarning, Pencil, Phone, Wallet } from 'lucide-react';
import { RowIcon } from '../../_components/row-icon';
import { Fold } from '@/app/_components/fold';
import { Badge } from '@/app/_components/badge';
import { detailsLine, DETAILS_CHECKLIST_KEYS, type DetailsKey } from '@/lib/supplier-details';
import { ProfileChecklistEditor } from '../../shop/_components/profile-checklist-editor';
import { VerifySection } from '../../shop/_components/verify-section';
import { VenueMatchCard } from '../../shop/_components/venue-match-card';
import { VenueTypeCard } from '../../shop/_components/venue-type-card';
import { PublicLineCard } from '../../shop/_components/public-line-card';
import { SuggestedCoverageCard } from '../../shop/_components/suggested-coverage-card';
import { VisibilityCard } from '../../shop/_components/visibility-card';
import { RequestCorrectionCard } from '../../shop/_components/request-correction-card';
import { CouldNotLoad } from '../../shop/_components/could-not-load';
import { ShopSegments } from '../../shop/_components/shop-segments';
import { DatesRow } from '../../customers/_components/dates-row';
import { formatCount } from '@/lib/format-number';
import { SupplierThumbRow } from '../../_components/supplier-thumb-row';
import { OpenFoldButton } from '../../_components/open-fold-button';
import { updateBusinessStartDate } from '../../actions';
import type { DetailsData } from '../details-data';

/**
 * YOUR DETAILS — the form, as ONE list (simpler supplier dashboard step 5 · prototype moment 6, `SCREENS.details`).
 *
 *   "4 of 6 done · left: documents · how clients pay you" + the bar, then one row per thing a couple and Setnayan
 *   need, in this order: Name and logo · What you do · Where you work · Contact · About · Your documents · How
 *   clients pay you · Something wrong?   Thumb: "Add what is left" opens the first one still open.
 *
 * 🔑 EVERY FOLD IS A SHIPPED EDITOR, MOUNTED — NOT REDRAWN. The rows inside are `ProfileChecklistEditor`'s
 * close-save rows (each saves itself when it closes), handed only THAT fold's checklist keys; the cards are the ones
 * My Shop's Profile tile held; the papers are `VerifySection`; the money is the payment surface, embedded; Where you
 * work is the Branch tile's panel. A fold opens by link: `#docs`, `#pay`, `#where` … (the shared `Fold` anchor).
 *
 * About is the page's own paragraph — it is written on Your page (one place, one draft), so here it is a row that
 * goes there, never a second editor of the same words.
 *
 * Server component: every value arrives read (`details-data.ts`); the editors are client components with their
 * own shipped server actions.
 */
export function DetailsScreen({
  d,
  payBody,
  branchBody,
}: {
  d: DetailsData;
  /** The payment surface, embedded (a server component with its own actions) — the lab hands in a stand-in. */
  payBody: ReactNode;
  /** Where you work's body — `BranchPanel` on the real page (async, store-shell aware). */
  branchBody: ReactNode;
}) {
  const p = d.progress;
  const row = (k: DetailsKey) => p.rows.find((r) => r.key === k)!;
  const items = (k: keyof typeof DETAILS_CHECKLIST_KEYS) =>
    d.checklist.filter((i) => DETAILS_CHECKLIST_KEYS[k].includes(i.key));
  const badge = (k: DetailsKey) => {
    const b = row(k).badge;
    return (
      <Badge tone={b.tone} data={`details-${k}`}>
        {b.word}
      </Badge>
    );
  };
  const pct = Math.round((p.done / p.of) * 100);
  const line = detailsLine(p);
  const head = line.split(' · ')[0] ?? line;
  const rest = line.slice(head.length);
  const services = d.profileFields.services.map((s) => d.profileFields.serviceLabels?.[s] ?? s);
  const docsState = row('docs').state;

  return (
    <>
      <section className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-32 pt-4 sm:px-6" data-supplier-details="">
        <ShopSegments on="page" />
        <h1 className="sn-h1">Your details</h1>
        <div>
          <p className="text-[15px] text-ink" data-details-line="" aria-live="polite">
            <b className="font-semibold">{head}</b>
            {rest}
          </p>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/10"
            role="meter"
            aria-label="Your details"
            aria-valuemin={0}
            aria-valuemax={p.of}
            aria-valuenow={p.done}
          >
            <span
              className="block h-full rounded-full bg-sn-accent transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="divide-y divide-ink/10" data-details-list="">
          <Fold
            anchor="name"
            lead={<RowIcon icon={Pencil} />}
            data="details-name"
            title="Name and logo"
            line={d.businessName}
            aside={badge('name')}
          >
            <div className="space-y-3 pb-4">
              {d.logoUnavailable ? <CouldNotLoad what="your logo" /> : null}
              <ProfileChecklistEditor
                items={items('name')}
                data={d.profileFields}
                isVerified={d.isVerified}
                showProgress={false}
              />
              {/* The exact start date (optional) — moved from My Shop's Profile tile with its own Save. */}
              <form action={updateBusinessStartDate} className="pt-1">
                <label htmlFor="in_business_since_date" className="block text-sm font-medium text-ink">
                  Business start date <span className="font-normal text-ink/55">(optional)</span>
                </label>
                <p className="mt-0.5 text-xs text-ink/55">
                  The exact day you started — powers your business anniversary. Leave blank to use the year above.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    id="in_business_since_date"
                    name="in_business_since_date"
                    type="date"
                    defaultValue={d.businessStartDate ?? ''}
                    className="input-field max-w-[12rem]"
                  />
                  <button type="submit" className="button-primary min-h-11">
                    Save
                  </button>
                </div>
              </form>
            </div>
          </Fold>

          <Fold
            anchor="what"
            lead={<RowIcon icon={ListChecks} />}
            data="details-what"
            title="What you do"
            line={services.length ? services.join(' · ') : 'Not set yet'}
            aside={badge('what')}
          >
            <div className="space-y-3 pb-4">
              <ProfileChecklistEditor
                items={items('what')}
                data={d.profileFields}
                isVerified={d.isVerified}
                showProgress={false}
              />
              <VenueTypeCard initialVenueType={d.venueType} />
              <VenueMatchCard
                initialVenueSettings={d.compatibleVenueSettings}
                initialCeremonyTypes={d.compatibleCeremonyTypes}
              />
              {d.pendingCoverageSuggestion ? (
                <SuggestedCoverageCard
                  dossierId={d.pendingCoverageSuggestion.dossierId}
                  suggestions={d.pendingCoverageSuggestion.suggestions}
                />
              ) : null}
            </div>
          </Fold>

          <Fold
            anchor="where"
            lead={<RowIcon icon={MapPin} />}
            data="details-where"
            title="Where you work"
            line={d.profileFields.location_city || d.profileFields.hq_address || 'Not set yet'}
            aside={badge('where')}
          >
            <div className="space-y-3 pb-4">
              <ProfileChecklistEditor
                items={items('where')}
                data={d.profileFields}
                isVerified={d.isVerified}
                showProgress={false}
              />
              {branchBody}
            </div>
          </Fold>

          <Fold
            anchor="contact"
            lead={<RowIcon icon={Phone} />}
            data="details-contact"
            title="Contact"
            line={[d.profileFields.contact_phone, d.profileFields.contact_email].filter(Boolean).join(' · ') || 'Not set yet'}
            aside={badge('contact')}
          >
            <div className="space-y-3 pb-4">
              <ProfileChecklistEditor
                items={items('contact')}
                data={d.profileFields}
                isVerified={d.isVerified}
                showProgress={false}
              />
              <p className="flex flex-wrap gap-2" data-details-confirmed="">
                <Badge tone={d.verify.phoneConfirmedAt ? 'ok' : 'quiet'} data="phone-confirmed">
                  {d.verify.phoneConfirmedAt ? 'Phone confirmed' : 'Phone not confirmed yet'}
                </Badge>
                <Badge tone={d.verify.emailConfirmedAt ? 'ok' : 'quiet'} data="email-confirmed">
                  {d.verify.emailConfirmedAt ? 'Email confirmed' : 'Email not confirmed yet'}
                </Badge>
              </p>
              <PublicLineCard initialTagline={d.tagline} initialWebsite={d.website} />
              <VisibilityCard
                initialSameDayAvailable={d.sameDayAvailable}
                initialSocialFeatureOptOut={d.socialFeatureOptOut}
                isVerified={d.isVerified}
                isPaidTier={d.tier != null && d.tier !== 'free'}
                alreadyFeatured={d.socialAlreadyFeatured}
              />
            </div>
          </Fold>

          <DatesRow
            data="details-about"
            lead={<RowIcon icon={Pencil} />}
            title="About"
            line={d.about ? d.about.split(/(?<=[.!?])\s/)[0] : 'Optional · one paragraph on your page'}
            badge={d.about ? { tone: 'ok', word: 'Done' } : { tone: 'quiet', word: 'Optional' }}
            href="/vendor-dashboard/website#about"
          />

          <Fold
            anchor="docs"
            lead={<RowIcon icon={FileText} />}
            data="details-docs"
            title="Your documents"
            line={
              docsState === 'checking'
                ? 'Setnayan is checking your documents'
                : d.isVerified
                  ? 'Verified · kept private'
                  : `${formatCount(d.docsIn)} of ${formatCount(d.docsTotal)} in · DTI or SEC · BIR 2303 · permit · a bank proof`
            }
            aside={badge('docs')}
          >
            <div className="space-y-3 pb-4">
              {!d.verifyMeasured ? <CouldNotLoad what="your documents" /> : null}
              <p className="text-xs text-ink/55">Kept private — only Setnayan sees them.</p>
              <VerifySection
                businessName={d.businessName}
                vendorProfileId={d.vendorId}
                isVerified={d.isVerified}
                profileComplete={d.profileComplete}
                profileFieldsLeft={d.checklist.filter((i) => !i.ok).length}
                verify={d.verify}
              />
            </div>
          </Fold>

          <Fold
            anchor="pay"
            lead={<RowIcon icon={Wallet} />}
            data="details-pay"
            title="How clients pay you"
            line={
              !d.pay.measured
                ? 'Could not be read just now'
                : d.pay.methods.length
                  ? d.pay.methods.map((m) => m.label || m.provider || m.method_type).join(' · ')
                  : 'Add GCash or a bank'
            }
            aside={badge('pay')}
          >
            <div className="pb-4">{payBody}</div>
          </Fold>

          <Fold anchor="fix" data="details-fix" title="Something wrong?" line="Ask us to correct it" lead={<RowIcon icon={MessageSquareWarning} />}>
            <div className="pb-4">
              <RequestCorrectionCard currentSlug={d.slug} isVerified={d.isVerified} openRequests={d.openCorrections} />
            </div>
          </Fold>
        </div>
      </section>

      {p.firstLeft ? (
        <SupplierThumbRow name="details" label="Your details">
          <OpenFoldButton anchor={p.firstLeft} label="Add what is left" />
        </SupplierThumbRow>
      ) : null}
    </>
  );
}
