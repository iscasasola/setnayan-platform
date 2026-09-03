/**
 * supplier-invite-eligibility — MAY THIS SUPPLIER BE SENT A CLAIM INVITE?
 * ONE definition, because five call sites had three answers. (2026-09-03)
 *
 * PURE on purpose. It lives here rather than in `lib/vendor-invites.ts`
 * because that module is `server-only`: a predicate nobody can import from a
 * unit test is a predicate whose truth table nobody checks, and this one's
 * truth table is the whole defect.
 */

// ---------------------------------------------------------------------------
// MAY THIS SUPPLIER BE INVITED? — ONE definition (2026-09-03)
//
// ── The defect this closes ─────────────────────────────────────────────────
// Four shipped call sites answered this one question three different ways:
//
//   · `createManualVendorInvite`  — manual_vendor_id IS NOT NULL
//                                   AND marketplace_vendor_id IS NULL
//   · `finalizeVendor`            — the same two conditions
//   · the workspace page          — marketplace_vendor_id IS NULL, alone
//   · `createAutoShareInviteAction` — no condition at all
//
// Measured against production 2026-09-03: of 45 `event_vendors` rows, **43
// carry BOTH ids NULL**. Narrow it to the rows that are actually eligible —
// off-platform AND locked, the ones the workspace page offers an invite for —
// and it is **12 of 12 REFUSED**, every one of them told
// *"This vendor is already on Setnayan."* That sentence is false for precisely
// the suppliers it is shown to: they are the ones NOT on Setnayan.
// `vendor_invites` holds **0 rows of any source**, which is what a path nobody
// can reach looks like from the data.
// Re-measure, never trust these figures:
//   select count(*) filter (where manual_vendor_id is null
//                             and marketplace_vendor_id is null)
//   from public.event_vendors;
//
// ── Why `marketplace_vendor_id IS NULL` is the whole condition ─────────────
// It is the ONLY half `ensureAutoShareInvite`'s own reasoning ever justified:
// a marketplace-linked row already has chat unlocked and a `vendor_profiles`
// row for the supplier to log into, so an invite there is a no-op. The
// `manual_vendor_id IS NOT NULL` half described how manual vendors happened to
// be created in 2026-06; it was never a property of the question. It cannot be
// one: `event_manual_vendors` requires `contact_person` AND `contact_number`,
// both NOT NULL, so a supplier the couple named with nothing but a NAME can
// never have that row — and is exactly the supplier who most needs an invite.
//
// 🔑 THE SHIPPED RENDER ALREADY AGREED. The workspace page — the surface that
// actually puts `ClaimLinkShare` in front of a couple — has always said, in
// its own comment: "ANY vendor without a Setnayan account
// (marketplace_vendor_id IS NULL) gets the claim-link CTA". The two actions
// contradicted the page that renders them.
//
// ⚖ OFF-PLATFORM AND FINALIZED ARE INDEPENDENT AXES (owner, 2026-09-02:
// "Adding them to their shortlist does not mean it is final, it just means they
// are not on the app."). This predicate answers ONLY the account question.
// Whether the booking is real enough to bother inviting is a SEPARATE
// condition, and it stays where it belongs — the workspace page ANDs its own
// locked-status test, `finalizeVendor` runs at lock time by construction, and
// the add-a-contact modal deliberately offers the QR at add time per the
// owner's 2026-07-01 directive. Folding status in here would silently retire
// one of those three behaviours.
// ---------------------------------------------------------------------------

/** The one field every question here turns on. Deliberately minimal. */
export type SupplierInviteEligibility = {
  /** `vendor_profiles.vendor_profile_id`, or null when they have no account. */
  marketplace_vendor_id?: string | null;
};

/**
 * THE FACT: this supplier has no Setnayan account.
 *
 * `marketplace_vendor_id` is populated by `applyClaimAutoLink` when a supplier
 * finishes signing up through a claim link, so its absence is exactly "nobody
 * has an account here yet".
 */
export function isOffPlatformSupplier(row: SupplierInviteEligibility): boolean {
  return !row.marketplace_vendor_id;
}

/**
 * THE QUESTION: can this `event_vendors` row be sent a claim invite?
 *
 * TRUE exactly when the supplier has no Setnayan account — there is nothing
 * else to invite them TO. Every gate on this question calls this;
 * `one-gate-decides-a-supplier-invite.test.ts` fails CI if one grows its own
 * predicate again.
 *
 * ⚖ NAMED SEPARATELY FROM `isOffPlatformSupplier` ON PURPOSE, even though it
 * returns the same thing today. They are different questions — "do they have an
 * account" is a fact about the world, "may we invite them" is a product rule
 * that could acquire another clause. Collapsing them to one name would make a
 * future change to one silently change the other, which is the class of defect
 * this whole file exists to end.
 */
export function canInviteSupplier(row: SupplierInviteEligibility): boolean {
  return isOffPlatformSupplier(row);
}

/**
 * What to tell a couple when the invite is genuinely pointless.
 *
 * ⚠ THE STRING IT REPLACES WAS FALSE FOR EVERY SUPPLIER IT REACHED. It read
 * "This vendor is already on Setnayan." and was returned to 12 of 12 eligible
 * off-platform suppliers — the ones who are not. Now it is only ever shown when
 * `canInviteSupplier` is false, i.e. when it is true.
 */
export const SUPPLIER_ALREADY_HAS_ACCOUNT_MESSAGE =
  'This supplier already has a Setnayan account, so they do not need an invite.';
