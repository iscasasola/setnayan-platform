'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { daySheetHref } from '@/lib/vendor-dates';

/**
 * "CHECK A DATE" — the Dates thumb's left half (owner 2026-10-14, DECISION_LOG 🧑‍🤝‍🧑 call 1: *"Check a date"
 * replaces "Block a date" as the bottom thumb button; marking not-available moves inside the day*). Prototype
 * `thumb()`: a field with a calendar mark; the phone's own date wheel opens on a tap, and picking a day opens that
 * day's screen — whose first line answers "is this day free?" (Free · Still has room · Full · Not available).
 *
 * The native date input lies over the whole field (a 44-px press), so a church helper meets the phone's own picker,
 * never a new one. While the day loads, the field says so ("Opening …").
 */
export function CheckADate() {
  const router = useRouter();
  const [opening, setOpening] = useState<string | null>(null);
  return (
    <label
      className="sn-press relative flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-ink/[0.06] px-4 text-[15px] font-medium text-ink"
      data-dates-check=""
      data-pressed={opening ? '' : undefined}
    >
      <CalendarDays aria-hidden className="h-[18px] w-[18px] flex-none text-ink/60" strokeWidth={1.9} />
      <span className="truncate">{opening ? 'Opening the day…' : 'Check a date'}</span>
      <input
        type="date"
        aria-label="Check a date"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        onChange={(e) => {
          const d = e.target.value;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
          setOpening(d);
          router.push(daySheetHref(d));
        }}
      />
    </label>
  );
}
