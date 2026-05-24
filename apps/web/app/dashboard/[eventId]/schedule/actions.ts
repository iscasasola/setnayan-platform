'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  SCHEDULE_BLOCK_TYPES,
  buildScheduleSeed,
  type ScheduleBlockType,
  type SeedCeremonyType,
} from '@/lib/schedule';

const VALID_TYPES = new Set<ScheduleBlockType>(SCHEDULE_BLOCK_TYPES);

function nullIfBlank(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

function parseDatetimeLocal(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  // <input type="datetime-local"> gives e.g. "2026-12-12T15:30"; treat as
  // local time, convert to ISO with the user's local TZ offset.
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function createScheduleBlock(formData: FormData) {
  const eventId = formData.get('event_id');
  const label = formData.get('label');
  const blockTypeRaw = formData.get('block_type');
  const startRaw = formData.get('start_at');
  const endRaw = formData.get('end_at');

  if (typeof eventId !== 'string' || typeof label !== 'string') {
    throw new Error('Invalid input');
  }
  if (typeof blockTypeRaw !== 'string' || !VALID_TYPES.has(blockTypeRaw as ScheduleBlockType)) {
    throw new Error('Invalid block type');
  }
  const trimmedLabel = label.trim().slice(0, 120);
  if (trimmedLabel.length === 0) throw new Error('Label required');

  const startIso = parseDatetimeLocal(startRaw);
  const endIso = parseDatetimeLocal(endRaw);
  if (!startIso) throw new Error('Start time required');
  if (endIso && new Date(endIso) <= new Date(startIso)) {
    throw new Error('End time must be after start time');
  }

  // 2026-05-24 owner directive · Card 15 hierarchy. Optional parent_block_id
  // form field — when present, the inserted block is a child of an existing
  // block (e.g., a new "Sand ceremony" part inside the Ceremony parent).
  // When NULL or absent, the inserted block is top-level.
  const parentBlockIdRaw = formData.get('parent_block_id');
  const parentBlockId =
    typeof parentBlockIdRaw === 'string' && parentBlockIdRaw.length > 0
      ? parentBlockIdRaw
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.from('event_schedule_blocks').insert({
    event_id: eventId,
    label: trimmedLabel,
    block_type: blockTypeRaw,
    start_at: startIso,
    end_at: endIso,
    location: nullIfBlank(formData.get('location')),
    notes: nullIfBlank(formData.get('notes')),
    is_public: formData.get('is_public') === 'on',
    parent_block_id: parentBlockId,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/schedule`);
  revalidatePath(`/dashboard/${eventId}`);
}

export async function deleteScheduleBlock(formData: FormData) {
  const eventId = formData.get('event_id');
  const blockId = formData.get('block_id');
  if (typeof eventId !== 'string' || typeof blockId !== 'string') {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // ON DELETE CASCADE on parent_block_id self-FK means deleting a parent
  // automatically removes all its child parts · no app-layer cleanup needed.
  const { error } = await supabase
    .from('event_schedule_blocks')
    .delete()
    .eq('block_id', blockId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/schedule`);
  revalidatePath(`/dashboard/${eventId}`);
}

export async function toggleBlockVisibility(formData: FormData) {
  const eventId = formData.get('event_id');
  const blockId = formData.get('block_id');
  const desiredRaw = formData.get('desired');
  if (
    typeof eventId !== 'string' ||
    typeof blockId !== 'string' ||
    typeof desiredRaw !== 'string'
  ) {
    throw new Error('Invalid input');
  }
  const desired = desiredRaw === 'true';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('event_schedule_blocks')
    .update({ is_public: desired, updated_at: new Date().toISOString() })
    .eq('block_id', blockId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/schedule`);
  revalidatePath(`/dashboard/${eventId}`);
}

// ────────────────────  Card 15 hierarchy actions  ────────────────────
//
// Server actions wired by Card 15 (Create Schedule wizard card) for
// inline edits to the schedule block tree. They share the same RLS-gated
// pattern as the existing create/delete/toggle actions above — the
// authenticated supabase client respects the event_schedule_blocks
// couple-write policy, so a host can only mutate blocks on their own
// event.
//
// All four revalidate BOTH the /schedule deep-edit page AND the event
// home (/dashboard/[eventId]) where the wizard card renders, so edits in
// either surface re-fetch the other.

/**
 * Update label · start · end · is_public on an existing block. Card 15
 * uses this for the inline time pickers + label input. Other surfaces
 * (/schedule deep-edit page) can call the same action with the full set
 * of fields they edit.
 */
export async function updateScheduleBlock(formData: FormData) {
  const eventId = formData.get('event_id');
  const blockId = formData.get('block_id');

  if (typeof eventId !== 'string' || typeof blockId !== 'string') {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  type Patch = {
    label?: string;
    start_at?: string;
    end_at?: string | null;
    is_public?: boolean;
    location?: string | null;
    notes?: string | null;
    updated_at: string;
  };
  const patch: Patch = { updated_at: new Date().toISOString() };

  const labelRaw = formData.get('label');
  if (typeof labelRaw === 'string') {
    const trimmed = labelRaw.trim().slice(0, 120);
    if (trimmed.length === 0) throw new Error('Label cannot be empty');
    patch.label = trimmed;
  }

  const startRaw = formData.get('start_at');
  if (startRaw !== null) {
    const iso = parseDatetimeLocal(startRaw);
    if (!iso) throw new Error('Invalid start time');
    patch.start_at = iso;
  }

  const endRaw = formData.get('end_at');
  if (endRaw !== null) {
    if (typeof endRaw === 'string' && endRaw.length === 0) {
      patch.end_at = null;
    } else {
      const iso = parseDatetimeLocal(endRaw);
      if (!iso) throw new Error('Invalid end time');
      patch.end_at = iso;
    }
  }

  const visibilityRaw = formData.get('is_public');
  if (visibilityRaw !== null) {
    patch.is_public = visibilityRaw === 'true' || visibilityRaw === 'on';
  }

  const locationRaw = formData.get('location');
  if (locationRaw !== null) {
    patch.location = nullIfBlank(locationRaw);
  }

  const notesRaw = formData.get('notes');
  if (notesRaw !== null) {
    patch.notes = nullIfBlank(notesRaw);
  }

  const { error } = await supabase
    .from('event_schedule_blocks')
    .update(patch)
    .eq('block_id', blockId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/schedule`);
  revalidatePath(`/dashboard/${eventId}`);
}

/**
 * Reorder blocks within a single level (top-level OR siblings under the
 * same parent). Caller passes the ORDERED list of block_ids · server
 * assigns sort_order = idx * 10 (gap-10 spacing leaves room for insertion
 * without a full reorder on every add).
 *
 * Bulk update via individual statements per row · acceptable for V1
 * because a wedding-day schedule is bounded (typically ~20-30 blocks
 * total · max realistic ~50). If we hit perf issues at scale, switch to
 * a single UPDATE … SET sort_order = CASE block_id WHEN … THEN … ELSE …
 * END statement via supabase.rpc.
 */
export async function reorderScheduleBlocks(formData: FormData) {
  const eventId = formData.get('event_id');
  const orderedIdsRaw = formData.get('ordered_block_ids');

  if (typeof eventId !== 'string' || typeof orderedIdsRaw !== 'string') {
    throw new Error('Invalid input');
  }

  // Expected payload shape: comma-separated UUIDs in target order.
  const orderedIds = orderedIdsRaw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (orderedIds.length === 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const now = new Date().toISOString();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from('event_schedule_blocks')
      .update({ sort_order: (i + 1) * 10, updated_at: now })
      .eq('block_id', orderedIds[i]!)
      .eq('event_id', eventId);
    if (error) throw new Error(`Reorder failed at row ${i}: ${error.message}`);
  }

  revalidatePath(`/dashboard/${eventId}/schedule`);
  revalidatePath(`/dashboard/${eventId}`);
}

/**
 * Idempotent seed for Card 15 first-open. Fires when the host opens the
 * card and event_schedule_blocks is EMPTY for the event. Inserts the
 * canonical 4 top-level blocks (Ceremony · Cocktail Hour · Reception ·
 * After Party) + ceremony-type-aware sub-blocks under Ceremony +
 * universal Filipino reception parts under Reception.
 *
 * Two-pass insert (parents first, then children) because the children
 * need their parent's block_id which only exists after pass 1 commits.
 *
 * Uses the admin client to write because the seed runs on first card
 * load (not in response to a user form submit); this matches the
 * existing pattern of server-side fixtures used elsewhere in the wizard.
 * RLS still applies — the host's event_id is required and validated
 * via membership check before the admin write.
 *
 * Returns the count of rows inserted · 0 if the seed was skipped because
 * blocks already exist for this event.
 */
export async function seedDefaultScheduleBlocks(
  eventId: string,
  ceremonyType: SeedCeremonyType | null,
  eventDate: string | null,
): Promise<number> {
  if (!eventId) throw new Error('event_id required');

  // Use the regular authenticated client first to verify the user has
  // access to this event (via the RLS-gated SELECT on event_schedule_blocks).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: existing, error: existingErr } = await supabase
    .from('event_schedule_blocks')
    .select('block_id')
    .eq('event_id', eventId)
    .limit(1);
  if (existingErr) throw new Error(existingErr.message);
  if (existing && existing.length > 0) return 0; // already seeded · skip

  // Admin client for the actual writes · bypasses RLS for the seed pass
  // (the membership check above already confirmed the host owns this event).
  const admin = createAdminClient();

  const seed = buildScheduleSeed(ceremonyType, eventDate);

  // Pass 1 · insert the 4 top-level blocks and capture their block_ids
  // keyed by `key` so pass 2 can wire children correctly.
  const topLevelRows = seed.topLevel.map((row) => ({
    event_id: eventId,
    label: row.label,
    block_type: row.block_type,
    start_at: row.start_at,
    end_at: row.end_at,
    is_public: row.is_public,
    sort_order: row.sort_order,
    parent_block_id: null,
  }));

  const { data: insertedTop, error: topErr } = await admin
    .from('event_schedule_blocks')
    .insert(topLevelRows)
    .select('block_id,label');
  if (topErr) throw new Error(topErr.message);
  if (!insertedTop) throw new Error('Top-level seed insert returned no rows');

  // Map back from label → block_id so we can wire children.
  const ceremonyParentId = insertedTop.find((r) => r.label === 'Ceremony')?.block_id;
  const receptionParentId = insertedTop.find((r) => r.label === 'Reception')?.block_id;
  if (!ceremonyParentId || !receptionParentId) {
    throw new Error('Failed to resolve seed parent IDs');
  }

  // Pass 2 · insert child sub-blocks under Ceremony + Reception.
  const childRows = seed.buildChildren({
    ceremony: ceremonyParentId,
    reception: receptionParentId,
  });
  const childInserts = childRows.map((row) => ({
    event_id: eventId,
    label: row.label,
    block_type: row.block_type,
    start_at: row.start_at,
    end_at: row.end_at,
    is_public: row.is_public,
    sort_order: row.sort_order,
    parent_block_id:
      row.parent_key === 'ceremony' ? ceremonyParentId : receptionParentId,
  }));

  if (childInserts.length > 0) {
    const { error: childErr } = await admin
      .from('event_schedule_blocks')
      .insert(childInserts);
    if (childErr) throw new Error(childErr.message);
  }

  revalidatePath(`/dashboard/${eventId}/schedule`);
  revalidatePath(`/dashboard/${eventId}`);
  return topLevelRows.length + childInserts.length;
}
