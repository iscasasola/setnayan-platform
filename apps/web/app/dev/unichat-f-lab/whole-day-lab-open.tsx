'use client';

/** The lab's ⋯ › Schedule on the hosts' chat: one press raises "The whole day" (lab only). Opens on load for shots. */
import { useState } from 'react';
import { WholeDayRise } from '@/app/_components/chat/whole-day-rise';
import type { WholeDay } from '@/lib/hosts-whole-day';

export function WholeDayLabOpen({ whole }: { whole: WholeDay }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" className="sn-press min-h-11 rounded-full bg-frame px-4 text-sm font-semibold shadow-sn-hair" data-lab-open="" onClick={() => setOpen(true)}>
        ⋯ › Schedule
      </button>
      {open ? <WholeDayRise whole={whole} onClose={() => setOpen(false)} lab /> : null}
    </>
  );
}
