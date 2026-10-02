import { PageMasthead } from '@/app/_components/page-masthead';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getConfirmedVendorCount } from '@/lib/events';
import { resolveBudgetVisibility } from '@/lib/budget-visibility';
import { baziBirthDataEnabled } from '@/lib/bazi-birthdata';
import { celebrantShapeIsVisible, resolveProfile } from '@/lib/event-type-profile';
import { isChineseWedding } from '@/lib/chinese-wedding';
import {
  cadencesForType,
  cadenceIsForced,
  effectiveCadence,
  CADENCE_LABELS,
} from '@/lib/event-anchor';
import { DetailsForm } from '../_components/details-form';
import { GovernedFields } from '../_components/governed-fields';
import { fetchActiveCeremonyTypes } from '@/lib/religion-readiness';
import { PaxSettingsCard } from '../_components/pax-settings-card';
import { describeEventDate } from '@/lib/event-details-sheet';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Event settings' };

/**
 * Event settings · /dashboard/[eventId]/details/change
 *
 * 📋 MOVED, NOT REDRAWN (owner 2026-10-01, DECISION_LOG "EVENT DETAILS IS
 * INFORMATION ONLY"). `/details` became Event Details — a read-out of every
 * collected fact, editing nothing. Several facts this page edits have NO other
 * home (region, the budget target's first-set, birth data, the repeat, who is
 * celebrated, kind of event, venue settings, the guest estimate, the guest-list
 * closing date, how costs are shown), so dropping these editors would have
 * stranded them. They moved here whole; Event Details' "Open Event settings ›"
 * is their door.
 *
 * (What follows is the shipped page's own description, unchanged.)
 *
 * Personalization · /dashboard/[eventId]/details
 * The single place every piece of the couple's onboarding lives — documented
 * and, where it's safe to, editable. CLAUDE.md 2026-06-02 directive 2:
 * "all the information from the onboarding to be documented and editable on
 * the 'Personalization' Page ... this is where all the data will be preserved."
 *
 * Three bands:
 *   1. The basics — names · region · style/feel · budget. GOVERNANCE-FREE
 *      (bind no vendor) → edited inline via DetailsForm + updateEventMatchCriteria.
 *   2. Your wedding — wedding type · venue setting · guest count · date.
 *      GOVERNED (a booked vendor can lock these) → edited inline via
 *      <GovernedFields>, which runs the conflict preview first and warns which
 *      picked services would clash before the change commits (directive 4).
 *      All four lock to support once a vendor is confirmed.
 *   3. (Moved to Event Details, 2026-10-01) From your onboarding — budget band · monogram · music. Documented
 *      read-only (region + style/feel are in band 1; guest count + venue are
 *      band 2's governed editors).
 *
 * Route kept as /details (relabel-not-rename, per the Vendors→Services
 * precedent) so the Home "Personalize" link + the More-tab activeMatch stay
 * valid. Guard mirrors /for-you (getUser → redirect; maybeSingle → notFound).
 */
/** What each shape is called on screen. Shared by the default option's hint so
 *  a person can see what "however this usually goes" means for their type. */
const CELEBRANT_SHAPE_LABELS: Record<'single' | 'couple' | 'multiple', string> = {
  single: 'one person',
  couple: 'a couple',
  multiple: 'several people',
};

export default async function PersonalizationPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event, error: eventError } = await supabase
    // SEC-2b: public.events_host, not public.events — this select names a column
    // (budget / birth data / Drive folder) that is SELECT-denied to `authenticated`
    // on the base table by 20271008731642. The view is the couple/moderator-scoped
    // read path; same columns, same row shape, guests get zero rows.
    .from('events_host')
    .select(
      'event_id, display_name, event_type, archived, bride_name, groom_name, region, mood_feel_key, ' +
        // The repeat — read back so the control shows what is actually stored.
        'recurs, recur_cadence, ' +
        // Who this celebration is FOR, and how many of them (owner 2026-08-27).
        // NULL — every row today — means "use this event type's own shape".
        'celebrant_shape, ' +
        'estimated_budget_centavos, ceremony_type, secondary_ceremony_type, ' +
        'ceremony_type_locked_at, event_date, event_date_precision, date_mode, date_candidates, ' +
        // TWO venues, not one (owner 2026-09-03): venue_setting is the
        // RECEPTION, ceremony_venue_setting is where they marry. Read through
        // events_host, which migration 20271197508087 rebuilt to project the
        // new column — without that rebuild this select would name a phantom
        // column and throw, killing the whole Personalization page.
        'date_window_start, date_window_end, estimated_pax, venue_setting, ' +
        'ceremony_venue_setting, ' +
        'guest_list_edit_deadline, adaptive_pricing_mode, ' +
        // PR-G — opt-in BaZi birth-data (Chinese weddings). Read back only here,
        // on the couple-dashboard details surface; never selected by any
        // public/guest renderer. Behind baziBirthDataEnabled() at render time.
        'partner_a_birth_date, partner_a_birth_time, partner_b_birth_date, ' +
        'partner_b_birth_time, bazi_birthdata_consent_at',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (eventError) throw new Error(eventError.message);
  if (!event) notFound();

  const e = event as unknown as Record<string, unknown>;
  const base = `/dashboard/${eventId}`;
  const str = (k: string): string | null => {
    const v = e[k];
    return typeof v === 'string' && v.trim() !== '' ? v : null;
  };
  const num = (k: string): number | null => {
    const v = e[k];
    return typeof v === 'number' ? v : null;
  };

  const confirmedVendorCount = await getConfirmedVendorCount(supabase, eventId);

  // This page had NO membership gate of any kind — it leaned on `events_host`,
  // which admits any accepted delegate — so a coordinator opened the couple's
  // Personalization form with their budget target sitting in an editable box.
  // The read was half of it; `updateEventMatchCriteria` authorised
  // "couple/coordinator OR accepted moderator" and wrote the field through the
  // admin client, so she could also CHANGE it. Same shared resolver as /budget.
  const budgetAccess = await resolveBudgetVisibility(supabase, eventId, user.id);

  const budgetCentavos = num('estimated_budget_centavos');
  const initialBudgetPesos =
    budgetCentavos != null && budgetCentavos > 0 ? String(Math.round(budgetCentavos / 100)) : '';

  // bride_name/groom_name are combined "First Last" strings (onboarding PR #796
  // stores [first, last].join(' ')); split them back for the First+Last inputs.
  // splitName is lossless round-trip (first token = first name, rest = last) and
  // handles pre-#796 events that stored a first-name-only value.
  const brideName = splitName(str('bride_name'));
  const groomName = splitName(str('groom_name'));

  // PR-G — BaZi birth-data opt-in section. Triple gate (render side): the
  // feature flag is on AND this is a Chinese wedding (primary OR overlay). The
  // third gate (explicit consent checkbox) lives inside the form. With the flag
  // OFF or a non-Chinese event, showBaziBirthData is false → the section never
  // renders and the form is byte-identical to today. Birth time stores as
  // HH:MM:SS (Postgres `time`); trim to HH:MM for <input type="time">.
  const showBaziBirthData =
    baziBirthDataEnabled() &&
    isChineseWedding({
      ceremony_type: str('ceremony_type'),
      secondary_ceremony_type: str('secondary_ceremony_type'),
    });
  const trimTime = (v: string | null): string => (v ? v.slice(0, 5) : '');
  const baziConsentAt = str('bazi_birthdata_consent_at');

  // --- Documented values (band 3) -------------------------------------------
  const ceremonyType = str('ceremony_type');
  const secondaryCeremony = str('secondary_ceremony_type');
  const venueSetting = str('venue_setting');
  const ceremonyVenueSetting = str('ceremony_venue_setting');
  const pax = num('estimated_pax');
  // Adaptive Pax Pricing couple settings (Phase 8).
  const editDeadline = str('guest_list_edit_deadline');
  const paxMode: 'realtime' | 'final_only' =
    str('adaptive_pricing_mode') === 'final_only' ? 'final_only' : 'realtime';
  const moodFeel = str('mood_feel_key');

  const dateDoc = describeEventDate(e);
  // The date <input type="date"> prefills only from a committed day-precision
  // date; month/year-precision + window/candidate modes leave it blank so the
  // host picks deliberately (the governed editor stamps full precision).
  const eventDateRaw = str('event_date');
  const datePrecision = str('event_date_precision') ?? 'day';
  const dateValue = eventDateRaw && datePrecision === 'day' ? eventDateRaw : null;

  // ── the repeat, resolved server-side ──────────────────────────────────────
  // The options come from the ONE per-type map, so this screen cannot offer a
  // cadence the create path would refuse — the exact divergence that left
  // birthdays invisible on the Year view.
  const repeatType = str('event_type');
  const repeatOptions = cadencesForType(repeatType).map((c) => ({
    value: c,
    label: CADENCE_LABELS[c],
  }));
  const repeatForced = cadenceIsForced(repeatType);
  const storedCadence = effectiveCadence(e['recurs'] === true, str('recur_cadence'));

  // ── who is being celebrated ───────────────────────────────────────────────
  // Offered ONLY where the answer could change a word a guest reads. A wedding's
  // noun is 'couple' and a wake's is 'family'; both are collective, so no shape
  // pluralises them and the control would be a question asked for nothing.
  //
  // 🔑 THE HOSTS ARE NOT ASKED ABOUT ANYWHERE ON THIS PAGE, ON PURPOSE. Owner
  // 2026-08-27: there can be many on any event — and how many there are is
  // already known, because it is who holds a host's key to this celebration.
  const celebrantProfile = await resolveProfile(str('event_type') ?? 'wedding');
  const celebrantNoun = celebrantProfile.terminology.celebrantNoun;
  const showCelebrantShape = celebrantShapeIsVisible(celebrantNoun);
  const celebrantTypeDefaultLabel =
    CELEBRANT_SHAPE_LABELS[celebrantProfile.terminology.celebrantShape];

  return (
    <section className="sn-col space-y-5">
      <Link
        href={`${base}/details`}
        className="inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink"
      >
        <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Event Details
      </Link>
      <PageMasthead title="Event settings" />

      {/* Band 1 — the basics (governance-free, editable inline) */}
      <div className="sn-tile p-4 sm:p-5">
        <h2 className="m-display-tight text-base uppercase tracking-[0.02em] text-ink">The basics</h2>
        <DetailsForm
          eventId={eventId}
          initialBrideFirst={brideName.first}
          initialBrideLast={brideName.last}
          initialGroomFirst={groomName.first}
          initialGroomLast={groomName.last}
          initialRegion={str('region') ?? ''}
          initialFeel={moodFeel ?? ''}
          initialBudgetPesos={initialBudgetPesos}
          mayEditBudget={budgetAccess.mayEdit}
          showBaziBirthData={showBaziBirthData}
          baziHasConsent={baziConsentAt != null}
          initialPartnerABirthDate={str('partner_a_birth_date') ?? ''}
          initialPartnerABirthTime={trimTime(str('partner_a_birth_time'))}
          initialPartnerBBirthDate={str('partner_b_birth_date') ?? ''}
          initialPartnerBBirthTime={trimTime(str('partner_b_birth_time'))}
          repeatOptions={repeatOptions}
          repeatForced={repeatForced}
          initialCadence={storedCadence ?? ''}
          showCelebrantShape={showCelebrantShape}
          initialCelebrantShape={str('celebrant_shape') ?? ''}
          celebrantTypeDefaultLabel={celebrantTypeDefaultLabel}
        />
      </div>

      {/* Band 2 — your wedding (governed: ceremony · venue · guest count · date).
          Editable inline, but a change runs the conflict preview first and
          warns which picked services would clash before it commits (directive
          4). All four lock to support once a vendor is confirmed. */}
      <div className="sn-tile p-4 sm:p-5">
        <div className="mb-3">
          <h2 className="m-display-tight text-base uppercase tracking-[0.02em] text-ink">
            Your wedding
          </h2>
          <p className="mt-0.5 text-sm text-ink/55">
            These shape supplier availability and your paperwork. Change one and we’ll flag any
            services it would affect before you confirm.
          </p>
        </div>

        <GovernedFields
          eventId={eventId}
          confirmedVendorCount={confirmedVendorCount}
          ceremony={ceremonyType}
          secondaryCeremony={secondaryCeremony}
          venue={venueSetting}
          ceremonyVenue={ceremonyVenueSetting}
          pax={pax}
          dateDisplay={dateDoc}
          dateValue={dateValue}
          activeCeremonies={await fetchActiveCeremonyTypes(supabase)}
        />
      </div>

      {/* Adaptive Pax Pricing settings (Phase 8) — edit deadline + pricing view. */}
      <PaxSettingsCard eventId={eventId} deadline={editDeadline} mode={paxMode} />

    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * Splits a stored combined name into first + last for the edit form. First
 * token is the first name, the rest is the last name — lossless round-trip
 * with onboarding's [first, last].join(' '), and safe for pre-#796 events that
 * stored a first-name-only value (→ { first, last: '' }).
 */
function splitName(full: string | null): { first: string; last: string } {
  const t = (full ?? '').trim();
  if (!t) return { first: '', last: '' };
  const parts = t.split(/\s+/);
  return { first: parts[0] ?? '', last: parts.slice(1).join(' ') };
}
