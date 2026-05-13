'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { sanitizeRolePalette } from '@/lib/mood-board';
import type { RoleGroup } from '@/lib/role-groups';

const KEYS: ReadonlyArray<RoleGroup> = [
  'wedding_party',
  'principal_sponsors',
  'secondary_sponsors',
  'bearers_flower_girl',
  'officiants',
  'other_roles',
];

export async function saveRolePalette(formData: FormData) {
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string') throw new Error('Invalid event');

  const raw: Record<string, unknown> = {};
  for (const key of KEYS) {
    const v = formData.get(key);
    if (typeof v === 'string' && v.length > 0) {
      raw[key] = v;
    }
  }
  const sanitized = sanitizeRolePalette(raw);

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
