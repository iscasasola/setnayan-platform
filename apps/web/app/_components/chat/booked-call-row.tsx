'use client';

import { useRef } from 'react';
import { Phone, Video } from 'lucide-react';
import { ActionButton, useFitRow } from '@/components/action-button';
import { CALLS_OPEN_ONCE_BOOKED, type BookedSupplierCall } from '@/lib/booked-supplier-call';

/**
 * 📞 Call · Video call · Viber — the chat head's second row, on a thread with a BOOKED supplier (owner 2026-11-04,
 * DECISION_LOG "SIX OWNER ANSWERS", item 2; 2026-11-05: *"have a button for it"*). The rule, and why it is not a door
 * out of the app, are in `lib/booked-supplier-call.ts`; the read is `lib/booked-supplier-call.server.ts`.
 *
 *   booked          → two buttons: Call (`tel:`) and Video call · Viber (Viber, mobiles only — a landline gets Call)
 *   not_booked      → ONE muted line, "Calls open once you've booked." — no greyed-out button teasing a door
 *   booked_no_phone → nothing (a button that dials nothing is worse than none)
 *   unknown         → nothing (a refused read must not claim either way)
 *
 * They ride the head's `below` slot, not its right-hand actions: the name already takes two lines at 390 px, and two
 * WORDED buttons beside it would cut it. Buttons are the house `ActionButton` (a framed pill — a frame only on what
 * you can press); the hint is plain text.
 *
 * 📏 ONE ROW, NEVER TWO (measured in the chat lab, 390 px): icon + word for both buttons is 241 px in a 230 px column,
 * and wrapping put Video call on a second line — a head 2× as tall, taken from the conversation. So the row runs the
 * house fit pass (`useFitRow`, BUTTON_RULE 3a): full → words only → icons only, one state for the whole row. A client
 * component for that hook — which is also why `call` arrives as plain data (the page is a server component; a
 * function cannot cross into a client one).
 *
 * `showHint` — the page passes false where "once you've booked" would be wrong to say (a closed or blocked
 * conversation: there is no booking ahead to wait for).
 */
export function BookedCallRow({ call, showHint }: { call: BookedSupplierCall; showHint: boolean }) {
  if (call.kind === 'booked') {
    return <CallButtons {...call.links} />;
  }
  if (call.kind === 'not_booked' && showHint) {
    return (
      <p className="mt-0.5 text-[12px] leading-tight text-ink/55" data-calls-hint="">
        {CALLS_OPEN_ONCE_BOOKED}
      </p>
    );
  }
  return null;
}

function CallButtons({ tel, viber, display }: { tel: string; viber: string | null; display: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useFitRow(ref);
  return (
    <div ref={ref} className="mt-1.5 flex flex-nowrap items-center gap-2" data-booked-call-row="">
      <ActionButton tone="info" href={tel} prefetch={false} icon={Phone} label="Call" name={`Call · ${display}`} />
      {viber ? (
        <ActionButton
          tone="info"
          href={viber}
          prefetch={false}
          icon={Video}
          label="Video call · Viber"
          name={`Video call on Viber · ${display}`}
        />
      ) : null}
    </div>
  );
}
