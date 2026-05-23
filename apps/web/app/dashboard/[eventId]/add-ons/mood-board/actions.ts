'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { sanitizeRolePalette } from '@/lib/mood-board';

export type MoodboardSelectionInput = {
  eventId: string;
  pillar: 'location_feel' | 'dress_codes';
  pillarSlot: string;
  assetId: string;
  paletteSnapshot: Record<string, string>;
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

  revalidatePath(`/dashboard/${input.eventId}/add-ons/mood-board`);
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

  revalidatePath(`/dashboard/${eventId}/add-ons/mood-board`);
}
