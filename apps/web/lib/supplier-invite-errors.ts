/**
 * The only words `/i/<shop>?error=` can show (final check A1-058, 25 Nov 2026). `joinSupplierInvite` redirects with
 * one of these sentences; the page maps the param against this list and shows `INVITE_JOIN_FAILED` for anything else,
 * never the URL's own words.
 */
export const INVITE_JOIN_FAILED = 'We couldn’t join you just now. Please try again.';
export const INVITE_ERRORS = {
  openShopFirst: 'Open your shop first, then join from this link.',
  failed: INVITE_JOIN_FAILED,
  self: 'This is your own invite link.',
  noShop: 'This invite link no longer opens a shop.',
} as const;
