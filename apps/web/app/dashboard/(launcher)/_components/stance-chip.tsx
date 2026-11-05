import { HeartHandshake, Mail, Users } from 'lucide-react';
import { stanceLabel, type EventStance } from '@/lib/event-board';
import { cardShowsForTag, forTagWords, type ForTag } from '@/lib/for-tag';
import { ForTagMark } from '@/app/_components/for-tag-mark';

/*
 * stance-chip.tsx — the Events board card's second chip, lifted out of `(launcher)/page.tsx`
 * unchanged (2026-10-22) so the "For <name>" variant can be drawn by a test and by a lab —
 * a page file may export nothing but its page.
 */

/**
 * THE STANCE CHIP — "You organise this" / "You're invited".
 *
 * The one thing a card has to answer before it is pressed, because it decides
 * what is behind it: an organiser opens the event dashboard, an invited person
 * opens the event's own public page (their photos, their table, their RSVP —
 * with the money and plan surfaces absent, not present-and-refused).
 *
 * Rendered on EVERY card, not just the invited ones. An unexplained difference
 * between two cards is worse than a label on both — and "you organise this" is
 * the sentence that makes the other one legible.
 */
export function StanceChip({ stance, forTag = null }: { stance: EventStance; forTag?: ForTag | null }) {
  const invited = stance === 'invited';
  /* "FOR <NAME>" (owner 22 Oct 2026, prototypes/for_tag_on_event_cards_2026-10-22.html): an
     event FOR a subject the viewer holds — their shop, a loved one — says so in THIS slot, the
     same shell, the icon's place taken by the shop's round logo or the loved one's initials.
     It REPLACES "You organise this" (holding the subject means you organise it) so the card
     stays at two chips. A helper's or a guest's card never gets here (`cardShowsForTag`). */
  if (forTag && cardShowsForTag(stance, forTag)) {
    return (
      <span
        data-for-tag=""
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/85 px-2 py-1 text-[9.5px] font-bold uppercase tracking-[0.08em] text-[color:var(--sn-ink-500)] shadow-[0_2px_8px_rgba(30,26,18,0.08)]"
      >
        <ForTagMark tag={forTag} place="chip" />
        {forTagWords(forTag.name)}
      </span>
    );
  }
  // A helper's chip is the organiser's colour (both open the dashboard) with
  // its own mark, so the two never read as the same sentence at a glance.
  const Icon = invited ? Mail : stance === 'helper' ? Users : HeartHandshake;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[9.5px] font-bold uppercase tracking-[0.08em] shadow-[0_2px_8px_rgba(30,26,18,0.08)] ${
        invited
          ? 'bg-[color:var(--sn-mulberry-100,rgba(194,78,37,0.14))] text-mulberry'
          : 'bg-white/85 text-[color:var(--sn-ink-500)]'
      }`}
    >
      <Icon aria-hidden className="h-[11px] w-[11px]" strokeWidth={2.25} />
      {stanceLabel(stance)}
    </span>
  );
}
