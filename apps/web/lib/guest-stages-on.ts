import type { SupabaseClient } from '@supabase/supabase-js';
import { envFlagEnabled } from '@/lib/env-flag';
import { eventHostIsInternal } from '@/lib/entitlements';

/**
 * 🧭 THE MAKER'S GUEST SIDE — ON FOR THIS EVENT? (plan
 * `EVENT_HUB_MAKER_STAGES_STUDIO_BUILD_PLAN_2026-10-06.md` §3 PR 6: the four
 * per-guest parts on Invitation › Me, the Reply card, the full-screen camera
 * with its three looks.)
 *
 * ⚠ THIS IS THE GUEST SIDE ONLY. The Maker itself is no longer switched — there
 * is one Maker, for every couple (owner 2026-10-25; `lib/there-is-one-maker.test.ts`).
 * What a GUEST is shown kept its own switch, unchanged: the same env variable the
 * Maker used to read (`NEXT_PUBLIC_MAKER_STAGES_STUDIO_ENABLED`, so production's
 * value keeps meaning what it meant), or an internal (§10a) HOST — a guest is
 * never internal, so on the guest side "internal" is the event's host: the
 * owner's test weddings show what their Maker makes, and every other event's
 * guests keep today's page until the variable is on. Whether guests follow the
 * Maker is the owner's call, not this file's.
 *
 * The host read is the shipped SECURITY DEFINER `event_host_is_internal`
 * (`eventHostIsInternal`), asked only when the env flag is off, and false on a
 * failed read — a failure leaves the shipped page, never a half-new one.
 *
 * ONE reader of the variable (`lib/flag-chokepoint-scan.test.ts`).
 */
export function guestStagesFlagOn(): boolean {
  return envFlagEnabled(process.env.NEXT_PUBLIC_MAKER_STAGES_STUDIO_ENABLED);
}

export async function guestStagesOn(supabase: SupabaseClient, eventId: string | null | undefined): Promise<boolean> {
  if (guestStagesFlagOn()) return true;
  if (!eventId) return false;
  return (await eventHostIsInternal(supabase, eventId).catch(() => false)) === true;
}
