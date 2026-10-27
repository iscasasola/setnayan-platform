import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getConfirmedVendorCount } from '@/lib/events';
import { resolveBudgetVisibility } from '@/lib/budget-visibility';
import { baziBirthDataEnabled } from '@/lib/bazi-birthdata';
import { celebrantShapeIsVisible, resolveProfile } from '@/lib/event-type-profile';
import { isChineseWedding } from '@/lib/chinese-wedding';
import { cadencesForType, cadenceIsForced, effectiveCadence, CADENCE_LABELS } from '@/lib/event-anchor';
import { fetchActiveCeremonyTypes } from '@/lib/religion-readiness';
import { NOT_SET_YET, describeEventDate, sheetDate } from '@/lib/event-details-sheet';
import { CEREMONY_LABEL, VENUE_LABEL, titleCase } from '@/lib/personalized-menu';
import { CEREMONY_VENUE_SETTING_SHORT_LABEL } from '@/lib/venue-settings';
import { FEEL_OPTIONS } from '@/lib/match-criteria';
import { resolveRegion } from '@/lib/region-source';
import { formatCount } from '@/lib/format-number';
import { formatPhpRounded } from '@/lib/php';
import { logQueryError } from '@/lib/supabase/error-detect';
import { getEventTypeVocab } from '@/lib/event-types-db';
import { GENERIC_EVENT_TYPE, eventKindChoices, type EventKindLineInput, type EventTypeRequestRow } from '@/lib/event-type-requests';

/**
 * 🗂 YOUR INFO › EVENT SETTINGS — the reads of the retired `/details/change`
 * page, moved WHOLE into the Maker's Your info (owner 2026-10-02, DECISION_LOG
 * "EVERY ANSWER ABOUT AN EVENT LIVES IN EVENT DETAILS ("YOUR INFO") — ONE HOME,
 * MAPPED": *"#6247's separate /details/change page folds into Your info"*).
 *
 * The facts that page edited and nothing else in Your info edits — the kind of
 * wedding and its two venue settings, the guest estimate, the area, the feel,
 * the budget target, the repeat, who is celebrated, the birth data, the
 * guest-list closing date and how costs are shown — are read here exactly as
 * the page read them, through `events_host` (the budget and the birth data are
 * SELECT-denied on `events` to every session, 20271008731642), behind the SAME
 * budget gate (`resolveBudgetVisibility`). The editors are the page's own,
 * unchanged (`DetailsForm` without its names — Your info › Names is their one
 * field — `GovernedFields` without its date row — Your info › Date is — and
 * `PaxSettingsCard`), each still saving through its own action.
 *
 * Null when the event row could not be read: the item is not drawn, never a
 * form over a guess.
 */
export type EventSettingsInput = {
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
    repeatOptions: Array<{ value: string; label: string }>;
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
    /** The governed rows Event settings draws — never the date (Your info › Date's). */
    rows: ReadonlyArray<'ceremony' | 'venue' | 'ceremony_venue' | 'pax'>;
  };
  pax: { deadline: string | null; mode: 'realtime' | 'final_only' };
  /**
   * 🏷 KIND OF EVENT — Event settings' one line (owner 2026-10-28, DECISION_LOG "EVENT TYPES MUST BE SPECIFIC"). Null
   * = no line: the event already has a specific kind and the viewer asked for nothing that is now added.
   */
  kind: EventKindLineInput | null;
  /** The middle column's read-out — each fact as stored, words from the shared label maps. */
  readout: ReadonlyArray<{ label: string; value: string | null }>;
  /** The navigator row's line. */
  sub: string;
};

/**
 * The line's data: the stored type, the create picker's roster, and the viewer's OWN asks that are now added (RLS
 * returns no one else's). A refused asks read means none; a refused created_at read lets every added ask count — both
 * only ever OFFER, and the action re-derives the same answer before writing.
 */
async function loadEventKind(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
  eventType: string | null,
): Promise<EventKindLineInput | null> {
  const [vocab, { data: asks, error: asksError }, { data: when, error: whenError }] = await Promise.all([
    getEventTypeVocab(),
    supabase
      .from('event_type_requests')
      .select('status, event_type, created_at, label')
      .eq('requested_by', userId)
      .eq('status', 'added'),
    supabase.from('events').select('created_at').eq('event_id', eventId).maybeSingle(),
  ]);
  if (asksError) logQueryError('DetailsSettings.kindAsks', asksError, { event_id: eventId }, 'graceful_degrade');
  if (whenError) logQueryError('DetailsSettings.kindCreatedAt', whenError, { event_id: eventId }, 'graceful_degrade');
  const creatable = vocab.filter((t) => t.enabled).map((t) => ({ key: t.key, label: t.label }));
  const choices = eventKindChoices({
    eventType,
    eventCreatedAt: (when as { created_at?: string | null } | null)?.created_at ?? null,
    creatable,
    myAsks: (asks ?? []) as Pick<EventTypeRequestRow, 'status' | 'event_type' | 'created_at' | 'label'>[],
  });
  if (choices.length === 0) return null;
  return {
    generic: eventType === GENERIC_EVENT_TYPE,
    currentLabel: vocab.find((t) => t.key === eventType)?.label ?? 'This event',
    choices,
  };
}

/** What each shape is called on screen (the retired page's own words). */
const CELEBRANT_SHAPE_LABELS: Record<'single' | 'couple' | 'multiple', string> = {
  single: 'one person',
  couple: 'a couple',
  multiple: 'several people',
};

export async function loadEventSettings(input: {
  supabase: SupabaseClient;
  eventId: string;
  userId: string;
}): Promise<EventSettingsInput | null> {
  const { supabase, eventId, userId } = input;
  const { data, error } = await supabase
    // SEC-2b: public.events_host — this select names the budget and the birth
    // data, SELECT-denied to `authenticated` on the base table.
    .from('events_host')
    .select(
      'event_id, event_type, region, mood_feel_key, recurs, recur_cadence, celebrant_shape, ' +
        'estimated_budget_centavos, ceremony_type, secondary_ceremony_type, event_date, event_date_precision, ' +
        'date_mode, date_candidates, date_window_start, date_window_end, estimated_pax, venue_setting, ' +
        'ceremony_venue_setting, guest_list_edit_deadline, adaptive_pricing_mode, ' +
        'partner_a_birth_date, partner_a_birth_time, partner_b_birth_date, partner_b_birth_time, bazi_birthdata_consent_at',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) {
    logQueryError('DetailsSettings.event', error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  if (!data) return null;

  const e = data as unknown as Record<string, unknown>;
  const str = (k: string): string | null => {
    const v = e[k];
    return typeof v === 'string' && v.trim() !== '' ? v : null;
  };
  const num = (k: string): number | null => {
    const v = e[k];
    return typeof v === 'number' ? v : null;
  };

  const eventType = str('event_type');
  const [confirmedVendorCount, budgetAccess, profile, activeCeremonies, kind] = await Promise.all([
    getConfirmedVendorCount(supabase, eventId),
    resolveBudgetVisibility(supabase, eventId, userId),
    resolveProfile(eventType ?? 'wedding'),
    eventType === 'wedding' ? fetchActiveCeremonyTypes(supabase) : Promise.resolve(null),
    eventType === 'wedding' ? Promise.resolve(null) : loadEventKind(supabase, eventId, userId, eventType),
  ]);

  const budgetCentavos = num('estimated_budget_centavos');
  const budgetPesos = budgetCentavos != null && budgetCentavos > 0 ? Math.round(budgetCentavos / 100) : null;
  const showBazi =
    baziBirthDataEnabled() &&
    isChineseWedding({ ceremony_type: str('ceremony_type'), secondary_ceremony_type: str('secondary_ceremony_type') });
  const trimTime = (v: string | null): string => (v ? v.slice(0, 5) : '');

  const repeatOptions = cadencesForType(eventType).map((c) => ({ value: c, label: CADENCE_LABELS[c] }));
  const storedCadence = effectiveCadence(e['recurs'] === true, str('recur_cadence'));
  const celebrantNoun = profile.terminology.celebrantNoun;

  const eventDateRaw = str('event_date');
  const datePrecision = str('event_date_precision') ?? 'day';

  const ceremony = str('ceremony_type');
  const secondary = str('secondary_ceremony_type');
  const venue = str('venue_setting');
  const ceremonyVenue = str('ceremony_venue_setting');
  const pax = num('estimated_pax');
  const region = resolveRegion(str('region'));
  const feel = str('mood_feel_key');
  const deadline = str('guest_list_edit_deadline');
  const mode: 'realtime' | 'final_only' = str('adaptive_pricing_mode') === 'final_only' ? 'final_only' : 'realtime';
  const isWedding = eventType === 'wedding';

  /* The wedding-only rows: the ceremony and its two venue settings are wedding
     columns (`events_wedding_fields_consistency` holds them NULL elsewhere), so
     they are offered only where they can be written. */
  const rows: EventSettingsInput['governed']['rows'] = isWedding ? ['ceremony', 'venue', 'ceremony_venue', 'pax'] : ['pax'];

  const kind = ceremony
    ? [CEREMONY_LABEL[ceremony] ?? `${titleCase(ceremony)} ceremony`, secondary ? `also ${(CEREMONY_LABEL[secondary] ?? titleCase(secondary)).toLowerCase()}` : null]
        .filter(Boolean)
        .join(' · ')
    : null;
  const readout: Array<{ label: string; value: string | null }> = [
    ...(isWedding
      ? [
          { label: 'Kind of wedding', value: kind },
          { label: 'Reception setting', value: venue ? (VENUE_LABEL[venue] ?? titleCase(venue)) : null },
          {
            label: 'Ceremony setting',
            value: ceremonyVenue
              ? (CEREMONY_VENUE_SETTING_SHORT_LABEL[ceremonyVenue as keyof typeof CEREMONY_VENUE_SETTING_SHORT_LABEL] ?? titleCase(ceremonyVenue))
              : null,
          },
        ]
      : []),
    { label: 'Guests', value: pax != null && pax > 0 ? `About ${formatCount(pax)}` : null },
    { label: 'Area', value: region?.display_label ?? null },
    { label: 'Feel', value: feel ? (FEEL_OPTIONS.find((o) => o.value === feel)?.label ?? titleCase(feel)) : null },
    ...(budgetAccess.mayRead ? [{ label: 'Budget target', value: budgetPesos ? `About ${formatPhpRounded(budgetPesos)}` : null }] : []),
    ...(repeatOptions.length > 0 ? [{ label: 'Repeats', value: storedCadence ? CADENCE_LABELS[storedCadence] : 'Just this once' }] : []),
    { label: 'Guest list closes', value: sheetDate(deadline) },
    { label: 'How you see costs', value: mode === 'final_only' ? 'Final only' : 'Realtime' },
  ];

  return {
    form: {
      region: str('region') ?? '',
      feel: feel ?? '',
      budgetPesos: budgetPesos ? String(budgetPesos) : '',
      mayEditBudget: budgetAccess.mayEdit,
      showBazi,
      baziHasConsent: str('bazi_birthdata_consent_at') != null,
      partnerABirthDate: str('partner_a_birth_date') ?? '',
      partnerABirthTime: trimTime(str('partner_a_birth_time')),
      partnerBBirthDate: str('partner_b_birth_date') ?? '',
      partnerBBirthTime: trimTime(str('partner_b_birth_time')),
      repeatOptions,
      repeatForced: cadenceIsForced(eventType),
      cadence: storedCadence ?? '',
      showCelebrantShape: celebrantShapeIsVisible(celebrantNoun),
      celebrantShape: str('celebrant_shape') ?? '',
      celebrantTypeDefaultLabel: CELEBRANT_SHAPE_LABELS[profile.terminology.celebrantShape],
    },
    governed: {
      confirmedVendorCount,
      ceremony,
      secondaryCeremony: secondary,
      venue,
      ceremonyVenue,
      pax,
      dateDisplay: describeEventDate(e),
      dateValue: eventDateRaw && datePrecision === 'day' ? eventDateRaw : null,
      activeCeremonies,
      rows,
    },
    pax: { deadline, mode },
    kind,
    readout,
    sub: [pax != null && pax > 0 ? `About ${formatCount(pax)} guests` : null, region?.display_label ?? null].filter(Boolean).join(' · ') || NOT_SET_YET,
  };
}
