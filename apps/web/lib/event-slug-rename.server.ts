import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { findSlugConflict } from '@/lib/slug-availability';
import { clearHomeShelf } from '@/lib/home-shelf-clear';
import { SLUG_SHAPE } from '@/lib/hub-draft';

/**
 * apps/web/lib/event-slug-rename.server.ts — THE ONE RENAME of an event's address (lifted out of `updateEventSlug`,
 * `invitation/actions.ts`, unchanged in what it does, 2026-10-22) so the Maker's ✓ Apply can put a drafted custom
 * address live through exactly the same door (owner 2026-10-22: "a rename keeps the old link forwarding").
 *
 *   · the shape (3–32 small letters, digits, hyphens) and `findSlugConflict` — reserved words, taken, shop and handle
 *     names, retired addresses still forwarding;
 *   · the update on the CALLER's session (RLS), with `.select()` — a zero-row update is a refusal, never "saved";
 *   · the old address logged in `slug_change_log`, which is what keeps it forwarding (and, since 2026-10-22, the proof
 *     an event renamed before parts shipped — grandfathered).
 *
 * 🔒 It does NOT decide who may rename — the Custom address part is the caller's question (`eventHubPartActive`).
 */
export async function renameEventSlug(
  supabase: SupabaseClient,
  eventId: string,
  requestedRaw: string,
  userId: string | null,
): Promise<{ ok: true; changed: boolean } | { ok: false; reason: string }> {
  const requested = requestedRaw.trim().toLowerCase();
  if (!requested || !SLUG_SHAPE.test(requested)) return { ok: false, reason: 'invalid_format' };
  const admin = createAdminClient();
  const conflict = await findSlugConflict(admin, requested, { eventId });
  if (conflict) return { ok: false, reason: conflict };
  const { data: existing } = await admin.from('events').select('slug').eq('event_id', eventId).maybeSingle();
  if (existing?.slug === requested) return { ok: true, changed: false };
  const { data: updatedRows, error: updateErr } = await supabase
    .from('events')
    .update({ slug: requested, updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .select('event_id');
  // The home page remembers this for 60 s — forget it now (lib/home-shelf-clear.ts).
  clearHomeShelf('events');
  if (updateErr) return { ok: false, reason: updateErr.message };
  if (!updatedRows || updatedRows.length === 0) return { ok: false, reason: 'We couldn’t save that address. Please refresh and try again.' };
  if (existing?.slug && existing.slug !== requested) {
    // The forwarding row keeps the old link working; a failed insert is logged (the rename itself already stands).
    const { error: logErr } = await admin.from('slug_change_log').insert({
      entity_type: 'event',
      entity_id: eventId,
      old_slug: existing.slug,
      new_slug: requested,
      changed_by: userId,
    });
    if (logErr) console.error('[slug-rename] the old address will not forward:', eventId, logErr.message);
  }
  return { ok: true, changed: true };
}

/**
 * 💎 GRANDFATHERED (owner 2026-10-22): an event that renamed its address before the Custom address part existed keeps
 * that address free — its row in `slug_change_log` is the proof (no new column). A further rename asks for the part.
 * (Nothing is ever taken away: the address an event has stays whatever it holds; this only lets the field say so.)
 * False on a refused read — then the field simply shows the address as free.
 */
export async function eventHasRenamed(eventId: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from('slug_change_log')
    .select('id')
    .eq('entity_type', 'event')
    .eq('entity_id', eventId)
    .limit(1);
  if (error) return false;
  return (data ?? []).length > 0;
}
