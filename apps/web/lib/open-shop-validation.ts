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
  logo: 'Add your shop logo.',
  service: 'Pick your primary service.',
  contactName: 'Add the owner name.',
  contactPhone: 'Add a contact number.',
  contactEmail: 'Add a valid company email.',
  locationCity: 'Add the city you serve.',
} as const;
