import type { SupabaseClient } from '@supabase/supabase-js';
import { makerStagesStudioEnabled } from '@/lib/maker-stages-studio-flag';
import { eventHostIsInternal } from '@/lib/entitlements';

/**
 * 🧭 THE NEW MAKER'S GUEST SIDE — ON FOR THIS EVENT? (plan
 * `EVENT_HUB_MAKER_STAGES_STUDIO_BUILD_PLAN_2026-10-06.md` §3 PR 6: the four
 * per-guest parts on Invitation › Me, the Reply card, the full-screen camera
 * with its three looks.)
 *
 * The same switch as the Maker (`makerStagesStudioEnabled`, "nothing reaches
 * couples until you switch it on") — but a guest is never internal, so on the
 * guest side "internal" is the EVENT'S HOST: an internal (§10a) host's events
 * (the owner's test weddings) show what their Maker makes, and every real
 * couple's guests keep today's page, byte for byte, until the flag is on.
 *
 * The host read is the shipped SECURITY DEFINER `event_host_is_internal`
 * (`eventHostIsInternal`), asked only when the env flag is off, and false on a
 * failed read — a failure leaves the shipped page, never a half-new one.
 */
export async function guestStagesOn(supabase: SupabaseClient, eventId: string | null | undefined): Promise<boolean> {
  if (makerStagesStudioEnabled({ internal: false })) return true;
  if (!eventId) return false;
  return makerStagesStudioEnabled({ internal: await eventHostIsInternal(supabase, eventId).catch(() => false) });
}
