/**
 * WHO PAYS THE BOOKING FEE, IN WORDS — the ONE place every page quotes (owner 2026-11-16, specs DECISION_LOG
 * d4899cd5 · 9fe95ebe · 34909f1 · 99b6ab5 · 1abf35b, and the owner's answer 3 the same day closing the coordinator
 * loophole on the outside door). It replaces "only on couples Setnayan brings you" and "your own clients never carry a
 * fee", which stopped being true together: since 16 Nov a booking is FREE only when
 *   · the supplier is the FIRST supplier to bring an event onto Setnayan (one free slot per event), or
 *   · the supplier's import brought the couple onto Setnayan — then that couple books them free for a set number of
 *     months (`platform_settings.booking_fee_new_client_free_months`), or
 *   · the couple's own Suppliers › Find invite created the shop;
 * and, for the first two, only for a VERIFIED shop. Every other booking carries the fee.
 * The bill itself is `booking_fee_attribution_for` (SQL); these words must say what it does — change both together.
 * ⚠ No price here, ever: the rate is read from the admin fee table where a sentence shows it.
 *
 * 📅 THE WINDOW'S LENGTH, TWO AUDIENCES (2026-11-19 PROMOTION PAGES (4), owner: "this is a ruling that it is a new
 * account, or they are the first supplier QR"; "No number of months is named on any page"):
 *   · PUBLIC pages read the constants below, which name NO duration — the owner's own words.
 *   · The supplier's OWN app and receipts read `feeFreeRuleInApp` / `feeNewClientLine`, which name the months from
 *     `platform_settings.booking_fee_new_client_free_months` (the schedule's `newClientFreeMonths`) — never typed.
 *     Unread → they fall back to the public words, never to a guessed number.
 */

/**
 * The full rule, to a supplier (second person). Since 20 Nov (#8061) public pages read it too — help, llms.txt, the
 * invite message, /features — so it names NO duration: the owner's words verbatim (19 Nov PROMOTION PAGES (4)), then the
 * verified-only fact (99b6ab50). The in-app screens that may name the length use `feeFreeRuleInApp`.
 * ⤳ main (batch A, #8078) holds the same sentence as `SUPPLIER_FREE_BOOKING_LINE`; when this branch meets main, this
 *   becomes `${SUPPLIER_FREE_BOOKING_LINE} Verified shops only.` — one sentence, one home.
 */
export const FEE_FREE_RULE = "New to Setnayan, or you're the first to bring their event? They book you free. Verified shops only.";

/** The same rule in Tagalog, for the Tagalog feature pages. No duration. */
export const FEE_FREE_RULE_TL =
  'Bago pa sa Setnayan, o ikaw ang unang nagdala ng event nila? Libre ang booking nila sa iyo. Para lang sa verified na shops.';

/** The same rule about a supplier (third person) — help, SEO answers, llms.txt. No duration. */
export const FEE_FREE_RULE_THIRD =
  "A verified supplier's booking is free when they are the first supplier to bring an event onto Setnayan, or when the couple is new to Setnayan through them.";

/**
 * The new-client window in one short line — the SUPPLIER'S OWN APP AND RECEIPTS ONLY. `months` is the schedule's
 * `newClientFreeMonths` (`platform_settings.booking_fee_new_client_free_months`). Null when it was not read, so the
 * caller shows nothing rather than a guessed length.
 */
export function feeNewClientLine(months: number | null | undefined): string | null {
  if (typeof months !== 'number' || !Number.isInteger(months) || months <= 0) return null;
  return `New to Setnayan through you? They book you free for ${months} ${months === 1 ? 'month' : 'months'}.`;
}

/** What sits behind the new-client line's ⓘ — when the window starts, whom it covers, what happens after. */
export const FEE_NEW_CLIENT_DETAIL =
  'Counted from the day you brought them, with your shop only. After that, or with another shop, the usual fee applies.';

/**
 * The full rule with the window's length — the SUPPLIER'S OWN APP AND RECEIPTS ONLY (the fee notice before Agree, the
 * Booking fees page). Unread months → the public `FEE_FREE_RULE`, which names no duration.
 */
export function feeFreeRuleInApp(months: number | null | undefined): string {
  const line = feeNewClientLine(months);
  if (!line) return FEE_FREE_RULE;
  return `Your booking is free when you are the first to bring an event onto Setnayan. ${line} ${FEE_NEW_CLIENT_DETAIL} Verified shops only.`;
}

/** Where a sentence used to say "only on couples Setnayan brings you". Second person. */
export const FEE_SCOPE = 'unless you are the first to bring the event';

/** The same, third person ("…a supplier pays a booking fee, unless…"). */
export const FEE_SCOPE_THIRD = 'unless the supplier is the first to bring the event';

/** The short chip — the owner's own words F1 (DECISION_LOG 2026-11-16 "yes to all", item 7). */
export const FEE_FREE_CHIP = 'Be the first to bring the event — your booking is free';
