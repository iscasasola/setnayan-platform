/**
 * Authorization predicate for POST /api/crew/register-device.
 *
 * The endpoint used to trust a client-supplied `vendor_profile_id` outright and
 * write with the service-role admin client (which bypasses RLS) — so any caller
 * holding a valid master-QR token could register a device under ANY vendor,
 * exhaust a competitor's 5-device cap, or masquerade as their crew.
 *
 * The fix derives the caller's authorized vendor set from their session
 * (public.current_vendor_profile_ids()) and only accepts a supplied id that is
 * actually in that set. This module is the pure, testable core of that check.
 */

/**
 * Resolve the vendor_profile_id the caller is allowed to register a device for.
 *
 * @param suppliedVendorProfileId the client-supplied id from the request body
 *   (already format-validated by the route).
 * @param authorizedVendorProfileIds the vendor_profile_ids the authenticated
 *   caller actually controls, from current_vendor_profile_ids().
 * @returns the supplied id if the caller is authorized for it; otherwise null.
 *
 * A null return MUST map to a 403 in the route — never fall back to the supplied
 * id, and never register under an arbitrary authorized id the caller did not ask
 * for.
 */
export function resolveAuthorizedCrewVendorId(
  suppliedVendorProfileId: string,
  authorizedVendorProfileIds: readonly string[],
): string | null {
  if (!suppliedVendorProfileId) return null;
  return authorizedVendorProfileIds.includes(suppliedVendorProfileId)
    ? suppliedVendorProfileId
    : null;
}
