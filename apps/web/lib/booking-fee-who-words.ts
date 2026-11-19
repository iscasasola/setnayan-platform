/**
 * WHO PAYS THE BOOKING FEE, IN WORDS — the ONE place every page quotes (owner 2026-11-16, specs DECISION_LOG
 * d4899cd5 · 9fe95ebe · 34909f1 · 99b6ab5 · 1abf35b, and the owner's answer 3 the same day closing the coordinator
 * loophole on the outside door). It replaces "only on couples Setnayan brings you" and "your own clients never carry a
 * fee", which stopped being true together: since 16 Nov a booking is FREE only when
 *   · the supplier is the FIRST supplier to bring an event onto Setnayan (one free slot per event), or
 *   · the supplier's import brought the couple onto Setnayan — then that couple books them free for a year, or
 *   · the couple's own Suppliers › Find invite created the shop;
 * and, for the first two, only for a VERIFIED shop. Every other booking carries the fee.
 * The bill itself is `booking_fee_attribution_for` (SQL); these words must say what it does — change both together.
 * ⚠ No price here, ever: the rate is read from the admin fee table where a sentence shows it.
 */

/** The full rule, to a supplier (second person). */
export const FEE_FREE_RULE =
  'Your booking is free when you are the first supplier to bring an event onto Setnayan, and a couple you bring onto Setnayan books you free for a year — verified shops only.';

/** The same rule in Tagalog, for the Tagalog feature pages. */
export const FEE_FREE_RULE_TL =
  'Libre ang booking mo kapag ikaw ang unang supplier na nagdala ng event sa Setnayan, at libreng mag-book sa iyo nang isang taon ang couple na dinala mo sa Setnayan — para lang sa verified na shops.';

/** The same rule about a supplier (third person) — help, SEO answers, llms.txt. */
export const FEE_FREE_RULE_THIRD =
  "A verified supplier's booking is free when they are the first supplier to bring an event onto Setnayan, and a couple they bring onto Setnayan books them free for a year.";

/** Where a sentence used to say "only on couples Setnayan brings you". Second person. */
export const FEE_SCOPE = 'unless you are the first to bring the event';

/** The same, third person ("…a supplier pays a booking fee, unless…"). */
export const FEE_SCOPE_THIRD = 'unless the supplier is the first to bring the event';

/** The short chip — the owner's own words F1 (DECISION_LOG 2026-11-16 "yes to all", item 7). */
export const FEE_FREE_CHIP = 'Be the first to bring the event — your booking is free';
