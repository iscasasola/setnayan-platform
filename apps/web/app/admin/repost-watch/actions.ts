'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { rescanAllVendorImages } from '@/lib/vendor-image-repost-watch';
import { scanAllVendorMediaForQr } from '@/lib/vendor-qr-media-guard';

// Shared admin gate (require-admin.ts) — identical contract to the local
// requireAdmin this file used to duplicate (login redirect · Forbidden throw).
import { requireAdminAction as requireAdmin } from '@/lib/admin/require-admin';
// /admin/repost-watch actions — moderator resolution path for the cross-vendor
// reverse-image repost-detection queue. A flag can be:
//   · dismiss         — no theft (stock/shared imagery, or the same vendor
//                       legitimately re-shot a venue). status=dismissed.
//   · confirm_theft   — records the verdict + notes ONLY. NO auto-takedown:
//                       any action against the reposting vendor is a separate,
//                       deliberate admin step on the vendor's own admin page.
//   · escalate        — flag for owner/legal review; status=escalated.
//
// Mirrors the requireAdmin + revalidatePath shape of
// app/admin/user-reports/actions.ts. Writes go via the service-role admin client
// (RLS grants admin UPDATE, but using the admin client keeps the write path
// uniform with the rest of the queue).

const ACTIONS = ['dismiss', 'confirm_theft', 'escalate'] as const;
type Action = (typeof ACTIONS)[number];

function isAction(v: FormDataEntryValue | null): v is Action {
  return typeof v === 'string' && (ACTIONS as readonly string[]).includes(v);
}

const ACTION_STATUS: Record<Action, 'dismissed' | 'confirmed_theft' | 'escalated'> = {
  dismiss: 'dismissed',
  confirm_theft: 'confirmed_theft',
  escalate: 'escalated',
};

const ACTION_NOTE: Record<Action, string> = {
  dismiss: 'Dismissed — no repost / legitimately shared imagery.',
  confirm_theft:
    'Confirmed repost. Verdict recorded; any takedown is a separate admin action against the supplier.',
  escalate: 'Escalated to owner / legal review.',
};

/**
 * Resolve a repost flag — stamps status + resolution notes + reviewer. NEVER
 * touches the underlying vendor images (no auto-takedown/hide/delete).
 */
export async function resolveRepostFlag(formData: FormData) {
  const { userId } = await requireAdmin();
  const flagId = formData.get('flag_id');
  const action = formData.get('action');
  const note = formData.get('note');

  if (typeof flagId !== 'string' || flagId.length === 0) {
    throw new Error('Invalid input');
  }
  if (!isAction(action)) {
    throw new Error('Pick an action');
  }

  const admin = createAdminClient();
  const extraNote =
    typeof note === 'string' && note.trim().length > 0
      ? ` — ${note.trim().slice(0, 500)}`
      : '';

  const { error } = await admin
    .from('vendor_image_flags')
    .update({
      status: ACTION_STATUS[action],
      resolution_notes: ACTION_NOTE[action] + extraNote,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', Number(flagId));
  if (error) throw new Error(error.message);

  revalidatePath('/admin/repost-watch');
}

/**
 * Admin "Rescan all" backfill — hashes every real vendor's current portfolio +
 * service cover images AND re-matches the full hash set at the current threshold
 * (so a widened threshold actually takes effect, not just newly-hashed refs).
 * REQUIRED for the feature to have any signal (hashing otherwise only fires on
 * new saves, and the founder-only vendor set is near-static). Runs synchronously
 * then redirects back with a summary.
 */
export async function rescanAllRepostWatch() {
  await requireAdmin();
  const summary = await rescanAllVendorImages();
  revalidatePath('/admin/repost-watch');
  redirect(
    `/admin/repost-watch?rescanned=${summary.vendorsScanned}&refs=${summary.refsConsidered}&rematched=${summary.refsRematched}&flagged=${summary.flagsUpserted}`,
  );
}

/* ─── QR-in-media guard (owner-locked 2026-07-03) ────────────────────────── */

/**
 * Retro-scan every real vendor's CURRENT website media (portfolio + logo +
 * microsite hero + service cover/showcase photos) for embedded vendor-funnel
 * QR codes. New uploads are rejected at save time; this sweeps what was
 * uploaded BEFORE the guard shipped. Flag-and-review — never auto-deletes.
 * Showcase videos are outside the sweep (no server-side frame extraction);
 * the summary reports how many were skipped.
 */
export async function scanQrMediaGuard() {
  await requireAdmin();
  const summary = await scanAllVendorMediaForQr();
  revalidatePath('/admin/repost-watch');
  redirect(
    `/admin/repost-watch?qr_vendors=${summary.vendorsScanned}&qr_refs=${summary.refsScanned}&qr_flagged=${summary.flagsUpserted}&qr_videos=${summary.videosSkipped}`,
  );
}

const QR_ACTIONS = ['clear', 'mark_removed'] as const;
type QrAction = (typeof QR_ACTIONS)[number];

const QR_ACTION_STATUS: Record<QrAction, 'cleared' | 'removed'> = {
  clear: 'cleared',
  mark_removed: 'removed',
};

const QR_ACTION_NOTE: Record<QrAction, string> = {
  clear: 'Cleared — reviewed, not a funnel QR / acceptable.',
  mark_removed:
    'Supplier removed / replaced the media. Removal itself is a separate, deliberate step with the supplier — this records the outcome.',
};

/**
 * Resolve a QR-media flag — records the verdict. Like the repost queue, this
 * NEVER touches the underlying media: an admin clears the flag or records
 * that the offending media was removed after contacting the vendor.
 */
export async function resolveQrMediaFlag(formData: FormData) {
  const { userId } = await requireAdmin();
  const flagId = formData.get('flag_id');
  const action = formData.get('action');
  const note = formData.get('note');

  if (typeof flagId !== 'string' || flagId.length === 0) {
    throw new Error('Invalid input');
  }
  if (
    typeof action !== 'string' ||
    !(QR_ACTIONS as readonly string[]).includes(action)
  ) {
    throw new Error('Pick an action');
  }

  const admin = createAdminClient();
  const extraNote =
    typeof note === 'string' && note.trim().length > 0
      ? ` — ${note.trim().slice(0, 500)}`
      : '';

  const { error } = await admin
    .from('vendor_qr_media_flags')
    .update({
      status: QR_ACTION_STATUS[action as QrAction],
      resolution_notes: QR_ACTION_NOTE[action as QrAction] + extraNote,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', Number(flagId));
  if (error) throw new Error(error.message);

  revalidatePath('/admin/repost-watch');
}

// ── 🃏 SERVICE CARD CHECKS — the claim words and the per-shop allowance (owner 2026-10-26) ──────────────────────────
//
// The card maker refuses a card carrying a word from `card_claim_words` (lib/service-card-checks.ts) until it is
// reworded; admin edits the list here, and may let ONE shop use ONE word (`card_claim_word_allowances`). Both tables
// are admin-only under RLS; the writes go through the service-role client like the rest of this page. A save never
// resets the screen: each action revalidates in place (no navigation); only a refused input returns to the section.

const WORDS_REFUSED = '/admin/repost-watch?words_error=1#card-claim-words';

function cleanPhrase(v: FormDataEntryValue | null): string | null {
  if (typeof v !== 'string') return null;
  const p = v.trim().toLowerCase().replace(/\s+/g, ' ');
  return p.length >= 1 && p.length <= 60 ? p : null;
}

function cleanNote(v: FormDataEntryValue | null): string | null {
  if (typeof v !== 'string') return null;
  const n = v.trim().slice(0, 200);
  return n.length > 0 ? n : null;
}

export async function addCardClaimWord(formData: FormData) {
  const { userId } = await requireAdmin();
  const phrase = cleanPhrase(formData.get('phrase'));
  if (!phrase) redirect(WORDS_REFUSED);
  const { error } = await createAdminClient()
    .from('card_claim_words')
    .upsert({ phrase, note: cleanNote(formData.get('note')), created_by: userId }, { onConflict: 'phrase' });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/repost-watch');
}

export async function removeCardClaimWord(formData: FormData) {
  await requireAdmin();
  const phrase = cleanPhrase(formData.get('phrase'));
  if (!phrase) throw new Error('Invalid input');
  const { error } = await createAdminClient().from('card_claim_words').delete().eq('phrase', phrase);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/repost-watch');
}

export async function grantCardClaimWordAllowance(formData: FormData) {
  const { userId } = await requireAdmin();
  const phrase = cleanPhrase(formData.get('phrase'));
  const shop = formData.get('vendor_profile_id');
  if (!phrase || typeof shop !== 'string' || !/^[0-9a-f-]{36}$/i.test(shop)) {
    redirect(WORDS_REFUSED);
  }
  const { error } = await createAdminClient()
    .from('card_claim_word_allowances')
    .upsert(
      { vendor_profile_id: shop, phrase, note: cleanNote(formData.get('note')), granted_by: userId },
      { onConflict: 'vendor_profile_id,phrase' },
    );
  if (error) throw new Error(error.message);
  revalidatePath('/admin/repost-watch');
}

export async function removeCardClaimWordAllowance(formData: FormData) {
  await requireAdmin();
  const phrase = cleanPhrase(formData.get('phrase'));
  const shop = formData.get('vendor_profile_id');
  if (!phrase || typeof shop !== 'string') throw new Error('Invalid input');
  const { error } = await createAdminClient()
    .from('card_claim_word_allowances')
    .delete()
    .eq('vendor_profile_id', shop)
    .eq('phrase', phrase);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/repost-watch');
}
