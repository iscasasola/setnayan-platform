'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { asVendorTier, firstPlanWith, tierCaps, TIER_LABEL } from '@/lib/vendor-tier-caps';
import { notifyHostsOfForm } from '@/lib/vendor-forms-on-booking.server';
import {
  draftItemsOfTemplate,
  itemRow,
  validateFormDraft,
  type FormDraft,
  type FormItemDraft,
} from '@/lib/vendor-forms';

/**
 * 📋 THE FORM MAKER'S WRITES — ONE dispatcher (THE ONE BUILD · C3 Forms; B2 §2.7).
 *
 * One export, four ops, because every exported server action is one Vercel route and the budget sits at its ceiling
 * (`scripts/lint-server-action-budget.mjs`, same shape as `couple-photo-share-actions.ts`):
 *   • `save`   — title + items + card links in ONE call; item order = list index; an item dropped from the list is
 *                RETIRED (`is_asked = false`), never deleted — a couple may already have answered it.
 *   • `retire` — the form leaves the library (`retired_at`); sends and answers stay.
 *   • `use`    — "Use this": COPIES an admin suggestion into the shop's own form (never a live link — an admin edit
 *                never rewrites the copy, DECISION_LOG 2026-10-28).
 *   • `send`   — "Send to chat": records the send (`event_form_sends`), posts ONE line in the conversation as the
 *                supplier, tells the hosts in the app. 🔑 THE SEND IS THE SUCCESS (the shipped
 *                `sendQuestionsToEvent` rule): a failed line or notice is logged, never reported as a failed send.
 *
 * Authorisation is RLS's (`vendor_forms_owner_all`, `event_form_sends_vendor_insert`, the same-shop triggers); every
 * write `.select()`s so a write refused to zero rows is never reported as saved. FORM MEDIA BY PLAN is checked here
 * through the ONE caps home (`tierCaps`), never inline. No email (no new emails without the owner's word).
 *
 * 💾 A save never resets the screen: this returns a state, no redirect.
 */

export type FormsActionState =
  | { status: 'idle' }
  | { status: 'saved'; formId: string; message: string }
  | { status: 'sent'; formId: string; message: string }
  | { status: 'retired'; formId: string }
  | { status: 'error'; message: string };

const NOT_SAVED = 'We couldn’t save this form. Nothing you typed was lost — please try again.';

async function shopContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' } as const;
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { error: 'Only a shop keeps forms.' } as const;
  return { supabase, user, profile } as const;
}

/** The plan gate for one draft — the first refused item names the plan it needs. */
async function planRefusal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  vendorProfileId: string,
  items: FormItemDraft[],
): Promise<string | null> {
  const wantsMedia = items.some((i) => i.kind === 'media');
  const wantsVideo = items.some((i) => i.kind === 'video_link');
  if (!wantsMedia && !wantsVideo) return null;
  const { data, error } = await supabase.from('vendor_profiles').select('tier_state').eq('vendor_profile_id', vendorProfileId).maybeSingle();
  if (error) {
    logQueryError('formsAction.planRefusal', error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return 'We couldn’t read your plan. Nothing was saved — please try again.';
  }
  const caps = tierCaps(asVendorTier((data as { tier_state: string | null } | null)?.tier_state));
  if (wantsMedia && !caps.formMediaUploads) {
    const plan = firstPlanWith((c) => c.formMediaUploads);
    return `Media files on a form come with ${plan ? TIER_LABEL[plan] : 'a higher plan'}.`;
  }
  if (wantsVideo && !caps.formVideoLinks) {
    const plan = firstPlanWith((c) => c.formVideoLinks);
    return `Video links on a form come with ${plan ? TIER_LABEL[plan] : 'a higher plan'}.`;
  }
  return null;
}

function parseDraft(raw: FormDataEntryValue | null): FormDraft | null {
  if (typeof raw !== 'string') return null;
  try {
    const d = JSON.parse(raw) as Partial<FormDraft>;
    if (typeof d.title !== 'string' || !Array.isArray(d.items)) return null;
    return {
      formId: typeof d.formId === 'string' && d.formId ? d.formId : undefined,
      title: d.title,
      items: d.items as FormItemDraft[],
      serviceIds: Array.isArray(d.serviceIds) ? d.serviceIds.filter((s): s is string => typeof s === 'string') : [],
    };
  } catch {
    return null;
  }
}

export async function formsAction(_prev: FormsActionState, formData: FormData): Promise<FormsActionState> {
  const op = String(formData.get('op') ?? '');
  const ctx = await shopContext();
  if ('error' in ctx) return { status: 'error', message: ctx.error ?? 'Please sign in again.' };
  const { supabase, profile } = ctx;
  const shop = profile.vendor_profile_id;
  const path = String(formData.get('return_path') ?? '');

  if (op === 'save') {
    const draft = parseDraft(formData.get('draft'));
    if (!draft) return { status: 'error', message: NOT_SAVED };
    const problems = validateFormDraft(draft);
    if (problems.length) return { status: 'error', message: problems[0]!.message };
    const refusal = await planRefusal(supabase, shop, draft.items);
    if (refusal) return { status: 'error', message: refusal };
    const saved = await saveDraft(supabase, shop, draft);
    if ('error' in saved) return { status: 'error', message: saved.error };
    if (path.startsWith('/vendor-dashboard/')) revalidatePath(path);
    return { status: 'saved', formId: saved.formId, message: 'Saved to your library' };
  }

  if (op === 'retire') {
    const formId = String(formData.get('form_id') ?? '');
    const { data, error } = await supabase
      .from('vendor_forms')
      .update({ retired_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('form_id', formId)
      .eq('vendor_profile_id', shop)
      .select('form_id');
    if (error || !data || data.length !== 1) return { status: 'error', message: 'We couldn’t remove that form. Please try again.' };
    if (path.startsWith('/vendor-dashboard/')) revalidatePath(path);
    return { status: 'retired', formId };
  }

  if (op === 'use') {
    const key = String(formData.get('template_key') ?? '');
    const { data: t, error } = await supabase
      .from('form_templates')
      .select('template_key, title, items')
      .eq('template_key', key)
      .eq('is_active', true)
      .maybeSingle();
    if (error || !t) return { status: 'error', message: 'We couldn’t open that suggestion. Please try again.' };
    const tpl = t as { template_key: string; title: string; items: unknown };
    const items = draftItemsOfTemplate(tpl.items);
    if (items.length === 0) return { status: 'error', message: 'That suggestion has no questions yet.' };
    const saved = await saveDraft(supabase, shop, { title: tpl.title, items, serviceIds: [] }, tpl.template_key);
    if ('error' in saved) return { status: 'error', message: saved.error };
    if (path.startsWith('/vendor-dashboard/')) revalidatePath(path);
    return { status: 'saved', formId: saved.formId, message: 'Added to your library' };
  }

  if (op === 'send') {
    const formId = String(formData.get('form_id') ?? '');
    const eventId = String(formData.get('event_id') ?? '');
    if (!formId || !eventId) return { status: 'error', message: 'Missing form.' };
    const sent = await sendFormIntoEvent(supabase, { shop, shopName: profile.business_name, formId, eventId });
    if ('error' in sent) return { status: 'error', message: sent.error };
    if (path.startsWith('/vendor-dashboard/')) revalidatePath(path);
    return { status: 'sent', formId, message: `Sent to the chat` };
  }

  return { status: 'error', message: 'Unknown action.' };
}

/** One write path for a form + its items + its links (also `use`). */
async function saveDraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shop: string,
  draft: FormDraft,
  fromTemplateKey?: string,
): Promise<{ formId: string } | { error: string }> {
  const now = new Date().toISOString();
  const title = draft.title.trim();
  let formId = draft.formId;
  if (formId) {
    const { data, error } = await supabase
      .from('vendor_forms')
      .update({ title, updated_at: now })
      .eq('form_id', formId)
      .eq('vendor_profile_id', shop)
      .is('retired_at', null)
      .select('form_id');
    if (error || !data || data.length !== 1) return { error: NOT_SAVED };
  } else {
    const { data, error } = await supabase
      .from('vendor_forms')
      .insert({ vendor_profile_id: shop, title, from_template_key: fromTemplateKey ?? null })
      .select('form_id')
      .single();
    if (error || !data) return { error: NOT_SAVED };
    formId = (data as { form_id: string }).form_id;
  }

  // Items: the existing rows of this form, then update / insert in list order; retire what left the list.
  const { data: existing, error: exErr } = await supabase
    .from('vendor_questions')
    .select('question_id')
    .eq('vendor_profile_id', shop)
    .eq('form_id', formId)
    .eq('is_asked', true);
  if (exErr) return { error: NOT_SAVED };
  const keep = new Set<string>();
  for (const [i, it] of draft.items.entries()) {
    const base = itemRow(it, i);
    // `is_required` named here on purpose: this save IS the Required switch's handle (gates-have-handles).
    const row = { ...base, is_required: base.is_required, updated_at: now };
    if (it.id) {
      keep.add(it.id);
      const { data, error } = await supabase
        .from('vendor_questions')
        .update(row)
        .eq('question_id', it.id)
        .eq('form_id', formId)
        .select('question_id');
      if (error || !data || data.length !== 1) return { error: NOT_SAVED };
    } else {
      const { error } = await supabase.from('vendor_questions').insert({ ...row, vendor_profile_id: shop, form_id: formId });
      if (error) return { error: NOT_SAVED };
    }
  }
  const dropped = ((existing ?? []) as { question_id: string }[]).map((r) => r.question_id).filter((id) => !keep.has(id));
  if (dropped.length) {
    const { error } = await supabase
      .from('vendor_questions')
      .update({ is_asked: false, updated_at: now })
      .eq('form_id', formId)
      .in('question_id', dropped);
    if (error) return { error: NOT_SAVED };
  }

  // Links: exactly the picked cards.
  const want = new Set(draft.serviceIds);
  const { data: links, error: lErr } = await supabase.from('vendor_form_service_links').select('vendor_service_id').eq('form_id', formId);
  if (lErr) return { error: NOT_SAVED };
  const have = new Set(((links ?? []) as { vendor_service_id: string }[]).map((l) => l.vendor_service_id));
  const add = [...want].filter((s) => !have.has(s));
  const remove = [...have].filter((s) => !want.has(s));
  if (add.length) {
    const { error } = await supabase
      .from('vendor_form_service_links')
      .insert(add.map((vendor_service_id) => ({ form_id: formId, vendor_service_id })));
    if (error) return { error: 'Saved — but a service card could not be linked. Please try again.' };
  }
  if (remove.length) {
    const { error } = await supabase.from('vendor_form_service_links').delete().eq('form_id', formId).in('vendor_service_id', remove);
    if (error) return { error: 'Saved — but a service card could not be unlinked. Please try again.' };
  }
  return { formId: formId! };
}

/** Send one of the shop's live forms into an event it talks to (the supplier's own session). */
async function sendFormIntoEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: { shop: string; shopName: string | null; formId: string; eventId: string },
): Promise<{ ok: true } | { error: string }> {
  const { data: thread, error: tErr } = await supabase
    .from('chat_threads')
    .select('thread_id, event_id, vendor_profile_id')
    .eq('event_id', args.eventId)
    .eq('vendor_profile_id', args.shop)
    .maybeSingle();
  if (tErr) return { error: 'We couldn’t send this form. Please try again.' };
  if (!thread) return { error: 'Start a conversation with this couple first.' };
  const t = thread as { thread_id: string; event_id: string; vendor_profile_id: string };

  const { data: form, error: fErr } = await supabase
    .from('vendor_forms')
    .select('form_id, title')
    .eq('form_id', args.formId)
    .eq('vendor_profile_id', args.shop)
    .is('retired_at', null)
    .maybeSingle();
  if (fErr || !form) return { error: 'That form is not in your library.' };
  const title = (form as { title: string }).title;

  // 1 · the send. Upsert: a re-send moves sent_at only (first_sent_at is the database's).
  const { data: rows, error: sErr } = await supabase
    .from('event_form_sends')
    .upsert(
      {
        event_id: t.event_id,
        form_id: args.formId,
        vendor_profile_id: args.shop,
        thread_id: t.thread_id,
        sent_by: 'supplier',
        sent_at: new Date().toISOString(),
      },
      { onConflict: 'event_id,form_id' },
    )
    .select('form_id');
  if (sErr || !rows || rows.length !== 1) {
    if (sErr) console.error('[formsAction.send] send failed:', sErr.message);
    return { error: 'We couldn’t send this form. Please try again.' };
  }

  // 2 · one line in the conversation, as the supplier.
  const { error: msgError } = await supabase.from('chat_messages').insert({
    thread_id: t.thread_id,
    event_id: t.event_id,
    vendor_profile_id: t.vendor_profile_id,
    body: `I sent you a form — “${title}”. Answer it in your event.`,
  });
  if (msgError) console.error('[formsAction.send] line failed:', msgError.message);

  // 3 · tell the hosts, in the app only.
  await notifyHostsOfForm({ eventId: t.event_id, threadId: t.thread_id, shop: args.shop, shopName: args.shopName, title });
  return { ok: true };
}
