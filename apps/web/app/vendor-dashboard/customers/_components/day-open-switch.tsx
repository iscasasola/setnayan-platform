'use client';

import { useEffect, useState, useTransition } from 'react';
import { SwitchRow } from '@/app/_components/form-row';
import { blockClosesDay } from '@/lib/not-available';
import type { DatesBlock } from '@/lib/vendor-dates';

type Action = (formData: FormData) => void | Promise<void>;

/**
 * "YOU CAN TAKE BOOKINGS" — the picked day's availability, one switch under its rows (owner 2026-10-28, prototype
 * `supplier_in_place_2026-10-28` Customers › Dates: "tap a day → its list below; a switch marks the day not available").
 *
 * The SHIPPED writes, in place (`return_to=inplace` — nothing redirects, the month and the picked day stay):
 *   · off → `addManualBlock` — the same all-day, every-schedule "Not available" the day's own sheet writes;
 *   · on  → `removeBlock` of THAT one-day closure.
 * A day closed by something bigger — a repeat ("Masses · every Sunday") or a closure of several days — is not
 * reopened from here (one tap would reopen every day of it): the switch shows the day closed, says by what, and the
 * day's own sheet ("Open the day") is where it changes. A past day draws no switch.
 *
 * Honest: the switch shows the state the page READ (`blocks`); a refused write puts it back and says so.
 */
export function DayOpenSwitch({
  day,
  today,
  blocks,
  actions,
}: {
  day: string;
  today: string;
  /** The shop's blocks as the month reads them — a closure carries its `blockId`. */
  blocks: readonly DatesBlock[];
  actions: { addManualBlock: Action; removeBlock: Action };
}) {
  const [pending, start] = useTransition();
  const closing = blocks.filter((b) => b.source === 'manual' && b.poolId === null && blockClosesDay(b, day));
  const read = closing.length === 0;
  const [on, setOn] = useState(read);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    setOn(read);
    setProblem(null);
  }, [read, day]);

  if (day < today) return null;
  const only = closing.length === 1 ? closing[0]! : null;
  const reopenable = Boolean(only && only.blockId && (only.repeat ?? 'once') === 'once' && only.startDate === day && only.endDate === day);
  const lockedBy = !read && !reopenable ? (closing[0]?.label?.trim() || 'Not available') : null;

  return (
    <div className="mt-2 border-t border-ink/10" data-dates-day-open={read ? 'open' : 'closed'}>
      <SwitchRow
        name="You can take bookings"
        on={on}
        disabled={pending || Boolean(lockedBy)}
        data="dates-day-open"
        about={{ words: 'Off marks this day not available on every schedule — couples cannot ask for it. Your bookings on it stay.' }}
        note={lockedBy ? `Closed by “${lockedBy}” — open the day to change it` : 'Off = couples can’t ask for this day'}
        problem={problem}
        onChange={(next) => {
          setOn(next);
          setProblem(null);
          const fd = new FormData();
          fd.set('return_to', 'inplace');
          if (!next) {
            fd.set('scope', 'org');
            fd.set('start_date', day);
            fd.set('end_date', day);
            fd.set('label', 'Not available');
            fd.set('repeat_rule', 'once');
            fd.set('day_part', 'all_day');
          } else if (only?.blockId) {
            fd.set('block_id', only.blockId);
          }
          start(async () => {
            try {
              // Both actions revalidate Customers themselves — the page re-reads once, no extra refresh.
              await (next ? actions.removeBlock(fd) : actions.addManualBlock(fd));
            } catch {
              setOn(!next);
              setProblem('That didn’t save — nothing changed. Try again.');
            }
          });
        }}
      />
    </div>
  );
}
