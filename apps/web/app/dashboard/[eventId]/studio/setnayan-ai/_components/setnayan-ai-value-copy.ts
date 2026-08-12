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
  | 'deadlines'
  | 'next_move'
  | 'payments'
  | 'budget'
  | 'demand'
  | 'price_watch'
  | 'date_watch'
  | 'schedule_clash';

/**
 * ⛔ NOTHING GOES ON THIS CARD THAT THE PRODUCT DOES NOT DO (owner 2026-08-12:
 * "just list what is true").
 *
 * REMOVED 2026-08-12, because a verification pass found them sold and unbuilt:
 *   • `first_inquiry` — "Sends your first inquiry to the best fit". NO
 *     implementation existed anywhere. The only inquiry fan-out in the product
 *     is the FREE one at sign-up, so this was charging for something absent.
 *   • `chase` — "Chases the vendors who go quiet". It fires internally, but it
 *     is a "secretary" message and notifications carry GUARDS only, while the
 *     home rail is handed an empty inquiry list. Blocked twice over; it has
 *     never reached a single person.
 *
 * ⚠ THESE ARE COMING BACK. The owner's ruling is BUILD them, not delete them —
 * `first_inquiry` specifically is to become a real Setnayan AI feature (the
 * planner writing and sending a requirement-filled inquiry to the single best
 * fit, then following it up), distinct from the free fan-out, which stays free.
 * Re-add each line the day the thing behind it works, not before.
 *
 * 🔑 A FEATURE LIST IS A PROMISE WITH A PRICE ON IT. This card sits directly
 * above a buy button.
 */
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
          // ⚠ REWORDED 2026-08-12, not removed. The old title claimed the "%
          // match" on every vendor, and that score is FREE for everyone —
          // category-search.ts says so in as many words: "the paid layer is the
          // concierge, not the score". What Setnayan AI genuinely changes is the
          // SUGGESTED TEAM's rank mode (`compat` vs `cheapest`). Deleting the
          // line would have under-claimed a real paid capability; keeping the old
          // wording would have sold a free one. Both are failures.
          title: 'Builds your suggested team by best fit, not cheapest',
          body:
            'The “% match” on each vendor is free for everyone. What Setnayan AI ' +
            'changes is how your suggested TEAM is assembled — around fit with ' +
            'your date, budget and the rest of your line-up, instead of simply ' +
            'the lowest price.',
        },
      ],
    },
    {
      heading: 'Keeps it all moving',
      blurb: 'The quiet secretary that never loses the thread.',
      caps: [
        { id: 'deadlines', title: 'Tracks every deadline for you', body: deadlineBody },
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
          id: 'price_watch',
          title: 'Tells you when a vendor you’re watching changes their price',
          body:
            'It keeps the figure you were quoted and checks it against what the ' +
            'vendor charges now, so a quiet rise before you have signed does not ' +
            'reach you as a surprise on the invoice.',
        },
        {
          id: 'date_watch',
          title: 'Tells you when someone you’re considering gets booked — or frees up',
          body:
            'The one you were still deciding on takes another booking on your ' +
            'date, and you hear it from us rather than from a reply three days ' +
            'later. It works the other way too, when a full favourite opens up.',
        },
        {
          id: 'schedule_clash',
          title: 'Warns you when two things clash on the day',
          body:
            'Two parts of the run-of-show booked over each other, or a supplier ' +
            'due somewhere they cannot be, gets caught while it is still a ' +
            'calendar problem instead of a problem on the day itself.',
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
