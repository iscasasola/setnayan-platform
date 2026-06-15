'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildChecklistSeed } from '@/lib/checklist';

/**
 * Idempotent TOP-UP seed for the couple planning checklist. Fires when the home
 * checklist card (or the full /checklist page) renders. Inserts any template
 * rows the event is MISSING — so a brand-new event gets the whole list, and an
 * event seeded under an older/shorter template gains the new tasks without
 * touching the couple's existing rows or their done-state.
 *
 * Tailoring: church-only steps are skipped for a non-church ceremony_type (the
 * free deterministic "Setnayan AI" personalization). Couple-completed and
 * custom (null-key) rows are always preserved — the diff is keyed on
 * template_key, which custom items don't have.
 *
 * Mirrors `seedDefaultScheduleBlocks`: read access via the RLS-gated
 * authenticated client, then write with the admin client (this runs on a
 * render, not a user form submit). The membership-gated read above the admin
 * write keeps the seed scoped to the host's own event.
 *
 * Returns the number of rows inserted · 0 when nothing was missing (or on any
 * graceful-degrade path, e.g. the migration hasn't reached this environment).
 */
export async function ensureChecklistSeeded(eventId: string): Promise<number> {
  if (!eventId) throw new Error('event_id required');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Which template keys does this event already have? (RLS-scoped read.)
  const { data: existingRows, error: existingErr } = await supabase
    .from('event_checklist_items')
    .select('template_key')
    .eq('event_id', eventId);
  // Graceful skip if the table isn't here yet — the card simply won't render
  // rather than crashing home.
  if (existingErr) return 0;

  // Ceremony type drives the deterministic tailoring. A read error just means
  // no filtering (keep every task) — never block the seed on it.
  const { data: eventRow } = await supabase
    .from('events')
    .select('ceremony_type')
    .eq('event_id', eventId)
    .maybeSingle();
  const ceremonyType = (eventRow?.ceremony_type as string | null | undefined) ?? null;

  const existingKeys = new Set(
    (existingRows ?? [])
      .map((r) => (r as { template_key: string | null }).template_key)
      .filter((k): k is string => k != null),
  );

  const missing = buildChecklistSeed(eventId, ceremonyType).filter(
    (row) => row.template_key != null && !existingKeys.has(row.template_key),
  );
  if (missing.length === 0) return 0;

  const admin = createAdminClient();
  const { error: insertErr } = await admin.from('event_checklist_items').insert(missing);
  if (insertErr) {
    // Lost a race with a concurrent top-up (unique index on event_id+template_key)
    // or table missing — either way, don't crash the page.
    return 0;
  }

  revalidatePath(`/dashboard/${eventId}`);
  return missing.length;
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
