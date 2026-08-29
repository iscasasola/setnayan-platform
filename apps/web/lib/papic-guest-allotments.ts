/**
 * HOW A CELEBRATION'S CREDITS ARE DIVIDED — one rule, one reader.
 *
 * ── WHAT THE COUPLE DECIDES ─────────────────────────────────────────────────
 * Named guests get a specific number each. Everyone else splits what is left,
 * equally. Whatever does not divide evenly is spare, and the spare is anyone's.
 * A button — and an automatic release late in the celebration — opens the rest
 * to everyone.
 *
 * ⚠ OWNER RULINGS, ALREADY MADE. Do not re-open any of them:
 *   • Unused credits are freed by a BUTTON plus an automatic late release.
 *     Sharing only among guests who have already started shooting was OFFERED
 *     AND REJECTED — a number that shrinks as more people join is a broken
 *     promise, and a guest who arrives late would watch their own allowance
 *     fall while they queued for the buffet.
 *   • A NAMED guest's unused credits STAY HERS. The release opens the other
 *     two tiers only. This is the whole reason naming somebody means anything.
 *   • A guest who buys chooses: keep them, or add them to the celebration.
 *
 * ── WHY THE ARITHMETIC LIVES HERE AND NOWHERE ELSE ──────────────────────────
 * The couple's sheet draws this split live, and the database enforces it at
 * capture time. Those are two readers of one rule, and this project has already
 * paid for a screen and a ledger that derived the same money twice and drifted
 * — `setCameraShots`' docblock says it plainly: *"the screen is the one people
 * believe."* So the split is written ONCE, here, as pure arithmetic with no
 * imports, and the sheet renders what this returns rather than doing its own.
 *
 * ⚠ NO IMPORTS, deliberately — same reason as `papic-guest-cap.ts`. The guard
 * has to EXECUTE this rule rather than match its text, and every richer module
 * on this surface reaches `server-only` or a Supabase client, neither of which
 * loads under `node:test`.
 *
 * ── THE THREE WORDS, AND WHICH ONE GOES WHERE ───────────────────────────────
 * ⚠ POINTS ON THE WIRE, CREDITS ON THE SCREEN. This is an existing deliberate
 * convention, NOT drift: the schema in this family says `points` (212
 * occurrences across the migrations — `points_used`, `floor_points`,
 * `ceiling_points`, `points_cost`) while its own comments and every host-facing
 * string say "credit". Do not "fix" either half, and do not introduce a third
 * word. This module is where the translation happens.
 *
 * ⚠ AND A PHOTOGRAPH IS STILL A SHOT. `32df56e81` ("the unit is a credit
 * everywhere a customer reads it", 2026-08-29) moved the CURRENCY meaning only.
 * "Take the shot", "Next shot", the vendor's shot list — all correct English,
 * all deliberately untouched. Sweeping them would have hit 440 occurrences and
 * corrupted the capture screens. So: currency → credits, photograph → shot.
 *
 * ── 🚨 THREE NUMBERS CALL THEMSELVES "PER GUEST", AND TWO OF THEM ARE 150 ────
 * This is the trap this control walks into, and it has already cost one shipped
 * defect:
 *
 *   1. `papic_event_pool_config.points_per_guest` (DEFAULT 150) — the POOL
 *      MULTIPLIER. It SIZES the pot: pool = clamp(guest_count ×
 *      points_per_guest, floor_points, ceiling_points). It is not a ceiling on
 *      anybody.
 *   2. `GUEST_CAPTURE_CREDITS = 150` (`papic-guest.ts`, spec § 8) — what one
 *      guest may SPEND.
 *   3. What this module adds: the number the COUPLE chooses for a guest.
 *
 * (1) and (2) are different quantities that happen to hold the same value, so
 * they have never visibly disagreed — and the capture pool's own migration
 * comment conflates them outright, calling the multiplier *"EXACTLY the
 * credits-per-guest already SHIPPED"* (20270826385580:20). The browser then
 * counted every guest down from a hardcoded 150 against a ceiling the database
 * was not applying at all — the defect `papic-guest-cap.ts` exists to kill.
 *
 * 🔑 THE MOMENT A COUPLE SETS (3) TO ANYTHING BUT 150, ALL THREE DIVERGE. So
 * the copy this module produces never says a bare "per guest" — it says what
 * the number DOES, and it never renders the pool multiplier and a spend ceiling
 * in the same breath.
 */

/**
 * ⛔ THE STORAGE IS NOT THIS SESSION'S TO NAME — it lands with the ceiling
 * migration, and this module must adopt whatever that migration calls things.
 *
 * 🔑 IT IS COLLECTED HERE, IN ONE PLACE, ON PURPOSE. Every write in this
 * feature reads its column name from this object, so adopting the real names is
 * an edit to THIS FILE and nothing else. Scattering the strings through the
 * action and the component is how a rename half-lands.
 *
 * 🚨 UNTIL THE CEILING MIGRATION IS APPLIED, THESE COLUMNS DO NOT EXIST and
 * every write below fails at runtime. That is not a bug to route around — it is
 * why this work must not merge before the ceiling does. A control that saves a
 * number nothing enforces is the `papic_uploads_open` defect this tree has
 * already paid for once: gate the write, not the button.
 *
 * ⚠ THESE NAMES SAY `points`, NOT `credits`, ON PURPOSE — see the convention
 * above. If the ceiling migration lands different names, change them HERE and
 * nowhere else.
 *
 * ⚠ AND NOT A BARE `points_per_guest` — that name is TAKEN, by the pool
 * multiplier, and means something else entirely. `ceiling` is the word that
 * distinguishes a limit on spending from a term that sizes the pot.
 */
export const ALLOTMENT_STORAGE = {
  /** `events` — is a per-guest ceiling in force at all? */
  enabled: 'papic_guest_ceiling_enabled',
  /** `events` — the number of points each un-named guest gets, when the couple
   *  sets one explicitly rather than letting the remainder divide itself. */
  everyoneElse: 'papic_guest_ceiling_points',
  /** `events` — stamped when the rest is opened to everyone, by the button or
   *  by the automatic late release. Null means still held back. */
  releasedAt: 'papic_guest_ceiling_released_at',
  /** The per-guest allotments, one row per named guest. */
  table: 'papic_guest_allotments',
} as const;

/** The sponsor roles that earn a bigger default. Mirrors `SponsorTier`. */
export type AllotmentRole = 'principal' | 'cord' | 'veil' | 'coin' | 'candle' | 'guest';

/**
 * SPONSORS DEFAULT TO A BIGGER SHARE — a starting number, never a rule.
 *
 * A ninong or ninang is photographed all night and asked to photograph all
 * night; a cord, veil, coin or candle sponsor stands up during the ceremony
 * itself. Handing them the same allowance as a plus-one is the kind of default
 * that makes a couple edit every row by hand, so the sheet opens with these and
 * the couple changes any of them.
 *
 * ⚖ A MULTIPLIER, NOT AN AMOUNT. The pot varies by an order of magnitude
 * between a 40-guest civil ceremony and a 400-guest reception, so a hard-coded
 * "give a ninong 60" is either extravagant or insulting depending on the event.
 * This scales whatever the ordinary share turns out to be.
 *
 * ⚠ IT IS ONLY A DEFAULT. Nothing enforces it, nothing re-applies it after the
 * couple has edited a row, and a named guest's saved number always wins. The
 * moment this starts overwriting an edit it has stopped being a suggestion.
 */
export const ROLE_MULTIPLIER: Record<AllotmentRole, number> = {
  principal: 3,
  cord: 2,
  veil: 2,
  coin: 2,
  candle: 2,
  guest: 1,
};

/**
 * The suggested opening number for a guest in a given role, given the ordinary
 * per-head share. Rounded up, so a role that earns more never lands on less
 * through flooring.
 */
export function suggestedAllotment(role: AllotmentRole, perHead: number): number {
  if (!Number.isFinite(perHead) || perHead <= 0) return 0;
  return Math.ceil(perHead * (ROLE_MULTIPLIER[role] ?? 1));
}

export type SplitInputs = {
  /** Everything the celebration holds to give away. */
  pot: number;
  /** How many guests are on the list. */
  guestCount: number;
  /** The named guests' allotments — one entry each, already chosen. */
  named: number[];
  /**
   * The couple's explicit number for everyone else, or null to let the
   * remainder divide itself equally.
   *
   * ⚠ NULL IS NOT ZERO. A blank box means "work it out for me"; zero means
   * "nobody but my named guests shoots". Collapsing them would silently mute
   * every un-named guest at a celebration where somebody just cleared the field
   * to retype it — the same defect `setCameraShots` guards with
   * *"a blank box is not zero."*
   */
  everyoneElse: number | null;
};

export type Split = {
  /** How many credits each un-named guest gets. */
  perHead: number;
  /** What is left over after the equal split — anyone's. */
  spare: number;
  /** Guests who are not named. */
  unnamedCount: number;
  /** The named allotments' total. */
  namedTotal: number;
  /**
   * The named allotments alone exceed the pot.
   *
   * 🔑 REPORTED, NEVER CLAMPED. Quietly capping it would show the couple a
   * sheet that adds up while the database refuses guests all night, and they
   * would have no way to learn why. The sheet says so and the couple fixes it.
   */
  overCommitted: boolean;
};

/**
 * Divide the pot: named guests first, then everyone else equally, then spare.
 *
 * Worked example — the line the couple reads:
 *   120 guests, 8 named holding 32 between them, a pot of 1,632
 *   → 1,600 left over 112 un-named guests → 14 each, 32 spare.
 */
export function splitTheRest(i: SplitInputs): Split {
  const namedTotal = i.named.reduce((sum, n) => sum + (Number.isFinite(n) && n > 0 ? n : 0), 0);
  const unnamedCount = Math.max(0, i.guestCount - i.named.length);
  const remaining = i.pot - namedTotal;

  if (remaining < 0) {
    return { perHead: 0, spare: 0, unnamedCount, namedTotal, overCommitted: true };
  }

  // No un-named guests left to divide among: the whole remainder is spare.
  if (unnamedCount === 0) {
    return { perHead: 0, spare: remaining, unnamedCount, namedTotal, overCommitted: false };
  }

  // The couple's own number wins over the derived one — but it cannot promise
  // more than the celebration holds, so it is capped by what is actually there.
  const derived = Math.floor(remaining / unnamedCount);
  const perHead =
    i.everyoneElse === null ? derived : Math.max(0, Math.min(i.everyoneElse, derived));

  return {
    perHead,
    spare: remaining - perHead * unnamedCount,
    unnamedCount,
    namedTotal,
    overCommitted: false,
  };
}

/**
 * The live line under the controls:
 *   "120 guests · 8 named · everyone else gets 14 each · 32 spare"
 *
 * ⚠ IT SAYS THE HONEST THING WHEN THE NUMBERS DO NOT WORK. An over-committed
 * sheet reads as over-committed rather than quietly showing zeroes.
 */
export function summariseAllotments(i: SplitInputs): string {
  const split = splitTheRest(i);
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  if (split.overCommitted) {
    return `${plural(i.guestCount, 'guest', 'guests')} · ${i.named.length} named · your named guests are promised ${split.namedTotal - i.pot} credits more than this celebration holds`;
  }

  return [
    plural(i.guestCount, 'guest', 'guests'),
    `${i.named.length} named`,
    split.unnamedCount === 0
      ? 'everyone on your list is named'
      : `everyone else gets ${split.perHead} credits each`,
    `${split.spare} spare`,
  ].join(' · ');
}
