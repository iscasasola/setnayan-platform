import type { SupabaseClient } from '@supabase/supabase-js';
import {
  COORDINATOR_AREAS,
  PERMISSION_TEMPLATES,
  generateInvitationToken,
  type ModeratorPermissions,
} from './event-moderators';

const INVITE_TTL_DAYS = 7;
const MS_PER_DAY = 86_400_000;

// Auto-grant a coordinator delegate (owner 2026-06-22): the moment a booked
// planner_coordinator's downpayment is marked, auto-create the SAME pending
// delegate the manual "Promote your coordinator" makes — role
// wedding_planner_external with the COORDINATOR_AREAS grants (full planning edit ·
// mood board view · budget OFF). The coordinator activates it via the existing
// /host/accept flow, so access is never granted without their acceptance.
//
// Idempotent: skips if an active (non-removed) wedding-planner row for this event
// already covers this coordinator (same invitation email, case-insensitive) — so
// re-marking the payment, or a couple who already clicked Promote, never spawns a
// duplicate invite. Requires an ADMIN client (writes event_moderators directly,
// bypassing RLS like inviteHost). Best-effort by contract — callers wrap this so a
// failure never blocks the booking-status write that triggered it.
export async function autoInviteCoordinator(
  admin: SupabaseClient,
  params: {
    eventId: string;
    email: string;
    displayLabel: string | null;
    invitedByUserId: string;
  },
): Promise<{ created: boolean }> {
  const email = params.email.trim().toLowerCase();
  if (!email) return { created: false };

  // Dedupe against any active wedding-planner delegate already covering this email.
  const { data: existing } = await admin
    .from('event_moderators')
    .select('invitation_email')
    .eq('event_id', params.eventId)
    .eq('role_subtype', 'wedding_planner_external')
    .is('removed_at', null);
  const already = (existing ?? []).some(
    (r) => (r as { invitation_email: string | null }).invitation_email?.trim().toLowerCase() === email,
  );
  if (already) return { created: false };

  const now = new Date();
  const permissions: ModeratorPermissions = {
    ...PERMISSION_TEMPLATES.wedding_planner_external,
    areas: { ...COORDINATOR_AREAS },
  };
  const { error } = await admin.from('event_moderators').insert({
    event_id: params.eventId,
    user_id: null,
    role_subtype: 'wedding_planner_external',
    display_label: params.displayLabel,
    permissions_json: permissions,
    invited_by_user_id: params.invitedByUserId,
    invitation_email: email,
    invitation_phone: null,
    invitation_sent_at: now.toISOString(),
    invitation_expires_at: new Date(now.getTime() + INVITE_TTL_DAYS * MS_PER_DAY).toISOString(),
    invitation_token: generateInvitationToken(),
    accepted_at: null,
  });
  return { created: !error };
}
