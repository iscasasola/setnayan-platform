/**
 * The date fit on a SAMPLE service card (Card 14's foot, above the distance), for /for-suppliers and /for-coordinators.
 * The words are the couple's own (`DATE_FIT_WORDS` in lib/calendar-truth.ts), the same Find prints on a real card, in
 * Find's own tones (`supplier-sheet.ts`: free = ok, booked = warn).
 * Owner 23 Nov: "load up the sample cards. we want to show if the details were complete." The redraw of 23 Nov lets the
 * live cards flip it by the couple's picked day ("Booked that day").
 */
import { CalendarCheck, CalendarX } from 'lucide-react';
import { DATE_FIT_WORDS } from '@/lib/calendar-truth';

export function SampleDateFit({ fit = 'free' }: { fit?: 'free' | 'booked' }) {
  const Icon = fit === 'free' ? CalendarCheck : CalendarX;
  return (
    <span
      className={`flex items-start gap-1 text-sn-xs font-medium leading-tight ${fit === 'free' ? 'text-[rgb(var(--color-ok))]' : 'text-[rgb(var(--color-warn))]'}`}
      data-mall-date-fit={fit}
    >
      <Icon aria-hidden className="mt-px h-3 w-3 shrink-0" strokeWidth={2} />
      <span>{DATE_FIT_WORDS[fit]}</span>
    </span>
  );
}
