/**
 * 📅 NO LIFETIME QUOTATION (Supplier Build 3 · lane B; DECISION_LOG 📅 2026-11-09).
 *
 * Owner: a quote cannot be SENT without a Valid until (a draft may be blank). The picker offers four choices — 7 days ·
 * 14 days · 30 days · Pick a date — none preselected, one dropdown; a choice that would land past the event is not
 * offered; what is stored and shown is the real date ("Valid until Nov 23"). The day must be after today and on or
 * before the event day. The database holds the same line (`vendor_proposals_sent_has_valid_until` + the send
 * trigger, migration 20271329937802); this is the words the screen and the server action say first.
 */

export type ValidUntilChoiceKey = '7' | '14' | '30' | 'pick';

export const VALID_UNTIL_CHOICES: readonly { key: ValidUntilChoiceKey; label: string; days: number | null }[] = [
  { key: '7', label: '7 days', days: 7 },
  { key: '14', label: '14 days', days: 14 },
  { key: '30', label: '30 days', days: 30 },
  { key: 'pick', label: 'Pick a date', days: null },
];

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** yyyy-mm-dd + n days (calendar arithmetic, no time zone involved). */
export function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** The choices that land on or before the event day (all of them when there is no day). "Pick a date" always stays. */
export function validUntilChoices(todayIso: string, eventDate: string | null) {
  return VALID_UNTIL_CHOICES.filter(
    (c) => c.days == null || !eventDate || !ISO.test(eventDate) || addDaysIso(todayIso, c.days) <= eventDate,
  ).map((c) => ({ ...c, date: c.days == null ? null : addDaysIso(todayIso, c.days) }));
}

/** Null = it may be sent. Otherwise the one sentence the screen shows. */
export function validUntilRefusal(value: string | null | undefined, todayIso: string, eventDate: string | null): string | null {
  const v = (value ?? '').trim();
  if (!v) return 'Pick how long this quote is valid before you send it.';
  if (!ISO.test(v)) return 'That Valid until date could not be read — pick it again.';
  if (v <= todayIso) return 'A quote is valid until a day after today.';
  if (eventDate && ISO.test(eventDate) && v > eventDate) return 'A quote can be valid until the event day at the latest.';
  return null;
}

const fmt = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' });
/** "Valid until Nov 23". */
export function validUntilWords(iso: string): string {
  if (!ISO.test(iso)) return 'Valid until —';
  return `Valid until ${fmt.format(Date.parse(`${iso}T00:00:00Z`))}`;
}

/** Today in Manila, yyyy-mm-dd — the day the server and the picker both count from. */
export function manilaTodayIsoFor(nowMs: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(nowMs));
}
