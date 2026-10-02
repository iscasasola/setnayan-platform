'use client';

import { DetailsForm } from './details-form';
import { GovernedFields } from './governed-fields';
import { PaxSettingsCard } from './pax-settings-card';

/**
 * 🗂 EVENT SETTINGS — on the Event Details page, OUTSIDE the Maker (2026-10-02).
 *
 * #6280 folded the retired `/details/change` page's three editors into the
 * Maker's Your info › Event settings. But each saves LIVE through its own
 * action, and the Maker's rule is that nothing there takes effect until Apply.
 * None of the three can ride the Event Hub draft as it stands:
 *   · `GovernedFields` — the kind of wedding, venues and guest estimate are
 *     governed by booked suppliers (it can remove a supplier, `deleteVendor`,
 *     another table);
 *   · `DetailsForm` — writes through the admin client with an audit row
 *     (another table), re-asks the budget gate, and stamps the BaZi birth-data
 *     consent receipt — personal data that must not sit in a draft blob;
 *   · `PaxSettingsCard` — kept beside them so "Event settings" stays one place.
 * So they live here, in place, and save the moment they are changed — the
 * Event Details page is not the Maker.
 */
/** The settings item's right column — the three shipped editors, in the page's order. */
export function EventSettingsEditor({
  eventId,
  form,
  governed,
  pax,
}: {
  eventId: string;
  form: {
    region: string;
    feel: string;
    budgetPesos: string;
    mayEditBudget: boolean;
    showBazi: boolean;
    baziHasConsent: boolean;
    partnerABirthDate: string;
    partnerABirthTime: string;
    partnerBBirthDate: string;
    partnerBBirthTime: string;
    repeatOptions: ReadonlyArray<{ value: string; label: string }>;
    repeatForced: boolean;
    cadence: string;
    showCelebrantShape: boolean;
    celebrantShape: string;
    celebrantTypeDefaultLabel: string;
  };
  governed: {
    confirmedVendorCount: number;
    ceremony: string | null;
    secondaryCeremony: string | null;
    venue: string | null;
    ceremonyVenue: string | null;
    pax: number | null;
    dateDisplay: string | null;
    dateValue: string | null;
    activeCeremonies: readonly string[] | null;
    rows: ReadonlyArray<'ceremony' | 'venue' | 'ceremony_venue' | 'pax'>;
  };
  pax: { deadline: string | null; mode: 'realtime' | 'final_only' };
}) {
  return (
    <div className="flex flex-col gap-6" data-details-settings="">
      <GovernedFields
        eventId={eventId}
        confirmedVendorCount={governed.confirmedVendorCount}
        ceremony={governed.ceremony}
        secondaryCeremony={governed.secondaryCeremony}
        venue={governed.venue}
        ceremonyVenue={governed.ceremonyVenue}
        pax={governed.pax}
        dateDisplay={governed.dateDisplay}
        dateValue={governed.dateValue}
        only={governed.rows}
        activeCeremonies={governed.activeCeremonies}
      />
      <DetailsForm
        eventId={eventId}
        showNames={false}
        initialBrideFirst=""
        initialBrideLast=""
        initialGroomFirst=""
        initialGroomLast=""
        initialRegion={form.region}
        initialFeel={form.feel}
        initialBudgetPesos={form.budgetPesos}
        mayEditBudget={form.mayEditBudget}
        showBaziBirthData={form.showBazi}
        baziHasConsent={form.baziHasConsent}
        initialPartnerABirthDate={form.partnerABirthDate}
        initialPartnerABirthTime={form.partnerABirthTime}
        initialPartnerBBirthDate={form.partnerBBirthDate}
        initialPartnerBBirthTime={form.partnerBBirthTime}
        repeatOptions={form.repeatOptions}
        repeatForced={form.repeatForced}
        initialCadence={form.cadence}
        showCelebrantShape={form.showCelebrantShape}
        initialCelebrantShape={form.celebrantShape}
        celebrantTypeDefaultLabel={form.celebrantTypeDefaultLabel}
      />
      <PaxSettingsCard eventId={eventId} deadline={pax.deadline} mode={pax.mode} />
    </div>
  );
}
