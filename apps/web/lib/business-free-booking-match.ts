/**
 * 🛡 ONE FREE FIRST BOOKING PER BUSINESS — what the verification desk shows.
 *
 * ⚖ OWNER, 2026-11-06 (DECISION_LOG "ONE FREE FIRST BOOKING PER BUSINESS, NOT
 * PER ACCOUNT — THE NEW-ACCOUNT LOOPHOLE IS CLOSED AT THE VERIFICATION DESK"):
 * the desk matches the registration/permit number, phone and payout account
 * against other shops; the match shows in the queue "with links to the matching
 * shops (read-only, like B3)", and the second shop gets no second free booking.
 *
 * The MATCH itself is `public.booking_fee_business_matches` (migration
 * 20271319712279) — the same function the charge path asks through
 * `booking_fee_business_free_standing`, so the desk and the bill can never
 * disagree about who is the same business. This module only shapes its rows.
 *
 * PURE: no database. READ-ONLY: nothing here writes, blocks or changes a shop.
 * 🔒 A refused read is `null` ("could not check"), never `[]` ("no match").
 */

export type MatchedOn = 'registration_number' | 'phone' | 'payout_account';

export const MATCHED_ON_LABEL: Record<MatchedOn, string> = {
  registration_number: 'registration number',
  phone: 'phone',
  payout_account: 'payout account',
};

export type BusinessMatchRow = {
  vendor_profile_id: string;
  other_vendor_profile_id: string;
  matched_on: string[] | null;
  other_took_free: boolean | null;
};

export type MatchedShop = {
  vendorProfileId: string;
  businessName: string;
  matchedOn: MatchedOn[];
  /** That shop already holds the business's free first booking. */
  tookFree: boolean;
};

export type WithheldCounts = {
  alreadyUsed: number;
  checkUnreadable: number;
  /** This shop itself holds the business's free first booking. */
  selfTookFree: boolean;
};

export type FreeBookingMatch = {
  /** The other shops of this business. `null` = the match could not be read. */
  shops: MatchedShop[] | null;
  /** This shop's bookings billed inside its own free place. `null` = not readable. */
  withheld: WithheldCounts | null;
};

function asMatchedOn(v: unknown): MatchedOn | null {
  return v === 'registration_number' || v === 'phone' || v === 'payout_account' ? v : null;
}

/**
 * One `FreeBookingMatch` per shop under review. `rows === null` (the match read
 * failed) gives every shop `shops: null`; a shop with no row gets `[]`.
 * `withheldRows === null` gives every shop `withheld: null`.
 */
export function buildFreeBookingMatches(args: {
  reviewedIds: readonly string[];
  rows: readonly BusinessMatchRow[] | null;
  names: Readonly<Record<string, string>>;
  withheldRows: ReadonlyArray<{
    vendor_profile_id: string;
    free_booking_withheld_reason: string | null;
    is_free_booking?: boolean | null;
  }> | null;
}): Record<string, FreeBookingMatch> {
  const out: Record<string, FreeBookingMatch> = {};
  for (const id of args.reviewedIds) {
    out[id] = {
      shops: args.rows === null ? null : [],
      withheld: args.withheldRows === null ? null : { alreadyUsed: 0, checkUnreadable: 0, selfTookFree: false },
    };
  }
  for (const r of args.rows ?? []) {
    const target = out[r.vendor_profile_id];
    if (!target?.shops) continue;
    const matchedOn = (r.matched_on ?? []).map(asMatchedOn).filter((m): m is MatchedOn => m !== null);
    target.shops.push({
      vendorProfileId: r.other_vendor_profile_id,
      businessName: args.names[r.other_vendor_profile_id]?.trim() || 'A shop (name not readable)',
      matchedOn,
      tookFree: r.other_took_free === true,
    });
  }
  for (const w of args.withheldRows ?? []) {
    const target = out[w.vendor_profile_id]?.withheld;
    if (!target) continue;
    if (w.is_free_booking === true) target.selfTookFree = true;
    if (w.free_booking_withheld_reason === 'business_already_used') target.alreadyUsed += 1;
    else if (w.free_booking_withheld_reason === 'business_check_unreadable') target.checkUnreadable += 1;
  }
  // The shop holding the free booking first, then by name — stable for the reviewer.
  for (const m of Object.values(out)) {
    m.shops?.sort((a, b) => Number(b.tookFree) - Number(a.tookFree) || a.businessName.localeCompare(b.businessName));
  }
  return out;
}

/** "registration number and phone" — the identities that matched, in plain words. */
export function matchedOnText(on: readonly MatchedOn[]): string {
  const words = on.map((m) => MATCHED_ON_LABEL[m]);
  if (words.length <= 1) return words[0] ?? 'details';
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}
