// ============================================================================
// Which celebrations can be written up as a Setnayan editorial
// ============================================================================
// THE ONE PLACE. Owner, 2026-08-15, twice: "not all stories will be wedding.
// each event they create will have an editorial not just wedding" and "each
// event can create a similar editorial."
//
// 🔴 WHAT THIS REPLACED, AND WHY IT IS A SINGLE MODULE.
// The editorial path used to refuse every non-wedding celebration in SIX
// separate places — `event_type !== 'wedding'` in the admin eligibility check
// plus five `.eq('event_type', 'wedding')` filters in `showcase-db.ts` — and
// each refusal fired BEFORE consent was even read. Fifteen of the sixteen live
// event types could therefore never be written up, at any consent setting, and
// prod already held two non-wedding celebrations with public slugs that were
// permanently uncoverable.
//
// Meanwhile the product promised the opposite in three places: /realstories'
// own public description names "weddings, debuts, anniversaries, graduations,
// travels, and reunions"; `GalleryItem.eventType` is typed for them; and the
// curated sample fallback (`lib/real-weddings.ts`) is ALREADY MIXED — 5 weddings
// plus a Debut, an Anniversary, a Graduation and a Reunion. The shelf already
// SHOWED non-wedding editorials; only real ones were refused.
// 🔑 The promise shipped and the gate never opened.
//
// ⚖ WHY AN EXCLUSION SET AND NOT AN ALLOWLIST — this is deliberate, do not
// "tighten" it into a list of permitted types. `event_type_vocab` is
// admin-managed and grows. An allowlist would mean a newly added celebration
// silently cannot be written up — which is EXACTLY the defect above, rebuilt.
// The default must be "every celebration can be written up", because that is
// the owner's model. This is the rare case where failing OPEN is correct, and
// it is safe because nothing here is a permission: the consent gate
// (`users.public_summary_consent_at`), the public-slug requirement, the
// private-page check and the post-event grace window all still apply on top,
// unchanged. This set answers a different question — "would Setnayan ever
// publish about this KIND of occasion at all?" — not "did these people agree?"
//
// ⏭ OPEN OWNER DECISION (design doc § 7-3, 2026-08-15). Sixteen kinds are live,
// and two of them — `date` and `hangout` — are somebody's private evening out
// rather than an occasion with guests. Whether Setnayan should ever publish an
// editorial about those is a judgement call, not an engineering one. Until the
// owner rules, the set is EMPTY: every kind may be written up, matching what he
// stated. The recommendation on the table is to keep it empty and simply never
// SOLICIT the intimate kinds editorially — a curation behaviour, not a gate —
// so those appear only when the people involved ask.
//
// To act on a ruling, add the event_type keys here. Nowhere else.

/**
 * Event types that may never become a public Setnayan editorial, regardless of
 * consent. Empty by design — see the module docblock before adding to it.
 *
 * Keys are `event_type_vocab.event_type` values (e.g. 'date', 'hangout').
 */
export const EDITORIAL_EXCLUDED_EVENT_TYPES: readonly string[] = [];

/**
 * Whether this kind of celebration may be written up at all.
 *
 * This is the KIND question only. Consent, the public slug, the private-page
 * check and the grace window are separate gates and are applied by the callers
 * — a `true` here never means "publish it".
 */
export function editorialAllowsEventType(
  eventType: string | null | undefined,
): boolean {
  if (!eventType) return false;
  return !EDITORIAL_EXCLUDED_EVENT_TYPES.includes(eventType);
}

/**
 * Display fallback when a celebration has no name of its own.
 *
 * Deliberately KIND-NEUTRAL. The old string was 'A Setnayan wedding', which
 * became a lie the moment a debut could be written up. Deriving the word from
 * the event type would need a second hardcoded copy of the vocabulary, and a
 * hardcoded vocabulary drifting from the admin-managed one is the same disease
 * this module exists to cure — so one true word for all sixteen kinds.
 */
export const UNNAMED_EDITORIAL_LABEL = 'A Setnayan celebration';
