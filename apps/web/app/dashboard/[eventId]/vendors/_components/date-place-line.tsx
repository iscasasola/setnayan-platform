/**
 * DatePlaceLine — "Fri, Dec 18, 2026 · Seda Vertis North, Metro Manila", the
 * second line of the Suppliers screen (owner 2026-10-06: the event's date and
 * venue live in Suppliers; 2026-10-07: *"this is already found inside the date
 * and location on top"* — it is the ONLY place on this page they appear).
 *
 * A SERVER component: the page owns the event read; the shell only places it
 * (`factsSlot`), pinned above Find · Build · Booked.
 *
 * 🔑 NO SECOND EDITOR — AND NO TRIP AWAY (PR5). Each value opens ITS SHEET on this page (`fact-sheets.tsx`): the date
 * sheet (ladder · I have a date | Help me choose · the clash note · an open date change) and the place sheet (ladder ·
 * City or area · the venue as booked or typed, with its pin). Both write through the one draft door — a date or a
 * venue is a DRAFT until the Event Hub's Apply (owner 2026-10-10 answer 7), and a date a booked supplier cannot do is
 * asked of them, never moved (J51). A date that waits in the draft says so ("in your draft"); a date change asked of
 * a booked supplier says so too ("· change asked", answer 10).
 *
 * The words are `lib/suppliers-shell.ts`'s; a value that is still vague ("a
 * month", "an area") or not set reads in the accent, as the prototype's `.set`.
 */
import { RotateCcw } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import type { SuppliersFact } from '@/lib/suppliers-shell';
import { FactLine } from './fact-line';

export function DatePlaceLine({
  eventId,
  facts,
  drafted = false,
  changeAsked = false,
  priced = [],
}: {
  eventId: string;
  /** Null = the event row could not be read. That is said — it is never drawn
   *  as "Pick your date" to a couple who has one. */
  facts: { date: SuppliersFact; place: SuppliersFact } | null;
  /** The date shown waits in the Event Hub draft. */
  drafted?: boolean;
  /** A date change is asked of a booked supplier. */
  changeAsked?: boolean;
  /** The build's priced picks — Help me choose offers only days every one of them can take. */
  priced?: readonly string[];
}) {
  if (!facts) {
    return (
      <p data-suppliers-facts="unreadable" role="status" className="flex flex-wrap items-center gap-2 text-[15px] leading-snug text-ink/70">
        Couldn’t load your date and place.
        {/* A problem says so with Try again (§ 9 kind 16): the line is drawn on the
            server, so trying again is drawing the page again. */}
        <ActionButton tone="neutral" quiet icon={RotateCcw} label="Try again" href={`/dashboard/${eventId}/vendors`} prefetch={false} />
      </p>
    );
  }
  return <FactLine eventId={eventId} facts={facts} drafted={drafted} changeAsked={changeAsked} priced={priced} />;
}
