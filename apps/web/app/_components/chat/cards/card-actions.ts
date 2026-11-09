'use server';

/**
 * 🪜 THE LANE-C CHAT CARDS — their reads and their few writes (Supplier Build 3 · lane C).
 *
 * RULE 0: every Send goes to a SHIPPED writer wherever one exists —
 *   Change quote / guest-count Apply → `sendCustomProposalFromChat` (a new version; supersede + card + accept again)
 *   Payment (ask now)                → `vendorAskForPayment`
 *   Log a payment                    → `logPayment` (budget actions) — wrapped here ONLY to hold the coordinator Agree
 *   Form (send)                      → `formsAction` op=send · answering → `saveSupplierAnswers`
 * New here, because nothing shipped does it: Ask for a change (`ask_for_a_change` / `answer_change_ask`, migration
 * 20271332041210), Keep price and the Decision lines (plain chat lines, the sender's own RLS insert).
 *
 * AUTHORISATION IS RLS'S on every read and write below (the caller's own session). A refused read returns
 * `{ ok: false }` and the card says "Couldn't load" — never an empty list dressed as "none yet".
 */
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { logPayment } from '@/app/dashboard/[eventId]/budget/actions';
import { loadCatalogueExtrasForQuote } from '@/app/vendor-dashboard/messages/[threadId]/proposal-actions';
import { seedScheduleFromStored } from '@/lib/quote-revision-seed';
import { readShopForms } from '@/lib/vendor-forms.server';
import { formLockOf, quoteLocksOf, type ItemLocks } from '@/lib/quote-locks';
import {
  askRefusalWords,
  decisionLine,
  logPaymentRefusal,
  needsCoordinatorAgree,
  type AskSubject,
  type CardLine,
  type PerPaxLine,
} from '@/lib/chat-cards';
import type { AutoBalanceMeta, InstallmentDraft } from '@/lib/proposal-payment-schedule';
import { isSafeNext } from '@/lib/safe-next';
import { askForPaymentCore } from '@/app/vendor-dashboard/clients/[eventId]/actions';

type Fail = { ok: false };

// ── Change quote · the live quote, its floor, its locks, the catalogue ───────

export type QuoteForCard = {
  proposalId: string;
  publicId: string;
  title: string;
  status: string;
  totalCentavos: number;
  lines: CardLine[];
  validUntil: string | null;
  paymentMethodIds: string[];
  gift: boolean | null;
  serviceCardIds: string[] | null;
  plan: { manual: InstallmentDraft[]; autoBalance: AutoBalanceMeta } | null;
  /** The stored crew-meal credit, carried so the server's base stays total + credit. */
  creditCentavos: number;
  /** The paid quotation's total once a payment is confirmed; null = no floor yet. */
  floorCentavos: number | null;
  /** The plan rows a confirmed payment is attributed to — frozen on every face. */
  paidSeqs: number[];
  locks: ItemLocks;
  extras: { id: string; label: string; qty: number; pricePhp: number }[];
  pax: number | null;
  /**
   * The shipped S5 gate (`vendor_may_requote`): a confirmed booking or an open lock request refuses a new version.
   * ⚠ Owner 8 Nov rules a paid booking CAN be re-quoted (the paid one is the floor) — that conflicts with S5 and is
   * reported, not overridden here: the card says what the server will say before the supplier builds anything.
   */
  requote: 'ok' | 'deal_locked' | 'lock_requested';
};

const QUOTE_COLS =
  'proposal_id, public_id, title, total_centavos, status, sent_at, valid_until, line_items, payment_method_ids, payment_schedule, includes_setnayan_gift, service_card_ids, changes_locked, plan_locked';

function cardLinesOf(raw: unknown): CardLine[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((l, i) => {
    const r = (l ?? {}) as { label?: unknown; detail?: unknown; amount_centavos?: unknown };
    const amt = r.amount_centavos == null ? null : Math.round(Number(r.amount_centavos));
    return {
      key: `l${i}`,
      label: String(r.label ?? '').trim() || 'Line item',
      detail: r.detail == null ? null : String(r.detail),
      amountCentavos: amt == null || !Number.isFinite(amt) ? null : amt,
    };
  });
}

async function liveQuote(supabase: Awaited<ReturnType<typeof createClient>>, eventId: string, shop: string) {
  return supabase
    .from('vendor_proposals')
    .select(QUOTE_COLS)
    .eq('event_id', eventId)
    .eq('vendor_profile_id', shop)
    .in('status', ['sent', 'viewed', 'accepted'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
}

/** The plan rows already paid (a confirmed, unrefused payment carrying its `schedule_instance_seq`); null = unread. */
async function paidSeqsOf(supabase: Awaited<ReturnType<typeof createClient>>, eventId: string, shop: string): Promise<number[] | null> {
  const { data: ev, error } = await supabase
    .from('event_vendors')
    .select('vendor_id')
    .eq('event_id', eventId)
    .eq('marketplace_vendor_id', shop)
    .limit(1)
    .maybeSingle();
  if (error) return null;
  if (!ev) return [];
  const { data, error: pErr } = await supabase
    .from('event_vendor_payments')
    .select('schedule_instance_seq')
    .eq('vendor_id', (ev as { vendor_id: string }).vendor_id)
    .not('vendor_confirmed_at', 'is', null)
    .is('payment_refused_at', null);
  if (pErr) return null;
  return ((data ?? []) as { schedule_instance_seq: number | null }[])
    .map((r) => r.schedule_instance_seq)
    .filter((v): v is number => typeof v === 'number');
}

/** The supplier's live quote in this chat, shaped for the step-by-step Change quote card. */
export type QuoteRead = { ok: true; quote: QuoteForCard | null } | Fail;

export async function loadQuoteForCard(threadId: string): Promise<QuoteRead> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };
  const profile = await fetchOwnVendorProfile(supabase, auth.user.id);
  if (!profile) return { ok: false };
  const { data: thread, error: tErr } = await supabase
    .from('chat_threads')
    .select('thread_id, event_id, vendor_profile_id, pax_current')
    .eq('thread_id', threadId)
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  if (tErr || !thread) return { ok: false };
  const t = thread as { event_id: string; vendor_profile_id: string; pax_current: number | null };
  const [{ data: q, error: qErr }, floorRes, extras, gate] = await Promise.all([
    liveQuote(supabase, t.event_id, t.vendor_profile_id),
    supabase.rpc('paid_quote_floor_centavos', { p_event_id: t.event_id, p_vendor_profile_id: t.vendor_profile_id }),
    loadCatalogueExtrasForQuote().catch(() => []),
    supabase.rpc('vendor_may_requote', { p_event_id: t.event_id, p_vendor_profile_id: t.vendor_profile_id }),
  ]);
  // A refused floor read must not pass as "no floor": the card would let a lower price through to the server.
  if (qErr || floorRes.error || gate.error) return { ok: false };
  // No live quote in this chat: an honest empty, never a refusal.
  if (!q) return { ok: true, quote: null };
  const row = q as Record<string, unknown>;
  const paid = await paidSeqsOf(supabase, t.event_id, t.vendor_profile_id);
  if (!paid) return { ok: false };
  const seed = seedScheduleFromStored(row.payment_schedule);
  const pax = typeof t.pax_current === 'number' && t.pax_current > 0 ? t.pax_current : null;
  return {
    ok: true,
    quote: {
    proposalId: String(row.proposal_id),
    publicId: String(row.public_id),
    title: String(row.title ?? 'Quote'),
    status: String(row.status),
    totalCentavos: Math.round(Number(row.total_centavos) || 0),
    lines: cardLinesOf(row.line_items),
    validUntil: (row.valid_until as string | null) ?? null,
    paymentMethodIds: Array.isArray(row.payment_method_ids) ? (row.payment_method_ids as string[]) : [],
    gift: typeof row.includes_setnayan_gift === 'boolean' ? row.includes_setnayan_gift : null,
    serviceCardIds: Array.isArray(row.service_card_ids) ? (row.service_card_ids as string[]) : null,
    plan: seed ? { manual: seed.manual, autoBalance: seed.autoBalance ?? { label: 'Final balance', due: 'before_event', offsetDays: 14 } } : null,
    creditCentavos: Math.max(0, Math.round(Number((row.payment_schedule as { credit_centavos?: unknown } | null)?.credit_centavos) || 0)),
    floorCentavos: floorRes.data == null ? null : Math.round(Number(floorRes.data)),
    paidSeqs: paid,
    locks: quoteLocksOf(row as { changes_locked?: boolean; plan_locked?: boolean }),
    extras: (extras ?? []).map((x) => {
      const perPax = x.line.basis === 'per_pax';
      return {
        id: x.id,
        label: x.label,
        qty: perPax ? Math.max(pax ?? 0, x.line.minPax || 0) || 1 : 1,
        pricePhp: perPax ? x.line.ratePhp : x.line.free ? 0 : x.line.basis === 'per_hour' ? x.line.basePhp : x.line.flatPhp,
      };
    }),
    pax,
    requote: gate.data === 'deal_locked' ? 'deal_locked' : gate.data === 'lock_requested' ? 'lock_requested' : 'ok',
    },
  };
}

// ── Guest-count recount · only the quote's per-guest lines ───────────────────

export type RecountRead = { ok: true; quote: QuoteForCard | null; perPax: PerPaxLine[] };

/** The live quote and the per-guest service cards it was built from (`pricing_basis = 'per_pax'`), matched by name. */
export async function loadRecount(threadId: string): Promise<RecountRead | Fail> {
  const read = await loadQuoteForCard(threadId);
  if (!read.ok) return { ok: false };
  const quote = read.quote;
  if (!quote || !quote.serviceCardIds || quote.serviceCardIds.length === 0) return { ok: true, quote, perPax: [] };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('vendor_services')
    .select('vendor_service_id, title, pricing_basis, per_pax_price_php, min_pax')
    .in('vendor_service_id', quote.serviceCardIds);
  if (error) return { ok: false };
  const cards = (data ?? []) as { vendor_service_id: string; title: string | null; pricing_basis: string | null; per_pax_price_php: number | null; min_pax: number | null }[];
  const perPax: PerPaxLine[] = [];
  for (const c of cards) {
    if (c.pricing_basis !== 'per_pax' || !c.per_pax_price_php || !c.title) continue;
    const line = quote.lines.find((l) => l.label.trim().toLowerCase() === c.title!.trim().toLowerCase());
    if (!line) continue;
    perPax.push({ key: line.key, label: line.label, rateCentavos: Math.round(c.per_pax_price_php * 100), minPax: Math.max(0, c.min_pax ?? 0) });
  }
  return { ok: true, quote, perPax };
}

// ── Ask for a change ─────────────────────────────────────────────────────────

export type AskResult = { ok: true } | { ok: false; message: string };

/** A host or coordinator asks; the database refuses a locked item and the shop's own team. */
export async function askForAChangeFromChat(formData: FormData): Promise<AskResult> {
  const threadId = String(formData.get('thread_id') ?? '');
  const subject = String(formData.get('subject') ?? '') as AskSubject;
  const note = String(formData.get('note') ?? '').trim();
  const proposalId = String(formData.get('proposal_id') ?? '') || null;
  const formId = String(formData.get('form_id') ?? '') || null;
  const back = String(formData.get('return_to') ?? '');
  if (!threadId || !['quote', 'plan', 'form'].includes(subject) || !note) return { ok: false, message: askRefusalWords('BAD_ASK') };
  const supabase = await createClient();
  const { error } = await supabase.rpc('ask_for_a_change', {
    p_thread_id: threadId,
    p_subject: subject,
    p_note: note.slice(0, 1000),
    p_proposal_id: proposalId,
    p_form_id: formId,
  });
  if (error) return { ok: false, message: askRefusalWords(error.message) };
  if (isSafeNext(back)) revalidatePath(back);
  return { ok: true };
}

export type ChangeAskRow = { askId: string; subject: AskSubject; note: string; askedAt: string; status: 'open' | 'revised' | 'declined'; proposalId: string | null };

/** This chat's asks, newest first — the card finds its own by the moment it was asked. */
export async function loadChangeAsks(threadId: string): Promise<{ ok: true; asks: ChangeAskRow[] } | Fail> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('booking_change_asks')
    .select('ask_id, subject, note, asked_at, status, proposal_id')
    .eq('thread_id', threadId)
    .order('asked_at', { ascending: false })
    .limit(40);
  if (error) return { ok: false };
  return {
    ok: true,
    asks: ((data ?? []) as { ask_id: string; subject: AskSubject; note: string; asked_at: string; status: ChangeAskRow['status']; proposal_id: string | null }[]).map((r) => ({
      askId: r.ask_id,
      subject: r.subject,
      note: r.note,
      askedAt: r.asked_at,
      status: r.status,
      proposalId: r.proposal_id,
    })),
  };
}

/** The supplier answers: Revise (a new version follows from the Quote card) or Decline. */
export async function answerChangeAskFromChat(formData: FormData): Promise<AskResult> {
  const askId = String(formData.get('ask_id') ?? '');
  const answer = String(formData.get('answer') ?? '');
  const back = String(formData.get('return_to') ?? '');
  if (!askId || (answer !== 'revised' && answer !== 'declined')) return { ok: false, message: "Couldn't send that. Try again." };
  const supabase = await createClient();
  const { error } = await supabase.rpc('answer_change_ask', {
    p_ask_id: askId,
    p_answer: answer,
    p_note: String(formData.get('note') ?? '').slice(0, 500) || null,
  });
  if (error) return { ok: false, message: "Couldn't send that. Try again." };
  if (isSafeNext(back)) revalidatePath(back);
  return { ok: true };
}

// ── Log a payment · the coordinator's Agree is REQUIRED ──────────────────────

/** The booking a host logs against, and whether it is a coordinator/planner (Agree required). */
export async function loadLogPaymentTarget(threadId: string): Promise<
  { ok: true; eventId: string; vendorId: string; toCoordinator: boolean; supplierName: string } | { ok: true; eventId: string; vendorId: null } | Fail
> {
  const supabase = await createClient();
  const { data: thread, error: tErr } = await supabase
    .from('chat_threads')
    .select('event_id, vendor_profile_id')
    .eq('thread_id', threadId)
    .maybeSingle();
  if (tErr || !thread) return { ok: false };
  const t = thread as { event_id: string; vendor_profile_id: string };
  const { data, error } = await supabase
    .from('event_vendors')
    .select('vendor_id, category, vendor_name')
    .eq('event_id', t.event_id)
    .eq('marketplace_vendor_id', t.vendor_profile_id)
    .limit(1)
    .maybeSingle();
  // Not on the event's supplier list yet: an honest "nothing to log against", not a refusal.
  if (!error && !data) return { ok: true, eventId: t.event_id, vendorId: null };
  if (error || !data) return { ok: false };
  const r = data as { vendor_id: string; category: string | null; vendor_name: string | null };
  return { ok: true, eventId: t.event_id, vendorId: r.vendor_id, toCoordinator: needsCoordinatorAgree(r.category), supplierName: r.vendor_name ?? 'your supplier' };
}

/**
 * The host's Log a payment from the chat. The ONLY rule added to the shipped `logPayment`: a payment proof to a
 * coordinator/planner is refused without the Agree (owner, 8 Nov: "No, Agree is required"). The category is read
 * HERE, from the booking, never trusted from the form.
 */
export async function logPaymentFromChat(formData: FormData): Promise<AskResult> {
  const eventId = String(formData.get('event_id') ?? '');
  const vendorId = String(formData.get('vendor_id') ?? '');
  if (!eventId || !vendorId) return { ok: false, message: "Couldn't send that. Try again." };
  const supabase = await createClient();
  const { data: booking, error } = await supabase
    .from('event_vendors')
    .select('category')
    .eq('vendor_id', vendorId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (error || !booking) return { ok: false, message: "Couldn't send that. Try again." };
  const refusal = logPaymentRefusal({
    toCoordinator: needsCoordinatorAgree((booking as { category: string | null }).category),
    agree: formData.get('agree') === '1',
  });
  if (refusal) return { ok: false, message: refusal };
  try {
    await logPayment(formData);
  } catch (e) {
    unstable_rethrow(e); // a limited helper's refusal is a redirect, not a failed write
    console.error('[chat-cards] logPayment refused:', (e as Error).message);
    return { ok: false, message: "Couldn't log that payment. Check the amount and try again." };
  }
  return { ok: true };
}

// ── Plain lines: Keep price · a Decision opened or closed ───────────────────

async function postOwnLine(threadId: string, body: string): Promise<AskResult> {
  const supabase = await createClient();
  const { data: thread, error: tErr } = await supabase
    .from('chat_threads')
    .select('thread_id, event_id, vendor_profile_id')
    .eq('thread_id', threadId)
    .maybeSingle();
  if (tErr || !thread) return { ok: false, message: "Couldn't send that. Try again." };
  const t = thread as { thread_id: string; event_id: string; vendor_profile_id: string };
  // sender_user_id / sender_role are the database's to derive (migration 20271132839561).
  const { error } = await supabase.from('chat_messages').insert({ thread_id: t.thread_id, event_id: t.event_id, vendor_profile_id: t.vendor_profile_id, body: body.slice(0, 2000) });
  if (error) return { ok: false, message: "Couldn't send that. Try again." };
  return { ok: true };
}

export async function keepPriceFromChat(formData: FormData): Promise<AskResult> {
  const threadId = String(formData.get('thread_id') ?? '');
  const total = String(formData.get('total_words') ?? '').slice(0, 40);
  const guests = Math.round(Number(formData.get('guests')) || 0);
  if (!threadId || !total || guests <= 0) return { ok: false, message: "Couldn't send that. Try again." };
  return postOwnLine(threadId, `Kept the price at ${total} for ${guests.toLocaleString('en-PH')} guests`);
}

export async function decisionLineFromChat(formData: FormData): Promise<AskResult> {
  const threadId = String(formData.get('thread_id') ?? '');
  const topic = String(formData.get('topic') ?? '').trim();
  const act = String(formData.get('act') ?? 'open');
  if (!threadId || !topic || (act !== 'open' && act !== 'close' && act !== 'reopen')) return { ok: false, message: 'Name the topic first.' };
  return postOwnLine(threadId, decisionLine(topic, act, await whoIsWriting()));
}

/** The name a line says it is "by" — the shop's name for its team, the person's own display name otherwise. */
async function whoIsWriting(): Promise<string> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return 'you';
  const profile = await fetchOwnVendorProfile(supabase, auth.user.id);
  if (profile?.business_name?.trim()) return profile.business_name.trim().slice(0, 60);
  const { data } = await supabase.from('users').select('display_name').eq('user_id', auth.user.id).maybeSingle();
  const name = String((data as { display_name?: string | null } | null)?.display_name ?? '').trim();
  return (name.split(/\s+/)[0] || 'a host').slice(0, 60);
}

// ── Form · the shop's library ────────────────────────────────────────────────

export async function loadShopFormsForCard(): Promise<{ ok: true; forms: { formId: string; title: string; questions: string[] }[] } | Fail> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };
  const profile = await fetchOwnVendorProfile(supabase, auth.user.id);
  if (!profile) return { ok: false };
  const read = await readShopForms(supabase, profile.vendor_profile_id);
  if (read.status !== 'ok') return { ok: false };
  return {
    ok: true,
    forms: read.forms.map((f) => ({
      formId: f.formId,
      title: f.title,
      questions: f.items.filter((it) => it.item_kind === 'question' && it.is_asked).map((it) => it.prompt),
    })),
  };
}

export type FormToAnswer = {
  eventId: string;
  vendorProfileId: string;
  formId: string;
  title: string;
  locked: boolean;
  questions: { id: string; prompt: string; answer: string | null }[];
};

/**
 * The form a supplier's "I sent you a form — “<title>”" line names, for the host's one-at-a-time face. The line carries
 * no id (the shipped send writes words only), so the form is found among THIS chat's sends by its title; null = not
 * found (retired since, or renamed) — the line then stays a plain line.
 */
export async function loadSentFormForAnswer(threadId: string, title: string): Promise<{ ok: true; form: FormToAnswer | null } | Fail> {
  const supabase = await createClient();
  const { data: thread, error: tErr } = await supabase.from('chat_threads').select('event_id, vendor_profile_id').eq('thread_id', threadId).maybeSingle();
  if (tErr || !thread) return { ok: false };
  const t = thread as { event_id: string; vendor_profile_id: string };
  const { data: sends, error: sErr } = await supabase
    .from('event_form_sends')
    .select('form_id, locked, vendor_forms ( title )')
    .eq('event_id', t.event_id)
    .eq('vendor_profile_id', t.vendor_profile_id);
  if (sErr) return { ok: false };
  const hit = ((sends ?? []) as unknown as { form_id: string; locked: boolean | null; vendor_forms: { title: string | null } | null }[]).find(
    (r) => (r.vendor_forms?.title ?? '').trim() === title.trim(),
  );
  if (!hit) return { ok: true, form: null };
  const qs = await loadFormForAnswer({ eventId: t.event_id, formId: hit.form_id });
  if (!qs.ok) return { ok: false };
  return { ok: true, form: { eventId: t.event_id, vendorProfileId: t.vendor_profile_id, formId: hit.form_id, title, locked: formLockOf(hit), questions: qs.questions } };
}

/** A sent form's questions and this event's answers. */
async function loadFormForAnswer(input: { eventId: string; formId: string }): Promise<
  { ok: true; questions: { id: string; prompt: string; answer: string | null }[] } | Fail
> {
  const supabase = await createClient();
  const [{ data: items, error: iErr }, { data: answers, error: aErr }] = await Promise.all([
    supabase.from('vendor_questions').select('question_id, prompt, item_kind, is_asked, display_order').eq('form_id', input.formId).order('display_order'),
    supabase.from('event_question_answers').select('question_id, answer').eq('event_id', input.eventId),
  ]);
  if (iErr || aErr) return { ok: false };
  const byQ = new Map(((answers ?? []) as { question_id: string; answer: unknown }[]).map((a) => [a.question_id, a.answer == null ? null : typeof a.answer === 'string' ? a.answer : JSON.stringify(a.answer)]));
  return {
    ok: true,
    questions: ((items ?? []) as { question_id: string; prompt: string; item_kind: string; is_asked: boolean }[])
      .filter((q) => q.item_kind === 'question' && q.is_asked)
      .map((q) => ({ id: q.question_id, prompt: q.prompt, answer: byQ.get(q.question_id) ?? null })),
  };
}

// ── Payment · ask for one now (the SAME ask the client page posts, without leaving the chat) ──

const ASK_PAYMENT_WORDS: Record<string, string> = {
  amount: 'Type an amount above ₱0.',
  notbooked: 'Opens once they book you.',
  signin: 'Please sign in again.',
  shop: "Couldn't find your shop.",
  event: "Couldn't send that. Try again.",
  error: "Couldn't send that. Try again.",
};

export async function askForPaymentFromChat(formData: FormData): Promise<AskResult> {
  const res = await askForPaymentCore(formData);
  if (res.ok) {
    const back = String(formData.get('return_to') ?? '');
    if (isSafeNext(back)) revalidatePath(back);
    return { ok: true };
  }
  return { ok: false, message: ASK_PAYMENT_WORDS[res.code] ?? ASK_PAYMENT_WORDS.error! };
}
