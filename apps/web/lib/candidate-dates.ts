/**
 * Candidate-date narrowing — the "dates shrink as you lock vendors" engine.
 *
 * The couple commits a few candidate wedding dates at onboarding
 * (events.date_candidates). As they LOCK (contract) vendors, the viable set
 * narrows to the dates every locked vendor is actually free on. When exactly
 * one candidate survives, the next vendor lock can finalize the wedding date
 * (see finalizeVendor's date_will_lock gate).
 *
 * Honesty (RA-10173-clean, matches lib/schedule-matrix.ts): a vendor with no
 * calendar data on file does NOT constrain the date — we never assert a vendor
 * is "free", only that nothing on file blocks them. Off-platform vendors (no
 * marketplace profile id) can't be checked at all and never constrain.
 */

/**
 * Intersect candidate dates against the locked vendors' availability.
 *
 * @param candidates           Candidate day keys 'YYYY-MM-DD'.
 * @param availByProfile       profileId → set of available day keys (from
 *                             getBatchVendorAvailableDays). A profile MISSING
 *                             from the map = no calendar data = doesn't
 *                             constrain (failing-open, per the honesty rule).
 * @param lockedProfileIds     vendor_profiles ids of the LOCKED vendors that
 *                             should constrain the set. Off-platform locks are
 *                             excluded by the caller (no profile id).
 * @returns the candidate dates every locked vendor is free on, original order.
 */
export function intersectViableCandidates(
  candidates: string[],
  availByProfile: Map<string, Set<string>>,
  lockedProfileIds: string[],
): string[] {
  if (lockedProfileIds.length === 0) return [...candidates];
  return candidates.filter((dateKey) =>
    lockedProfileIds.every((pid) => {
      const avail = availByProfile.get(pid);
      // No data for this vendor → it doesn't block any date (honest).
      return !avail || avail.has(dateKey);
    }),
  );
}

/** Human label for a 'YYYY-MM-DD' key — "Saturday, September 12, 2027". */
export function formatCandidateDate(dateKey: string): string {
  const [y = 1970, m = 1, d = 1] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
