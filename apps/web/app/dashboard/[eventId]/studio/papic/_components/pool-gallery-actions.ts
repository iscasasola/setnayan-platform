'use server';

/**
 * Shared Pool Gallery — the open/close action behind Memories ⚙ › **Who sees what** (OnTheDay build ⑥; renamed by
 * the owner 2026-10-30: closed = **Only tagged**, the default · open = **Share all memories** — `lib/memories-rules.ts`).
 *
 * 👥 HOSTS + COORDINATORS (owner 2026-10-30, DECISION_LOG "MEMORIES ⚙ HOLDS THE MEMORIES RULES — HOSTS + COORDINATORS
 * MANAGE THEM"): the couple, every co-host, and the event's coordinator (a booked coordinator supplier or one added
 * by hand) — never a guest, another supplier or a limited helper. ⚠ SUPERSEDES the earlier COUPLE-ONLY lock on this
 * action ("a coordinator gets 'forbidden'"): the owner widened it to the coordinator on 2026-10-30. Gated HERE, on
 * the server — the dropdown is drawn only for the same people, but hiding a control is not a refusal:
 *   1. `limitedHelperRefusal(eventId, null)` — null = no area: a limited helper is refused whatever they were given;
 *   2. `memoriesManagerRole` — host or live coordinator seat, or 'forbidden'.
 * Then written with the admin client (the events UPDATE policy is couple-or-admin, so a coordinator's own session
 * could not write it; the explicit gate above is the authority, exactly as before).
 *
 * Closing is RETROACTIVE: the guest_pool_gallery RPC re-checks
 * events.pool_gallery_open on every read, so flipping OFF empties the pool
 * (and kills self-linking) on the very next request.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { papicPoolGalleryActive } from '@/lib/papic-pool-gate';
import { limitedHelperRefusal } from '@/lib/host-gate';
import { memoriesManagerRole } from '@/lib/memories-rules.server';

type ActionResult = { ok: true; open: boolean } | { ok: false; error: string };

export async function setPoolGalleryOpen(
  eventId: string,
  open: boolean,
): Promise<ActionResult> {
  const helperRefusal = await limitedHelperRefusal(eventId, null);
  if (helperRefusal) return { ok: false, error: helperRefusal };
  if (!(await papicPoolGalleryActive())) return { ok: false, error: 'unavailable' };
  const clean = eventId?.trim();
  if (!clean) return { ok: false, error: 'missing_event' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  // HOSTS + COORDINATOR only — the one rule (`memoriesManagerRoleOf`); a failed read is a refusal, never a pass.
  if (!(await memoriesManagerRole(supabase, clean, user.id))) {
    return { ok: false, error: 'forbidden' };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('events')
    .update({ pool_gallery_open: open === true })
    .eq('event_id', clean)
    .select('event_id');
  if (error) return { ok: false, error: error.message.slice(0, 80) };
  // 0-row update (event vanished / column missing pre-migration) is NOT success.
  if (!data || data.length === 0) return { ok: false, error: 'not_saved' };

  revalidatePath(`/dashboard/${clean}/memories`); // the gallery lives in Memories
  return { ok: true, open: open === true };
}
