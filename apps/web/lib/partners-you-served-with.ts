/**
 * 🤝 PARTNERS COME AFTER A SHARED EVENT — the pure half (owner, verbatim, 2026-11-06, DECISION_LOG):
 * "Suppliers can connect partnerships with suppliers they have been with in events. cannot link until they have
 * served the same event."
 *
 * "Served the same event" is decided in ONE place, the database: `public.vendor_served_together_rows(uuid)`
 * (migration 20271316893943) — both shops BOOKED (`BOOKED_VENDOR_STATUSES`) on one non-sample event whose date has
 * passed. The same function backs the insert trigger that refuses a link without it, and the supplier's own read
 * (`partners_you_served_with`), so the picker and the refusal can never disagree.
 *
 * This file only FOLDS that read into one entry per shop and words the row's line. No read, no session — the read is
 * `partners-you-served-with.server.ts`.
 */

/** One row of `partners_you_served_with(p_vendor)` — one per (other shop, event). Never the event's name or the couple. */
export type ServedWithRow = {
  other_vendor_profile_id: string;
  business_name: string | null;
  is_live: boolean | null;
  event_type: string | null;
  event_date: string | null;
  event_date_precision: string | null;
};

export type ServedTogetherEvent = {
  eventType: string | null;
  /** `YYYY-MM-DD` — the stored date; with `precision` it may stand for a whole month or year. */
  eventDate: string;
  precision: 'day' | 'month' | 'year';
};

export type ServedWithPartner = {
  vendorProfileId: string;
  businessName: string;
  /** Live on the marketplace (verified + publicly visible) — the only shops the picker offers. */
  isLive: boolean;
  /** Newest first. */
  events: ServedTogetherEvent[];
};

/**
 * The read, honest about itself: `measured: false` means the read FAILED — the picker must say so, never draw the
 * "nobody yet" empty state (that sentence is true only of a read that worked).
 */
export type PartnersYouServedWith =
  | { measured: true; partners: ServedWithPartner[] }
  | { measured: false; partners: [] };

const PRECISIONS = new Set(['day', 'month', 'year']);

/** Rows (one per shop × event) → one entry per shop, its events newest first; shops ordered by their latest event. */
export function foldServedWithRows(rows: ReadonlyArray<ServedWithRow>): ServedWithPartner[] {
  const byShop = new Map<string, ServedWithPartner>();
  for (const r of rows) {
    if (!r.other_vendor_profile_id || !r.event_date) continue;
    let p = byShop.get(r.other_vendor_profile_id);
    if (!p) {
      p = {
        vendorProfileId: r.other_vendor_profile_id,
        businessName: r.business_name?.trim() || 'A Setnayan supplier',
        isLive: r.is_live === true,
        events: [],
      };
      byShop.set(r.other_vendor_profile_id, p);
    }
    const precision = PRECISIONS.has(r.event_date_precision ?? '')
      ? (r.event_date_precision as ServedTogetherEvent['precision'])
      : 'day';
    p.events.push({ eventType: r.event_type, eventDate: r.event_date.slice(0, 10), precision });
  }
  const partners = [...byShop.values()];
  for (const p of partners) p.events.sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  partners.sort(
    (a, b) =>
      (b.events[0]?.eventDate ?? '').localeCompare(a.events[0]?.eventDate ?? '') ||
      a.businessName.localeCompare(b.businessName),
  );
  return partners;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Mar 2026" — or "2026" when only the year is known. Read from the string, never through a time zone. */
export function servedWhen(ev: Pick<ServedTogetherEvent, 'eventDate' | 'precision'>): string {
  const [y, m] = ev.eventDate.split('-');
  if (ev.precision === 'year' || !m) return y ?? '';
  const month = MONTHS[Number(m) - 1];
  return month ? `${month} ${y}` : (y ?? '');
}

/**
 * The row's line: "Served together · Wedding · Mar 2026" (+ "· 2 events" when there were more). The event TYPE and the
 * month only — never the couple's names, never the event's own title.
 */
export function servedTogetherLine(
  partner: Pick<ServedWithPartner, 'events'>,
  typeLabel: (eventType: string) => string,
): string {
  const latest = partner.events[0];
  if (!latest) return 'Served together';
  const parts = ['Served together'];
  if (latest.eventType && latest.eventType !== 'unspecified') parts.push(typeLabel(latest.eventType));
  parts.push(servedWhen(latest));
  if (partner.events.length > 1) parts.push(`${partner.events.length} events`);
  return parts.join(' · ');
}

/** The shops the propose picker offers: served together AND live on the marketplace. */
export function proposableShops(read: PartnersYouServedWith): ServedWithPartner[] {
  return read.measured ? read.partners.filter((p) => p.isLive) : [];
}

/** The picker's empty-state sentence (brief, owner 2026-11-06). */
export const NO_PARTNERS_YET =
  'Partners show here after you serve an event with another Setnayan supplier.';

/** What a refused proposal says (the action, and the trigger's NOT_SERVED_TOGETHER). */
export const NOT_SERVED_TOGETHER_MESSAGE = "You can link up after you've both served the same event.";
