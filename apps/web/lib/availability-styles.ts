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

/* ── THE CARD'S OWN STYLE (Availability plan, step 3 — owner "ok" 2026-11-19) ─────────────────────────────────────
 * Stored on `vendor_services.availability_style` (migration 20271351451190, same seven values). Empty = Not set: the
 * card behaves exactly as before. The card maker lists all seven; three can't be picked until step 5. */

/** The short label (AV-ORDER) for a stored value; '' for null. */
export function availabilityLabel(v: AvailabilityStyle | null): string {
  if (v === null) return '';
  return AVAILABILITY_STYLES.find((s) => s.value === v)?.label ?? '';
}

/** Listed on a card as "Coming soon" — they can't be picked until step 5 (drawing 2026-11-19). */
export const CARD_STYLES_COMING_SOON: ReadonlySet<AvailabilityStyle> = new Set<AvailabilityStyle>(['hour', 'time', 'night']);

/** A style a supplier may pick on a card today. */
export function isCardPickableStyle(v: unknown): v is AvailabilityStyle {
  return isAvailabilityStyle(v) && !CARD_STYLES_COMING_SOON.has(v);
}

/** The number question a card asks, by its style — the SAME `daily_capacity`, under a new name (drawing § What this removes). */
export function cardCountQuestion(style: AvailabilityStyle | null, dayQuestion: string): { name: string; about: string; counts: string } {
  if (style === 'order') return { name: 'Orders for one day', about: 'how many you can finish for one date', counts: 'Orders for one day' };
  if (style === 'piece') return { name: 'How many do you have', about: 'you say how many a couple gets at your yes', counts: 'How many you have' };
  return { name: dayQuestion, about: '', counts: 'Events on the same day' };
}

/** Rented by the piece has NO cap above 500 (owner ruling 3, 2026-11-19); every other card keeps the ceiling. */
export function cardCountHasNoCap(style: AvailabilityStyle | null): boolean {
  return style === 'piece';
}

/** Always available: no number is asked and nothing is counted (owner ruling 4). */
export function cardIsNeverCounted(style: AvailabilityStyle | null): boolean {
  return style === 'none';
}

const n = (x: number) => x.toLocaleString('en-US');

/**
 * The one sentence under the style dropdown: how Setnayan reads the card (drawing 2026-11-19). Null when the card is
 * Not set or still on a Coming soon style — then nothing new is said.
 */
export function availabilityReads(style: AvailabilityStyle | null, perDay: number | null, leadDays: number | null): string | null {
  if (style === 'none') return 'No number to type. This card is never on your calendar. Couples still give their event date, but it is never counted.';
  if (style === 'order') {
    const finish = perDay && perDay > 0 ? `you can finish ${n(perDay)} ${perDay === 1 ? 'order' : 'orders'} due on one day` : 'you take orders for any date';
    const ahead = leadDays && leadDays > 0 ? `, and couples must order ${n(leadDays)} ${leadDays === 1 ? 'day' : 'days'} before` : '';
    return `Setnayan reads this as: ${finish}${ahead}.`;
  }
  if (style === 'piece') {
    if (!perDay || perDay <= 0) return 'Setnayan reads this as: you rent by the piece. Say how many you have.';
    return `Setnayan reads this as: ${n(perDay)} ${perDay === 1 ? 'piece' : 'pieces'} a day. A date closes when all ${n(perDay)} are out.`;
  }
  if (style === 'day') {
    if (!perDay || perDay <= 0) return null;
    return `Setnayan reads this as: ${n(perDay)} ${perDay === 1 ? 'event' : 'events'} a day.`;
  }
  return null;
}

/** The Booking terms fold's summary line, by style ("Made to order · 5 a day · order 14 days ahead"). Null = keep today's. */
export function bookingTermsLine(style: AvailabilityStyle | null, perDay: number | null, leadDays: number | null): string | null {
  if (style === 'order') {
    return ['Made to order', perDay && perDay > 0 ? `${n(perDay)} a day` : '', leadDays && leadDays > 0 ? `order ${n(leadDays)} ${leadDays === 1 ? 'day' : 'days'} ahead` : '']
      .filter(Boolean)
      .join(' · ');
  }
  if (style === 'piece') return ['Rented by the piece', perDay && perDay > 0 ? `${n(perDay)} on hand` : ''].filter(Boolean).join(' · ');
  if (style === 'none') return 'Always available';
  return null;
}

/**
 * Made to order's hard rule, checked when a couple asks (step 3): is the date at least `leadDays` days after today?
 * `today` and `day` are YYYY-MM-DD (Manila). A missing rule (null / 0) never refuses.
 */
export function orderIsTooSoon(today: string, day: string, leadDays: number | null): boolean {
  if (!leadDays || leadDays <= 0) return false;
  const t = Date.parse(`${today}T00:00:00Z`);
  const d = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(t) || !Number.isFinite(d)) return false;
  return Math.round((d - t) / 86_400_000) < leadDays;
}

/** What the couple reads when the date is too soon for a made-to-order card. */
export function orderTooSoonMessage(leadDays: number): string {
  return `This supplier needs orders at least ${n(leadDays)} ${leadDays === 1 ? 'day' : 'days'} before the date. Pick a later date, or ask another supplier.`;
}
