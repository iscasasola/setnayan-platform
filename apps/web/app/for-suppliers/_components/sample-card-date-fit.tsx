/**
 * The date fit on a SAMPLE service card (Card 14's foot, above the distance), for /for-suppliers and /for-coordinators.
 * The words are the couple's own (`DATE_FIT_WORDS` in lib/calendar-truth.ts), the same Find prints on a real card.
 * Owner 23 Nov: "load up the sample cards. we want to show if the details were complete."
 */
import { CalendarCheck } from 'lucide-react';
import { DATE_FIT_WORDS } from '@/lib/calendar-truth';

export function SampleDateFit() {
  return (
    <span className="flex items-start gap-1 text-sn-xs font-medium leading-tight text-[rgb(var(--color-ok))]" data-mall-date-fit="">
      <CalendarCheck aria-hidden className="mt-px h-3 w-3 shrink-0" strokeWidth={2} />
      <span>{DATE_FIT_WORDS.free}</span>
    </span>
  );
}
