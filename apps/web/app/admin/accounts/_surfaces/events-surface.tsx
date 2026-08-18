import { CalendarDays, ScanFace, Trash2 } from 'lucide-react';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { SubmitButton } from '@/app/_components/submit-button';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { deleteEvent, setEventFaceMode } from '@/app/admin/events/actions';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { PageMasthead } from '@/app/_components/page-masthead';

/**
 * The read's own ceiling, named once and handed to the table as `cap`. It was a
 * bare `.limit(200)` and nothing on the page said so, so a 200th event read as
 * the last event in the system.
 */
const EVENT_ROW_LIMIT = 200;

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
  /** The biometric gate. `mode_a` = a consenting adult guest's face descriptor
   *  is stored; anything else = it is hard-nulled at the DB boundary. */
  papic_face_mode: string | null;
  event_type: string | null;
};

/**
 * Event types where most of the room is likely to be CHILDREN.
 *
 * ⚠ These were "locked — cannot ever store face data" until 2026-08-05. The
 * owner (also the DPO) ruled that face tagging applies to every event type we
 * offer, so the switch now works here too — but the confirmation names the risk
 * and the guardian-consent workflow still does not exist. Mirrors
 * MINOR_HEAVY_EVENT_TYPES in lib/papic-face-mode.ts.
 */
const MINOR_HEAVY = new Set(['christening', 'debut']);

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

/**
 * EventsSurface — the Events LIST body, re-homed byte-identical from
 * app/admin/events/page.tsx into the tabbed /admin/accounts studio (Accounts
 * Studio slice 1). Behaviour is unchanged: the ?q + ?archived filters, the
 * live guest / paid-vendor / STD-view rollups, and the deleteEvent form
 * (imported from its unchanged @/app/admin/events/actions location). Only two
 * things differ, both mechanical:
 *   1. It accepts the surface's own searchParams (q, archived) as props from
 *      the /admin/accounts shell instead of awaiting them itself.
 *   2. The filter form posts to /admin/accounts with a hidden tab=events input
 *      so submitting a filter stays on the Events tab.
 *
 * ── 2026-08-17 · onto <ConsoleTable>, and it was NOT a looks change ──────────
 * The list read `(data ?? [])` and then branched on `events.length === 0`, so a
 * refused read — a phantom column, a stale enum value, an unapplied migration —
 * printed "No events match." on the screen whose whole job is to show every
 * event on the platform. The error banner above it was real, but the table
 * underneath contradicted it in a calmer voice, and the empty sentence is the one
 * that reads as an answer. `events` stays nullable to the table now.
 *
 * 🔢 THE THREE ROLLUPS WERE WORSE, because they are per-row and there was no
 * banner for them at all. Guests, paid vendors and save-the-date views each came
 * from their own read whose `{ error }` was never destructured, then `?? 0` per
 * cell. A refused guests read printed a confident **0 guests** down the whole
 * column — which on this screen reads as "nobody has RSVP'd to any wedding" —
 * and there was nothing anywhere to say the count had failed. Each rollup now
 * carries whether it was measured, and an unmeasured one renders an em-dash.
 *
 * 🪤 The old empty row spanned `colSpan={10}` over ELEVEN columns. Harmless, and
 * exactly the kind of hand-counted number that stops existing here.
 */
export async function EventsSurface({
  q: qRaw,
  archived,
}: {
  q: string;
  archived: string | null;
}) {
  const q = (qRaw ?? '').trim();
  const showArchived = archived === '1';

  const admin = createAdminClient();
  let query = admin
    .from('events')
    .select(
      'event_id,public_id,display_name,event_date,slug,venue_name,archived,created_at,updated_at,papic_face_mode,event_type',
    )
    .order('event_date', { ascending: true, nullsFirst: false })
    .limit(EVENT_ROW_LIMIT);
  if (!showArchived) query = query.eq('archived', false);
  if (q.length > 0) {
    query = query.or(`display_name.ilike.%${q}%,slug.ilike.%${q}%,public_id.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    logQueryError('AdminEventsPage (events)', error);
  }
  // NOT `?? []`. Null survives to the table as NOT MEASURED; `listed` is the
  // flattened copy for the rollup lookups below, which genuinely need an array.
  const events = data as EventRow[] | null;
  const listed = events ?? [];

  // Live guest counts from the non-deleted guests table.
  const eventIds = listed.map((e) => e.event_id);
  const guestCounts = new Map<string, number>();
  // Distinct paid vendors per event. `orders.vendor_profile_id` is nullable
  // (the cart flow doesn't always set it for couple-side bookings yet —
  // see 20260516210000_vendor_payout_model.sql), so we count distinct
  // non-null vendor_profile_ids on paid orders only.
  const paidVendorsByEvent = new Map<string, Set<string>>();
  // All-time Save-the-Date views per event (iteration 0024 · daily rollup summed).
  const stdViewsByEvent = new Map<string, number>();
  // Was each rollup actually READ? A refused read left every map empty, and `?? 0`
  // then painted a confident zero in every row of that column. `false` here means
  // the column renders an em-dash instead of a number nobody counted. Starts
  // true for the no-events case, where there is nothing to look up and an empty
  // map is the honest, complete answer.
  let guestsMeasured = true;
  let paidVendorsMeasured = true;
  let stdViewsMeasured = true;

  if (eventIds.length > 0) {
    const [guestsRes, paidOrdersRes, stdViewsRes] = await Promise.all([
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
      admin
        .from('event_std_views')
        .select('event_id,views')
        .in('event_id', eventIds),
    ]);

    if (guestsRes.error) logQueryError('AdminEventsPage (guest rollup)', guestsRes.error);
    if (paidOrdersRes.error) {
      logQueryError('AdminEventsPage (paid-vendor rollup)', paidOrdersRes.error);
    }
    if (stdViewsRes.error) {
      logQueryError('AdminEventsPage (save-the-date view rollup)', stdViewsRes.error);
    }

    // Each rollup is judged on its own read — one failing does not make the other
    // two unknown, and a rollup that came back is still worth showing. NOTE the
    // shape: nothing is flattened with `?? []`, so the null check IS the measured
    // check. A flatten plus a separate boolean is two halves that have to agree,
    // and this repo has been bitten by two halves that were wrong in the same
    // direction and therefore agreed perfectly.
    const guestRows = guestsRes.error
      ? null
      : (guestsRes.data as Array<{ event_id: string }> | null);
    const paidOrderRows = paidOrdersRes.error
      ? null
      : (paidOrdersRes.data as Array<{
          event_id: string;
          vendor_profile_id: string | null;
        }> | null);
    const stdViewRows = stdViewsRes.error
      ? null
      : (stdViewsRes.data as Array<{ event_id: string; views: number | null }> | null);

    guestsMeasured = guestRows !== null;
    paidVendorsMeasured = paidOrderRows !== null;
    stdViewsMeasured = stdViewRows !== null;

    if (guestRows) {
      for (const row of guestRows) {
        guestCounts.set(row.event_id, (guestCounts.get(row.event_id) ?? 0) + 1);
      }
    }
    if (paidOrderRows) {
      for (const row of paidOrderRows) {
        if (!row.vendor_profile_id) continue;
        if (!paidVendorsByEvent.has(row.event_id)) {
          paidVendorsByEvent.set(row.event_id, new Set());
        }
        paidVendorsByEvent.get(row.event_id)!.add(row.vendor_profile_id);
      }
    }
    if (stdViewRows) {
      for (const row of stdViewRows) {
        stdViewsByEvent.set(
          row.event_id,
          (stdViewsByEvent.get(row.event_id) ?? 0) + (Number(row.views) || 0),
        );
      }
    }
  }

  /** A rollup cell: the number when it was counted, an em-dash when it was not. */
  function rollup(measured: boolean, value: number) {
    if (!measured) {
      return (
        <span
          className="text-ink/70"
          title="This count could not be read — it is not a zero."
        >
          —
        </span>
      );
    }
    return (
      <span className={value > 0 ? 'text-ink' : 'text-ink/70'}>
        {value.toLocaleString()}
      </span>
    );
  }

  return (
    <div>
      <PageMasthead
        className="mb-6"
        title="Events"
      />

      <form className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center" method="get" action="/admin/accounts">
        <input type="hidden" name="tab" value="events" />
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

      {/* The old "Events couldn't load right now" banner is GONE, not lost: the
          table below now renders the refusal itself, naming what could not be
          read and saying in words that this is not a count of zero. One failure
          got two voices before, and the calmer of the two ("No events match.")
          was the one that read as an answer. */}

      <ConsoleTable
        rows={events}
        readPermitted
        readError={error}
        reads="the event list"
        cap={EVENT_ROW_LIMIT}
        label="Events"
        minWidth="46rem"
        rowKey={(e) => e.event_id}
        empty={{
          Icon: CalendarDays,
          title: q ? 'No event matches that search' : 'No events yet',
          blurb: q
            ? 'The read went through and matched nothing. Clear the search to see every event.'
            : showArchived
              ? 'Nothing has been created on the platform yet — archived events included.'
              : 'No active events. Tick "Include archived" if you are looking for one that was put away.',
          verifiedNote: 'Verified: read permitted · 0 events matched',
        }}
        columns={[
          {
            header: 'Event',
            cell: (e) => (
              <>
                <p className="font-medium text-ink">{e.display_name}</p>
                {e.archived ? (
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/70">
                    Archived
                  </p>
                ) : null}
              </>
            ),
          },
          {
            header: 'Date',
            mono: true,
            cell: (e) => <span className="text-ink/70">{e.event_date ?? '—'}</span>,
          },
          {
            header: 'Venue',
            hideBelow: 'md',
            cell: (e) => <span className="text-xs text-ink/70">{e.venue_name ?? '—'}</span>,
          },
          {
            header: 'Slug',
            hideBelow: 'md',
            mono: true,
            cell: (e) => <span className="text-ink/70">{e.slug ?? '—'}</span>,
          },
          {
            header: 'Guests',
            align: 'right',
            mono: true,
            cell: (e) => rollup(guestsMeasured, guestCounts.get(e.event_id) ?? 0),
          },
          {
            header: 'Paid vendors',
            align: 'right',
            mono: true,
            hideBelow: 'md',
            cell: (e) =>
              rollup(paidVendorsMeasured, paidVendorsByEvent.get(e.event_id)?.size ?? 0),
          },
          {
            header: 'STD views',
            align: 'right',
            mono: true,
            hideBelow: 'lg',
            cell: (e) => rollup(stdViewsMeasured, stdViewsByEvent.get(e.event_id) ?? 0),
          },
          {
            header: 'Updated',
            hideBelow: 'lg',
            mono: true,
            cell: (e) => <span className="text-ink/70">{formatUpdated(e.updated_at)}</span>,
          },
          {
            header: 'ID',
            hideBelow: 'lg',
            mono: true,
            cell: (e) => <span className="text-ink/70">{e.public_id}</span>,
          },
          {
            /* FACE AUTO-TAGGING — the one switch that decides whether a
               consenting adult guest's face descriptor is KEPT. Admin-only by
               design: the column is revoked from hosts (migration
               20271005100000) because it is the biometric gate. Until
               2026-08-04 nothing in the app could write it at all, so every
               event sat off with no way to turn it on. Christening + debut
               carry the extra warning — the guardian-consent workflow does not
               exist yet.

               This is the archetype's per-row form, not a table action: it
               renders inside its own cell and keeps its own confirmation, so the
               caller has to mean it. There is no actions prop to reach for. */
            header: 'Face tagging',
            align: 'right',
            cell: (e) => (
              <ConfirmForm
                action={setEventFaceMode}
                message={
                  e.papic_face_mode === 'mode_a'
                    ? `Turn face auto-tagging OFF for "${e.display_name}"? New photos stop being matched to faces. Descriptors already stored are not deleted by this.`
                    : MINOR_HEAVY.has(e.event_type ?? '')
                      ? `Turn face auto-tagging ON for "${e.display_name}"?\n\n⚠ This is a ${e.event_type} — most of the room is likely to be CHILDREN, and the only thing standing between a child and a face enrolment is a checkbox they can tick themselves. The guardian-consent workflow does not exist yet.\n\nIf you turn this on, use the per-guest "exclude from face recognition" flag on every minor. You are the DPO making this call.`
                      : `Turn face auto-tagging ON for "${e.display_name}"? A face descriptor will be stored for each guest who has ticked biometric consent AND affirmed 18+, and who the host has not excluded. Nobody else. DPIA-relevant — you are the DPO making this call.`
                }
              >
                <input type="hidden" name="event_id" value={e.event_id} />
                <input
                  type="hidden"
                  name="face_mode"
                  value={e.papic_face_mode === 'mode_a' ? 'mode_b' : 'mode_a'}
                />
                <SubmitButton
                  title={
                    e.papic_face_mode === 'mode_a'
                      ? 'Face auto-tagging is ON for this event. Click to turn it off.'
                      : 'Face auto-tagging is OFF. Click to turn it on for consenting adult guests.'
                  }
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium disabled:opacity-60 ${
                    e.papic_face_mode === 'mode_a'
                      ? 'bg-success-100 text-success-900 hover:bg-ink/5'
                      : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
                  }`}
                  pendingLabel="Saving…"
                >
                  <ScanFace className="h-3 w-3" strokeWidth={2} />
                  {e.papic_face_mode === 'mode_a' ? 'On' : 'Off'}
                </SubmitButton>
              </ConfirmForm>
            ),
          },
          {
            header: 'Actions',
            align: 'right',
            cell: (e) => {
              // 🪤 THE DELETE WARNING IS BUILT FROM A ROLLUP THAT CAN BE UNKNOWN.
              // It used to read the same `?? 0` as the column, so a refused
              // orders read produced the *reassuring* wording — "Guests, members,
              // seating… cascade-delete" — on an event that may well have paid
              // vendors attached. Unknown now says so, and says it in the
              // direction of caution.
              const paidVendorCount = paidVendorsByEvent.get(e.event_id)?.size ?? 0;
              const cascade =
                'Guests, members, seating, budget, schedule all cascade-delete.';
              const message = !paidVendorsMeasured
                ? `Hard-delete "${e.display_name}"? We could NOT read this event's paid vendors, so it may have orders attached that will lose their event link. ${cascade} Not reversible.`
                : paidVendorCount > 0
                  ? `Hard-delete "${e.display_name}"? This event has ${paidVendorCount} paid vendor${paidVendorCount === 1 ? '' : 's'} — their order rows survive but lose the event link. ${cascade} Not reversible.`
                  : `Hard-delete "${e.display_name}"? ${cascade} Not reversible — the host can put it away instead from its Personalization page if they might want it back.`;
              return (
                <ConfirmForm action={deleteEvent} message={message}>
                  <input type="hidden" name="event_id" value={e.event_id} />
                  <SubmitButton
                    title="Hard-delete this event."
                    className="inline-flex items-center gap-1 rounded-md bg-ink/5 px-2 py-1 text-xs font-medium text-ink/70 hover:bg-danger-100 hover:text-danger-900 disabled:opacity-60"
                    pendingLabel="Deleting…"
                  >
                    <Trash2 className="h-3 w-3" strokeWidth={2} />
                    Delete
                  </SubmitButton>
                </ConfirmForm>
              );
            },
          },
        ]}
      />
    </div>
  );
}
