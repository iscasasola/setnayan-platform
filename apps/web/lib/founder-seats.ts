/**
 * Founder seats — up to 10 owner-granted platform-founder accounts
 * (owner-locked 2026-07-16 · migration 20270818135217 · corpus
 * Founder_Account_Token_Free_Inquiry_2026-07-16.md).
 *
 * A seat confers: (1) token-free vendor inquiries — the vendor's accept is
 * comped (unlock row at tokens_burned 0 + comp_reason 'founder', no debit, no
 * hold);
 *
 *     ⚠ BENEFIT (1) IS NOW VESTIGIAL, and is left recorded rather than deleted
 *     because it was owner-locked on 2026-07-16 and the mechanism still runs.
 *     Accepting an inquiry became free for EVERY vendor when the inbox was
 *     ungated (owner 2026-07-24) and token packs were retired:
 *     `unlock_vendor_event_free` forces `v_tokens := 0` for every tier and
 *     marks its own burn path "retained but unreachable". The comp row is still
 *     written with `comp_reason 'founder'`, so the audit trail is intact — it
 *     simply no longer comps anything, because there is nothing left to charge.
 *     The vendor-facing copy stopped claiming it on 2026-09-08: a perk everyone
 *     has is not a perk, and naming it implied the other inquiries cost money.
 *
 * (2) every in-app SKU already paid for on the founder's events
 * (eventSkuActive ORs in eventHostHoldsFounderSeat — lib/entitlements.ts);
 * (3) an explicit, SERVER-ASSERTED founder signal to the vendor. The signal
 * must only ever come from the definer helpers backed by the founder_seats
 * table — never from profile text — so it cannot be impersonated.
 *
 * Deliberately distinct from is_internal (§10a): internal is the team/ops
 * flag and may later cover non-founder staff; the vendor-facing "founder of
 * the app" claim is only ever true for owner-granted seats. Ice + Cale hold
 * the first two; the rest are granted from /admin/founder-seats.
 *
 * NOT a 'use client' module — the copy constants below are imported by Server
 * Components (RSC gotcha: value exports from client modules resolve undefined
 * in the prod RSC build).
 */

/** Hard cap — also enforced by the founder_seats.seat_no CHECK (1..10). */
export const FOUNDER_SEAT_CAP = 10;

/** The badge chip text (vendor thread header). */
export const FOUNDER_BADGE_LABEL = 'Setnayan Founder';

/**
 * The explicit signal line next to the badge — the owner's brief: vendors must
 * know "we are not just clients, we are the founders of the app".
 *
 * ── THE COST CLAUSE IS GONE, AND IT HAD TO BE (owner, 2026-09-08) ─────────
 * *"why do i see accepting token is free. this token system does not exist
 * anymore."*
 *
 * It read "Accepting is token-free." Two things were wrong with that, and the
 * second is the worse one:
 *
 *   1. TOKENS ARE RETIRED. `chat-actions.ts` says so where it accepts —
 *      "answering is free — token packs are retired" — and
 *      `unlock_vendor_event_free` forces the burn to zero for every tier, with
 *      its own burn path marked "retained but unreachable".
 *   2. IT ADVERTISED A PRIVILEGE THAT IS UNIVERSAL. Answering is free for
 *      EVERY vendor — "the inbox is ungated (owner 2026-07-24) … no tier wall
 *      and no weekly cap". Telling a supplier that accepting *this* inquiry
 *      costs nothing implies the others do. The card already states the true,
 *      unconditional version one line above: "Accept to see who they are and
 *      reply — it's free."
 *
 * 🔑 A PERK THAT EVERYONE HAS IS NOT A PERK — naming it here made a founder
 * inquiry look like a discount, in the currency of a system that no longer
 * exists. The identity half of the brief is the half that still says something.
 */
export const FOUNDER_INQUIRY_NOTE =
  'This inquiry is from a founder of Setnayan — not just a client, one of the people who built the app.';

/** Title for the vendor_inquiry_received notification (+ its email). */
export const FOUNDER_INQUIRY_NOTIFICATION_TITLE =
  'New booking inquiry — from a Setnayan founder';

/**
 * Prefix for the notification body (the couple's message text follows).
 *
 * Same removal as `FOUNDER_INQUIRY_NOTE`, and it matters more here: this one
 * goes out by EMAIL, where there is no surrounding card to say "replying is
 * free" and no way to correct it once sent.
 */
export const FOUNDER_INQUIRY_NOTIFICATION_PREFIX =
  'This inquiry comes from a founder of Setnayan. ';
