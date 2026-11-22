/**
 * lib/event-day-prep-window.ts — WHEN "Prepare for event day" IS OFFERED (iteration 0036): from three days before the
 * event's date through one day after. Pure, so the offer's own button (`app/_components/event-day-prep-cta.tsx`) and
 * Home's Today list (which draws the offer as a row — owner 20 Nov 2026) ask ONE rule.
 */
export const PREP_T_MINUS_DAYS = 3;
export const PREP_T_PLUS_DAYS = 1;

function daysUntilDate(eventDate: string, now: Date): number {
  const event = new Date(`${eventDate}T00:00:00`);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((event.getTime() - today.getTime()) / 86_400_000);
}

export function isInPrepWindow(eventDate: string | null, now: Date): boolean {
  if (!eventDate) return false;
  const days = daysUntilDate(eventDate, now);
  return days <= PREP_T_MINUS_DAYS && days >= -PREP_T_PLUS_DAYS;
}
