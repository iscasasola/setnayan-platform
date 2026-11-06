// ============================================================================
// Call · Video call — in a chat's head, ONLY between a couple and a shop that is
// BOOKED on the event (owner 2026-11-04, DECISION_LOG "SIX OWNER ANSWERS",
// verbatim: *"We can call and video call suppliers as well on the chat"* ·
// *"Viber and phone call booked suppliers"*).
//
// Both are HAND-OFFS out of Setnayan — the phone's dialer (tel:) and Viber
// (viber://chat?number=) — never the retired in-app call: nothing here touches
// ThreadCallRoom / startThreadCall (`lib/the-chat-has-no-calls.test.ts`).
//
// 🔑 The links are made ONLY by `lib/booked-handoff.ts`, which returns null
// without the booking. Before the booking, or with no number saved on the other
// side, this renders NOTHING — not a disabled button, not a hint of a number.
// Guard: `lib/no-door-out-of-the-app.test.ts` (BOOKED_HANDOFF_BILL + the
// unbooked-renders-no-link test).
// ============================================================================

import { Phone, Video } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { bookedTelHref, bookedViberHref } from '@/lib/booked-handoff';

export function BookedCallButtons({
  booked,
  phone,
  who,
}: {
  /** `shopIsBookedOnEvent(event, shop)` — the one booking check. */
  booked: boolean;
  /** The OTHER side's saved number (`bookedCounterpartyPhone`), null when none is saved. */
  phone: string | null;
  /** Their name, for the accessible label ("Call Lumière Studio"). */
  who: string;
}) {
  const tel = bookedTelHref(booked, phone);
  const viber = bookedViberHref(booked, phone);
  if (!tel && !viber) return null;
  return (
    <span className="flex items-center gap-1" data-booked-call>
      {tel ? <ActionButton href={tel} tone="neutral" iconOnly icon={<Phone aria-hidden strokeWidth={1.75} />} label="Call" name={`Call ${who}`} /> : null}
      {viber ? (
        <ActionButton href={viber} tone="neutral" iconOnly icon={<Video aria-hidden strokeWidth={1.75} />} label="Video call" name={`Video call ${who} on Viber`} />
      ) : null}
    </span>
  );
}
