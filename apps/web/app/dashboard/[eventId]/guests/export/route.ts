import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { fetchEventViewer, viewerAreaLevel } from '@/lib/event-viewer.server';
import { fetchGuestsByEventMeasured } from '@/lib/guests';
import { fetchAssignments, fetchTables } from '@/lib/seating';
import { measuredOr } from '@/lib/measured-read';
import { loadRoleNames } from '@/lib/role-names.server';
import { resolveRoleSetKeyForEvent } from '@/lib/event-type-profile';
import { resolveRoleSet } from '@/lib/role-sets';
import { eventHasSides } from '@/lib/guest-side-question';
import { honoreeRank } from '@/lib/role-groups';
import { tableWords } from '@/lib/table-words';
import { isUuid } from '@/lib/is-uuid';
import { logQueryError } from '@/lib/supabase/error-detect';
import { guestListCsv, guestListFileName } from '@/lib/guest-export-file';

export const dynamic = 'force-dynamic';

/**
 * GET /dashboard/[eventId]/guests/export — 📥 "Download as Excel" on the Guest list (owner 2026-10-16:
 * *"just have a excel file for their guests"*). The host's list as a CSV Excel opens cleanly, in the
 * import template's own columns (`lib/guest-export-file.ts`), written fresh on every tap.
 *
 * 🔒 WHO: the couple, or a helper the couple shared the guest list with (`viewerAreaLevel`, the one rule
 * every guest-list screen asks). Anyone else gets a 404 — the same answer as an event that does not exist.
 *
 * 🔒 HONEST: a refused or failed guest read is NEVER an empty file (lib/guests.ts — an absence is not
 * "no guests"). It is a 503 that says nothing was downloaded. A refused seat read drops the Table column
 * rather than writing a column of blanks that reads as "nobody is seated".
 *
 * 🔒 PRIVATE: `private, no-store` — a guest list with mobiles never sits in a shared cache.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await ctx.params;
  if (!isUuid(eventId)) return new NextResponse('Not found', { status: 404 });
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Sign in to download your guest list.', { status: 401 });
  const supabase = await createClient();

  const [viewer, eventRead] = await Promise.all([
    fetchEventViewer(supabase, eventId, user.id),
    supabase.from('events').select('display_name').eq('event_id', eventId).maybeSingle(),
  ]);
  if (!eventRead.data || viewerAreaLevel(viewer, 'guest_list') === null) {
    return new NextResponse('Not found', { status: 404 });
  }

  const [guestsRead, roleSetKey, roleNames, assignmentsRead, tablesRead] = await Promise.all([
    fetchGuestsByEventMeasured(supabase, eventId, { includePassedAway: true }),
    resolveRoleSetKeyForEvent(eventId),
    loadRoleNames(supabase, eventId, 'GuestsExport.roleNames'),
    measuredOr(fetchAssignments(supabase, eventId), [] as Awaited<ReturnType<typeof fetchAssignments>>, (e) =>
      logQueryError('GuestsExport.assignments', e, { event_id: eventId }, 'graceful_degrade'),
    ),
    measuredOr(fetchTables(supabase, eventId), [] as Awaited<ReturnType<typeof fetchTables>>, (e) =>
      logQueryError('GuestsExport.tables', e, { event_id: eventId }, 'graceful_degrade'),
    ),
  ]);
  if (!guestsRead.measured) {
    return new NextResponse(
      "We couldn't read your guest list just now, so nothing was downloaded. Nothing has been lost — try again in a moment.",
      { status: 503, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }

  const hasSides = eventHasSides(resolveRoleSet(roleSetKey));
  let tableByGuest: Record<string, string> | null = null;
  if (assignmentsRead.measured && tablesRead.measured) {
    const labelOf = new Map(tablesRead.value.map((t) => [t.table_id, t.table_label] as const));
    tableByGuest = {};
    for (const a of assignmentsRead.value) {
      const label = labelOf.get(a.table_id);
      if (label) tableByGuest[a.guest_id] = tableWords(label);
    }
  }
  const rows = [...guestsRead.rows].sort(
    (a, b) =>
      honoreeRank(a.role) - honoreeRank(b.role) ||
      a.last_name.localeCompare(b.last_name) ||
      a.first_name.localeCompare(b.first_name),
  );
  const csv = guestListCsv(rows, { hasSides, roleNames, tableByGuest });
  const name = guestListFileName((eventRead.data as { display_name?: string | null }).display_name);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'private, no-store',
    },
  });
}
