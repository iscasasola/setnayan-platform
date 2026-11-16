/**
 * A soft navigation to /vendor-dashboard clears the slot — an unmatched parallel slot would otherwise KEEP the risen
 * page up after a tab tap (build-sessions/RISE-AUDIT-2026-11-13.md § H.2).
 */
export default function NothingRisenHere() {
  return null;
}
