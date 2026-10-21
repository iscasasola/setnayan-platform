/**
 * NewEventHead — the line above the event-type picker: the way back, then "New event". Split out of
 * `create-event/page.tsx` (2026-10-21) so `/dev/you-lab?door=picker` draws the same head the page does.
 *
 * 🚪 `nothingBehind` — a brand-new account's first screen after the You card (owner 2026-10-21, prototype
 * first_run_you_and_next_steps P2) has no board behind it yet, so it draws no "Back to events".
 */
import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';

export function NewEventHead({
  nothingBehind,
  samahan,
}: {
  nothingBehind: boolean;
  samahan: { communityId: string; name: string } | null;
}) {
  return (
    <div className="mb-2 space-y-2">
      {/*
        🔴 `?hub=1`, NOT A BARE `/dashboard`. The board AUTO-JUMPS a couple who
        holds exactly one upcoming event straight back into that event
        (`(launcher)/page.tsx:348`) — an owner ruling that stays. So the
        routine way OUT of this page would have dumped them INSIDE their
        wedding instead of on their events board, and `?hub=1` is the only
        escape hatch that exists. This matters now because the rail's
        "+ Create event" points here (2026-08-15); before that, almost nobody
        arrived from the board.
      */}
      {nothingBehind ? null : (
        <Link
          href={samahan ? `/dashboard/samahan/${samahan.communityId}?tab=events` : '/dashboard?hub=1'}
          className="sn-chip sn-press w-fit"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          {samahan ? `Back to ${samahan.name}` : 'Back to events'}
        </Link>
      )}
      <p className="sn-eye">
        <Sparkles aria-hidden strokeWidth={1.75} />
        New event
      </p>
    </div>
  );
}
