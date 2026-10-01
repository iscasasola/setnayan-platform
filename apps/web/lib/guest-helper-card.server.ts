import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { ModeratorPermissions } from '@/lib/event-moderators';
import { seatIsFullCohost, ACCESS_LEVEL_LABEL } from '@/lib/guest-access';
import { loadCoordinatorColourGrantees, type ColourGrantee } from '@/lib/colour-access.server';
import { fetchDelegateActivity } from '@/lib/delegate-activity.server';
import type { DelegateActivityLine } from '@/lib/delegate-activity';

/**
 * What a LIMITED HELPER's guest card carries beyond the Access line — the Hosts
 * pieces that moved onto it in the Hosts fold (owner 2026-09-30, DECISION_LOG
 * "GUEST LIST: ACCESS + CHECK-IN BECOME COLUMNS; HOSTS FOLDS INTO THE GUEST
 * LIST"; build F2). Nothing here is new: the seat's grants
 * (`permissions_json`), their colour domains (`loadCoordinatorColourGrantees`,
 * the one assembly the planner's workspace also uses) and what they did
 * (`fetchDelegateActivity`, the Overview feed's own read, narrowed to them).
 *
 * 🔑 CONTROL ENDS, THE RECORD STAYS (owner, "HOSTS FOLD — THREE OWNER ANSWERS"
 * (1)): *"when no more host. then no more control. it will just be archive
 * files that people can track in the future for reference."* So the grants and
 * colours are drawn only for a CURRENT limited-helper seat, while their activity
 * is read from ANY seat this guest row ever held — read-only, never actionable.
 *
 * Couple only: the caller asks this only when the viewer may manage Access.
 * Admin client, as every host door reads `event_moderators` (restrictive RLS).
 * ⚠ `measured` is carried: a refused read says so, never "nothing".
 */
export type GuestHelperCard = {
  measured: boolean;
  /** Their CURRENT limited-helper seat, or null (none, a co-host, or ended). */
  seat: { moderatorId: string; permissions: ModeratorPermissions | null; live: boolean } | null;
  /** Their colour domains — only while the seat is live (a coordinator member exists then). */
  colour: ColourGrantee | null;
  /** What they did while they had access; null when no account ever held a seat here. */
  activity: { measured: boolean; lines: DelegateActivityLine[] } | null;
};

type SeatRow = {
  moderator_id: string;
  user_id: string | null;
  role_subtype: string;
  permissions_json: ModeratorPermissions | null;
  removed_at: string | null;
};

export async function loadGuestHelperCard(input: {
  eventId: string;
  guestId: string;
  viewerUserId: string;
  displayName: string;
}): Promise<GuestHelperCard> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('event_moderators')
    .select('moderator_id, user_id, role_subtype, permissions_json, removed_at, created_at')
    .eq('event_id', input.eventId)
    .eq('guest_id', input.guestId)
    .order('created_at', { ascending: false });
  if (error) {
    logQueryError('loadGuestHelperCard.seats', error, { eventId: input.eventId }, 'graceful_degrade');
    return { measured: false, seat: null, colour: null, activity: null };
  }
  const seats = (data ?? []) as SeatRow[];
  const current = seats.find((s) => !s.removed_at) ?? null;
  const helper = current && !seatIsFullCohost(current.role_subtype) ? current : null;

  let colour: ColourGrantee | null = null;
  let colourMeasured = true;
  if (helper?.user_id) {
    const res = await loadCoordinatorColourGrantees(
      admin,
      input.eventId,
      [{ user_id: helper.user_id, role_subtype: helper.role_subtype, displayName: input.displayName, roleLine: ACCESS_LEVEL_LABEL.limited_helper }],
      input.viewerUserId,
    );
    colourMeasured = res.measured;
    colour = res.grantees[0] ?? null;
  }

  // The record outlives the access: any account that ever held this row's seat.
  const actor = current?.user_id ?? seats.find((s) => s.user_id)?.user_id ?? null;
  const activity = actor ? await fetchDelegateActivity(admin, input.eventId, 10, actor) : null;

  return {
    measured: colourMeasured,
    seat: helper ? { moderatorId: helper.moderator_id, permissions: helper.permissions_json, live: Boolean(helper.user_id) } : null,
    colour,
    activity,
  };
}
