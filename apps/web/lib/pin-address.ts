/**
 * What the address box should hold after the vendor moves the pin.
 *
 * Owner 2026-08-10: *"we just want them to pin the address so we can verify
 * with their documents when they send it after."* That sentence is the whole
 * design. The pin is a CLAIM, checked later against the DTI/SEC registration,
 * the BIR 2303 and the Mayor's Permit — none of which state a latitude. So the
 * one thing this step must never do is hand the reviewer a dot on a map with no
 * address written next to it.
 *
 * 🔑 TWO RULES, AND THEY PULL IN OPPOSITE DIRECTIONS.
 *   • A vendor who taps the map without typing has still told us where they
 *     are — write the street down for them.
 *   • A vendor who typed their own address has said it in their own words, and
 *     a geocoder's phrasing ("Barangay 123, Fourth District, …") does not get
 *     to replace it. Overwriting is worse than leaving it blank: it looks like
 *     the form corrected them, and on a document check the vendor's own wording
 *     is the one that matches the permit.
 *
 * Extracted from the component so it is provable. The rule lived as a callback
 * inside a `setState`, where nothing could break it on purpose.
 */
export function addressFromPin(typed: string, found: string): string | null {
  if (typed.trim()) return null; // their words win, always
  const next = found.trim();
  return next ? next : null;
}
