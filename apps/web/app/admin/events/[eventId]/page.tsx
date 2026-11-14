import { readEventTypeNames, type EventTypeName } from '@/lib/admin/event-type-names.server';
import { notFound } from 'next/navigation';
import { after } from 'next/server';
import { ScanFace, Undo2 } from 'lucide-react';
import { Badge } from '@/app/_components/badge';
import { ActionButton } from '@/components/action-button';
import {
  RecordBack,
  RecordEmpty,
  RecordFacts,
  RecordFold,
  RecordFolds,
  RecordHead,
  RecordRow,
  RecordRows,
  RecordSection,
} from '@/app/admin/_components/record-kit';
import { PageMasthead } from '@/app/_components/page-masthead';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { setEventFaceMode } from '@/app/admin/events/actions';
import { requireAdmin } from '@/lib/admin/require-admin';
import { logAdminDataAccess } from '@/lib/admin-data-access';
import { createAdminClient } from '@/lib/supabase/admin';
import { readEventServiceCounts } from '@/lib/supplier-count.server';
import { breakdownWords, ruleLabels, ruleWords } from '@/lib/supplier-count';
import { logQueryError } from '@/lib/supabase/error-detect';
import { formatCount } from '@/lib/format-number';
import { guestListIsClosed } from '@/lib/guest-list-closed';
import { resolveFaceMode } from '@/lib/papic-face-mode';
import { guestFullName } from '@/lib/guests';
import { BOOKED_EVENT_VENDOR_STATUSES } from '@/lib/vendor-funnel';
import { readAdminEventScans } from '@/lib/supplier-scan.server';
import { SupplierScansAdmin } from './_components/supplier-scans-admin';
import { NOT_TAKING_CHANGES, SCHEDULE_MARK_COLUMNS, marksByShop, markDay, timesMarkOf } from '@/lib/supplier-schedule-marks';
import { adminWhereLine, whereChaptersFrom, type WhereBlockRow, type WhereRequestRow } from '@/lib/supplier-where';

export const metadata = { title: 'Event · Admin' };
export const dynamic = 'force-dynamic';

/**
 * ONE admin page per event — /admin/events/<S89E-… or event uuid>.
 *
 * Built 2026-09-30 because the owner could not open an event from the console
 * at all, and had to run SQL by hand to reopen one couple's finalized guest
 * list. This page shows what the console needs to answer about an event —
 * who hosts it, how many replied, whether the list is closed, whether face
 * tagging runs — and carries the two admin writes that go with it.
 *
 * 🔑 EVERY READ BINDS ITS ERROR AND RENDERS "Couldn't load" — never `0`, never
 * an empty list. A refused read and a genuinely empty event look identical as
 * data, and only one of them is true (same contract as lib/guests.ts and
 * lib/guests-read-is-honest.test.ts). Held by
 * lib/admin-event-page-is-honest.test.ts.
 *
 * 📇 THE EVENT RECORD (owner 14 Nov 2026, "Yes, queue the builds" — the approved 13 Nov drawing
 * `Setnayan-specs/prototypes/admin_pub/people.html`, screen `event`): the head, the facts, the hosts, then one fold
 * each — Guest list (Reopen) · Face tagging · Suppliers (who each counts · schedule · scans). Force-delete stays on the
 * Events list, where its paid-supplier and money reads word the consequence.
 *
 * PRIVACY WALL: face data here is a yes/no per guest, read as `guest_id` only.
 * No descriptor, no selfie asset, no quality score ever leaves the database.
 */

/** Guest rows fetched for the face list; disclosed by the table when full. */
const GUEST_CAP = 1000;

const PUBLIC_ID_RE = /^S89E-[0-9A-Za-z]{10}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COULD_NOT_LOAD = "Couldn't load";

const NOTICE: Record<string, string> = {
  guest_list_reopened:
    'Guest list reopened. The hosts can add, remove and change replies again; it stays open until a host presses Finalize.',
  face_mode_on: 'Face auto-tagging is now ON for this event (unless the couple declined).',
  face_mode_off: 'Face auto-tagging is now OFF for this event.',
};
const ERROR: Record<string, string> = {
  missing_event: 'No event was named, so nothing changed.',
  reopen_read_failed: "Couldn't read the event before reopening it. Nothing changed.",
  reopen_not_found: 'That event no longer exists. Nothing changed.',
  reopen_failed: 'The database refused the reopen. Nothing changed.',
  reopen_not_applied:
    'The reopen did not land — the row came back still finalized. Reload and check before trying again.',
  face_mode_failed: 'The database refused the face-tagging change. Nothing changed.',
  face_mode_not_applied: 'The face-tagging change did not land. Reload and check before trying again.',
};

function fmtDate(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v.length === 10 ? `${v}T00:00:00Z` : v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
};

type FaceRow = {
  guest_id: string;
  name: string;
  excluded: boolean;
};

export default async function AdminEventPage({ params, searchParams }: Props) {
  // 🏷 F-A-15: event types by their admin-managed names.
  const typeName = await readEventTypeNames();
  const { userId: adminUserId } = await requireAdmin();
  const { eventId: rawId } = await params;
  const sp = await searchParams;
  const id = decodeURIComponent(rawId).trim();
  const byPublicId = PUBLIC_ID_RE.test(id);
  if (!byPublicId && !UUID_RE.test(id)) notFound();

  const admin = createAdminClient();

  // ── the event itself ────────────────────────────────────────────────────
  const eventRead = await admin
    .from('events')
    .select(
      'event_id, public_id, display_name, event_type, event_date, archived, papic_face_mode, face_tagging_declined_by_couple, guest_count_locked_at, final_pax, guest_list_edit_deadline',
    )
    .eq(byPublicId ? 'public_id' : 'event_id', id)
    .maybeSingle();
  if (eventRead.error) {
    logQueryError('admin/events/[eventId]:event', eventRead.error);
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <PageMasthead title="Event" />
        <p role="alert" className="rounded-lg bg-mulberry/10 p-4 text-sm text-mulberry">
          {COULD_NOT_LOAD} this event — the database refused the read. This is not the same as the
          event not existing.
        </p>
      </main>
    );
  }
  const ev = eventRead.data;
  if (!ev) notFound();
  const eventId = ev.event_id as string;
  // 🧮 Leaves now, read below — it needs no other answer.
  const serviceCountsRead = readEventServiceCounts(admin, eventId);

  // ── hosts ───────────────────────────────────────────────────────────────
  const membersRead = await admin
    .from('event_members')
    .select('user_id')
    .eq('event_id', eventId)
    .eq('member_type', 'couple');
  if (membersRead.error) logQueryError('admin/events/[eventId]:hosts', membersRead.error);
  const hostIds = (membersRead.data ?? []).map((m) => m.user_id as string).filter(Boolean);
  const usersRead = hostIds.length
    ? await admin.from('users').select('user_id, display_name, email').in('user_id', hostIds)
    : { data: [] as Array<{ user_id: string; display_name: string | null; email: string | null }>, error: null };
  if (usersRead.error) logQueryError('admin/events/[eventId]:host users', usersRead.error);
  const hostsError = membersRead.error ?? usersRead.error;
  const hosts = hostsError ? null : (usersRead.data ?? []);

  // ── guest counts (head-only; each one's error decides its own cell) ─────
  const liveGuests = () =>
    admin
      .from('guests')
      .select('guest_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .is('deleted_at', null);
  const [totalRead, yesRead, declinedRead] = await Promise.all([
    liveGuests(),
    liveGuests().eq('rsvp_status', 'attending'),
    liveGuests().eq('rsvp_status', 'declined'),
  ]);
  for (const [label, r] of [
    ['total', totalRead],
    ['attending', yesRead],
    ['declined', declinedRead],
  ] as const) {
    if (r.error) logQueryError(`admin/events/[eventId]:guests ${label}`, r.error);
  }
  const countCell = (r: { count: number | null; error: unknown }) =>
    r.error || r.count === null ? COULD_NOT_LOAD : formatCount(r.count);

  // ── 🧮 who each per-head service counts (owner 2026-11-04) — numbers and the rule, so support can answer "why 141?"
  // without opening a guest list. The service role reads it (`get_event_service_counts`); null = refused, said so.
  const serviceCounts = await serviceCountsRead;

  // ── per-guest face list ─────────────────────────────────────────────────
  const guestsRead = await admin
    .from('guests')
    .select(
      'guest_id, display_name, name_prefix, first_name, middle_name, last_name, name_suffix, face_recognition_excluded',
    )
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(GUEST_CAP);
  if (guestsRead.error) logQueryError('admin/events/[eventId]:face guests', guestsRead.error);
  const faceRows: FaceRow[] | null = guestsRead.error
    ? null
    : (guestsRead.data ?? []).map((g) => ({
        guest_id: g.guest_id as string,
        // Explicitly 'full', not the event's Name style: the admin reads every
        // part of the name to find the right guest; the host's style governs
        // what is PRINTED, not an admin lookup row.
        name: guestFullName(g, 'full') ?? 'Unnamed guest',
        excluded: g.face_recognition_excluded === true,
      }));

  // guest_id ONLY — a yes/no, never a vector, asset or score. `count: 'exact'`
  // so a read the server truncated (PostgREST max-rows) is caught instead of
  // quietly marking the rest "not enrolled".
  const enrolRead = await admin
    .from('guest_face_enrollments') // chat-guard-allow: guest_id only — an enrolled yes/no per guest; reads zero face vectors, assets or scores
    .select('guest_id', { count: 'exact' })
    .eq('event_id', eventId)
    .is('revoked_at', null);
  if (enrolRead.error) logQueryError('admin/events/[eventId]:face enrollments', enrolRead.error);
  const enrolRows = enrolRead.data;
  const enrolledIds: Set<string> | null =
    enrolRead.error || !enrolRows || (enrolRead.count ?? -1) !== enrolRows.length
      ? null
      : new Set(enrolRows.map((r) => r.guest_id as string));

  // ── booked suppliers and their schedule marks (🔒 CHANGE LOCK, audit D7) ─────
  // Read-only: which booked shop LOCKED their part (a host's change is refused), confirmed their times, or saw a
  // change. Admin words may say "Locked"; the host reads "Not taking changes".
  const supRowsRead = await admin
    .from('event_vendors')
    .select('vendor_id, vendor_name, marketplace_vendor_id, category')
    .eq('event_id', eventId)
    .in('status', [...BOOKED_EVENT_VENDOR_STATUSES])
    .is('archived_at', null)
    .not('marketplace_vendor_id', 'is', null);
  if (supRowsRead.error) logQueryError('admin/events/[eventId]:booked suppliers', supRowsRead.error);
  const supShopIds = [...new Set((supRowsRead.data ?? []).map((r) => r.marketplace_vendor_id as string))];
  const marksRead = await admin.from('event_supplier_schedule_marks').select(SCHEDULE_MARK_COLUMNS).eq('event_id', eventId);
  if (marksRead.error) logQueryError('admin/events/[eventId]:schedule marks', marksRead.error);
  const shopNamesRead = supShopIds.length
    ? await admin.from('vendor_profiles').select('vendor_profile_id, business_name').in('vendor_profile_id', supShopIds)
    : { data: [] as Array<{ vendor_profile_id: string; business_name: string | null }>, error: null };
  if (shopNamesRead.error) logQueryError('admin/events/[eventId]:supplier shop names', shopNamesRead.error);
  const shopName = new Map(
    (shopNamesRead.data ?? []).map((n) => [n.vendor_profile_id as string, ((n.business_name as string | null) ?? '').trim()]),
  );
  const marks = marksRead.error
    ? null
    : marksByShop(
        (marksRead.data ?? []) as Array<{ vendor_profile_id: string; seen_at: string | null; confirmed_at: string | null; locked_at: string | null }>,
      );
  // 🎟 Suppliers' scans (the claim scanner) — every claim at this event, to see and to fix. null = unread.
  const supplierScans = await readAdminEventScans(eventId);
  // 📍 Each supplier's Where (owner 2026-11-04, migration 20271308641275): the chapters they are on, and a Where request
  // still waiting either way. Read-only; a refused read is said on the row, never "no chapter".
  const chaptersRead = await admin
    .from('event_schedule_blocks')
    .select('block_id, parent_block_id, label, start_at, time_tba, responsible_vendor_ids')
    .eq('event_id', eventId)
    .is('parent_block_id', null);
  const whereAsksRead = await admin
    .from('event_schedule_suggestions')
    .select('suggestion_id, kind, status, direction, where_vendor_id, proposed_block_ids')
    .eq('event_id', eventId)
    .eq('kind', 'where')
    .eq('status', 'open');
  if (chaptersRead.error) logQueryError('admin/events/[eventId]:chapters for Where', chaptersRead.error);
  if (whereAsksRead.error) logQueryError('admin/events/[eventId]:Where requests', whereAsksRead.error);
  const whereChapters = chaptersRead.error ? null : whereChaptersFrom((chaptersRead.data ?? []) as WhereBlockRow[]);
  const whereAsks = whereAsksRead.error ? null : ((whereAsksRead.data ?? []) as WhereRequestRow[]);
  const supplierLocks: Array<{ key: string; name: string; state: string; where: string }> | null = supRowsRead.error
    ? null
    : (supRowsRead.data ?? []).map((r) => {
        const shop = r.marketplace_vendor_id as string;
        const mark = marks ? timesMarkOf(marks.get(shop)) : null;
        const state =
          marks === null
            ? COULD_NOT_LOAD
            : !mark
              ? 'Open · nothing pressed yet'
              : mark.word === NOT_TAKING_CHANGES
                ? `Locked since ${markDay(mark.at)} · a host's change is refused`
                : `Open · ${mark.word} ${markDay(mark.at)}`;
        return {
          key: r.vendor_id as string,
          name: shopName.get(shop) || ((r.vendor_name as string | null) ?? '').trim() || 'Supplier',
          state,
          where: adminWhereLine({
            vendorId: r.vendor_id as string,
            category: (r.category as string | null) ?? null,
            chapters: whereChapters,
            openAsks: whereAsks,
          }),
        };
      });

  // RA 10173 who-viewed-whom — one row per host whose details this page shows.
  // Post-response and non-fatal, exactly like the account card.
  after(async () => {
    for (const h of hosts ?? []) {
      await logAdminDataAccess(admin, {
        adminUserId,
        accessedUserId: h.user_id as string,
        surface: 'admin_event_page',
        context: { event_id: eventId },
      });
    }
  });

  // ── derived state ───────────────────────────────────────────────────────
  const lockedAt = (ev.guest_count_locked_at as string | null) ?? null;
  const deadline = (ev.guest_list_edit_deadline as string | null) ?? null;
  const eventDate = (ev.event_date as string | null) ?? null;
  // Closed ONLY by the host's Finalize (owner ruling 2026-09-30) — the stamp.
  const closed = guestListIsClosed({ lockedAt });

  const stored = (ev.papic_face_mode as string | null) ?? 'mode_b';
  const declined = ev.face_tagging_declined_by_couple === true;
  const effective = resolveFaceMode(stored, ev.event_type as string | null, declined);
  const faceLabel =
    stored === 'mode_a'
      ? declined
        ? 'On (couple declined) — not running'
        : 'On'
      : declined
        ? 'Off (couple also declined)'
        : 'Off';

  const name = (ev.display_name as string | null) ?? 'Untitled event';
  const notice = sp.saved ? NOTICE[sp.saved] : undefined;
  const failure = sp.error ? (ERROR[sp.error] ?? 'That did not go through. Nothing changed.') : undefined;

  const yes = countCell(yesRead);
  const guestSummary = `${closed ? 'Finalized' : 'Open'} · ${countCell(totalRead)} guests`;
  const supplierSummary =
    supplierLocks === null ? COULD_NOT_LOAD : `${formatCount(supplierLocks.length)} booked`;

  return (
    <main className="mx-auto w-full max-w-[760px] px-4 py-6 sm:px-6">
      <RecordBack href="/admin/accounts?tab=events" label="Events" />
      <PageMasthead titleNode={name} />
      <RecordHead
        small={`Event · ${ev.public_id as string} · ${typeName(ev.event_type as string | null)}`}
        name={name}
        badges={<Badge tone={ev.archived ? 'quiet' : 'ok'}>{ev.archived ? 'Archived' : 'Active'}</Badge>}
      />

      {notice ? (
        <p role="status" className="my-2 rounded-lg bg-success-100 p-3 text-sm text-success-800">
          {notice}
        </p>
      ) : null}
      {failure ? (
        <p role="alert" className="my-2 rounded-lg bg-mulberry/10 p-3 text-sm text-mulberry">
          {failure}
        </p>
      ) : null}

      <RecordFacts
        label="The event"
        items={[
          ['Type', typeName(ev.event_type as string | null)],
          ['Date', fmtDate(eventDate)],
          ['ID', ev.public_id as string],
          ['Status', ev.archived ? 'Archived' : 'Active'],
        ]}
      />

      <RecordSection label={`Hosts${hosts === null ? '' : ` (${formatCount(hosts.length)})`}`}>
        {hosts === null ? (
          <p role="alert" className="text-sm text-mulberry">
            {COULD_NOT_LOAD} the hosts — the read was refused, so this is not &ldquo;no hosts&rdquo;.
          </p>
        ) : hosts.length === 0 ? (
          <RecordEmpty>Verified: this event has no host accounts.</RecordEmpty>
        ) : (
          <RecordRows label="Hosts">
            {hosts.map((h) => (
              <RecordRow
                key={h.user_id as string}
                href={`/admin/users/${h.user_id as string}`}
                title={(h.display_name as string | null) || 'No name'}
                line={(h.email as string | null) ?? '—'}
              />
            ))}
          </RecordRows>
        )}
      </RecordSection>

      <RecordFolds>
        <RecordFold title="Guest list" anchor="guests" summary={guestSummary}>
          <RecordFacts
            items={[
              ['Guests', countCell(totalRead)],
              ['Replied yes', yes],
              ['Declined', countCell(declinedRead)],
              ['State', closed ? 'Finalized' : 'Open'],
              ['Finalized on', fmtDate(lockedAt)],
              ['Final count', ev.final_pax === null || ev.final_pax === undefined ? '—' : formatCount(ev.final_pax as number)],
              ['Reply-by date', deadline ? fmtDate(deadline) : 'Not set'],
            ]}
          />
        {closed ? (
          <ConfirmForm
            action={setEventFaceMode}
            title="Reopen this guest list?"
            confirmLabel="Reopen"
            destructive={false}
            className="mt-3"
            message={`Reopen the guest list for "${name}"? This clears the finalized stamp and the frozen final count. The hosts can add, remove and change replies again, and the list stays open until a host presses Finalize. Recorded in the admin audit log.`}
          >
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="intent" value="reopen_guest_list" />
            <input type="hidden" name="from" value="event" />
            <ActionButton tone="warn" icon={<Undo2 aria-hidden strokeWidth={1.9} />} label="Reopen guest list" type="submit" />
          </ConfirmForm>
        ) : null}
        </RecordFold>

        <RecordFold title="Face tagging" anchor="face" summary={`${faceLabel} · running: ${effective === 'mode_a' ? 'yes' : 'no'}`}>
        <p className="text-sm text-ink">
          <span className="font-medium">{faceLabel}</span>
          <span className="text-ink/60">
            {' '}
            · running on this event: {effective === 'mode_a' ? 'yes' : 'no'}
          </span>
        </p>
        <ConfirmForm
          action={setEventFaceMode}
          className="mt-3"
          message={
            stored === 'mode_a'
              ? `Turn face auto-tagging OFF for "${name}"? New photos stop being matched to faces. Descriptors already stored are not deleted by this.`
              : `Turn face auto-tagging ON for "${name}"? A face descriptor will be stored for each guest who has ticked biometric consent AND affirmed 18+, and who the host has not excluded. Nobody else. DPIA-relevant — you are the DPO making this call.${declined ? ' The couple declined face tagging, so it still will not run until they change that.' : ''}`
          }
        >
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="face_mode" value={stored === 'mode_a' ? 'mode_b' : 'mode_a'} />
          <input type="hidden" name="from" value="event" />
          <ActionButton tone={stored === 'mode_a' ? 'danger' : 'neutral'} icon={<ScanFace aria-hidden strokeWidth={1.9} />} label={stored === 'mode_a' ? 'Turn off' : 'Turn on'} type="submit" />
        </ConfirmForm>

        {enrolledIds === null ? (
          <p role="alert" className="mt-4 text-sm text-mulberry">
            {COULD_NOT_LOAD} the face enrolments — the &ldquo;Enrolled&rdquo; column below is unknown, not &ldquo;no&rdquo;.
          </p>
        ) : null}
        <div className="mt-4">
          <ConsoleTable
            rows={faceRows}
            readPermitted
            readError={guestsRead.error}
            reads="the guest list"
            label="Guests and face enrolment"
            cap={GUEST_CAP}
            rowKey={(g) => g.guest_id}
            empty={{
              Icon: ScanFace,
              title: 'No guests yet',
              blurb: 'The read went through and this event has no guests on its list.',
            }}
            columns={[
              { header: 'Guest', cell: (g) => <span className="text-ink">{g.name}</span> },
              {
                header: 'Enrolled',
                cell: (g) =>
                  enrolledIds === null ? COULD_NOT_LOAD : enrolledIds.has(g.guest_id) ? 'Yes' : 'No',
              },
              { header: 'Excluded by host', cell: (g) => (g.excluded ? 'Yes' : 'No') },
            ]}
          />
        </div>
        </RecordFold>

        <RecordFold title="Suppliers" anchor="suppliers" summary={supplierSummary}>
      {/* 🧮 Who each supplier counts (owner 2026-11-04) — each per-head service's count and its rule. */}
      <div data-admin-service-counts="">
        <h3 className="flex min-h-9 items-center pb-1 text-[11.5px] font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2,#6A6E76)]">Who each supplier counts</h3>
        {serviceCounts === null ? (
          <p role="alert" className="text-sm text-mulberry">
            {COULD_NOT_LOAD} the suppliers&rsquo; counts — the read was refused, so this is not &ldquo;none&rdquo;.
          </p>
        ) : serviceCounts.services.length === 0 ? (
          <p className="text-sm text-ink/60">Verified: no supplier on this event is priced per head.</p>
        ) : (
          <ul className="divide-y divide-ink/10 text-sm">
            {serviceCounts.services.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-4 py-2" data-admin-service-count={s.id}>
                <span className="min-w-0">
                  <span className="block text-ink">
                    {s.label} · {s.shop ?? '—'}
                    {s.booked ? '' : <span className="text-ink/50"> · quoted, not booked</span>}
                  </span>
                  <span className="block text-xs text-ink/60">
                    {ruleWords(s.rule.mode, ruleLabels(s.rule, serviceCounts.groups, serviceCounts.names))} · {breakdownWords(s)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <b className="block text-base font-medium tabular-nums text-ink">{formatCount(s.counted)}</b>
                  <span className="text-xs text-ink/60">counted</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 🔒 Suppliers' schedule — the CHANGE LOCK (audit D7), read-only */}
      <div data-admin-supplier-locks="">
        <h3 className="flex min-h-9 items-center pb-1 text-[11.5px] font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2,#6A6E76)]">Suppliers&rsquo; schedule</h3>
        {supplierLocks === null ? (
          <p role="alert" className="text-sm text-mulberry">
            {COULD_NOT_LOAD} the booked suppliers — the read was refused, so this is not &ldquo;no suppliers&rdquo;.
          </p>
        ) : supplierLocks.length === 0 ? (
          <p className="text-sm text-ink/60">Verified: no booked supplier with a shop on this event.</p>
        ) : (
          <ul className="divide-y divide-ink/10 text-sm">
            {supplierLocks.map((s) => (
              <li key={s.key} className="flex flex-wrap justify-between gap-x-4 py-2">
                <span className="text-ink">{s.name}</span>
                <span className={s.state.startsWith('Locked') ? 'font-medium text-ink' : 'text-ink/60'}>{s.state}</span>
                <span className="basis-full text-xs text-ink/60" data-admin-supplier-where={s.key}>
                  {s.where}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 🎟 Suppliers' scans — the claim scanner's record at this event; Remove takes back one recorded in error. */}
      <div data-admin-supplier-scans="">
        <h3 className="flex min-h-9 items-center pb-1 text-[11.5px] font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2,#6A6E76)]">Suppliers&rsquo; scans</h3>
        {supplierScans === null ? (
          <p role="alert" className="text-sm text-mulberry">
            {COULD_NOT_LOAD} the suppliers&rsquo; scans — the read failed, so this is not &ldquo;no scans&rdquo;.
          </p>
        ) : supplierScans.length === 0 ? (
          <p className="text-sm text-ink/60">Verified: no supplier has scanned a guest at this event.</p>
        ) : (
          <SupplierScansAdmin eventId={eventId} claims={supplierScans} />
        )}
      </div>

        </RecordFold>
      </RecordFolds>
    </main>
  );
}
