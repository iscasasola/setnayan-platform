'use server';

/**
 * Integrity watch › Cards — the verdicts (service card checks, owner 2026-10-26; DECISION_LOG "APPROVED — SERVICE
 * CARD CHECKS AS DRAWN"; approved prototype frames 3 + 7).
 *
 *   · Approve      — `approve_service_card()` closes the hold and puts the card live in ONE transaction (the publish
 *                    gate still runs). Any repost-watch row the card's photo reason names is closed with it. A row
 *                    whose check did not finish is checked AGAIN first; if it now finds something, nothing is
 *                    approved and the row shows what it found.
 *   · Ask to fix   — status `asked_to_fix`, your message in `resolution_notes`; the card stays out of Explore; a resave
 *                    that passes goes live by itself.
 *   · Reject       — status `rejected`, the reason; the card stays hidden; the next save re-queues.
 *   · Bulk approve — words-only rows only, re-checked here; each approve is its own audit row.
 *   · Allow a word — "Not a problem — stop flagging “…” for this shop": an allowance, then the word leaves this card's
 *                    reasons; if it was the only reason, the card is approved (it would pass the check now).
 *   · Words list   — add / remove a claim word.
 *
 * Every verdict writes one `admin_audit_log` row and tells the supplier IN THE APP ONLY (ruling: no email) — never
 * which other shop a photo matched.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminAction as requireAdmin } from '@/lib/admin/require-admin';
import { emitNotification } from '@/lib/notification-emit';
import { displayServiceLabel } from '@/lib/vendors';
import { checkServiceCard } from '@/lib/service-card-checks.server';
import { isWordsOnly, scoreFor, primaryReason, type CardReason } from '@/lib/service-card-checks';
import { reasonsFromDetail } from '@/lib/service-card-check-copy';
import { REJECT_REASONS } from './_cards/cards-types';

const PAGE = '/admin/integrity-watch';
type Admin = ReturnType<typeof createAdminClient>;

type FlagRow = {
  id: number;
  public_id: string;
  status: string;
  subject_vendor_id: string;
  subject_service_id: string;
  detail: Record<string, unknown> | null;
};

async function readFlag(admin: Admin, flagId: number): Promise<FlagRow | null> {
  const { data, error } = await admin
    .from('integrity_flags')
    .select('id, public_id, status, subject_vendor_id, subject_service_id, detail')
    .eq('id', flagId)
    .eq('kind', 'service_card')
    .maybeSingle();
  if (error) throw new Error(`The card couldn’t be read just now: ${error.message}`);
  return (data as FlagRow | null) ?? null;
}

function flagIdFrom(formData: FormData): number {
  const n = Number(formData.get('flag_id'));
  if (!Number.isInteger(n) || n <= 0) throw new Error('Invalid input');
  return n;
}

async function audit(admin: Admin, userId: string, action: string, flag: FlagRow, after: string, extra: Record<string, unknown> = {}) {
  const { error } = await admin.from('admin_audit_log').insert({
    action: `service_card_${action}`,
    target_id: String(flag.id),
    actor_user_id: userId,
    metadata: {
      flag_id: flag.id,
      flag_public_id: flag.public_id,
      subject_vendor_id: flag.subject_vendor_id,
      subject_service_id: flag.subject_service_id,
      before_status: flag.status,
      after_status: after,
      ...extra,
    },
  });
  if (error) console.error('[card-actions] audit log insert failed', error.message);
}

async function cardTitle(admin: Admin, serviceId: string): Promise<string> {
  const { data, error } = await admin.from('vendor_services').select('title, category').eq('vendor_service_id', serviceId).maybeSingle();
  if (error) console.error('[supabase-error] card-actions · from:vendor_services.select (title)', error);
  const row = data as { title: string | null; category: string } | null;
  return row?.title?.trim() || (row ? displayServiceLabel(row.category) : 'Your card');
}

async function tellSupplier(admin: Admin, flag: FlagRow, title: string, body: string) {
  try {
    const { data, error } = await admin.from('vendor_profiles').select('user_id').eq('vendor_profile_id', flag.subject_vendor_id).maybeSingle();
    if (error) console.error('[supabase-error] card-actions · from:vendor_profiles.select (notice)', error);
    const userId = (data as { user_id?: string | null } | null)?.user_id;
    if (!userId) return;
    await emitNotification({
      userId,
      type: 'service_card_check',
      title,
      body,
      relatedUrl: `/vendor-dashboard/services/${flag.subject_service_id}`,
    });
  } catch (e) {
    console.error('[card-actions] notice failed', e);
  }
}

/** Close the repost-watch rows the card's photo reason names — "approving here resolves both". */
async function closeLinkedImageFlags(admin: Admin, flag: FlagRow, userId: string) {
  const photo = reasonsFromDetail(flag.detail).find((r): r is Extract<CardReason, { code: 'photo' }> => r.code === 'photo');
  const ids = photo?.matches.map((m) => m.imageFlagPublicId) ?? [];
  if (ids.length === 0) return;
  const { error } = await admin
    .from('vendor_image_flags')
    .update({
      status: 'dismissed',
      resolution_notes: `Cleared with service card flag ${flag.public_id} (approved on Integrity watch › Cards).`,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .in('public_id', ids)
    .eq('status', 'open');
  if (error) console.error('[card-actions] closing linked repost-watch rows failed', error.message);
}

/** Re-run the checks on the card as it is stored (an unfinished check is never approved blind). */
async function recheckStoredCard(admin: Admin, flag: FlagRow): Promise<CardReason[] | null> {
  const [svc, incs, addons] = await Promise.all([
    admin
      .from('vendor_services')
      .select('title, category, starting_price_php, pricing_basis, primary_photo_r2_key, showcase_photo_r2_keys')
      .eq('vendor_service_id', flag.subject_service_id)
      .maybeSingle(),
    admin.from('vendor_service_inclusions').select('label').eq('vendor_service_id', flag.subject_service_id),
    admin.from('vendor_service_addons').select('label').eq('vendor_service_id', flag.subject_service_id),
  ]);
  if (svc.error || !svc.data || incs.error) {
    console.error('[supabase-error] card-actions · recheck read', svc.error ?? incs.error);
    return null;
  }
  const s = svc.data as {
    title: string | null;
    category: string;
    starting_price_php: number | null;
    pricing_basis: string | null;
    primary_photo_r2_key: string | null;
    showcase_photo_r2_keys: string[] | null;
  };
  const r = await checkServiceCard({
    vendorProfileId: flag.subject_vendor_id,
    category: s.category,
    categoryLabel: displayServiceLabel(s.category),
    title: s.title,
    inclusionLabels: ((incs.data ?? []) as { label: string }[]).map((i) => i.label),
    addonLabels: addons.error ? null : ((addons.data ?? []) as { label: string }[]).map((a) => a.label),
    startingPricePhp: s.starting_price_php,
    pricingBasis: s.pricing_basis ?? 'fixed',
    cover: s.primary_photo_r2_key,
    showcase: s.showcase_photo_r2_keys ?? [],
  });
  return r.reasons;
}

/** The one approve path — single and bulk both come here. Returns a sentence when it did NOT approve. */
async function approveOne(admin: Admin, userId: string, flag: FlagRow): Promise<string | null> {
  if (!['open', 'asked_to_fix', 'rejected'].includes(flag.status)) return 'That card is not waiting any more.';
  const reasons = reasonsFromDetail(flag.detail);
  if (reasons.some((r) => r.code === 'check_unavailable')) {
    const fresh = await recheckStoredCard(admin, flag);
    if (fresh === null || fresh.length > 0) {
      const now = fresh ?? reasons;
      await admin
        .from('integrity_flags')
        .update({ detail: { ...(flag.detail ?? {}), reasons: now, checked_at: new Date().toISOString() }, score: scoreFor(now), reason: primaryReason(now) })
        .eq('id', flag.id);
      return fresh === null
        ? 'The check still couldn’t finish, so nothing was approved. Try again in a moment.'
        : 'The check ran again and found something — look before approving.';
    }
  }
  const { data: ok, error } = await admin.rpc('approve_service_card', { p_flag_id: flag.id, p_reviewer: userId, p_note: null });
  if (error) return error.message;
  if (ok !== true) return 'That card is not waiting any more.';
  await closeLinkedImageFlags(admin, flag, userId);
  await audit(admin, userId, 'approve', flag, 'approved');
  const title = await cardTitle(admin, flag.subject_service_id);
  await tellSupplier(admin, flag, 'Approved · your card is live', `“${title}” passed the quick check and couples can see it now.`);
  return null;
}

export async function approveServiceCard(formData: FormData) {
  const { userId } = await requireAdmin();
  const admin = createAdminClient();
  const flag = await readFlag(admin, flagIdFrom(formData));
  if (!flag) throw new Error('Card not found.');
  const refused = await approveOne(admin, userId, flag);
  revalidatePath(PAGE);
  if (refused) redirect(`${PAGE}?tab=cards&open=${flag.public_id}&error=${encodeURIComponent(refused)}`);
  redirect(`${PAGE}?tab=cards&done=approved`);
}

export async function bulkApproveServiceCards(formData: FormData) {
  const { userId } = await requireAdmin();
  const admin = createAdminClient();
  const ids = formData
    .getAll('flag_id')
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 50);
  let approved = 0;
  for (const id of ids) {
    const flag = await readFlag(admin, id);
    // Re-checked here, not trusted from the tick box: bulk is for words-only rows.
    if (!flag || !isWordsOnly(reasonsFromDetail(flag.detail))) continue;
    if ((await approveOne(admin, userId, flag)) === null) approved += 1;
  }
  revalidatePath(PAGE);
  redirect(`${PAGE}?tab=cards&done=bulk&n=${approved}`);
}

export async function askToFixServiceCard(formData: FormData) {
  const { userId } = await requireAdmin();
  const admin = createAdminClient();
  const flag = await readFlag(admin, flagIdFrom(formData));
  if (!flag) throw new Error('Card not found.');
  const message = String(formData.get('message') ?? '').trim().slice(0, 800);
  if (!message) redirect(`${PAGE}?tab=cards&open=${flag.public_id}&error=${encodeURIComponent('Write the message to the supplier first.')}`);
  const { data: moved, error } = await admin
    .from('integrity_flags')
    .update({ status: 'asked_to_fix', resolution_notes: message, reviewed_by: userId, reviewed_at: new Date().toISOString() })
    .eq('id', flag.id)
    .in('status', ['open', 'asked_to_fix'])
    .select('id');
  if (error) throw new Error(error.message);
  if (moved && moved.length > 0) {
    await audit(admin, userId, 'ask_to_fix', flag, 'asked_to_fix');
    const title = await cardTitle(admin, flag.subject_service_id);
    await tellSupplier(admin, flag, 'Setnayan asked you to fix a card', `“${title}”: ${message}`);
  }
  revalidatePath(PAGE);
  redirect(`${PAGE}?tab=cards&done=asked`);
}

export async function rejectServiceCard(formData: FormData) {
  const { userId } = await requireAdmin();
  const admin = createAdminClient();
  const flag = await readFlag(admin, flagIdFrom(formData));
  if (!flag) throw new Error('Card not found.');
  const reason = String(formData.get('reason') ?? '');
  if (!(REJECT_REASONS as readonly string[]).includes(reason)) throw new Error('Pick a reason');
  const words = String(formData.get('words') ?? '').trim().slice(0, 500);
  const isOther = reason === REJECT_REASONS[REJECT_REASONS.length - 1];
  if (isOther && !words) redirect(`${PAGE}?tab=cards&open=${flag.public_id}&error=${encodeURIComponent('Write the reason first.')}`);
  const note = isOther ? words : words ? `${reason} — ${words}` : reason;
  const { data: moved, error } = await admin
    .from('integrity_flags')
    .update({ status: 'rejected', resolution_notes: note, reviewed_by: userId, reviewed_at: new Date().toISOString() })
    .eq('id', flag.id)
    .in('status', ['open', 'asked_to_fix'])
    .select('id');
  if (error) throw new Error(error.message);
  if (moved && moved.length > 0) {
    await audit(admin, userId, 'reject', flag, 'rejected', { reason });
    const title = await cardTitle(admin, flag.subject_service_id);
    await tellSupplier(admin, flag, 'A card stays hidden', `“${title}” stays out of Explore: ${note}. You can still edit it — the next save is looked at again.`);
  }
  revalidatePath(PAGE);
  redirect(`${PAGE}?tab=cards&done=rejected`);
}

export async function allowClaimWordForShop(formData: FormData) {
  const { userId } = await requireAdmin();
  const admin = createAdminClient();
  const flag = await readFlag(admin, flagIdFrom(formData));
  if (!flag) throw new Error('Card not found.');
  const phrase = String(formData.get('phrase') ?? '').trim().toLowerCase();
  if (!phrase) throw new Error('Invalid input');
  const { error: allowErr } = await admin
    .from('card_claim_word_allowances')
    .upsert({ vendor_profile_id: flag.subject_vendor_id, phrase, allowed_by: userId }, { onConflict: 'vendor_profile_id,phrase', ignoreDuplicates: true });
  if (allowErr) redirect(`${PAGE}?tab=cards&open=${flag.public_id}&error=${encodeURIComponent(allowErr.message)}`);
  await admin.from('admin_audit_log').insert({
    action: 'service_card_allow_word',
    target_id: String(flag.id),
    actor_user_id: userId,
    metadata: { flag_id: flag.id, subject_vendor_id: flag.subject_vendor_id, phrase },
  });

  // The word leaves this card's reasons. If nothing is left, the card would pass now → it is approved.
  const reasons = reasonsFromDetail(flag.detail)
    .map((r) => (r.code === 'words' ? { ...r, hits: r.hits.filter((h) => h !== phrase) } : r))
    .filter((r) => !(r.code === 'words' && r.hits.length === 0));
  const afterReject = flag.detail?.previous === 'rejected' || flag.status === 'rejected';
  if (reasons.length === 0 && !afterReject) {
    const refused = await approveOne(admin, userId, { ...flag, detail: { ...(flag.detail ?? {}), reasons } });
    revalidatePath(PAGE);
    if (refused) redirect(`${PAGE}?tab=cards&open=${flag.public_id}&error=${encodeURIComponent(refused)}`);
    redirect(`${PAGE}?tab=cards&done=approved`);
  }
  await admin
    .from('integrity_flags')
    .update({ detail: { ...(flag.detail ?? {}), reasons }, score: scoreFor(reasons), reason: reasons.length ? primaryReason(reasons) : 'words' })
    .eq('id', flag.id);
  revalidatePath(PAGE);
  redirect(`${PAGE}?tab=cards&open=${flag.public_id}`);
}

export async function addClaimWord(formData: FormData) {
  const { userId } = await requireAdmin();
  const phrase = String(formData.get('phrase') ?? '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 60);
  if (!phrase) redirect(`${PAGE}?tab=cards`);
  const admin = createAdminClient();
  const { error } = await admin.from('card_claim_words').upsert({ phrase, created_by: userId }, { onConflict: 'phrase', ignoreDuplicates: true });
  if (error) redirect(`${PAGE}?tab=cards&error=${encodeURIComponent(error.message)}`);
  await admin.from('admin_audit_log').insert({ action: 'card_claim_word_add', target_id: phrase, actor_user_id: userId, metadata: { phrase } });
  revalidatePath(PAGE);
  redirect(`${PAGE}?tab=cards&words=1`);
}

export async function removeClaimWord(formData: FormData) {
  const { userId } = await requireAdmin();
  const phrase = String(formData.get('phrase') ?? '').trim().toLowerCase();
  if (!phrase) redirect(`${PAGE}?tab=cards`);
  const admin = createAdminClient();
  const { error } = await admin.from('card_claim_words').delete().eq('phrase', phrase);
  if (error) redirect(`${PAGE}?tab=cards&error=${encodeURIComponent(error.message)}`);
  await admin.from('admin_audit_log').insert({ action: 'card_claim_word_remove', target_id: phrase, actor_user_id: userId, metadata: { phrase } });
  revalidatePath(PAGE);
  redirect(`${PAGE}?tab=cards&words=1`);
}
