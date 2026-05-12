import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  computeGuestStats,
  fetchGuestsByEvent,
  guestDisplayName,
  guestInitials,
  ROLE_LABELS,
  RSVP_LABELS,
  type GuestRow,
  type GuestStats,
  type RsvpStatus,
} from '@/lib/guests';

export const metadata = { title: 'Guests' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ q?: string; rsvp?: string }>;
};

export default async function GuestsPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const guests = await fetchGuestsByEvent(supabase, eventId);

  // Client-side-style filter on already-loaded data (spec V1: small lists)
  const q = (search.q ?? '').trim().toLowerCase();
  const rsvpFilter = (search.rsvp ?? '') as RsvpStatus | '';
  const visible = guests.filter((g) => {
    if (rsvpFilter && g.rsvp_status !== rsvpFilter) return false;
    if (!q) return true;
    const haystack = `${g.first_name} ${g.last_name} ${g.display_name ?? ''} ${g.email ?? ''} ${g.custom_tags.join(' ')}`.toLowerCase();
    return haystack.includes(q);
  });

  const stats = computeGuestStats(guests);

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
            Guest list
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {stats.total} {stats.total === 1 ? 'guest' : 'guests'}
          </h1>
        </div>
        <Link
          href={`/dashboard/${eventId}/guests/new`}
          className="button-primary self-start sm:self-auto"
        >
          + Add guest
        </Link>
      </header>

      <StatsStrip stats={stats} eventId={eventId} active={rsvpFilter} />

      <SearchBar eventId={eventId} q={q} />

      {visible.length === 0 ? (
        <EmptyState hasGuests={stats.total > 0} eventId={eventId} />
      ) : (
        <>
          <DesktopTable guests={visible} eventId={eventId} />
          <MobileCardList guests={visible} eventId={eventId} />
        </>
      )}
    </section>
  );
}

function StatsStrip({
  stats,
  eventId,
  active,
}: {
  stats: GuestStats;
  eventId: string;
  active: RsvpStatus | '';
}) {
  const cards: { key: RsvpStatus | 'plus_ones' | 'total'; label: string; count: number; tint: string }[] = [
    { key: 'total', label: 'Invited', count: stats.total, tint: 'bg-ink/5 text-ink' },
    { key: 'attending', label: 'Attending', count: stats.attending, tint: 'bg-emerald-100 text-emerald-800' },
    { key: 'pending', label: 'Pending', count: stats.pending, tint: 'bg-amber-100 text-amber-800' },
    { key: 'declined', label: 'Declined', count: stats.declined, tint: 'bg-rose-100 text-rose-800' },
    { key: 'plus_ones', label: 'Plus-ones', count: stats.plus_ones, tint: 'bg-terracotta/10 text-terracotta-700' },
  ];

  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => {
        const href =
          card.key === 'total' || card.key === 'plus_ones'
            ? `/dashboard/${eventId}/guests`
            : `/dashboard/${eventId}/guests?rsvp=${card.key}`;
        const isActive =
          (card.key === 'total' && !active) || (card.key === active);
        return (
          <li key={card.key}>
            <Link
              href={href}
              className={`flex flex-col rounded-lg border px-3 py-2.5 transition-colors ${
                isActive
                  ? 'border-terracotta bg-terracotta/5'
                  : 'border-ink/10 hover:border-ink/25'
              }`}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
                {card.label}
              </span>
              <span className={`mt-1 inline-flex w-fit rounded-full px-2 py-0.5 text-base font-semibold ${card.tint}`}>
                {card.count}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SearchBar({ eventId, q }: { eventId: string; q: string }) {
  return (
    <form
      action={`/dashboard/${eventId}/guests`}
      method="get"
      className="flex items-center gap-2"
    >
      <input
        defaultValue={q}
        name="q"
        type="search"
        placeholder="Search by name, email, or tag…"
        className="input-field flex-1"
      />
      <button className="button-secondary" type="submit">
        Search
      </button>
    </form>
  );
}

function EmptyState({ hasGuests, eventId }: { hasGuests: boolean; eventId: string }) {
  if (hasGuests) {
    return (
      <div className="rounded-lg border border-dashed border-ink/15 bg-cream p-6 text-center text-ink/60">
        No guests match your filters.
        <div className="mt-3">
          <Link href={`/dashboard/${eventId}/guests`} className="button-secondary">
            Clear filters
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-dashed border-ink/15 bg-cream p-8 text-center">
      <p className="text-base text-ink/70">
        No guests yet. Start by adding the couple&rsquo;s first invite.
      </p>
      <div className="mt-4">
        <Link href={`/dashboard/${eventId}/guests/new`} className="button-primary">
          + Add your first guest
        </Link>
      </div>
    </div>
  );
}

function DesktopTable({ guests, eventId }: { guests: GuestRow[]; eventId: string }) {
  return (
    <div className="hidden overflow-hidden rounded-xl border border-ink/10 sm:block">
      <table className="w-full table-fixed text-left text-sm">
        <thead className="bg-ink/[0.03] text-[11px] uppercase tracking-[0.12em] text-ink/55">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="w-[18%] px-3 py-3 font-medium">Role</th>
            <th className="w-[12%] px-3 py-3 font-medium">Side</th>
            <th className="w-[14%] px-3 py-3 font-medium">RSVP</th>
            <th className="w-[14%] px-3 py-3 font-medium">Contact</th>
          </tr>
        </thead>
        <tbody>
          {guests.map((guest) => (
            <tr key={guest.guest_id} className="border-t border-ink/5 hover:bg-terracotta/[0.04]">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar guest={guest} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{guestDisplayName(guest)}</p>
                    {guest.plus_one_allowed ? (
                      <p className="truncate text-xs text-ink/55">
                        + {guest.plus_one_name ?? 'TBA'}
                      </p>
                    ) : null}
                  </div>
                </div>
              </td>
              <td className="px-3 py-3 text-ink/70">{ROLE_LABELS[guest.role]}</td>
              <td className="px-3 py-3">
                <SidePill side={guest.side} />
              </td>
              <td className="px-3 py-3">
                <RsvpPill status={guest.rsvp_status} />
              </td>
              <td className="px-3 py-3 text-xs text-ink/60">
                {guest.email ?? guest.mobile ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MobileCardList({ guests, eventId }: { guests: GuestRow[]; eventId: string }) {
  return (
    <ul className="space-y-2 sm:hidden">
      {guests.map((guest) => (
        <li key={guest.guest_id}>
          <div className="flex items-center gap-3 rounded-lg border border-ink/10 bg-cream p-3">
            <Avatar guest={guest} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{guestDisplayName(guest)}</p>
              <p className="truncate text-xs text-ink/55">{ROLE_LABELS[guest.role]}</p>
            </div>
            <RsvpPill status={guest.rsvp_status} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Avatar({ guest }: { guest: GuestRow }) {
  const sideTint: Record<typeof guest.side, string> = {
    bride: 'bg-rose-200/60 text-rose-900',
    groom: 'bg-sky-200/60 text-sky-900',
    both: 'bg-amber-200/60 text-amber-900',
  };
  return (
    <span
      aria-hidden
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${sideTint[guest.side]}`}
    >
      {guestInitials(guest)}
    </span>
  );
}

function SidePill({ side }: { side: GuestRow['side'] }) {
  const tone: Record<GuestRow['side'], string> = {
    bride: 'bg-rose-100 text-rose-800',
    groom: 'bg-sky-100 text-sky-800',
    both: 'bg-amber-100 text-amber-800',
  };
  const label = side === 'both' ? 'Both' : side === 'bride' ? "Bride's" : "Groom's";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${tone[side]}`}>
      {label}
    </span>
  );
}

function RsvpPill({ status }: { status: RsvpStatus }) {
  const tone: Record<RsvpStatus, string> = {
    attending: 'bg-emerald-100 text-emerald-800',
    pending: 'bg-amber-100 text-amber-800',
    declined: 'bg-rose-100 text-rose-800',
    maybe: 'bg-ink/10 text-ink/70',
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${tone[status]}`}>
      {RSVP_LABELS[status]}
    </span>
  );
}
