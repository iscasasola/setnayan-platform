'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isEgiftMethodKind } from '@/lib/egift-kinds';
import { pabuyaQrPolicy, parseClientRef } from '@/lib/r2-client-ref';
import { checkPabuyaQrImage } from '@/lib/pabuya-qr-check.server';
import { deleteDisplacedPabuyaQr } from '@/lib/pabuya-qr-object.server';
import { cleanPabuyaMessage } from '@/lib/pabuya-message';

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

/* Distinct from GENERIC_WRITE_ERROR on purpose: nothing failed, the write
   simply matched no row. "Try again" is wrong advice for that — the page the
   couple is looking at is out of date, and reloading is the fix. */
const STALE_ROW_ERROR =
  'That gift method isn’t there any more — reload the page and try again.';

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

  // The QR ref comes from <FileUpload> as an `r2://bucket/key` string.
  //
  // SEC-1: the old check was `startsWith('r2://')` only, which accepted ANY
  // bucket and ANY key. The stored ref is presigned later by lib/egift.ts for
  // the couple's guests, so a foreign key parked here would be signed for third
  // parties. Pin it to this event's own `events/{eventId}/pabuya/` upload
  // prefix in the public media bucket.
  const qrRaw = str(formData, 'qr_r2_key');
  let qrR2Key = parseClientRef(qrRaw, pabuyaQrPolicy(eventId)) ? qrRaw : null;

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

  // Grandfather clause: the edit form echoes the method's CURRENT qr ref back,
  // so a row written before this policy existed must still be re-savable.
  // Echoing a ref we already serve introduces nothing new; a ref that is
  // neither policy-conforming nor the stored one is refused.
  if (qrRaw.length > 0 && !qrR2Key) {
    let grandfathered = false;
    if (editingId.length > 0) {
      const { data: existing } = await supabase
        .from('event_egift_methods')
        .select('qr_r2_key')
        .eq('egift_method_id', editingId)
        .eq('event_id', eventId)
        .maybeSingle();
      grandfathered =
        (existing as { qr_r2_key?: string | null } | null)?.qr_r2_key === qrRaw;
    }
    if (!grandfathered) {
      return {
        ok: false,
        error: 'That QR image reference isn’t valid — re-upload and try again.',
      };
    }
    qrR2Key = qrRaw;
  }

  /*
    Is this image actually a payment QR? (2026-09-16)

    Until now any image could be saved as a gift QR — no decode, no QR Ph check
    — so an unusable upload would first be discovered by a guest at the
    reception. The upload is the last moment anybody can still fix it.

    ⚠ An earlier version of this comment cited the owner's own `IMG_4424.jpg` as
    the failing example. That was wrong: it is a valid QR Ph code. Corrected
    2026-09-17; see lib/pabuya-qr-verdict.ts.

    ⚠ ONLY A NEWLY ATTACHED OR CHANGED IMAGE IS CHECKED, and that is
    load-bearing rather than an optimisation. Checking on every save would trap
    every row that already holds a bad image: the couple could no longer fix the
    LABEL or the ACCOUNT NUMBER on that method without first producing a valid
    QR — and the account number is the part a guest can actually use. A rule
    that blocks the repair of the thing it is complaining about is worse than
    the thing. It also spares an R2 fetch on every unrelated edit.

    The verdict itself (which rails are held to QR Ph, and what each outcome
    means) lives in the pure lib/pabuya-qr-verdict.ts; this call site only
    decides WHEN to ask.
  */
  /* The key this row pointed at BEFORE this save, read once.
     Two consumers, and it must be in scope for both:
       · the QR Ph check below, which only runs on a CHANGED image;
       · the displaced-object delete after the write.
     ⚠ It is read for every edit, not only when a new image is attached —
     otherwise a couple REMOVING their QR (qrR2Key === null) would never have
     the abandoned object deleted, which is the case most likely to matter:
     they are retiring that account. */
  let previousRef: string | null = null;
  if (editingId.length > 0) {
    const { data: prior } = await supabase
      .from('event_egift_methods')
      .select('qr_r2_key')
      .eq('egift_method_id', editingId)
      .eq('event_id', eventId)
      .maybeSingle();
    previousRef =
      (prior as { qr_r2_key?: string | null } | null)?.qr_r2_key ?? null;
  }

  if (qrR2Key) {
    if (qrR2Key !== previousRef) {
      const verdict = await checkPabuyaQrImage({
        kind: methodKind,
        r2Ref: qrR2Key,
      });
      if (!verdict.ok) return verdict;
    }
  }

  if (editingId.length > 0) {
    /* 🔑 A ZERO-ROW WRITE IS SUCCESS-SHAPED. PostgREST returns no error when a
       filter matches nothing — RLS narrowing the row out, a stale id, a row
       another tab deleted — so `!error` alone renders "saved" over a write that
       changed nothing. `.select()` makes the affected rows come back and the
       count is the proof. Same shape as savePabuyaMessage below. */
    const { data: updated, error } = await supabase
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
      .eq('event_id', eventId)
      .select('egift_method_id');
    if (error) return { ok: false, error: GENERIC_WRITE_ERROR };
    if (!updated || updated.length === 0) return { ok: false, error: STALE_ROW_ERROR };
    /* The row now points somewhere else — retire the image it left behind.
       AFTER the write, and only once a row is confirmed to have moved: deleting
       first would destroy a live QR whenever the write then matched nothing.
       `previousRef` was captured before the write; the helper refuses an
       unchanged key and any key that is not this event's own object. */
    await deleteDisplacedPabuyaQr({
      previousKey: previousRef,
      nextKey: qrR2Key,
      eventId,
    });
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

    const { data: inserted, error } = await supabase
      .from('event_egift_methods')
      .insert({
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
      })
      .select('egift_method_id');
    if (error) return { ok: false, error: GENERIC_WRITE_ERROR };
    // An insert refused by RLS WITH CHECK returns no row and no error here.
    if (!inserted || inserted.length === 0) return { ok: false, error: GENERIC_WRITE_ERROR };
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

  /* `.select()` returns the DELETED row, which is the only way to learn the key
     after the fact — reading it first would race a concurrent edit and could
     delete an object the row no longer owns. */
  const { data: removed, error } = await supabase
    .from('event_egift_methods')
    .delete()
    .eq('egift_method_id', id)
    .eq('event_id', eventId)
    .select('egift_method_id, qr_r2_key');
  if (error) return { ok: false, error: GENERIC_WRITE_ERROR };
  // 🔑 A delete that removed nothing must not report "removed" — the couple
  // would believe their account details are gone when the row still stands.
  if (!removed || removed.length === 0) return { ok: false, error: STALE_ROW_ERROR };

  /* 🔑 THE ROW IS NOT THE DETAILS. Until now "Remove" deleted the row and left
     the QR — an image encoding the couple's account number — as a live object.
     `/privacy` promises the opposite in writing. */
  for (const row of removed as { qr_r2_key?: string | null }[]) {
    await deleteDisplacedPabuyaQr({
      previousKey: row.qr_r2_key ?? null,
      nextKey: null,
      eventId,
    });
  }

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

  const { data: toggled, error } = await supabase
    .from('event_egift_methods')
    .update({ is_enabled: enabled })
    .eq('egift_method_id', id)
    .eq('event_id', eventId)
    .select('egift_method_id');
  if (error) return { ok: false, error: GENERIC_WRITE_ERROR };
  // Hiding a destination is how a couple retires an account. A no-op that
  // reports success leaves it live on the guest page.
  if (!toggled || toggled.length === 0) return { ok: false, error: STALE_ROW_ERROR };

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
      .eq('event_id', eventId)
      .select('egift_method_id'),
    supabase
      .from('event_egift_methods')
      .update({ sort_order: a.sort_order })
      .eq('egift_method_id', b.egift_method_id)
      .eq('event_id', eventId)
      .select('egift_method_id'),
  ]);
  if (r1.error || r2.error) return { ok: false, error: GENERIC_WRITE_ERROR };
  /* ⚠ A HALF-APPLIED SWAP IS THE WORST OUTCOME HERE — two rows would share one
     sort_order and the list order becomes arbitrary. Both halves must have
     moved a row; if either matched nothing, say so rather than showing an
     order that is not the stored one. */
  if (!r1.data?.length || !r2.data?.length) return { ok: false, error: STALE_ROW_ERROR };

  await revalidateSurfaces(eventId);
  return { ok: true };
}

/**
 * SAVE THE COUPLE'S OWN SENTENCE above their e-gift methods.
 *
 * ⚖ Owner 2026-09-15: *"so pick among 5 or create your own."* The templates are
 * starting points in the UI; what is stored is always the couple's TEXT, never
 * a template key — so editing a template after picking it is just editing, and
 * a template's wording can be improved later without silently rewriting a page
 * somebody already published.
 *
 * 🔒 OWNERSHIP IS RLS's JOB, as with every other action in this file: the write
 * goes through the caller's own session client, and `events`' policies decide
 * whether this person may touch this row. There is no second check here to
 * drift out of step with the first.
 *
 * ⚠ EMPTY CLEARS IT — `cleanPabuyaMessage` returns null for whitespace, and null
 * is what makes the public page read exactly as it did before anybody typed
 * anything. Storing `''` would render a blank paragraph above the QR codes,
 * which looks like a layout fault rather than an empty field.
 */
export async function savePabuyaMessage(
  formData: FormData,
): Promise<EgiftActionResult> {
  let eventId: string;
  try {
    eventId = await requireEventId(formData);
  } catch {
    return { ok: false, error: 'Missing event reference. Please refresh.' };
  }

  const message = cleanPabuyaMessage(str(formData, 'pabuya_message'));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('events')
    .update({ pabuya_message: message })
    .eq('event_id', eventId)
    .select('event_id');

  if (error) {
    return { ok: false, error: 'Could not save your message. Please try again.' };
  }
  /*
    🔑 A ZERO-ROW UPDATE IS SUCCESS-SHAPED. PostgREST returns no error when the
    filter matches nothing — including when RLS refused the row — so without
    counting we would tell a couple their words were saved and show them a page
    that never changed.
  */
  if (!data || data.length === 0) {
    return { ok: false, error: 'We could not save that — please reload and try again.' };
  }

  await revalidateSurfaces(eventId);
  return { ok: true };
}
