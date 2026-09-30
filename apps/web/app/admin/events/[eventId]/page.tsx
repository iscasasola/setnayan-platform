import Link from 'next/link';
import { notFound } from 'next/navigation';
import { after } from 'next/server';
import { ArrowLeft, ScanFace } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { SubmitButton } from '@/app/_components/submit-button';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { setEventFaceMode } from '@/app/admin/events/actions';
import { requireAdmin } from '@/lib/admin/require-admin';
import { logAdminDataAccess } from '@/lib/admin-data-access';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { formatCount } from '@/lib/format-number';
import { guestListIsClosed, FINALIZE_LEAD_DAYS } from '@/lib/guest-list-closed';
import { resolveFaceMode } from '@/lib/papic-face-mode';
import { guestFullName } from '@/lib/guests';

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
 * PRIVACY WALL: face data here is a yes/no per guest, read as `guest_id` only.
 * No descriptor, no selfie asset, no quality score ever leaves the database.
 */

/** Guest rows fetched for the face list; disclosed by the table when full. */
const GUEST_CAP = 1000;

const PUBLIC_ID_RE = /^S89E-[0-9A-Za-z]{10}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COULD_NOT_LOAD = "Couldn't load";

const NOTICE: Record<string, string> = {
  guest_list_reopened: `Guest list reopened. The couple can edit it again until the new deadline (${FINALIZE_LEAD_DAYS} days from today), when it finalizes again on its own.`,
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
        name: guestFullName(g) ?? 'Unnamed guest',
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
  const closed = guestListIsClosed({ lockedAt, editDeadline: deadline, eventDate });

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

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <Link
        href="/admin/accounts?tab=events"
        className="inline-flex items-center gap-1 text-xs text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Events
      </Link>
      <PageMasthead titleNode={name} />

      {notice ? (
        <p role="status" className="rounded-lg bg-success-100 p-3 text-sm text-success-800">
          {notice}
        </p>
      ) : null}
      {failure ? (
        <p role="alert" className="rounded-lg bg-mulberry/10 p-3 text-sm text-mulberry">
          {failure}
        </p>
      ) : null}

      {/* The event */}
      <section className="border-t border-ink/10 pt-5">
        <h2 className="text-lg font-medium text-ink">{name}</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-ink/60">Type</dt>
            <dd className="text-ink">{(ev.event_type as string | null) ?? 'wedding'}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink/60">Date</dt>
            <dd className="text-ink">{fmtDate(eventDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink/60">ID</dt>
            <dd className="font-mono text-xs text-ink">{ev.public_id as string}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink/60">Status</dt>
            <dd className="text-ink">{ev.archived ? 'Archived' : 'Active'}</dd>
          </div>
        </dl>
      </section>

      {/* Hosts */}
      <section className="border-t border-ink/10 pt-5">
        <h2 className="mb-3 text-sm font-medium text-ink">Hosts</h2>
        {hosts === null ? (
          <p role="alert" className="text-sm text-mulberry">
            {COULD_NOT_LOAD} the hosts — the read was refused, so this is not &ldquo;no hosts&rdquo;.
          </p>
        ) : hosts.length === 0 ? (
          <p className="text-sm text-ink/60">Verified: this event has no host accounts.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {hosts.map((h) => (
              <li key={h.user_id as string}>
                <Link href={`/admin/users/${h.user_id as string}`} className="text-ink underline hover:text-ink/80">
                  {(h.display_name as string | null) || 'No name'}
                </Link>{' '}
                <span className="text-ink/60">{(h.email as string | null) ?? '—'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Guests + the finalized list */}
      <section className="border-t border-ink/10 pt-5">
        <h2 className="mb-3 text-sm font-medium text-ink">Guest list</h2>
        <dl className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-xs text-ink/60">Guests</dt>
            <dd className="text-ink">{countCell(totalRead)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink/60">Replied yes</dt>
            <dd className="text-ink">{countCell(yesRead)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink/60">Declined</dt>
            <dd className="text-ink">{countCell(declinedRead)}</dd>
          </div>
        </dl>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-ink/60">State</dt>
            <dd className="font-medium text-ink">
              {lockedAt ? 'Finalized' : closed ? 'Closed (deadline passed)' : 'Open'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink/60">Finalized on</dt>
            <dd className="text-ink">{fmtDate(lockedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink/60">Final count</dt>
            <dd className="text-ink">
              {ev.final_pax === null || ev.final_pax === undefined ? '—' : formatCount(ev.final_pax as number)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink/60">Edit deadline</dt>
            <dd className="text-ink">
              {deadline ? fmtDate(deadline) : `Not set (${FINALIZE_LEAD_DAYS} days before the event)`}
            </dd>
          </div>
        </dl>
        {closed ? (
          <ConfirmForm
            action={setEventFaceMode}
            title="Reopen this guest list?"
            confirmLabel="Reopen"
            destructive={false}
            className="mt-4"
            message={`Reopen the guest list for "${name}"? This clears the finalized stamp and the frozen final count, and moves the edit deadline to ${FINALIZE_LEAD_DAYS} days from today. The couple can add, remove and change replies again until then; the list finalizes again on its own at the new deadline. Recorded in the admin audit log.`}
          >
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="intent" value="reopen_guest_list" />
            <input type="hidden" name="from" value="event" />
            <SubmitButton className="rounded-lg border border-ink/20 px-3 py-1.5 text-sm text-ink hover:bg-ink/5">
              Reopen guest list
            </SubmitButton>
          </ConfirmForm>
        ) : null}
      </section>

      {/* Face tagging */}
      <section className="border-t border-ink/10 pt-5">
        <h2 className="mb-3 text-sm font-medium text-ink">Papic face tagging</h2>
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
          <SubmitButton className="rounded-lg border border-ink/20 px-3 py-1.5 text-sm text-ink hover:bg-ink/5">
            {stored === 'mode_a' ? 'Turn off' : 'Turn on'}
          </SubmitButton>
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
              verifiedNote: 'Verified: read permitted · 0 guests',
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
      </section>
    </main>
  );
}
