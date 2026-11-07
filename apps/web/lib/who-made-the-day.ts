/** One delivered supplier a checked-in guest may rate, by NAME and trade — never a price. */
export type WhoMadeTheDaySupplier = { slug: string; name: string; trade: string | null; rated: boolean };

/** After the day, in the venue's calendar: today (Manila, YYYY-MM-DD) is later than the event date. */
export function isAfterTheDay(eventDate: string | null | undefined, today: string): boolean {
  const day = typeof eventDate === 'string' ? eventDate.slice(0, 10) : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && /^\d{4}-\d{2}-\d{2}$/.test(today) && today > day;
}
