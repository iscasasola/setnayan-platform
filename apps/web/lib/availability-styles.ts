/**
 * availability-styles.ts — THE ONE SOURCE for the seven ways a service books (Availability plan, step 2).
 *
 * Owner-ruled 2026-11-17 ("Yes, keep them"): the stored value, the short label an admin sees beside it, and the
 * name an admin and a supplier read. Stored on `canonical_service_taxonomy.availability_style` (migration
 * 20271350696878), whose CHECK lists exactly these values — `availability-styles.test.ts` fails if the two drift.
 *
 * Empty (NULL) is NOT SET. Never treat it as `day`: a service nobody has decided is shown and counted as Not set.
 *
 * Pure: no I/O, safe to import from a client component.
 */

export const AVAILABILITY_STYLES = [
  { value: 'day', label: 'AV-DAY', name: 'One booking a day' },
  { value: 'order', label: 'AV-ORDER', name: 'Made to order' },
  { value: 'hour', label: 'AV-HOUR', name: 'By the hour' },
  { value: 'piece', label: 'AV-PIECE', name: 'Rented by the piece' },
  { value: 'time', label: 'AV-TIME', name: 'Set times with seats' },
  { value: 'night', label: 'AV-NIGHT', name: 'Rooms by the night' },
  { value: 'none', label: 'AV-NONE', name: 'Always available' },
] as const;

export type AvailabilityStyle = (typeof AVAILABILITY_STYLES)[number]['value'];

/** What an unset service is called, everywhere. */
export const AVAILABILITY_NOT_SET = 'Not set';

const VALUES: ReadonlySet<string> = new Set(AVAILABILITY_STYLES.map((s) => s.value));

export function isAvailabilityStyle(v: unknown): v is AvailabilityStyle {
  return typeof v === 'string' && VALUES.has(v);
}

/** The name an admin reads for a stored value; `Not set` for null. An unknown value is never dressed as one of the seven. */
export function availabilityName(v: AvailabilityStyle | null): string {
  if (v === null) return AVAILABILITY_NOT_SET;
  return AVAILABILITY_STYLES.find((s) => s.value === v)?.name ?? AVAILABILITY_NOT_SET;
}

/**
 * The most common style among a category's services — what a new service in it is pre-filled with. Unset services
 * do not vote. A tie, or no set service at all, answers null (Not set): a guess is never pre-filled.
 */
export function mostCommonAvailability(values: ReadonlyArray<AvailabilityStyle | null | undefined>): AvailabilityStyle | null {
  const counts = new Map<AvailabilityStyle, number>();
  for (const v of values) if (v && isAvailabilityStyle(v)) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: AvailabilityStyle | null = null;
  let bestN = 0;
  let tie = false;
  for (const [v, n] of counts) {
    if (n > bestN) {
      best = v;
      bestN = n;
      tie = false;
    } else if (n === bestN) tie = true;
  }
  return tie ? null : best;
}
