import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchEventViewer } from '@/lib/event-viewer.server';
import {
  RSVP_ROW_WORDS,
  fetchGroupMembershipsByEventMeasured,
  fetchGuestGroupsByEventMeasured,
  fetchGuestsByEventMeasured,
  guestPrintName,
  type GuestRow,
} from '@/lib/guests';
import { fetchAssignments, fetchTables, effectiveCapacity } from '@/lib/seating';
import { seatingUnits } from '@/lib/print-entrance-chart';
import { loadRoleNames } from '@/lib/role-names.server';
import { resolveRoleSetForEvent } from '@/lib/event-type-profile';
import { eventHasSides } from '@/lib/guest-side-question';
import { GUESTS_SHOW, listGroupOf, mapGroupOf, parseGuestsFilter } from '@/lib/guests-filter';
import { ROSTER_VIEWS, isToInvite, replyFilterMatches, rosterSections } from '@/lib/guest-roster-view';
import { readShownMarch } from '@/lib/guests-march-read';
import { printedDate, printFileName } from '@/lib/print-pieces';
import { sharePdf, sharePdfPaper } from '@/lib/share-pdf';
import {
  checkInPdf,
  guestListPdf,
  guestsShareDoor,
  isGuestsShareDoc,
  marchPdf,
  tableListPdf,
  type GuestsShareHead,
} from '@/lib/guests-share-pdf';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// 📤 GUESTS › SHARE OR PRINT — the four documents no print route made yet (R4 slice 8; `lib/guests-share-pdf.ts`):
// `?doc=guest-list` (as shown: `?gshow` · `?ggroup` · `?from=list|map`) · `check-in` · `table-list` · `march`, on the
// shared engine (`lib/share-pdf.ts`), `?paper=` from `SharePdfButton`'s Paper ▾.
//
// The same doors as the Guests page, BEFORE a name is read:
//   1. signed in;
//   2. a delegate the couple never shared the guest list with is refused — their guest read would be ZERO ROWS with no
//      error (RLS), and a file of nobody would look like a real, empty list;
//   3. the march is the couple's own (its read uses the service client, `lib/guests-march-read.ts`) — couple only, as
//      the March view itself;
//   4. the seat plan is its own area: a helper without `seat_plan` is refused the Table list, and gets every other file
//      with NO Table column — the tables are not even read for them.
// All four are one pure answer, `guestsShareDoor` (`lib/guests-share-pdf.ts`), from the viewer the Guests page uses
// (`fetchEventViewer` — a delegate past the 7-day window is nobody).
// Every read that fails answers 503 in words — never a file of "No guests" or "Nobody walks yet".
// ---------------------------------------------------------------------------

type Params = { params: Promise<{ eventId: string }> };

const say = (status: number, words: string) =>
  new NextResponse(words, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, no-store' } });
const UNREAD = "This file can't be made right now — part of your guest list didn't load. Please try again in a moment.";

export async function GET(req: Request, { params }: Params) {
  const { eventId } = await params;
  const q = new URL(req.url).searchParams;
  const doc = q.get('doc');
  if (!isGuestsShareDoc(doc)) return say(404, 'There is no such file to share.');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return say(401, 'Please sign in to share this.');

  const door = guestsShareDoor(await fetchEventViewer(supabase, eventId, user.id), doc);
  if (!door.ok) return say(door.status, door.words);

  const { data: event, error: eventError } = await supabase
    .from('events_host')
    .select('display_name, slug, event_date, event_date_precision, venue_name')
    .eq('event_id', eventId)
    .maybeSingle();
  // A refused read is not "no such event" — say it could not load, never 404.
  if (eventError) {
    logQueryError('guestsShare.event', eventError, { event_id: eventId });
    return say(503, UNREAD);
  }
  if (!event) return say(404, 'Event not found.');
  const ev = event as { display_name: string | null; slug: string | null; event_date: string | null; event_date_precision: string | null; venue_name: string | null };
  const head: GuestsShareHead = {
    eventName: ev.display_name?.trim() || 'Your event',
    meta: [printedDate(ev.event_date, ev.event_date_precision), ev.venue_name?.trim() || null],
    generatedAt: new Date(),
    paper: sharePdfPaper(q.get('paper')),
  };
  const file = (what: string) => printFileName(ev.slug, what);

  let built: { bytes: Uint8Array; name: string };
  try {
    if (doc === 'march') {
      const shown = await readShownMarch(supabase, eventId);
      if (shown.marchUnread || shown.draftUnread || shown.out === null) return say(503, "The march can't be shared right now — it didn't load. Please try again in a moment.");
      const name = (p: { name: string; nick?: string }) => (p.nick ? `${p.name} “${p.nick}”` : p.name);
      built = {
        name: file('wedding-march'),
        bytes: await sharePdf(
          marchPdf(head, {
            sections: shown.sections.map((s) => ({ label: s.label, walks: s.rows.map((r) => r.filter((p) => p !== null).map((p) => name(p!))) })),
            notWalking: shown.out.map((p) => name(p)),
            drafted: shown.drafted,
          }),
        ),
      };
    } else {
      const [read, tables, assignments] = await Promise.all([
        fetchGuestsByEventMeasured(supabase, eventId),
        // Without the seat plan, no table is read — nothing to leak, nothing to hide.
        door.tables ? fetchTables(supabase, eventId) : Promise.resolve([]),
        door.tables ? fetchAssignments(supabase, eventId) : Promise.resolve([]),
      ]);
      if (!read.measured) return say(503, UNREAD);
      const guests = read.rows;
      const tableLabel = new Map(tables.map((t) => [t.table_id, t.link_group_label?.trim() || t.table_label]));
      const tableOfGuest = new Map(assignments.map((a) => [a.guest_id, tableLabel.get(a.table_id) ?? null]));
      const tableOf = (id: string) => tableOfGuest.get(id) ?? null;
      const byName = (a: GuestRow, b: GuestRow) => guestPrintName(a).localeCompare(guestPrintName(b), 'en', { sensitivity: 'base' });

      if (doc === 'check-in') {
        const coming = guests.filter((g) => replyFilterMatches(g, 'attending')).sort(byName);
        const pending = guests.filter((g) => replyFilterMatches(g, 'none')).length;
        built = { name: file('check-in-sheet'), bytes: await sharePdf(checkInPdf(head, coming.map((g) => ({ name: guestPrintName(g), table: tableOf(g.guest_id) })), pending, door.tables)) };
      } else if (doc === 'table-list') {
        const units = seatingUnits(tables, assignments, guests);
        const seated = new Set(units.flatMap((u) => u.guests.map((g) => g.guest_id)));
        const unseated = guests.filter((g) => !seated.has(g.guest_id) && replyFilterMatches(g, 'attending')).sort(byName);
        built = {
          name: file('table-list'),
          bytes: await sharePdf(
            tableListPdf(
              head,
              units.map((u) => ({
                label: u.label,
                capacity: u.members.reduce((n, t) => n + effectiveCapacity(t.capacity, t.removed_seats), 0),
                guests: u.guests.map((g) => ({ name: guestPrintName(g) })),
              })),
              unseated.map((g) => ({ name: guestPrintName(g) })),
            ),
          ),
        };
      } else {
        // The guest list AS SHOWN: the ⇅ of the view it was shared from.
        const filter = parseGuestsFilter(q);
        const [roleNames, roleSet, groupsRead, membersRead] = await Promise.all([
          loadRoleNames(supabase, eventId, 'guestsShare.roleNames'),
          resolveRoleSetForEvent(eventId),
          fetchGuestGroupsByEventMeasured(supabase, eventId),
          fetchGroupMembershipsByEventMeasured(supabase, eventId),
        ]);
        const hasSides = eventHasSides(roleSet);
        const group = q.get('from') === 'map' ? mapGroupOf(filter, hasSides) : listGroupOf(filter);
        // Grouped by Group, an unread membership would file everyone under "no group" — refused, never guessed.
        if (group === 'group' && (!groupsRead.measured || !membersRead.measured)) return say(503, UNREAD);
        const groupLabel = new Map(groupsRead.groups.map((g) => [g.group_id, g.label]));
        const groupsOf = (id: string) =>
          (membersRead.memberships.get(id) ?? []).map((gid) => groupLabel.get(gid)).filter((l): l is string => Boolean(l)).sort();
        const shown = guests.filter((g) => replyFilterMatches(g, filter.show));
        const sections = rosterSections(shown, group, { roleNames, hasSides, groupsOf, tableOf, guestById: (id) => guests.find((g) => g.guest_id === id) });
        const reply = (g: GuestRow) => (g.rsvp_status === 'pending' && isToInvite(g) ? 'To invite' : RSVP_ROW_WORDS[g.rsvp_status]);
        built = {
          name: file('guest-list'),
          bytes: await sharePdf(
            guestListPdf(head, {
              showLabel: GUESTS_SHOW.find((s) => s.key === (filter.show ?? 'all'))?.label ?? 'Everyone',
              groupLabel: ROSTER_VIEWS.find((v) => v.key === group)?.label ?? 'Role',
              sections: sections.map((s) => ({
                label: s.label,
                guests: s.guests.map((g) => ({ name: guestPrintName(g), reply: reply(g), table: tableOf(g.guest_id) })),
              })),
              tables: door.tables,
            }),
          ),
        };
      }
    }
  } catch (e) {
    console.error('[guests-share] the file could not be made', e instanceof Error ? e.message : e, { event_id: eventId, doc });
    return say(503, UNREAD);
  }

  return new NextResponse(Buffer.from(built.bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${built.name}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
