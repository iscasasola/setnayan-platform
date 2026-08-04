/**
 * setnayan-ai-value-copy.ts — the Setnayan AI capability copy, per event type.
 *
 * WHY THIS EXISTS (2026-07-28)
 * ───────────────────────────
 * `SetnayanAiValue`'s capability list was a static `GROUPS` const written for
 * weddings. `eventWord` templated only the two closing sentences; every
 * capability body was frozen wedding prose. Three of them were outright wrong on
 * any other event type:
 *
 *   • "your PH marriage paperwork — license, Pre-Cana, PSA" — promised marriage
 *     paperwork tracking on a BIRTHDAY.
 *   • "another COUPLE starts looking at a vendor" — a corporate event has no couple.
 *   • "distance to your RECEPTION" — a tournament has no reception.
 *
 * That was harmless while the surface was wedding-only. It stops being harmless
 * the moment the AI card is mounted in the onboarding of all 15 vendor-bearing
 * types (Onboarding_Papic_AI_Cards_BUILD_SPEC_2026-07-27.md §2.3), which is what
 * this unblocks. A capability list is a PROMISE — the surrounding component is
 * built to the standing "no fake doors" rule, and promising Pre-Cana on a
 * birthday breaks it just as surely as a dead button would.
 *
 * DERIVED, NEVER NAMED BY TYPE
 * ────────────────────────────
 * The paperwork clause keys off `EventTypeProfile.statutoryPackKey`, the column
 * that ALREADY encodes this: `'ph_marriage'` on wedding, NULL on all 12 other
 * seeded types. The organizer noun comes from `terminology.organizerNoun`
 * ('couple' | 'host' | 'organizer' | 'celebrant'). No `=== 'wedding'` anywhere —
 * a future statutory type (a civil partnership, say) inherits the clause by
 * setting its pack key, and a future vendor-bearing type gets correct prose for
 * free. Same house pattern as `lib/papic-event-access.ts:154` — *"this is how
 * simple_event is excluded, for the right reason, not by name."*
 *
 * PURE + string-only: no React, no icons, no I/O, so the promises can be
 * asserted directly in a unit test. The component maps `id` → icon and
 * `id` → live-figure fn; this module owns nothing but words.
 */

/** The terminology + statutory facts the copy varies on. All from EventTypeProfile. */
export type AiValueTerms = {
  /** terminology.eventWord — 'wedding' | 'event' | 'trip'. */
  eventWord: string;
  /** terminology.organizerNoun — 'couple' | 'host' | 'organizer' | 'celebrant'. */
  organizerNoun: string;
  /**
   * statutoryPackKey != null. TRUE only for types carrying a real statutory
   * paperwork pack (today: wedding → 'ph_marriage'). Gates the license/Pre-Cana/
   * PSA clause — the single hardest wedding-ism in the list.
   */
  hasStatutoryPaperwork: boolean;
};

/**
 * The wedding shape — the default, so an un-migrated caller renders exactly what
 * it rendered before this module existed.
 */
export const WEDDING_AI_VALUE_TERMS: AiValueTerms = {
  eventWord: 'wedding',
  organizerNoun: 'couple',
  hasStatutoryPaperwork: true,
};

/** Stable ids — the component keys icons + live figures off these, never off titles. */
export type AiCapabilityId =
  | 'rank'
  | 'distance'
  | 'first_inquiry'
  | 'deadlines'
  | 'chase'
  | 'next_move'
  | 'payments'
  | 'budget'
  | 'demand';

export type AiCapabilityCopy = { id: AiCapabilityId; title: string; body: string };
export type AiCapabilityGroupCopy = {
  heading: string;
  blurb: string;
  caps: AiCapabilityCopy[];
};

/**
 * Build the capability copy for one event type.
 *
 * Every row here is a WIRED, running capability (owner "no fake doors").
 * Designed-but-dormant guards — price-drop, availability-change, contract
 * windows, the consent-gated trend/inference insights — stay deliberately absent
 * because they have no live data source yet (see setnayan-ai-snapshot.ts).
 */
export function buildAiValueGroups(terms: AiValueTerms): AiCapabilityGroupCopy[] {
  const { eventWord, organizerNoun, hasStatutoryPaperwork } = terms;

  // The deadline promise is the one that must not over-claim. With a statutory
  // pack we name the actual documents; without one we promise ONLY the booking
  // windows the app really tracks — never a vague "and your paperwork", which
  // would be the same false promise in softer words.
  const deadlineBody = hasStatutoryPaperwork
    ? 'Recommended booking windows plus your PH marriage paperwork — license, ' +
      'Pre-Cana, PSA — counted down and surfaced before they bite.'
    : 'Recommended booking windows for every category, counted down and surfaced ' +
      'before they bite.';

  return [
    {
      heading: 'Finds the right people',
      blurb: `Turns the whole vendor directory into a shortlist made for your ${eventWord}.`,
      caps: [
        {
          id: 'rank',
          // "faith" stays for EVERY type on purpose. It is a real weighted
          // dimension in the matcher (`faithFit`, 0.07 — a lift for a vendor who
          // declares the ceremony/faith), and it is not wedding-only: a
          // christening ranks on it too. Listing an input that simply scores
          // NEUTRAL when your event declares no faith is not a false promise;
          // dropping it would UNDER-claim a running capability, which breaks the
          // same "list only what's wired" rule from the other direction.
          title: 'Ranks every vendor by how well they fit',
          body:
            'Sorted by your date, budget, location, guest count, faith and reviews ' +
            '— each with a “% match”, not a generic A–Z list.',
        },
        {
          id: 'distance',
          // "reception" was wedding-only; "venue" is true for every type,
          // including a wedding, whose reception IS the anchor venue.
          title: 'Sorts by distance to your venue',
          body:
            'Nearer vendors rise to the top, so you’re not comparing a supplier ' +
            'three provinces away against one down the road.',
        },
        {
          id: 'first_inquiry',
          title: 'Sends your first inquiry to the best fit',
          body:
            'For each category it can draft and open the conversation with the ' +
            'strongest match, so you start with a reply — not a blank page.',
        },
      ],
    },
    {
      heading: 'Keeps it all moving',
      blurb: 'The quiet secretary that never loses the thread.',
      caps: [
        { id: 'deadlines', title: 'Tracks every deadline for you', body: deadlineBody },
        {
          id: 'chase',
          title: 'Chases the vendors who go quiet',
          body:
            'If someone you’ve messaged hasn’t replied, it notices and offers to ' +
            'send a polite nudge — so a stalled thread never becomes a lost date.',
        },
        {
          id: 'next_move',
          title: 'Tells you the one thing to do next',
          body:
            'Out of everything in flight, it names the single most-urgent move and ' +
            'how far you’ve come — no more staring at a to-do pile.',
        },
      ],
    },
    {
      heading: 'Guards against costly slips',
      blurb: 'The part that is practically impossible to keep by hand.',
      caps: [
        {
          id: 'payments',
          title: 'Flags a payment before it’s due',
          body:
            'Every vendor balance and due date, watched — so a deposit deadline ' +
            'never sneaks up and costs you the booking.',
        },
        {
          id: 'budget',
          title: 'Warns you before you go over budget',
          body:
            'It adds up what you’ve committed against your target and speaks up ' +
            'while there’s still room to trim, not after.',
        },
        {
          id: 'demand',
          title: 'Notices when someone eyes your date',
          body:
            `When another ${organizerNoun} starts looking at a vendor you’re ` +
            'considering for your date, it tells you — so you can lock them in first.',
        },
      ],
    },
  ];
}
