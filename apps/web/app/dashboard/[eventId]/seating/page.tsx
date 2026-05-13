import { redirect } from 'next/navigation';
import { Plus, Trash2, UserPlus, UserMinus, LayoutGrid } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchGuestsByEvent, ROLE_LABELS, type GuestRow } from '@/lib/guests';
import {
  TABLE_TYPE_CATALOG,
  TABLE_TYPE_LABEL,
  computeSeatingStats,
  fetchAssignments,
  fetchTables,
  type EventTableRow,
  type SeatAssignmentRow,
  type TableType,
} from '@/lib/seating';
import {
  assignGuest,
  createTable,
  deleteTable,
  unassignGuest,
  updateTablePosition,
} from './actions';
import { FloorPlan } from './_components/floor-plan';

export const metadata = { title: 'Seating chart' };

type Props = { params: Promise<{ eventId: string }> };

export default async function SeatingPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [tables, assignments, guests] = await Promise.all([
    fetchTables(supabase, eventId),
    fetchAssignments(supabase, eventId),
    fetchGuestsByEvent(supabase, eventId),
  ]);

  const stats = computeSeatingStats(tables, assignments, guests.length);
  const assignedSet = new Set(assignments.map((a) => a.guest_id));
  const unassignedGuests = guests.filter((g) => !assignedSet.has(g.guest_id));
  const guestById = new Map(guests.map((g) => [g.guest_id, g]));

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Iteration 0008 · Seating Chart (V1 MVP)
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Seating</h1>
          <p className="max-w-prose text-base text-ink/65">
            Add tables, assign guests. Free-placed editor with ring auto-fill ships in a later
            revision — for now this is a clean list view that keeps capacity counts honest.
          </p>
        </div>
      </header>

      <StatsStrip stats={stats} />

      <AddTableForm eventId={eventId} />

      {tables.length > 0 ? (
        <FloorPlan
          eventId={eventId}
          tables={tables}
          assignmentCounts={tables.map((t) => ({
            table_id: t.table_id,
            count: assignments.filter((a) => a.table_id === t.table_id).length,
          }))}
          saveAction={updateTablePosition}
        />
      ) : null}

      {tables.length === 0 ? (
        <EmptyTables />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {tables.map((t) => (
            <TableCard
              key={t.table_id}
              eventId={eventId}
              table={t}
              assignments={assignments.filter((a) => a.table_id === t.table_id)}
              guestById={guestById}
              unassignedGuests={unassignedGuests}
            />
          ))}
        </div>
      )}

      {unassignedGuests.length > 0 ? (
        <UnassignedList unassigned={unassignedGuests} />
      ) : null}
    </section>
  );
}

function StatsStrip({
  stats,
}: {
  stats: { tableCount: number; totalCapacity: number; assignedCount: number; unassignedCount: number };
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile label="Tables" value={stats.tableCount} />
      <StatTile label="Total capacity" value={stats.totalCapacity} />
      <StatTile label="Assigned" value={stats.assignedCount} />
      <StatTile label="Unassigned guests" value={stats.unassignedCount} tone="warn" />
    </ul>
  );
}

function StatTile({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'warn';
}) {
  return (
    <li className="rounded-xl border border-ink/10 bg-cream p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tracking-tight ${
          tone === 'warn' && value > 0 ? 'text-terracotta-700' : 'text-ink'
        }`}
      >
        {value}
      </p>
    </li>
  );
}

function AddTableForm({ eventId }: { eventId: string }) {
  return (
    <form
      action={createTable}
      className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-4 sm:flex-row sm:items-end"
    >
      <input type="hidden" name="event_id" value={eventId} />
      <div className="flex-1 space-y-1">
        <label
          htmlFor="table_label"
          className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55"
        >
          Table label
        </label>
        <input
          id="table_label"
          name="table_label"
          required
          maxLength={64}
          placeholder="Table 1 · Family · Sponsors"
          className="input-field"
        />
      </div>
      <div className="space-y-1">
        <label
          htmlFor="table_type"
          className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55"
        >
          Type
        </label>
        <select
          id="table_type"
          name="table_type"
          defaultValue="round_10"
          className="input-field min-w-[14rem]"
        >
          {TABLE_TYPE_CATALOG.map((t) => (
            <option key={t.type} value={t.type}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label
          htmlFor="capacity"
          className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55"
        >
          Capacity
        </label>
        <input
          id="capacity"
          name="capacity"
          type="number"
          min={1}
          max={32}
          defaultValue={10}
          className="input-field w-24"
        />
      </div>
      <button type="submit" className="button-primary inline-flex items-center gap-2">
        <Plus aria-hidden className="h-4 w-4" strokeWidth={2} /> Add table
      </button>
    </form>
  );
}

function EmptyTables() {
  return (
    <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center text-sm text-ink/55">
      <LayoutGrid aria-hidden className="mx-auto mb-2 h-6 w-6 text-ink/30" strokeWidth={1.5} />
      No tables yet — add one above to start seating your guests.
    </div>
  );
}

function TableCard({
  eventId,
  table,
  assignments,
  guestById,
  unassignedGuests,
}: {
  eventId: string;
  table: EventTableRow;
  assignments: SeatAssignmentRow[];
  guestById: Map<string, GuestRow>;
  unassignedGuests: GuestRow[];
}) {
  const filled = assignments.length;
  const overfilled = filled > table.capacity;
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border bg-cream p-4 ${
        overfilled ? 'border-rose-500/50' : 'border-ink/10'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-ink">{table.table_label}</p>
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
            {TABLE_TYPE_LABEL[table.table_type as TableType]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
              overfilled
                ? 'bg-rose-100 text-rose-800'
                : filled === table.capacity
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-ink/5 text-ink/55'
            }`}
          >
            {filled} / {table.capacity}
          </span>
          <form action={deleteTable}>
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="table_id" value={table.table_id} />
            <button
              type="submit"
              aria-label="Delete table"
              className="rounded-md p-1.5 text-ink/40 hover:bg-ink/5 hover:text-rose-700"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </form>
        </div>
      </div>

      <ul className="space-y-1">
        {assignments.length === 0 ? (
          <li className="rounded-md border border-dashed border-ink/15 p-2 text-xs text-ink/55">
            No guests seated yet.
          </li>
        ) : (
          assignments.map((a) => {
            const guest = guestById.get(a.guest_id);
            if (!guest) return null;
            const label =
              guest.display_name?.trim() || `${guest.first_name} ${guest.last_name}`.trim();
            return (
              <li
                key={a.assignment_id}
                className="flex items-center justify-between gap-2 rounded-md bg-ink/[0.03] px-2 py-1.5 text-sm"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium text-ink">{label}</span>
                  <span className="ml-2 text-xs text-ink/55">{ROLE_LABELS[guest.role]}</span>
                </span>
                <form action={unassignGuest}>
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="guest_id" value={a.guest_id} />
                  <button
                    type="submit"
                    aria-label="Remove from table"
                    className="rounded-md p-1 text-ink/40 hover:bg-ink/5 hover:text-rose-700"
                  >
                    <UserMinus className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </form>
              </li>
            );
          })
        )}
      </ul>

      {unassignedGuests.length > 0 && filled < table.capacity ? (
        <form action={assignGuest} className="flex items-center gap-2 border-t border-ink/10 pt-3">
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="table_id" value={table.table_id} />
          <select
            name="guest_id"
            defaultValue=""
            className="input-field flex-1 text-sm"
            required
          >
            <option value="" disabled>
              Add a guest…
            </option>
            {unassignedGuests.map((g) => {
              const label = g.display_name?.trim() || `${g.first_name} ${g.last_name}`.trim();
              return (
                <option key={g.guest_id} value={g.guest_id}>
                  {label}
                </option>
              );
            })}
          </select>
          <button
            type="submit"
            aria-label="Seat guest"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-ink/15 bg-cream text-terracotta hover:border-terracotta"
          >
            <UserPlus className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </form>
      ) : null}
    </div>
  );
}

function UnassignedList({ unassigned }: { unassigned: GuestRow[] }) {
  return (
    <div className="rounded-xl border border-dashed border-ink/15 bg-cream p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Unassigned guests
        </p>
        <span className="font-mono text-[11px] text-ink/55">{unassigned.length}</span>
      </div>
      <ul className="flex flex-wrap gap-2">
        {unassigned.slice(0, 60).map((g) => {
          const label = g.display_name?.trim() || `${g.first_name} ${g.last_name}`.trim();
          return (
            <li
              key={g.guest_id}
              className="rounded-full bg-ink/5 px-3 py-1 text-xs text-ink/75"
              title={ROLE_LABELS[g.role]}
            >
              {label}
            </li>
          );
        })}
        {unassigned.length > 60 ? (
          <li className="rounded-full bg-ink/5 px-3 py-1 text-xs text-ink/55">
            +{unassigned.length - 60} more
          </li>
        ) : null}
      </ul>
    </div>
  );
}
