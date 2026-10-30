'use server';

/**
 * 📸 A COUPLE'S OWN PHOTO, SHARED TO A SUPPLIER'S SERVICE CARD — the ONE server action both sides call (owner
 * 2026-10-30, DECISION_LOG "A CUSTOMER'S PHOTO SHARED TO A SUPPLIER'S INSPIRATION — THE SUPPLIER APPROVES, IT SYNCS TO
 * THEIR SERVICE CARD; THE CUSTOMER GETS A CREDIT LINE + AN OPTIONAL SUPPLIER GIFT, NEVER CASH").
 *
 *   { op: 'read' }       the couple's sheet's ONE batched read: the photo at (part, place), the linked shops' live
 *                        cards, this photo's shares so far, and the names credit
 *   { op: 'send' }       the couple sends it — consent + credit — to ONE card; the shop is told in-app (no email)
 *   { op: 'take_back' }  the uploader takes it back; an approved photo leaves the card at once
 *   { op: 'answer' }     the SHOP approves, declines, or takes an approved one off its card; the couple is told in-app
 *
 * 🔢 ONE EXPORT ON PURPOSE: every exported server action is a Vercel route and the repo budget
 * (`scripts/lint-server-action-budget.mjs`) sat at its ceiling — four exports would have been four routes.
 *
 * 🔑 Every rule is in SQL (migration 20271297221336), and each op runs under the CALLER'S OWN session (never the
 * admin client), so `auth.uid()` is the person pressing: the couple doors check the event's couple AND the photo's
 * uploader, own upload, live card, shop on the event, consent; the answer door checks the shop's owner/admin team.
 * This file only carries input and says the answer in plain words.
 *
 * 🚫 No money anywhere: nothing here prices, credits or pays, and the page-photo room is not touched
 * (`COUPLE_PHOTOS_USE_PAGE_ROOM`, an OPEN owner question). The thank-you is the credit line — and, optionally, the
 * SHOP'S own Gift (the 2026-10-28 Gift feature), which nothing here gives.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { refuseLimitedHelper } from '@/lib/host-gate';
import { emitNotification } from '@/lib/notification-emit';
import {
  COUPLE_PHOTO_CONSENT_VERSION,
  SHOP_COUPLE_PHOTOS_HREF,
  answeredNoticeTitle,
  coupleNamesCredit,
  sharedNoticeTitle,
  shareRefusalWords,
  shopAnswerDoneLine,
  type AnswerCouplePhotoResult,
  type CouplePhotoShareReply,
  type CouplePhotoShareRequest,
  type CouplePhotoShareState,
  type PhotoShareCard,
  type PhotoShareOptions,
  type PhotoShareRow,
  type SendPhotoShareInput,
  type ShareResult,
} from '@/lib/couple-photo-share';

export async function couplePhotoShare(req: CouplePhotoShareRequest): Promise<CouplePhotoShareReply> {
  switch (req.op) {
    case 'read':
      return { op: 'read', result: await readPhotoShareOptions(req.eventId, req.slotKey, req.slotPosition) };
    case 'send':
      return { op: 'send', result: await sharePhotoWithSupplier(req) };
    case 'take_back':
      return { op: 'take_back', result: await withdrawPhotoShare(req.eventId, req.shareId) };
    case 'answer':
      return { op: 'answer', result: await answerCouplePhoto(req.shareId, req.approve) };
  }
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

async function readPhotoShareOptions(eventId: string, slotKey: string, slotPosition: number): Promise<PhotoShareOptions> {
  await refuseLimitedHelper(eventId, 'mood_board');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error' };

  // ONE batched read: the photo, the event's names, and the linked shops — together.
  const [photoRes, eventRes, linkRes] = await Promise.all([
    supabase
      .from('event_inspiration_assets')
      .select('inspiration_id, source_kind, added_by_user_id')
      .eq('event_id', eventId)
      .eq('slot_key', slotKey)
      .eq('slot_position', slotPosition)
      .is('removed_at', null)
      .maybeSingle(),
    supabase
      .from('events')
      .select('display_name, bride_name, groom_name, event_date, event_date_precision')
      .eq('event_id', eventId)
      .maybeSingle(),
    supabase
      .from('event_vendors')
      .select('marketplace_vendor_id, service_id')
      .eq('event_id', eventId)
      .is('archived_at', null)
      .not('marketplace_vendor_id', 'is', null),
  ]);
  if (photoRes.error || eventRes.error || linkRes.error) {
    logQueryError('readPhotoShareOptions', photoRes.error ?? eventRes.error ?? linkRes.error, { eventId, slotKey, slotPosition });
    return { status: 'error' };
  }
  const photo = photoRes.data as { inspiration_id: string; source_kind: string; added_by_user_id: string } | null;
  if (!photo) return { status: 'gone' };

  const links = (linkRes.data ?? []) as Array<{ marketplace_vendor_id: string; service_id: string | null }>;
  const shopIds = [...new Set(links.map((l) => l.marketplace_vendor_id))];
  const booked = new Set(links.map((l) => l.service_id).filter((x): x is string => Boolean(x)));

  const [cardRes, shareRes] = await Promise.all([
    shopIds.length
      ? supabase
          .from('vendor_services')
          .select('vendor_service_id, title, vendor_profile_id, vendor_profiles ( business_name )')
          .in('vendor_profile_id', shopIds)
          .eq('is_active', true)
          .limit(60)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('couple_photo_shares')
      .select('share_id, state, credit_line, vendor_services ( title ), vendor_profiles ( business_name )')
      .eq('inspiration_id', photo.inspiration_id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);
  if (cardRes.error || shareRes.error) {
    logQueryError('readPhotoShareOptions.cards', cardRes.error ?? shareRes.error, { eventId });
    return { status: 'error' };
  }

  type CardRow = { vendor_service_id: string; title: string | null; vendor_profile_id: string; vendor_profiles: { business_name: string | null } | { business_name: string | null }[] | null };
  const cards: PhotoShareCard[] = ((cardRes.data ?? []) as CardRow[])
    .map((c) => ({
      vendorServiceId: c.vendor_service_id,
      title: (c.title ?? '').trim() || 'Service card',
      shop: one(c.vendor_profiles)?.business_name?.trim() || 'Your supplier',
    }))
    // The card the couple booked comes first, then by shop and title.
    .sort((a, b) => Number(booked.has(b.vendorServiceId)) - Number(booked.has(a.vendorServiceId)) || a.shop.localeCompare(b.shop) || a.title.localeCompare(b.title));

  type ShareRow = { share_id: string; state: CouplePhotoShareState; credit_line: string; vendor_services: { title: string | null } | { title: string | null }[] | null; vendor_profiles: { business_name: string | null } | { business_name: string | null }[] | null };
  const shares: PhotoShareRow[] = ((shareRes.data ?? []) as ShareRow[]).map((s) => ({
    shareId: s.share_id,
    state: s.state,
    credit: s.credit_line,
    serviceTitle: one(s.vendor_services)?.title?.trim() || 'Service card',
    shop: one(s.vendor_profiles)?.business_name?.trim() || 'Your supplier',
  }));

  const ev = (eventRes.data ?? {}) as { display_name?: string | null; bride_name?: string | null; groom_name?: string | null; event_date?: string | null; event_date_precision?: string | null };
  return {
    status: 'ok',
    shareable: photo.source_kind === 'file_upload' && photo.added_by_user_id === user.id,
    inspirationId: photo.inspiration_id,
    cards,
    shares,
    namesCredit: coupleNamesCredit(ev, new Date().toISOString()),
  };
}

async function sharePhotoWithSupplier(input: SendPhotoShareInput): Promise<ShareResult> {
  await refuseLimitedHelper(input.eventId, 'mood_board');
  if (!input.consent) return { status: 'refused', message: shareRefusalWords('no_consent') };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('couple_share_photo_with_supplier', {
    p_inspiration_id: input.inspirationId,
    p_vendor_service_id: input.vendorServiceId,
    p_credit_style: input.creditStyle,
    p_credit_line: input.creditStyle === 'names' ? input.creditLine : null,
    p_consent_version: COUPLE_PHOTO_CONSENT_VERSION,
  });
  if (error) {
    logQueryError('sharePhotoWithSupplier', error, { eventId: input.eventId });
    return { status: 'refused', message: shareRefusalWords(null) };
  }
  const r = (data ?? {}) as { status?: string; share_id?: string; shop_label?: string; shop_owner_user_id?: string | null };
  if (r.status !== 'ok' || !r.share_id) return { status: 'refused', message: shareRefusalWords(r.status) };

  // 🔔 The shop is told IN-APP (no email — `couple_photo_shared` is not on EMAIL_ENABLED_TYPES).
  if (r.shop_owner_user_id) {
    const { data: card } = await supabase.from('vendor_services').select('title').eq('vendor_service_id', input.vendorServiceId).maybeSingle();
    await emitNotification({
      userId: r.shop_owner_user_id,
      type: 'couple_photo_shared',
      title: sharedNoticeTitle(((card as { title?: string | null } | null)?.title ?? '').trim() || 'your service card'),
      body: 'Approve it to show it on your service card, or decline — it shows nowhere until you approve.',
      relatedUrl: SHOP_COUPLE_PHOTOS_HREF,
    });
  }
  revalidatePath(`/dashboard/${input.eventId}/studio/mood-board`);
  return { status: 'ok', shareId: r.share_id, shop: r.shop_label ?? 'Your supplier' };
}

async function withdrawPhotoShare(eventId: string, shareId: string): Promise<{ status: 'ok' | 'gone' | 'error' }> {
  await refuseLimitedHelper(eventId, 'mood_board');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('couple_withdraw_photo_share', { p_share_id: shareId });
  if (error) {
    logQueryError('withdrawPhotoShare', error, { eventId, shareId });
    return { status: 'error' };
  }
  const status = (data as { status?: string } | null)?.status;
  if (status === 'already') return { status: 'gone' };
  if (status !== 'ok') return { status: 'error' };
  revalidatePath(`/dashboard/${eventId}/studio/mood-board`);
  return { status: 'ok' };
}

/* ══ the SHOP's answer ══ */

async function answerCouplePhoto(shareId: string, approve: boolean): Promise<AnswerCouplePhotoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'refused', message: 'Sign back in to answer.' };

  const { data, error } = await supabase.rpc('vendor_answer_couple_photo', { p_share_id: shareId, p_approve: approve });
  if (error) {
    logQueryError('answerCouplePhoto', error, { shareId });
    return { status: 'refused', message: 'That did not go through — nothing changed. Try again.' };
  }
  const r = (data ?? {}) as { status?: string; was?: CouplePhotoShareState; event_id?: string; shared_by_user_id?: string };
  if (r.status === 'withdrawn') return { status: 'refused', message: 'The couple took this photo back — it shows nowhere.' };
  if (r.status === 'gone') return { status: 'refused', message: 'The couple removed this photo from their board — it shows nowhere.' };
  if (r.status === 'already') return { status: 'refused', message: 'This photo was already answered.' };
  if (r.status !== 'ok') return { status: 'refused', message: 'That did not go through — nothing changed. Try again.' };

  // 🔔 The uploader is told IN-APP (no email — `couple_photo_answered` is not on EMAIL_ENABLED_TYPES). A take-off of an
  // approved photo says the same as a decline: it is not on the card.
  if (r.shared_by_user_id && r.event_id) {
    const { data: shop } = await supabase.from('couple_photo_shares').select('vendor_profiles ( business_name )').eq('share_id', shareId).maybeSingle();
    const vp = (shop as { vendor_profiles?: { business_name?: string | null } | { business_name?: string | null }[] | null } | null)?.vendor_profiles;
    const name = (Array.isArray(vp) ? vp[0]?.business_name : vp?.business_name)?.trim() || 'Your supplier';
    await emitNotification({
      userId: r.shared_by_user_id,
      type: 'couple_photo_answered',
      title: answeredNoticeTitle(name, approve),
      body: approve ? 'It shows there with your credit line. You can take it back at any time.' : null,
      relatedUrl: `/dashboard/${r.event_id}/studio/mood-board`,
    });
  }
  revalidatePath('/vendor-dashboard/shop');
  return { status: 'ok', approved: approve, line: shopAnswerDoneLine(approve, r.was ?? null) };
}
