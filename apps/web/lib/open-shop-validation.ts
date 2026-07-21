/**
 * Shared validation contract for the /open-shop vendor wizard.
 *
 * WHY THIS FILE EXISTS: step 2 of the wizard had ZERO client validation while
 * the server rejected three of its fields. A blank phone or `juan@gmail`
 * reached the server, which redirected to `?error=`, and the wizard remounted
 * at STEP 1 with every step-2 value gone — none of them had ever been written
 * to the DB that the `defaults` prop reads from. The vendor retyped everything.
 *
 * Client and server now import the SAME regex and the SAME strings, so they
 * cannot drift into disagreeing about what "valid" means — which is the failure
 * mode that turns a client gate into a second bug rather than a fix.
 *
 * Kept out of `actions.ts` deliberately: that module is `'use server'`, so it
 * may only export async functions.
 */

/**
 * Is the shop logo required to FINISH registration?
 *
 * FALSE since 2026-07-21 (owner decision 4: "shop logo is only required before
 * verification. starting your shop can start as name, next is completing the
 * profile, then verification."). This softens iteration 0022 § 2.1b from
 * mandatory-at-registration to mandatory-before-verification.
 *
 * The requirement did NOT disappear — it MOVED one stage later. The logo is
 * still all of:
 *   • a `businessProfileChecklist` item (lib/vendor-profile.ts) — so it is
 *     counted in the My Shop completeness ring and named, by label, in the
 *     itemised checklist the vendor sees;
 *   • required to SUBMIT for verification, via `verificationSubmitMissing`
 *     (lib/vendor-verification.ts), which gates on that checklist's `complete`;
 *   • required to PUBLISH, via the save-time gate in
 *     app/vendor-dashboard/actions.ts.
 *
 * Both the client wizard and the `becomeVendor` server action read THIS
 * constant, so the two layers cannot drift into disagreeing about whether the
 * logo is required — the exact bug class this module exists to prevent.
 *
 * Typed `boolean` (not the literal `false`) on purpose: the call sites stay
 * real branches rather than being narrowed away, so flipping this one value is
 * all it takes to restore the old rule.
 */
export const OPEN_SHOP_LOGO_REQUIRED: boolean = false;

/** Light email shape check — enough to keep obviously-broken strings out. */
export const OPEN_SHOP_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidOpenShopEmail(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  return t.length > 0 && t.length <= 254 && OPEN_SHOP_EMAIL_RE.test(t);
}

/**
 * The exact copy the server redirects with. The client renders these verbatim
 * so a vendor never sees two different sentences for the same rejection.
 */
export const OPEN_SHOP_ERRORS = {
  shopName: 'Give your shop a name.',
  // Still the correct sentence if OPEN_SHOP_LOGO_REQUIRED is ever flipped back
  // on; unused by the wizard while the logo is optional at registration.
  logo: 'Add your shop logo.',
  service: 'Pick your primary service.',
  contactName: 'Add the owner name.',
  contactPhone: 'Add a contact number.',
  contactEmail: 'Add a valid company email.',
  locationCity: 'Add the city you serve.',
} as const;
