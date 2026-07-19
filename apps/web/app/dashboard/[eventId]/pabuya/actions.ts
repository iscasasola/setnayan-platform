'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isEgiftMethodKind } from '@/lib/egift-kinds';

/**
 * Server actions for the Pabuya e-gift surface (/dashboard/[eventId]/pabuya).
 *
 * Every write goes through the USER-scoped Supabase client, so the
 * event_egift_methods RLS policy (event_egift_methods_host_all) is the
 * authorization boundary — only a couple / accepted moderator / admin of the
 * event can touch its rows. RLS denial surfaces as a Postgres error, which we
 * translate to brand voice rather than leaking a raw string.
 *
 * REMINDER: none of this moves money. These rows are display-only handles the
 * couple owns; guests send directly to those accounts.
 */

const MAX_LABEL = 60;
const MAX_ACCOUNT_NAME = 80;
const MAX_HANDLE = 200;
const MAX_NOTE = 240;

export type EgiftActionResult =
  | { ok: true }
  | { ok: false; error: string };

const GENERIC_WRITE_ERROR =
  'Couldn’t save that. If it keeps happening, reach out from /help.';

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

/** Optional text field → trimmed value capped at `max`, or null when empty. */
function optional(formData: FormData, key: string, max: number): string | null {
  const v = str(formData, key);
  if (v.length === 0) return null;
  return v.slice(0, max);
}

async function requireEventId(formData: FormData): Promise<string> {
  const eventId = str(formData, 'event_id');
  if (eventId.length === 0) {
    // Thrown to the caller's action boundary; surfaces as a generic failure.
    throw new Error('Missing event reference.');
  }
  return eventId;
}

/** Revalidate the dashboard surface + (when the event has a slug) the public page. */
async function revalidateSurfaces(eventId: string): Promise<void> {
  revalidatePath(`/dashboard/${eventId}/pabuya`);
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('events')
      .select('slug')
      .eq('event_id', eventId)
      .maybeSingle();
    const slug = (data as { slug?: string | null } | null)?.slug ?? null;
    if (slug) {
      revalidatePath(`/${slug}/pabuya`);
      revalidatePath(`/${slug}`);
    }
  } catch {
    // Best-effort: the dashboard revalidate above already ran.
  }
}

/**
 * Create a new e-gift method, or update an existing one when `egift_method_id`
 * is present. New rows land at the end of the list (max sort_order + 1).
 */
export async function saveEgiftMethod(
  formData: FormData,
): Promise<EgiftActionResult> {
  let eventId: string;
  try {
    eventId = await requireEventId(formData);
  } catch {
    return { ok: false, error: 'Missing event reference. Please refresh.' };
  }

  const methodKind = str(formData, 'method_kind');
  if (!isEgiftMethodKind(methodKind)) {
    return { ok: false, error: 'Please choose a valid payment method.' };
  }

  const label = str(formData, 'label').slice(0, MAX_LABEL);
  if (label.length === 0) {
    return { ok: false, error: 'Please give this a short label (e.g. “GCash”).' };
  }

  const accountName = optional(formData, 'account_name', MAX_ACCOUNT_NAME);
  const handle = optional(formData, 'handle', MAX_HANDLE);
  const note = optional(formData, 'note', MAX_NOTE);

  // The QR ref comes from <FileUpload> as an `r2://bucket/key` string. Accept
  // only that shape (or empty) so a stray value can't be persisted as a handle.
  const qrRaw = str(formData, 'qr_r2_key');
  const qrR2Key = qrRaw.startsWith('r2://') ? qrRaw : null;

  // Require at least one actionable detail — a bare label helps no guest.
  if (!handle && !qrR2Key) {
    return {
      ok: false,
      error: 'Add a number/link or upload a QR code so guests know where to send.',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const editingId = str(formData, 'egift_method_id');

  if (editingId.length > 0) {
    const { error } = await supabase
      .from('event_egift_methods')
      .update({
        method_kind: methodKind,
        label,
        account_name: accountName,
        handle,
        qr_r2_key: qrR2Key,
        note,
      })
      .eq('egift_method_id', editingId)
      .eq('event_id', eventId);
    if (error) return { ok: false, error: GENERIC_WRITE_ERROR };
  } else {
    // Append at the end: read the current max sort_order for this event.
    const { data: maxRow } = await supabase
      .from('event_egift_methods')
      .select('sort_order')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextSort =
      ((maxRow as { sort_order?: number } | null)?.sort_order ?? -1) + 1;

    const { error } = await supabase.from('event_egift_methods').insert({
      event_id: eventId,
      method_kind: methodKind,
      label,
      account_name: accountName,
      handle,
      qr_r2_key: qrR2Key,
      note,
      is_enabled: true,
      sort_order: nextSort,
      created_by_user_id: user.id,
    });
    if (error) return { ok: false, error: GENERIC_WRITE_ERROR };
  }

  await revalidateSurfaces(eventId);
  return { ok: true };
}

/** Permanently remove an e-gift method. */
export async function deleteEgiftMethod(
  formData: FormData,
): Promise<EgiftActionResult> {
  let eventId: string;
  try {
    eventId = await requireEventId(formData);
  } catch {
    return { ok: false, error: 'Missing event reference. Please refresh.' };
  }
  const id = str(formData, 'egift_method_id');
  if (id.length === 0) return { ok: false, error: 'Nothing to remove.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('event_egift_methods')
    .delete()
    .eq('egift_method_id', id)
    .eq('event_id', eventId);
  if (error) return { ok: false, error: GENERIC_WRITE_ERROR };

  await revalidateSurfaces(eventId);
  return { ok: true };
}

/** Show/hide an e-gift method on the public guest surface. */
export async function setEgiftMethodEnabled(
  formData: FormData,
): Promise<EgiftActionResult> {
  let eventId: string;
  try {
    eventId = await requireEventId(formData);
  } catch {
    return { ok: false, error: 'Missing event reference. Please refresh.' };
  }
  const id = str(formData, 'egift_method_id');
  if (id.length === 0) return { ok: false, error: 'Nothing to update.' };
  const enabled = str(formData, 'is_enabled') === 'true';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('event_egift_methods')
    .update({ is_enabled: enabled })
    .eq('egift_method_id', id)
    .eq('event_id', eventId);
  if (error) return { ok: false, error: GENERIC_WRITE_ERROR };

  await revalidateSurfaces(eventId);
  return { ok: true };
}

/**
 * Move a method one slot up or down by swapping its sort_order with the
 * adjacent neighbour. Two small updates keep the ordering dense + stable.
 */
export async function moveEgiftMethod(
  formData: FormData,
): Promise<EgiftActionResult> {
  let eventId: string;
  try {
    eventId = await requireEventId(formData);
  } catch {
    return { ok: false, error: 'Missing event reference. Please refresh.' };
  }
  const id = str(formData, 'egift_method_id');
  const direction = str(formData, 'direction');
  if (id.length === 0 || (direction !== 'up' && direction !== 'down')) {
    return { ok: false, error: 'Couldn’t reorder that.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Read the full ordered set for this event (RLS scopes it to the couple's).
  const { data, error: readErr } = await supabase
    .from('event_egift_methods')
    .select('egift_method_id, sort_order')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (readErr || !data) return { ok: false, error: GENERIC_WRITE_ERROR };

  const rows = data as { egift_method_id: string; sort_order: number }[];
  const idx = rows.findIndex((r) => r.egift_method_id === id);
  if (idx === -1) return { ok: false, error: 'That item is no longer here.' };
  const swapWith = direction === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= rows.length) return { ok: true }; // already at edge

  const a = rows[idx]!;
  const b = rows[swapWith]!;
  // Swap their sort_order values.
  const [r1, r2] = await Promise.all([
    supabase
      .from('event_egift_methods')
      .update({ sort_order: b.sort_order })
      .eq('egift_method_id', a.egift_method_id)
      .eq('event_id', eventId),
    supabase
      .from('event_egift_methods')
      .update({ sort_order: a.sort_order })
      .eq('egift_method_id', b.egift_method_id)
      .eq('event_id', eventId),
  ]);
  if (r1.error || r2.error) return { ok: false, error: GENERIC_WRITE_ERROR };

  await revalidateSurfaces(eventId);
  return { ok: true };
}
