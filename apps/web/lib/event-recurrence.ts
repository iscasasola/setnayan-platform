/**
 * Recurrence — "Plan next year" for events that come back every year (birthdays,
 * reunions, anniversaries, annual corporate galas). Owner-locked 2026-07-12,
 * clone scope: "Details, not the guest list".
 *
 * This is the PURE payload builder. It takes last year's event and returns the
 * column values for next year's fresh planning instance: the identity + captured
 * details carry forward (name, type, the Event-Brief signature_details incl. the
 * honoree, the recurring anchor date, rough scale + location), while everything
 * event-specific starts fresh (the guest list, schedule, payments, venue, and the
 * chosen date). The server action (planNextYearEvent) adds a unique slug +
 * membership and does the insert — mirroring createWeddingEvent's proven path so
 * the wedding-CHECK constraints, is_primary, and the on_event_created trigger all
 * behave identically. No DB access here → unit-testable.
 */

/** Event types that recur annually and get the "Plan next year" affordance.
 *  Deliberately NOT gated on the `recurs` column: only anniversaries set it at
 *  creation today, so a type-set is what actually surfaces the button for
 *  birthdays/reunions/corporate. The clone always stamps recurs=true. */
export const RECURRENCE_CAPABLE_TYPES = [
  'birthday',
  'anniversary',
  'reunion',
  'corporate',
] as const;

export type RecurrenceCapableType = (typeof RECURRENCE_CAPABLE_TYPES)[number];

export function canPlanNextYear(eventType: string | null | undefined): boolean {
  return (
    typeof eventType === 'string' &&
    (RECURRENCE_CAPABLE_TYPES as readonly string[]).includes(eventType)
  );
}

/** The subset of a source event row the clone reads. All optional so a sparse
 *  row (name-only creation) clones cleanly. */
export type SourceEventForClone = {
  event_type?: string | null;
  display_name?: string | null;
  // Life-event cardinality key (council 2026-07-17): the honoree stays the same
  // person year over year, so both halves of the key carry into the clone.
  honoree_label?: string | null;
  honoree_dependent_id?: string | null;
  signature_details?: Record<string, unknown> | null;
  anchor_kind?: string | null;
  anchor_date?: string | null;
  anchor_origin?: string | null;
  estimated_pax?: number | null;
  budget_band?: string | null;
  estimated_budget_centavos?: number | null;
  region?: string | null;
  venue_latitude?: number | null;
  venue_longitude?: number | null;
  style_preferences?: Record<string, unknown> | null;
};

/**
 * Build the `events` insert payload for next year's instance. Carries identity +
 * captured details + the recurring anchor + rough scale/location; resets the
 * date, venue, and (by omission) the guest list / schedule / payments. Always
 * recurs=true and non-wedding CHECK columns null/false by construction (the
 * caller guards that the type is recurrence-capable, i.e. never 'wedding').
 */
export function buildNextYearClonePayload(
  source: SourceEventForClone,
): Record<string, unknown> {
  return {
    event_type: source.event_type ?? null,
    display_name: source.display_name ?? null,
    // Identity + captured details carry forward — the honoree, theme, rosters all
    // live in signature_details (attribute-only People-layer, owner 2026-07-12).
    signature_details: source.signature_details ?? null,
    // Life-event cardinality key (council 2026-07-17): same honoree next year —
    // carrying both halves keeps the (account × type × honoree) slot bookkeeping
    // honest for gated life types (birthday, among the recurrence set) and
    // stops the clone from landing as a post-epoch unlabeled singleton.
    honoree_label: source.honoree_label ?? null,
    honoree_dependent_id: source.honoree_dependent_id ?? null,
    // The recurring anchor date stays the same calendar date year over year; the
    // "next occurrence" is derived from it (per the event-anchor model).
    anchor_kind: source.anchor_kind ?? null,
    anchor_date: source.anchor_date ?? null,
    anchor_origin: source.anchor_origin ?? null,
    recurs: true,
    // Fresh timing: last year's specific date/candidates don't carry. The host
    // picks next year's date (event_date stays NULL — date-as-output, consistent
    // with createWeddingEvent).
    event_date: null,
    date_mode: 'specific',
    date_candidates: null,
    date_window_start: null,
    date_window_end: null,
    // Fresh venue — they re-book each year.
    venue_name: null,
    venue_address: null,
    // Rough scale + location carry as a sensible starting point (editable).
    estimated_pax: source.estimated_pax ?? null,
    budget_band: source.budget_band ?? null,
    estimated_budget_centavos: source.estimated_budget_centavos ?? null,
    region: source.region ?? null,
    venue_latitude: source.venue_latitude ?? null,
    venue_longitude: source.venue_longitude ?? null,
    ...(source.style_preferences
      ? { style_preferences: source.style_preferences }
      : {}),
    // Wedding-only CHECK columns: NULL/false by construction (recurrence-capable
    // types are never 'wedding') — satisfies events_wedding_fields_consistency.
    ceremony_type: null,
    venue_setting: null,
    ceremony_sub_type: null,
    is_mixed_ceremony: false,
    secondary_ceremony_type: null,
  };
}
