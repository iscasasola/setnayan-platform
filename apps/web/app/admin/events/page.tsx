import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: 'Events · Admin' };

type EventRow = {
  event_id: string;
  public_id: string;
  display_name: string;
  event_date: string | null;
  slug: string | null;
  venue_name: string | null;
  archived: boolean;
  created_at: string;
};

type Props = { searchParams: Promise<{ q?: string; archived?: string }> };

export default async function AdminEventsPage({ searchParams }: Props) {
  const search = await searchParams;
  const q = (search.q ?? '').trim();
  const showArchived = search.archived === '1';

  const admin = createAdminClient();
  let query = admin
    .from('events')
    .select('event_id,public_id,display_name,event_date,slug,venue_name,archived,created_at')
    .order('event_date', { ascending: true, nullsFirst: false })
    .limit(200);
  if (!showArchived) query = query.eq('archived', false);
  if (q.length > 0) {
    query = query.or(`display_name.ilike.%${q}%,slug.ilike.%${q}%,public_id.ilike.%${q}%`);
  }

  const { data, error } = await query;
  const events = (data ?? []) as EventRow[];

  // Pull guest counts for each event.
  const eventIds = events.map((e) => e.event_id);
  let guestCounts = new Map<string, number>();
  if (eventIds.length > 0) {
    const { data: guests } = await admin
      .from('guests')
      .select('event_id')
      .in('event_id', eventIds)
      .is('deleted_at', null);
    for (const row of guests ?? []) {
      guestCounts.set(row.event_id, (guestCounts.get(row.event_id) ?? 0) + 1);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
        <p className="text-sm text-ink/60">
          Soonest first. Guest counts are live from the active (non-deleted) `guests` table.
        </p>
      </header>

      <form className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="display name · slug · S89E-…"
          className="input-field flex-1"
        />
        <label className="inline-flex items-center gap-2 text-sm text-ink/70">
          <input
            type="checkbox"
            name="archived"
            value="1"
            defaultChecked={showArchived}
            className="h-4 w-4 cursor-pointer accent-terracotta"
          />
          Include archived
        </label>
        <button type="submit" className="button-secondary">Apply</button>
      </form>

      {error ? (
        <p role="alert" className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700">
          {error.message}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-ink/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink/[0.03] text-[11px] uppercase tracking-[0.12em] text-ink/55">
            <tr>
              <th className="px-3 py-3 font-medium">Event</th>
              <th className="px-3 py-3 font-medium">Date</th>
              <th className="hidden px-3 py-3 font-medium md:table-cell">Venue</th>
              <th className="hidden px-3 py-3 font-medium md:table-cell">Slug</th>
              <th className="px-3 py-3 font-medium">Guests</th>
              <th className="hidden px-3 py-3 font-medium lg:table-cell">ID</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-ink/55" colSpan={3}>
                  No events match.
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.event_id} className="border-t border-ink/5 hover:bg-terracotta/[0.04]">
                  <td className="px-3 py-3">
                    <p className="font-medium text-ink">{e.display_name}</p>
                    {e.archived ? (
                      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
                        Archived
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-ink/65">
                    {e.event_date ?? '—'}
                  </td>
                  <td className="hidden px-3 py-3 text-xs text-ink/65 md:table-cell">
                    {e.venue_name ?? '—'}
                  </td>
                  <td className="hidden px-3 py-3 font-mono text-[11px] text-ink/65 md:table-cell">
                    {e.slug ?? '—'}
                  </td>
                  <td className="px-3 py-3 font-mono text-sm">
                    {guestCounts.get(e.event_id) ?? 0}
                  </td>
                  <td className="hidden px-3 py-3 font-mono text-[11px] text-ink/55 lg:table-cell">
                    {e.public_id}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
