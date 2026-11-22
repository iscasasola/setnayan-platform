/**
 * 🏁 THE DEAL'S END — the reads behind the receipt, crew, handover and review cards, and the quote's terms line
 * (Unichat part H2, 20 Nov 2026). Rules in `lib/deal-end.ts`.
 *
 * CALLED FROM THE BROWSER with the reader's own session, like `card-calls.ts` — NOT server actions, so no new route.
 * Every read is the reader's own RLS on a table that already ships; there is no new table and no new grant.
 * A refused or failed read returns `{ ok: false }` and the card says "Couldn't load" — never an empty card, never ₱0.
 * The one write (the hosts confirming a handover) is the SHIPPED `acknowledgeHandover` action.
 */
import { createClient } from '@/lib/supabase/client';
import { TASK_COLUMNS } from '@/lib/schedule-chapters';
import { acknowledgeHandover } from '@/app/dashboard/[eventId]/vendors/actions';
import { dayCrew, handoverFor, receiptFor, type CrewTaskRow, type DayCrewMember, type HandoverRow, type PaymentRow, type Receipt } from '@/lib/deal-end';
import type { HandoverKind } from '@/lib/chat-card-lines';

type Fail = { ok: false };
type Client = ReturnType<typeof createClient>;

function refused(where: string, reason: { code?: string; message?: string } | null | undefined): Fail {
  console.warn(`[deal-end] ${where}:`, reason?.code || reason?.message || 'no row');
  return { ok: false };
}

type Booking = { eventId: string; shopId: string; vendorId: string | null; supplierName: string | null };

/** The chat's event and shop, and the hosts' own booking row for it (null when the shop is not on their list). */
async function bookingOf(supabase: Client, threadId: string, where: string): Promise<Booking | Fail> {
  const { data: thread, error: tErr } = await supabase.from('chat_threads').select('event_id, vendor_profile_id').eq('thread_id', threadId).maybeSingle();
  if (tErr || !thread) return refused(`${where} · thread`, tErr);
  const t = thread as { event_id: string; vendor_profile_id: string };
  const { data, error } = await supabase
    .from('event_vendors')
    .select('vendor_id, vendor_name')
    .eq('event_id', t.event_id)
    .eq('marketplace_vendor_id', t.vendor_profile_id)
    .limit(1)
    .maybeSingle();
  if (error) return refused(`${where} · booking`, error);
  const r = data as { vendor_id: string; vendor_name: string | null } | null;
  return { eventId: t.event_id, shopId: t.vendor_profile_id, vendorId: r?.vendor_id ?? null, supplierName: r?.vendor_name ?? null };
}

// ── The receipt (hosts and their coordinator; the supplier's side draws its own short line) ───────────────────────

/**
 * `isHost` — the reader is a HOST of the event (`event_members.member_type = 'couple'`), so the card may offer "PDF"
 * (the drawing: the coordinator sees the card, only the hosts get the PDF). A refused read is `false`: the button is
 * left out rather than offered and then not found — the receipt itself still shows.
 */
export type ReceiptRead = { ok: true; receipt: Receipt | null; eventId: string; vendorId: string | null; isHost: boolean } | Fail;

export async function loadReceipt(input: { threadId: string; lineAt: string; amountWords: string; first: boolean }): Promise<ReceiptRead> {
  const supabase = createClient();
  const b = await bookingOf(supabase, input.threadId, 'receipt');
  if ('ok' in b) return b;
  if (!b.vendorId) return { ok: true, receipt: null, eventId: b.eventId, vendorId: null, isHost: false };
  const me = (await supabase.auth.getSession()).data.session?.user.id ?? null;
  const [pay, quote, host] = await Promise.all([
    supabase
      .from('event_vendor_payments')
      .select('payment_id, amount_php, paid_at, method, reference, is_deposit_record, vendor_confirmed_at, payment_refused_at')
      .eq('vendor_id', b.vendorId)
      .not('vendor_confirmed_at', 'is', null),
    supabase
      .from('vendor_proposals')
      .select('total_centavos')
      .eq('event_id', b.eventId)
      .eq('vendor_profile_id', b.shopId)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    me
      ? supabase.from('event_members').select('user_id').eq('event_id', b.eventId).eq('user_id', me).eq('member_type', 'couple').maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  // A refused quote read must not pass as "no quote" — the receipt would then silently drop what is left.
  if (pay.error || quote.error) return refused('receipt · rows', pay.error ?? quote.error);
  const agreed = quote.data ? Math.round(Number((quote.data as { total_centavos: number | string }).total_centavos) || 0) : null;
  return {
    ok: true,
    eventId: b.eventId,
    vendorId: b.vendorId,
    isHost: !host.error && Boolean(host.data),
    receipt: receiptFor({ payments: (pay.data ?? []) as PaymentRow[], lineAt: input.lineAt, amountWords: input.amountWords, first: input.first, agreedCentavos: agreed }),
  };
}

// ── Crew for the day ────────────────────────────────────────────────────────

export type DayCrewRead = { ok: true; members: DayCrewMember[]; firstArrival: string | null; eventId: string } | Fail;

export async function loadDayCrew(threadId: string): Promise<DayCrewRead> {
  const supabase = createClient();
  const b = await bookingOf(supabase, threadId, 'crew');
  if ('ok' in b) return b;
  if (!b.vendorId) return { ok: true, members: [], firstArrival: null, eventId: b.eventId };
  const { data, error } = await supabase
    .from('event_schedule_tasks')
    // The schedule's own column list (`TASK_COLUMNS`) — never a narrower hand-typed copy of it.
    .select(TASK_COLUMNS)
    .eq('vendor_id', b.vendorId)
    .not('crew', 'is', null);
  if (error) return refused('crew · tasks', error);
  const tasks = (data ?? []) as { block_id: string; crew: string | null; what: string; call_at: string | null; sort_order: number | null }[];
  const startOf = new Map<string, string | null>();
  const blockIds = [...new Set(tasks.map((t) => t.block_id))];
  if (blockIds.length > 0) {
    const { data: blocks, error: bErr } = await supabase.from('event_schedule_blocks').select('block_id, start_at, time_tba').in('block_id', blockIds);
    // A task with no call time arrives with its moment: without the moments the arrival would be a guess.
    if (bErr) return refused('crew · moments', bErr);
    // A Time-TBA moment keeps a placeholder midnight in `start_at` — it has no time yet, so it gives no arrival.
    for (const r of (blocks ?? []) as { block_id: string; start_at: string | null; time_tba: boolean | null }[]) startOf.set(r.block_id, r.time_tba === true ? null : r.start_at);
  }
  const rows: CrewTaskRow[] = tasks.map((t) => ({ crew: t.crew, what: t.what, call_at: t.call_at, moment_start: startOf.get(t.block_id) ?? null, sort_order: t.sort_order }));
  return { ok: true, eventId: b.eventId, ...dayCrew(rows) };
}

// ── Handover ────────────────────────────────────────────────────────────────

export type HandoverRead = { ok: true; handover: HandoverRow | null; eventId: string } | Fail;

export async function loadHandover(input: { threadId: string; kind: HandoverKind; lineAt: string }): Promise<HandoverRead> {
  const supabase = createClient();
  const { data: thread, error: tErr } = await supabase.from('chat_threads').select('event_id, vendor_profile_id').eq('thread_id', input.threadId).maybeSingle();
  if (tErr || !thread) return refused('handover · thread', tErr);
  const t = thread as { event_id: string; vendor_profile_id: string };
  const { data, error } = await supabase
    .from('booking_handovers')
    .select('handover_id, event_vendor_id, kind, label, payload, status, created_at, couple_acknowledged_at')
    .eq('event_id', t.event_id)
    .eq('vendor_profile_id', t.vendor_profile_id)
    .eq('kind', input.kind);
  if (error) return refused('handover · rows', error);
  return { ok: true, eventId: t.event_id, handover: handoverFor((data ?? []) as HandoverRow[], input.kind, input.lineAt) };
}

/** The hosts confirm they received it — the shipped single-winner `acknowledge_handover`, through its own action. */
export async function confirmHandoverFromChat(input: { handoverId: string; eventId: string; eventVendorId: string }): Promise<{ ok: true } | { ok: false; message: string }> {
  const fd = new FormData();
  fd.set('handover_id', input.handoverId);
  fd.set('event_id', input.eventId);
  fd.set('vendor_id', input.eventVendorId);
  try {
    const r = await acknowledgeHandover(fd);
    if (r.status === 'ok' || r.status === 'already') return { ok: true };
    if (r.status === 'not_signed_in') return { ok: false, message: 'Sign in again to confirm it.' };
    if (r.status === 'not_ackable') return { ok: false, message: 'This handover can no longer be confirmed here.' };
    return { ok: false, message: "Couldn't confirm that. Try again." };
  } catch (e) {
    console.error('[deal-end] acknowledgeHandover refused:', (e as Error).message);
    return { ok: false, message: "Couldn't confirm that. Try again." };
  }
}

// ── The review ──────────────────────────────────────────────────────────────

export type ReviewRead = { ok: true; review: { rating: number; body: string | null } | null; writeHref: string | null } | Fail;

/**
 * The hosts' review of this supplier for this event, if one is posted (`vendor_reviews` is the shipped, public
 * record). `writeHref` is the shipped review page for the booking — only the hosts' side can resolve it.
 */
export async function loadReview(threadId: string, viewer: 'vendor' | 'couple'): Promise<ReviewRead> {
  const supabase = createClient();
  const { data: thread, error: tErr } = await supabase.from('chat_threads').select('event_id, vendor_profile_id').eq('thread_id', threadId).maybeSingle();
  if (tErr || !thread) return refused('review · thread', tErr);
  const t = thread as { event_id: string; vendor_profile_id: string };
  const { data, error } = await supabase
    .from('vendor_reviews')
    .select('rating_overall, body, created_at')
    .eq('event_id', t.event_id)
    .eq('vendor_profile_id', t.vendor_profile_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return refused('review · row', error);
  let writeHref: string | null = null;
  if (viewer === 'couple') {
    const { data: ev, error: evErr } = await supabase
      .from('event_vendors')
      .select('vendor_id')
      .eq('event_id', t.event_id)
      .eq('marketplace_vendor_id', t.vendor_profile_id)
      .limit(1)
      .maybeSingle();
    if (evErr) return refused('review · booking', evErr);
    const id = (ev as { vendor_id: string } | null)?.vendor_id;
    writeHref = id ? `/dashboard/${t.event_id}/vendors/${id}/review` : null;
  }
  const r = data as { rating_overall: number; body: string | null } | null;
  return { ok: true, review: r ? { rating: Number(r.rating_overall), body: r.body?.trim() || null } : null, writeHref };
}

// ── The quote's terms ───────────────────────────────────────────────────────

export type QuoteTermsRead = { ok: true; terms: string; status: string } | Fail;

/** The terms frozen on this quote when it was sent, and whether it is accepted. '' = the quote states none. */
export async function loadQuoteTerms(proposalId: string): Promise<QuoteTermsRead> {
  const { data, error } = await createClient().from('vendor_proposals').select('rendered_terms, status').eq('proposal_id', proposalId).maybeSingle();
  if (error || !data) return refused('terms · quote', error);
  const r = data as { rendered_terms: string | null; status: string };
  return { ok: true, terms: (r.rendered_terms ?? '').trim(), status: r.status };
}
