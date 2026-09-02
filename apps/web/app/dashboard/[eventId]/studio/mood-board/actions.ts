'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { RECEPTION_PARTS } from '@/lib/reception-scene';

/**
 * Persist the couple's reception design (per-part, per-attribute material
 * choices) to events.reception_design (migration 20261002000000). Mood Board
 * Phase 2/3. Nested shape { part: { attribute: optionId } }. Sanitizes against
 * the known parts/attributes/options so only valid choices land.
 */
export async function saveReceptionDesign(
  eventId: string,
  design: Record<string, Record<string, string>>,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const clean: Record<string, Record<string, string>> = {};
  for (const part of RECEPTION_PARTS) {
    const pd = design[part.id];
    if (!pd || typeof pd !== 'object') continue;
    const cp: Record<string, string> = {};
    for (const attr of part.attributes) {
      const v = pd[attr.id];
      if (v && attr.options.some((o) => o.id === v)) cp[attr.id] = v;
    }
    if (Object.keys(cp).length > 0) clean[part.id] = cp;
  }

  // RLS enforces host-only writes on their own events via event_members.
  const { error } = await supabase
    .from('events')
    .update({
      reception_design: clean,
      mood_board_updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/studio/mood-board`);
}

export async function saveRolePalette(formData: FormData) {
  const eventId = formData.get('event_id');
  const paletteJson = formData.get('palette_json');
  if (typeof eventId !== 'string' || typeof paletteJson !== 'string') {
    throw new Error('Invalid input');
  }

  let parsed: unknown = {};
  try {
    parsed = JSON.parse(paletteJson);
  } catch {
    throw new Error('Palette payload was not valid JSON');
  }
  const sanitized = sanitizeRolePalette(parsed);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('events')
    .update({
      role_palette: sanitized,
      mood_board_updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}`, 'layout');
}

export type MoodboardSlotRef = { slotKey: string; slotPosition: 1 | 2 };

/**
 * Swap the images occupying two inspiration-board cells — the drag-reorder
 * affordance on the redesigned canvas (Mood Board redesign, 2026-09-02).
 * Works within one slot (swap its two positions) or across slots (move an
 * image from one named slot into another), since every slot has exactly two
 * fixed positions and no new schema is needed to express "swap what's here".
 *
 * Implementation note: `event_inspiration_assets` enforces
 * UNIQUE(event_id, slot_key, slot_position) WHERE removed_at IS NULL, so a
 * straight two-row UPDATE swap can collide mid-flight. This does it in three
 * steps via a temporary negative slot_position, which never collides with a
 * real (positive) position — same "two round trips is fine for this" trade-off
 * this file already makes elsewhere (see saveAttireGuidePaletteColor's old
 * read-modify-write, now removed, and uploadMoodboardSlot's soft-delete step).
 * Either or both cells may be empty; a no-op (same cell) returns immediately.
 */
export async function reorderMoodboardSlot(
  eventId: string,
  from: MoodboardSlotRef,
  to: MoodboardSlotRef,
): Promise<void> {
  if (from.slotKey === to.slotKey && from.slotPosition === to.slotPosition) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const findActive = (ref: MoodboardSlotRef) =>
    supabase
      .from('event_inspiration_assets')
      .select('inspiration_id')
      .eq('event_id', eventId)
      .eq('slot_key', ref.slotKey)
      .eq('slot_position', ref.slotPosition)
      .is('removed_at', null)
      .maybeSingle();

  const [{ data: fromRow, error: fromErr }, { data: toRow, error: toErr }] = await Promise.all([
    findActive(from),
    findActive(to),
  ]);
  if (fromErr) throw new Error(fromErr.message);
  if (toErr) throw new Error(toErr.message);
  if (!fromRow) return; // nothing to move

  // 1. Park `from` at a temp negative position so it can never collide with
  //    the real (positive) position `to` is about to vacate.
  const tempPosition = -1;
  const { error: parkErr } = await supabase
    .from('event_inspiration_assets')
    .update({ slot_position: tempPosition })
    .eq('inspiration_id', fromRow.inspiration_id);
  if (parkErr) throw new Error(parkErr.message);

  // 2. If the destination was occupied, move that image into the vacated
  //    `from` cell.
  if (toRow) {
    const { error: swapErr } = await supabase
      .from('event_inspiration_assets')
      .update({ slot_key: from.slotKey, slot_position: from.slotPosition })
      .eq('inspiration_id', toRow.inspiration_id);
    if (swapErr) throw new Error(swapErr.message);
  }

  // 3. Land `from`'s image in the destination cell.
  const { error: landErr } = await supabase
    .from('event_inspiration_assets')
    .update({ slot_key: to.slotKey, slot_position: to.slotPosition })
    .eq('inspiration_id', fromRow.inspiration_id);
  if (landErr) throw new Error(landErr.message);

  revalidatePath(`/dashboard/${eventId}/studio/mood-board`);
}

const THEME_NAME_MAX = 80;
const THEME_DESCRIPTION_MAX = 280;

/**
 * Save the couple's "Overall Theme" name + description (Mood Board redesign,
 * 2026-09-02). Schema columns: events.moodboard_theme_name / _description
 * (migration 20271193183599). Follows the exact validation/auth pattern of
 * saveRolePalette / saveReceptionDesign above — RLS-gated via the user's own
 * supabase client, never the admin client.
 */
export async function saveMoodboardTheme(
  eventId: string,
  theme: { name: string; description: string },
): Promise<void> {
  const name = theme.name.trim().slice(0, THEME_NAME_MAX);
  const description = theme.description.trim().slice(0, THEME_DESCRIPTION_MAX);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // RLS enforces host-only writes on their own events via event_members.
  const { error } = await supabase
    .from('events')
    .update({
      moodboard_theme_name: name || null,
      moodboard_theme_description: description || null,
      mood_board_updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/studio/mood-board`);
}

/**
 * "Share with vendors" — pings every booked marketplace vendor on the event
 * that the couple's Mood Board is ready for their eyes (Mood Board · Surface B,
 * 2026-06-28).
 *
 * Free convenience layer, no paywall: a booked vendor ALREADY has read access to
 * the board via the get_vendor_mood_board SECURITY DEFINER RPC. This action just
 * drops an in-app notification per booked vendor deep-linking to that read-only
 * view, so the couple doesn't have to chase them down a chat thread.
 *
 * "Booked" mirrors the RPC's gate EXACTLY: any event_vendors row for this event
 * whose marketplace_vendor_id is non-null (no status filter — same as the RPC's
 * `EXISTS (… WHERE marketplace_vendor_id = vendor_profile_id)`). V1 default is
 * all-booked; no category filtering (locked).
 *
 * RLS: the host-scope read on event_vendors is enforced by the caller's session
 * (the host owns this event). Vendor user_id resolution + the notification
 * insert go through the service-role admin client (vendor_profiles + notifications
 * are not host-readable), mirroring the booking_confirmed emit in
 * dashboard/[eventId]/vendors/actions.ts. Returns the count so the page can toast
 * "Shared with N vendors".
 */
export async function shareMoodBoardWithVendors(
  eventId: string,
): Promise<{ sharedCount: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Host-scoped read: RLS only returns event_vendors rows for events the caller
  // is a member of, so this both authorizes the action and gathers the targets.
  const { data: vendorRows, error: vendorErr } = await supabase
    .from('event_vendors')
    .select('marketplace_vendor_id')
    .eq('event_id', eventId)
    .not('marketplace_vendor_id', 'is', null);
  if (vendorErr) throw new Error(vendorErr.message);

  // Distinct profiles — one vendor can hold several event_vendors rows (one per
  // category), but we ping them once.
  const profileIds = Array.from(
    new Set(
      (vendorRows ?? [])
        .map((r) => r.marketplace_vendor_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  if (profileIds.length === 0) return { sharedCount: 0 };

  // Resolve each booked vendor profile to its account user_id + grab the event
  // display name for the notification copy. vendor_profiles + the notification
  // insert are not host-readable, so this goes through the admin client.
  const admin = createAdminClient();
  const [{ data: profiles }, { data: eventRow }] = await Promise.all([
    admin
      .from('vendor_profiles')
      .select('vendor_profile_id, user_id')
      .in('vendor_profile_id', profileIds),
    admin
      .from('events')
      .select('display_name')
      .eq('event_id', eventId)
      .maybeSingle(),
  ]);

  const eventDisplay =
    (eventRow as { display_name: string | null } | null)?.display_name ?? 'A couple';

  const userIds = Array.from(
    new Set(
      (profiles ?? [])
        .map((p) => (p as { user_id: string | null }).user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  // Best-effort fan-out — emitNotification fails soft internally, so one vendor's
  // hiccup never blocks the rest. sharedCount reflects vendors we attempted to
  // notify (those with a resolvable account), which drives the couple's toast.
  await Promise.all(
    userIds.map((vendorUserId) =>
      emitNotification({
        userId: vendorUserId,
        type: 'mood_board_share',
        title: `${eventDisplay} shared their mood board`,
        body: `${eventDisplay} shared their mood board with you — open it to align your styling, decor, or booth to their palette and reception design.`,
        relatedUrl: `/vendor-dashboard/clients/${eventId}/mood-board`,
      }),
    ),
  );

  return { sharedCount: userIds.length };
}
