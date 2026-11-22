'use client';

/** The lab's Next box: one press raises the dated list, as the chat strip's does (lab only). Opens on load for shots. */
import { useState } from 'react';
import { AgendaRise, type AgendaRiseProps } from '@/app/vendor-dashboard/clients/[eventId]/_components/agenda-rise';

export function AgendaLabOpen(props: AgendaRiseProps) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" className="sn-press min-h-11 rounded-full bg-frame px-4 text-sm font-semibold shadow-sn-hair" data-lab-open="" onClick={() => setOpen(true)}>
        Next · Ocular · 20 Nov
      </button>
      {open ? <AgendaRise {...props} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
