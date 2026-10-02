'use server';

/**
 * search-word-actions.ts — approve, reject, remove or add one SEARCH WORD for a
 * service (`canonical_service_aliases`). Moved 2026-10-02 from
 * /admin/taxonomy/aliases/actions.ts: the words now sit on each service's panel
 * of "Categories & event types" (Search words), and the waiting ones across
 * every service under Show ▾ › Words waiting.
 *
 * 🔒 THE WHOLE POINT OF THIS FILE. A row in `canonical_service_aliases` with
 * `reviewed_at IS NULL` answers nobody — the RLS read policy hides it from
 * every ordinary session, and `reviewedAliasesByLiveTrade` re-checks the
 * same fact even when read with elevated privileges. APPROVING is the only
 * thing that turns a machine's guess into something a supplier can find
 * their trade by. There is no bulk-approve: each phrase is one press.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminAction } from '@/lib/admin/require-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalisePhrase } from '@/lib/service-trade-aliases';
import { CATEGORIES_PATH, backHref } from './_components/back';

const BASE = CATEGORIES_PATH;

function backTo(formData: FormData, kind: 'ok' | 'error', msg: string): never {
  redirect(backHref(formData, kind, msg));
}

/** Approve one proposed alias — the only act that lets it answer a supplier. */
export async function approveTradeAlias(formData: FormData) {
  const { userId } = await requireAdminAction();
  const id = Number(formData.get('id'));
  if (!Number.isFinite(id) || id <= 0) backTo(formData, 'error', 'Missing word id.');

  const admin = createAdminClient();
  const { error } = await admin
    .from('canonical_service_aliases')
    .update({
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    // Only ever reviews an UNREVIEWED row — a double-press or a stale tab
    // cannot re-stamp a reviewer over somebody else's decision.
    .is('reviewed_at', null);
  if (error) backTo(formData, 'error', error.message);

  revalidatePath(BASE);
  backTo(formData, 'ok', 'Approved — suppliers can find the service by that word now.');
}

/**
 * Reject one proposed alias. Deleted, not merely flagged — a rejected guess
 * costs nothing to regenerate, and a permanently-pending row would clutter
 * the queue forever with something already decided.
 */
export async function rejectTradeAlias(formData: FormData) {
  await requireAdminAction();
  const id = Number(formData.get('id'));
  if (!Number.isFinite(id) || id <= 0) backTo(formData, 'error', 'Missing word id.');

  const admin = createAdminClient();
  const { error } = await admin
    .from('canonical_service_aliases')
    .delete()
    .eq('id', id)
    .is('reviewed_at', null);
  if (error) backTo(formData, 'error', error.message);

  revalidatePath(BASE);
  backTo(formData, 'ok', 'Rejected.');
}

/**
 * Un-teach a REVIEWED alias — the admin changed their mind after it went
 * live. Deletes outright; the seeding script can propose it again later if
 * it is still right, and a live alias must never linger half-retracted.
 */
export async function unteachTradeAlias(formData: FormData) {
  await requireAdminAction();
  const id = Number(formData.get('id'));
  if (!Number.isFinite(id) || id <= 0) backTo(formData, 'error', 'Missing word id.');

  const admin = createAdminClient();
  const { error } = await admin.from('canonical_service_aliases').delete().eq('id', id);
  if (error) backTo(formData, 'error', error.message);

  revalidatePath(BASE);
  backTo(formData, 'ok', 'Removed.');
}

/**
 * Add a search word to a service, typed by an admin on its panel
 * ("+ Add a word"). A person typing it IS the review, so it lands reviewed —
 * `source = 'admin'` (migration 20271260148112) says how it was obtained.
 * Normalised exactly the way every other row is, or a lookup never hits. A
 * phrase that already belongs to a service is refused rather than moved: the
 * table is UNIQUE (phrase), and silently re-pointing an approved answer is the
 * one thing this queue exists to prevent.
 */
export async function addTradeAlias(formData: FormData) {
  const { userId } = await requireAdminAction();
  const canonical = String(formData.get('canonical_service') ?? '').trim();
  const phrase = normalisePhrase(String(formData.get('phrase') ?? '')).slice(0, 80);
  if (!canonical) backTo(formData, 'error', 'Missing service.');
  if (phrase.length < 2) backTo(formData, 'error', 'Type a word of at least 2 letters.');

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('canonical_service_aliases')
    .select('canonical_service')
    .eq('phrase', phrase)
    .maybeSingle();
  if (existing) {
    backTo(
      formData,
      'error',
      existing.canonical_service === canonical
        ? `"${phrase}" is already a word for this service.`
        : `"${phrase}" already belongs to another service (${existing.canonical_service}).`,
    );
  }
  const now = new Date().toISOString();
  const { error } = await admin.from('canonical_service_aliases').insert({
    phrase,
    canonical_service: canonical,
    source: 'admin',
    reviewed_at: now,
    reviewed_by: userId,
  });
  if (error) backTo(formData, 'error', error.message);

  revalidatePath(BASE);
  backTo(formData, 'ok', `"${phrase}" now finds this service.`);
}
