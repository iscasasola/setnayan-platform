import { Trash2 } from 'lucide-react';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { SubmitButton } from '@/app/_components/submit-button';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { deleteEvent } from './actions';

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
  updated_at: string;
};

type Props = { searchParams: Promise<{ q?: string; archived?: string }> };

function formatUpdated(iso: string): string {
  // YYYY-MM-DD HH:mm in Manila time — admin's mental model. Falls back to
  // the raw ISO if Intl is unhappy with the input.
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .format(d)
      .replace(',', '');
  } catch {
    return iso;
  }
}

export default async function AdminEventsPage({ searchParams }: Props) {
  const search = await searchParams;
  const q = (search.q ?? '').trim();
  const showArchived = search.archived === '1';

  const admin = createAdminClient();
  let query = admin
    .from('events')
    .select(
      'event_id,public_id,display_name,event_date,slug,venue_name,archived,created_at,updated_at',
    )
    .order('event_date', { ascending: true, nullsFirst: false })
    .limit(200);
  if (!showArchived) query = query.eq('archived', false);
  if (q.length > 0) {
    query = query.or(`display_name.ilike.%${q}%,slug.ilike.%${q}%,public_id.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    logQueryError('AdminEventsPage (events)', error);
  }
  const events = (data ?? []) as EventRow[];

  // Live guest counts from the non-deleted guests table.
  const eventIds = events.map((e) => e.event_id);
  const guestCounts = new Map<string, number>();
  // Distinct paid vendors per event. `orders.vendor_profile_id` is nullable
  // (the cart flow doesn't always set it for couple-side bookings yet —
  // see 20260516210000_vendor_payout_model.sql), so we count distinct
  // non-null vendor_profile_ids on paid orders only.
  const paidVendorsByEvent = new Map<string, Set<string>>();

  if (eventIds.length > 0) {
    const [guestsRes, paidOrdersRes] = await Promise.all([
      admin
        .from('guests')
        .select('event_id')
        .in('event_id', eventIds)
        .is('deleted_at', null),
      admin
        .from('orders')
        .select('event_id,vendor_profile_id')
        .in('event_id', eventIds)
        .eq('status', 'paid')
        .not('vendor_profile_id', 'is', null),
    ]);

    for (const row of guestsRes.data ?? []) {
      guestCounts.set(row.event_id, (guestCounts.get(row.event_id) ?? 0) + 1);
    }
    for (const row of paidOrdersRes.data ?? []) {
      if (!row.vendor_profile_id) continue;
      if (!paidVendorsByEvent.has(row.event_id)) {
        paidVendorsByEvent.set(row.event_id, new Set());
      }
      paidVendorsByEvent.get(row.event_id)!.add(row.vendor_profile_id);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
        <p className="text-sm text-ink/60">
          Soonest first. Guest counts are live from the active (non-deleted) `guests` table.
          Paid vendor counts are distinct vendor profiles on orders with{' '}
          <code className="font-mono text-xs">status=&lsquo;paid&rsquo;</code>.
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
          Events couldn&apos;t load right now. We&apos;ve logged the issue — refresh in a moment or check Sentry for the full detail.
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
              <th className="px-3 py-3 font-medium">Paid&nbsp;vendors</th>
              <th className="hidden px-3 py-3 font-medium lg:table-cell">Updated</th>
              <th className="hidden px-3 py-3 font-medium lg:table-cell">ID</th>
              <th className="px-3 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-ink/55" colSpan={9}>
                  No events match.
                </td>
              </tr>
            ) : (
              events.map((e) => {
                const guestCount = guestCounts.get(e.event_id) ?? 0;
                const paidVendorCount = paidVendorsByEvent.get(e.event_id)?.size ?? 0;
                return (
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
                    <td className="px-3 py-3 font-mono text-sm">{guestCount}</td>
                    <td className="px-3 py-3 font-mono text-sm">
                      <span
                        className={
                          paidVendorCount > 0
                            ? 'text-ink'
                            : 'text-ink/40'
                        }
                      >
                        {paidVendorCount}
                      </span>
                    </td>
                    <td className="hidden px-3 py-3 font-mono text-[11px] text-ink/55 lg:table-cell">
                      {formatUpdated(e.updated_at)}
                    </td>
                    <td className="hidden px-3 py-3 font-mono text-[11px] text-ink/55 lg:table-cell">
                      {e.public_id}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <ConfirmForm
                        action={deleteEvent}
                        message={
                          paidVendorCount > 0
                            ? `Hard-delete "${e.display_name}"? This event has ${paidVendorCount} paid vendor${paidVendorCount === 1 ? '' : 's'} — their order rows survive but lose the event link. Guests, members, seating, budget, schedule all cascade-delete. Not reversible.`
                            : `Hard-delete "${e.display_name}"? Guests, members, seating, budget, schedule all cascade-delete. Not reversible — consider archiving instead if you might restore later.`
                        }
                      >
                        <input type="hidden" name="event_id" value={e.event_id} />
                        <SubmitButton
                          title="Hard-delete this event."
                          className="inline-flex items-center gap-1 rounded-md bg-ink/5 px-2 py-1 text-xs font-medium text-ink/70 hover:bg-rose-100 hover:text-rose-900 disabled:opacity-60"
                          pendingLabel="Deleting…"
                        >
                          <Trash2 className="h-3 w-3" strokeWidth={2} />
                          Delete
                        </SubmitButton>
                      </ConfirmForm>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
