'use server';

/**
 * 🎛 "PICK WHAT SHOWS" — THE READ, ON THE TAP (owner 2026-10-25: the sheet chooses ONE stage — Save the Date ·
 * Invitation · The Day · Post Event). Reads the event's pin and the stage its date gives, nothing else; the WRITE is
 * the shipped `setLaunchPhase` (`website/editor/actions.ts`), the one the Maker's "Which version guests see" calls.
 *
 * 🔒 Hosts only — the gate `setLaunchPhase` itself uses (`requireHostMembership`), so the sheet never offers a choice
 * the viewer could not make. A failed read is said, never guessed (an unread pin is not "Automatic").
 */
import { createClient } from '@/lib/supabase/server';
import { requireHostMembershipOrThrow } from '@/lib/host-gate';
import { resolveHubStage } from '@/lib/event-hub-control';
import { manualLaunchPhase } from '@/lib/invitation-widgets';
import type { HomeHubPickRead } from './hub-pick-types';

export async function readHomeHubPick(eventId: string): Promise<HomeHubPickRead> {
  if (typeof eventId !== 'string' || eventId.length === 0) return { ok: false, reason: 'unread' };
  try {
    await requireHostMembershipOrThrow(eventId);
  } catch {
    return { ok: false, reason: 'not_host' };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('events')
    .select('launch_mode, manual_phase, event_date, event_end_date, cleared_at, timezone, slug, std_invitation_launch_date')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error || !data) return { ok: false, reason: 'unread' };
  const e = data as Record<string, string | null>;
  return {
    ok: true,
    pinned: manualLaunchPhase(e.launch_mode, e.manual_phase),
    byDate: resolveHubStage({
      measured: true,
      eventDate: e.event_date ?? null,
      eventEndDate: e.event_end_date ?? null,
      clearedAt: e.cleared_at ?? null,
      timezone: e.timezone ?? null,
      slug: e.slug ?? null,
      invitationLaunchDate: e.std_invitation_launch_date ?? null,
    }),
  };
}
