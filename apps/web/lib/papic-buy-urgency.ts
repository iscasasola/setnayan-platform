import { manilaTodayIso } from '@/lib/vendor-cashflow';

/**
 * "Is this purchase for an event happening TODAY?" — one definition, two users.
 *
 * Owner 2026-08-02: guest purchases ship with the manual 24-hour confirmation
 * wait, "or maybe have an emergency purchase part if the event day is the day
 * itself. these will be priority."
 *
 * A 24-hour SLA is a promise on an ordinary order and a BROKEN PRODUCT on a
 * same-day one: the party is over before anyone looks at the payment. So the
 * same-day case is not a nicer message — it is a different queue position, and
 * the guest is told which one they are in.
 *
 * ── WHY THIS IS A SHARED FUNCTION AND NOT AN INLINE COMPARISON ─────────────
 * Two surfaces decide "today": the buy panel, which PROMISES the guest priority,
 * and the admin queue, which DELIVERS it. If those two ever disagree the product
 * lies — it would promise priority to an order it then files as ordinary. They
 * cannot disagree while they call the same function.
 *
 * ── MANILA, NOT UTC ────────────────────────────────────────────────────────
 * The trap this exists to avoid: a PH evening reception is ALREADY TOMORROW in
 * UTC (Manila is UTC+8, so 8pm Saturday in Manila is 12pm Saturday UTC — but a
 * 9am Sunday Manila comparison against a UTC "today" reads Saturday). Comparing
 * against the server's UTC date would mark the busiest hours of a real event as
 * "not today" and drop those orders to the back of the queue — exactly the
 * orders that most need to jump it. `manilaTodayIso` is the same helper the
 * vendor payday timeline uses, so "today" means one thing across the app.
 */
export function isSameDayInManila(
  eventDate: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!eventDate) return false;
  // events.event_date is a DATE ('YYYY-MM-DD'), but a caller may hand us a full
  // timestamp. Take the date part either way rather than parsing: constructing a
  // Date from 'YYYY-MM-DD' parses as UTC midnight and would shift the day back
  // by 8 hours for every PH event.
  const day = String(eventDate).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return day === manilaTodayIso(now);
}

/**
 * The wait a guest is told to expect, in the guest's own words.
 *
 * Returned as data rather than JSX so the admin queue can assert on the SAME
 * value it sorts by — a promise the queue cannot keep is the failure mode here,
 * and a test can only catch it if both halves are inspectable.
 */
export type BuyWait = {
  sameDay: boolean;
  /** One sentence, no jargon, no false precision. */
  copy: string;
};

export function buyWaitCopy(sameDay: boolean): BuyWait {
  return {
    sameDay,
    copy: sameDay
      ? 'Your event is today, so this goes to the top of the queue — we confirm these first. Keep shooting on the shared pool while you wait.'
      : 'Someone checks payments by hand, so this can take up to 24 hours to go live. Keep shooting on the shared pool while you wait.',
  };
}
