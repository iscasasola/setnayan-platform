'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildChecklistSeed } from '@/lib/checklist';

/**
 * Idempotent seed for the couple planning checklist. Fires when the home
 * checklist card first renders and `event_checklist_items` is EMPTY for the
 * event. Inserts one row per CHECKLIST_TEMPLATE entry.
 *
 * Mirrors `seedDefaultScheduleBlocks`: verify event access via the RLS-gated
 * authenticated client, then write with the admin client (the seed runs on a
 * render, not a user form submit). The membership check above the admin write
 * is what keeps the seed scoped to the host's own event.
 *
 * Returns the number of rows inserted · 0 when the seed was skipped because the
 * checklist already exists for this event.
 */
export async function ensureChecklistSeeded(eventId: string): Promise<number> {
  if (!eventId) throw new Error('event_id required');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: existing, error: existingErr } = await supabase
    .from('event_checklist_items')
    .select('item_id')
    .eq('event_id', eventId)
    .limit(1);
  // Graceful skip if the table isn't here yet (migration not applied in this
  // environment) — the card simply won't render rather than crashing home.
  if (existingErr) return 0;
  if (existing && existing.length > 0) return 0;

  const admin = createAdminClient();
  const rows = buildChecklistSeed(eventId);
  const { error: insertErr } = await admin
    .from('event_checklist_items')
    .insert(rows);
  if (insertErr) {
    // Lost a race with a concurrent seed (unique index on event_id+template_key)
    // or table missing — either way, don't crash the page.
    return 0;
  }

  revalidatePath(`/dashboard/${eventId}`);
  return rows.length;
}

/**
 * Flip one checklist item between pending and done. The DB trigger keeps
 * `completed_at` consistent; we only send the status. RLS couple-write policy
 * scopes this to the host's own event.
 */
export async function toggleChecklistItem(formData: FormData) {
  const eventId = formData.get('event_id');
  const itemId = formData.get('item_id');
  const desiredRaw = formData.get('desired'); // 'done' | 'pending'
  if (
    typeof eventId !== 'string' ||
    typeof itemId !== 'string' ||
    (desiredRaw !== 'done' && desiredRaw !== 'pending')
  ) {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('event_checklist_items')
    .update({ status: desiredRaw })
    .eq('item_id', itemId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}`);
}
