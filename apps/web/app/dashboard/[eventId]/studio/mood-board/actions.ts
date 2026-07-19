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

export type MoodboardSelectionInput = {
  eventId: string;
  // 'florals' added 2026-06-08 (mood-board redesign — Flowers chapter).
  pillar: 'location_feel' | 'dress_codes' | 'florals';
  pillarSlot: string;
  assetId: string;
  // JSONB. Carries either the legacy { slot: "#hex" } shape OR the redesign's
  // self-describing MoodboardSnapshot ({ slot: { def, edit } }) from the
  // Recolor Studio. Stored verbatim; parsed back via parseSnapshot on read.
  paletteSnapshot: Record<string, unknown>;
};

export async function saveMoodboardSelection(
  input: MoodboardSelectionInput,
): Promise<{ saveId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // RLS enforces host-only writes on their own events via event_members.
  const { data, error } = await supabase
    .from('event_moodboard_saves')
    .upsert(
      {
        event_id: input.eventId,
        pillar: input.pillar,
        pillar_slot: input.pillarSlot,
        asset_id: input.assetId,
        palette_snapshot: input.paletteSnapshot,
        saved_at: new Date().toISOString(),
      },
      { onConflict: 'event_id,pillar,pillar_slot' },
    )
    .select('save_id')
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${input.eventId}/studio/mood-board`);
  return { saveId: data.save_id as string };
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

/**
 * Save a single role's attire color on the Wedding Attire Guide mockup.
 * Owner directive 2026-05-23 PM: "we want the capability to change the
 * color of the attires of each role." Per-role color picker on the
 * mockup fires this action on every color change so the host's pick
 * survives a page reload AND the V1.x Professional Mood Board engine
 * has the colors as Higgsfield prompt inputs.
 *
 * Schema column: events.attire_guide_palette JSONB (migration
 * 20260610010000). Stored as { [roleKey]: "#RRGGBB" }. This action
 * does a JSONB merge — preserves existing keys, sets only the one
 * the host just changed.
 *
 * Validation:
 *   - roleKey must be one of the 10 canonical keys from the mockup
 *   - hex must match #RRGGBB or #RGB (3-or-6 hex digits)
 * Failures throw — the client's optimistic UI rolls back on catch.
 */
const ALLOWED_ROLE_KEYS = new Set([
  'female_ps',
  'male_ps',
  'mothers',
  'fathers',
  'bridesmaids',
  'bride',
  'groom',
  'groomsmen',
  'guests',
  'men_guests',
]);
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export async function saveAttireGuidePaletteColor(
  eventId: string,
  roleKey: string,
  hex: string,
): Promise<void> {
  if (!ALLOWED_ROLE_KEYS.has(roleKey)) {
    throw new Error(`Invalid attire role key: ${roleKey}`);
  }
  if (!HEX_RE.test(hex)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Read-modify-write the JSONB column. Two round trips is fine for a
  // single-color save; debounce on the client side keeps this cheap
  // even when the host drags the color picker. RLS enforces host-only
  // writes via event_members on the events table.
  const { data: existing, error: readErr } = await supabase
    .from('events')
    .select('attire_guide_palette')
    .eq('event_id', eventId)
    .maybeSingle();

  if (readErr) throw new Error(readErr.message);

  const current =
    existing?.attire_guide_palette &&
    typeof existing.attire_guide_palette === 'object'
      ? (existing.attire_guide_palette as Record<string, string>)
      : {};

  const next = { ...current, [roleKey]: hex.toUpperCase() };

  const { error: updateErr } = await supabase
    .from('events')
    .update({
      attire_guide_palette: next,
      mood_board_updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId);

  if (updateErr) throw new Error(updateErr.message);

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
