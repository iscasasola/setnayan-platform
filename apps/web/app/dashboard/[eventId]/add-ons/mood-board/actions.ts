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
