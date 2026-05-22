import Link from 'next/link';
import { MessagesSquare, Palette, LayoutGrid, Inbox, type LucideIcon } from 'lucide-react';

// V1 pilot Home v2 — owner directive 2026-05-22.
// 2x2 toolkit grid below PlanningGroups. Quick deep-links to the four
// surfaces hosts return to most. Concierge is the only tile that ships
// disabled during the V1 pilot — CONCIERGE_ENABLED flag stays false per
// CLAUDE.md 2026-05-22 row 3 ("Concierge AI brain marketing surface kept
// invisible during pilot"). It still appears so the host knows it's
// coming.

type TileMeta = {
  key: 'concierge' | 'mood_board' | 'seat_plan' | 'inbox';
  Icon: LucideIcon;
  heading: string;
  subtitle: string;
  href: string | null;
  disabled?: boolean;
};

type Props = {
  eventId: string;
  /** Count of saves in event_moodboard_saves (or photos when that
   *  table grows). 0 renders a "Start a board" prompt. */
  moodBoardSaveCount: number;
  /** Total guests on this event. */
  totalGuests: number;
  /** Guests with a row in event_seat_assignments. */
  seatedGuests: number;
  /** Chat threads on this event (proxy for "inbox") — the schema
   *  doesn't track read-receipts yet so we surface total threads
   *  instead of unread count. The polite-voice copy works either
   *  way. */
  vendorThreadCount: number;
};

export function UsefulRightNow({
  eventId,
  moodBoardSaveCount,
  totalGuests,
  seatedGuests,
  vendorThreadCount,
}: Props) {
  const tiles: TileMeta[] = [
    {
      key: 'concierge',
      Icon: MessagesSquare,
      heading: 'Concierge',
      subtitle: 'Coming soon · AI assistant',
      href: null,
      disabled: true,
    },
    {
      key: 'mood_board',
      Icon: Palette,
      heading: 'Mood Board',
      subtitle:
        moodBoardSaveCount > 0
          ? `${moodBoardSaveCount} ${moodBoardSaveCount === 1 ? 'pinned' : 'pinned'}`
          : 'Start a board',
      href: `/dashboard/${eventId}/add-ons/mood-board`,
    },
    {
      key: 'seat_plan',
      Icon: LayoutGrid,
      heading: 'Seat Plan',
      subtitle:
        totalGuests > 0
          ? `${seatedGuests} of ${totalGuests} seated`
          : 'Open seat plan',
      href: `/dashboard/${eventId}/seating`,
    },
    {
      key: 'inbox',
      Icon: Inbox,
      heading: 'Inbox',
      subtitle:
        vendorThreadCount > 0
          ? `${vendorThreadCount} ${vendorThreadCount === 1 ? 'vendor thread' : 'vendor threads'}`
          : 'No vendor threads yet',
      href: `/dashboard/${eventId}/messages`,
    },
  ];

  return (
    <section aria-labelledby="useful-right-now-heading" className="space-y-3">
      <h2
        id="useful-right-now-heading"
        className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
      >
        Useful right now
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.key}>
            <Tile {...tile} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Tile({ Icon, heading, subtitle, href, disabled }: TileMeta) {
  const inner = (
    <div className="flex h-full flex-col gap-2 rounded-xl border border-ink/10 bg-white p-3 sm:p-4">
      <span
        aria-hidden
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg sm:h-10 sm:w-10 ${
          disabled ? 'bg-ink/5 text-ink/40' : 'bg-terracotta/10 text-terracotta'
        }`}
      >
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.75} />
      </span>
      <span
        className={`text-sm font-semibold ${disabled ? 'text-ink/55' : 'text-ink'}`}
      >
        {heading}
      </span>
      <span className={`text-[11px] sm:text-xs ${disabled ? 'text-ink/40' : 'text-ink/65'}`}>
        {subtitle}
      </span>
    </div>
  );

  if (disabled || !href) {
    return (
      <div
        aria-disabled="true"
        className="block h-full min-h-[88px] cursor-default opacity-70 sm:min-h-[96px]"
      >
        {inner}
      </div>
    );
  }
  return (
    <Link
      href={href}
      className="block h-full min-h-[88px] transition-colors hover:[&>div]:border-terracotta/40 hover:[&>div]:bg-terracotta/5 sm:min-h-[96px]"
    >
      {inner}
    </Link>
  );
}
