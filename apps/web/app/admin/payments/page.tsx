import { hidePlaceholdersBesideLogged } from '@/lib/payment-logged';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForPrivateStoredAsset } from '@/lib/uploads';
import { paymentProofPolicy } from '@/lib/r2-client-ref';
import { isRequestPlatform } from '@/lib/request-platform';
import { sweepLapsedSubscriptions } from '@/lib/subscriptions';
import {
  DeskHead,
  DeskNums,
  OpenedPayment,
  OrdersNeedingQuote,
  PaymentsList,
  RecordPaymentCard,
  deskHref,
  type CardDuplicate,
  type DeskAddress,
  type DeskBill,
  type DeskNumsRead,
  type DuplicateExposureResult,
  type Filter,
  type OrderEventInfo,
  type OrderEventInfoResult,
  type OrderJoined,
  type PaymentJoined,
  type ReceiptReadRow,
  type RecordTarget,
} from './_components/desk';
import { ONBOARDING_SERVICES_SKU, readOnboardingOrderItems } from '@/lib/onboarding-order-items';
import { SETNAYAN_AI_SKU, resolveSetnayanAiTypePricePhp } from '@/lib/setnayan-ai-event-pricing';
import { MONEY_STATUSES } from '@/lib/payment-reference-match';
import {
  deskBillLineLabel,
  deskDuplicateVerdict,
  type DeskBillLine,
  type DeskDuplicate,
} from '@/lib/admin-payment-desk';
import { readEventTypeNames } from '@/lib/admin/event-type-names.server';
import { requireAdmin } from '@/lib/admin/require-admin';
import {
  fetchPlatformSettings,
  fetchPlatformSettingsMeasured,
  getEffectiveVatRatePct,
} from '@/lib/platform-settings';
import { receivingAccounts, type ChannelSettings } from '@/lib/payment-channels';
import { isSameDayInManila } from '@/lib/papic-buy-urgency';
import { PageMasthead } from '@/app/_components/page-masthead';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readRemedyDesk } from '@/lib/admin/service-remedies.server';
export const metadata = { title: 'Payments · Admin' };

type Props = {
  // `notice` / `noticeType` surface an inline banner after a server action
  // redirects back here instead of throwing — e.g. approvePayment's shortfall
  // guard ("payment matched, order not promoted — ₱X short"). See actions.ts.
  searchParams: Promise<{ filter?: string; platform?: string; notice?: string; noticeType?: string; q?: string; open?: string }>;
};

/**
 * Case-insensitive contains across the fields a person might quote. Used for
 * the unquoted-orders branch, which is a single small read.
 */
function matchesQuery(q: string, fields: Array<string | null | undefined>): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return fields.some((f) => (f ?? '').toLowerCase().includes(needle));
}

export default async function AdminPaymentsPage({ searchParams }: Props) {
  await requireAdmin();
  const search = await searchParams;
  const filter: Filter =
    search.filter === 'all' || search.filter === 'orders_needing_quote' ? search.filter : 'pending';
  // ── ONE PAYMENT, OPENED (admin drawing 2026-11-13 · `pay`) ────────────────
  // A row opens its payment on top of the desk at `?open=<payment_id>`. Only a
  // uuid is read — anything else is ignored and the desk shows.
  const openId =
    typeof search.open === 'string' && /^[0-9a-f-]{36}$/i.test(search.open) ? search.open.toLowerCase() : null;
  // Optional platform filter (web | ios | android) — orthogonal to the status
  // filter, so it composes with it. null = all platforms.
  const platformFilter = isRequestPlatform(search.platform) ? search.platform : null;
  // Inline notice from a redirecting server action (see actions.ts shortfall
  // guard). Trim + cap length so a crafted `?notice=` can't blow out the layout.
  const notice = typeof search.notice === 'string' ? search.notice.slice(0, 400).trim() : '';
  const noticeIsWarn = search.noticeType === 'warn';

  // ── FIND ONE PAYMENT BY THE NUMBER THE BUYER WAS GIVEN ────────────────────
  // 🔑 FOUND BY THE FIRST REAL PURCHASE (2026-08-25). This queue had NO search
  // of any kind — only status + platform filters over the newest 100 rows. A
  // buyer writing in "my order SN9B5605B1 hasn't activated" could not be looked
  // up at all; the only recourse was to eyeball the list and hope it was recent.
  //
  // 🪤 SANITISED, NOT ESCAPED. PostgREST's `.or()` takes a COMMA-SEPARATED
  // filter string, so a comma / parenthesis / dot in the term does not fail —
  // it silently re-parses as extra filters, i.e. rejected-not-thrown with an
  // empty queue as the only symptom. Reference codes, public ids, bank refs and
  // emails are all drawn from this set, so narrowing the input is lossless.
  const rawQ = typeof search.q === 'string' ? search.q.trim().slice(0, 64) : '';
  const q = rawQ.replace(/[^A-Za-z0-9@_-]/g, '');
  // The term as typed, for the input's value — never fed to a query.
  const qDisplay = rawQ;

  const admin = createAdminClient();

  // The rate the platform ACTUALLY charges — 0 today, because Setnayan is not
  // VAT-registered. Read here so the quote card can never re-invent a 12% of
  // its own; falls back to 0 on a failed read, which is both the legally safe
  // answer for a non-VAT taxpayer and the honest one.
  const vatRatePct = await getEffectiveVatRatePct(admin);

  // Global subscription expiry sweep (Task #23 — pilot blocker). Admin
  // payments is the safety net: any per-scope sweep miss on couple/vendor
  // dashboards gets caught here. Fire-and-forget — never blocks the queue
  // render.
  void sweepLapsedSubscriptions(admin);

  let payments: PaymentJoined[] = [];
  let unquotedOrders: OrderJoined[] = [];
  // ── READS ARE HONEST (2026-09-30) ─────────────────────────────────────────
  // Supabase RESOLVES with `{ error }` instead of throwing, so a refused read
  // arrived as `data: null`, `?? []` made it an empty list, and this desk said
  // "Nothing to reconcile." to an admin with a customer's money waiting on it.
  // `readFailed` names WHICH read was refused; the lists render that instead of
  // their empty state. Same shape as vendor-dashboard/reads-are-honest.test.ts.
  let readFailed: 'queue' | 'search' | null = null;

  if (filter === 'orders_needing_quote' && !openId) {
    const { data, error: quoteError } = await admin
      .from('orders')
      .select(
        'order_id,user_id,public_id,reference_code,description,requested_total_php,confirmed_total_php,status,admin_notes,created_at, user:users!orders_user_id_fkey(email, public_id)',
      )
      .eq('status', 'submitted')
      .order('created_at', { ascending: true })
      .limit(100);
    if (quoteError) {
      logQueryError('admin/payments: orders needing a quote', quoteError);
      readFailed = 'queue';
    }
    unquotedOrders = ((data ?? []) as unknown as OrderJoined[]).filter((row) =>
      matchesQuery(q, [row.public_id, row.reference_code, row.user?.email]),
    );
  } else {
    // When a platform filter is active, the order embed becomes !inner so rows
    // whose order doesn't match the platform are excluded (a plain left-join
    // embed would keep them with a null order). Every payment has an order, so
    // !inner drops nothing else.
    const orderEmbed = platformFilter
      ? 'order:orders!inner(public_id, event_id, reference_code, description, service_key, requested_total_php, confirmed_total_php, voucher_discount_centavos, status, platform)'
      : 'order:orders(public_id, event_id, reference_code, description, service_key, requested_total_php, confirmed_total_php, voucher_discount_centavos, status, platform)';
    let paymentsQuery = admin
      .from('payments')
      .select(
        `payment_id,order_id,user_id,amount_php,channel,reference_number,screenshot_url,paid_at,status,admin_notes,admin_resubmit_notice,reviewed_at,created_at, ${orderEmbed}, user:users!payments_user_id_fkey(email, public_id)`,
      )
      .order('created_at', { ascending: false })
      .limit(100);
    // The opened payment is read by its id alone — its desk filters do not apply.
    if (openId) paymentsQuery = paymentsQuery.eq('payment_id', openId);
    if (filter === 'pending' && !openId) paymentsQuery = paymentsQuery.eq('status', 'pending');
    if (platformFilter && !openId) paymentsQuery = paymentsQuery.eq('order.platform', platformFilter);
    // A search must reach PAST the newest-100 window — the whole point is
    // finding an older payment somebody wrote in about. So when a term is
    // present we resolve the matching orders first and scope the payment read
    // to them, rather than filtering the page we already fetched.
    if (q && !openId) {
      const { data: hits, error: searchError } = await admin
        .from('orders')
        .select('order_id')
        .or(`public_id.ilike.%${q}%,reference_code.ilike.%${q}%`)
        .limit(200);
      // A refused order lookup must NOT quietly fall back to the bank-reference
      // search below — that would answer "no payment matches" about an order
      // that exists. Say the search failed instead.
      if (searchError) {
        logQueryError('admin/payments: order search', searchError, { q });
        readFailed = 'search';
      }
      const ids = (hits ?? []).map((r) => (r as { order_id: string }).order_id);
      // 🪤 An empty id list must NOT become `.in.()` — PostgREST rejects the
      // whole query, which reads as "no results" rather than as an error. Fall
      // back to the bank reference the buyer typed, which is often what they
      // actually quote from their own receipt.
      paymentsQuery = ids.length
        ? paymentsQuery.or(
            `order_id.in.(${ids.join(',')}),reference_number.ilike.%${q}%`,
          )
        : paymentsQuery.ilike('reference_number', `%${q}%`);
    }
    if (readFailed !== 'search') {
      const { data, error: queueError } = await paymentsQuery;
      if (queueError) {
        logQueryError('admin/payments: payment queue', queueError);
        readFailed = 'queue';
      }
      payments = hidePlaceholdersBesideLogged((data ?? []) as unknown as PaymentJoined[]);
    }
  }

  // ── RECORD A PAYMENT RECEIVED (owner 2026-10-01) ──────────────────────────
  // Offered only when the search names EXACTLY ONE order — the number on the
  // customer's email or our own id — so the money can only land on the order
  // the admin looked up. A refused read says so; it never hides the form
  // silently or offers it against a guess.
  const record = q && filter !== 'orders_needing_quote' && !openId ? await fetchRecordTarget(admin, q) : null;

  // The receiving-accounts list, read once: `payments.channel` is an account
  // ID ("maribank-7k2q") and the card must say its NAME. A refused read falls
  // back to the fixed two rails' names, never to a blank.
  const channelSettings: ChannelSettings = await fetchPlatformSettings(admin).catch(() => ({}));

  // Pre-resolve every payment-proof screenshot to a short-lived presigned GET
  // URL, keyed by payment_id. Payment proofs live in the PRIVATE thread-files
  // bucket, so the stored `r2://…` ref is NOT publicly readable — it must be
  // presigned server-side (24h TTL) before it can render in an <img>/<a>.
  // Legacy plain-URL values pass through unchanged. Doing this on the server
  // keeps R2 internals off the client and works for both old and new uploads.
  const screenshotUrlMap: Record<string, string> = {};
  await Promise.all(
    payments.map(async (p) => {
      if (!p.screenshot_url) return;
      // 🔒 The dedicated signer, scoped to THIS payment's own order folders
      // (lib/r2-client-ref.ts paymentProofPolicy) — the generic signer is
      // public-bucket-only, and a proof must never be signed from a folder
      // that belongs to a different order.
      const url = await displayUrlForPrivateStoredAsset(
        p.screenshot_url,
        paymentProofPolicy({ orderId: p.order_id, eventId: p.order?.event_id ?? null, userId: p.user_id }),
      );
      if (url) screenshotUrlMap[p.payment_id] = url;
    }),
  );

  // ── WHAT THE READER SAW ON EACH PICTURE ───────────────────────────────────
  // Newest advisory read per payment (lib/payment-receipt-read.server.ts). One
  // query for the page, ordered newest-first, and the first row per payment wins
  // — a re-read supersedes an earlier one rather than appending a second card.
  //
  // ⛔ NOTHING BELOW GATES ON THIS. It renders a card and nothing else: no row
  // is hidden, no button is disabled, and `decisive` is computed without it.
  const receiptReads: Record<string, ReceiptReadRow> = {};
  if (payments.length > 0) {
    const { data: reads } = await admin
      .from('payment_receipt_reads')
      .select('payment_id,status,reference_matches,amount_matches,seen_references,seen_amounts,summary,error,created_at')
      .in('payment_id', payments.map((p) => p.payment_id))
      .order('created_at', { ascending: false });
    for (const r of (reads ?? []) as unknown as ReceiptReadRow[]) {
      if (!receiptReads[r.payment_id]) receiptReads[r.payment_id] = r;
    }
  }

  // ── SAME-DAY FIRST (owner 2026-08-02) ─────────────────────────────────────
  // "have an emergency purchase part if the event day is the day itself. these
  // will be priority." A 24-hour SLA is a fine promise on an ordinary order and
  // a broken product on a same-day one — the party ends before anyone looks. So
  // an order for an event happening TODAY jumps the whole queue, above even a
  // clean match: a clean match on next month's wedding can wait and this cannot.
  //
  // Same function the guest-facing buy panel uses to PROMISE the priority, so
  // the promise and the queue position cannot drift apart.
  const sameDayOrderIds = await fetchSameDayOrderIds(admin, payments);

  // ── WHAT THE CARD MUST BE ABLE TO SAY (owner 2026-08-28) ──────────────────
  // "we should also know what they ordered and what event and what they will
  // get" · "used a discount. what they get. the amount that should be sent."
  // Three batched reads, each with its OWN failure story said out loud on the
  // card — a silently empty bill is something an admin might approve against.
  const eventInfo = await fetchOrderEventInfo(admin, payments);
  const deskBills = await fetchDeskBills(admin, payments, eventInfo.byEventId);
  const dupExposure = await fetchDuplicateExposure(admin, payments);
  // A paid service they cannot use → Papic credits, or their next event
  // (owner 2026-11-05 "yes to refund"). One batched read for the paid rows.
  const remedyDesk = await readRemedyDesk(
    admin,
    payments
      // `lapsed` too: a converted order is switched off (lapsed) and its row still shows what was done.
      .filter((p) => p.order && ['paid', 'fulfilled', 'lapsed'].includes(p.order.status))
      .map((p) => p.order_id),
  );

  // ── THE NUMBERS ABOVE THE LIST (admin drawing 2026-11-13, Money · To confirm) ──
  // Two small reads of their own, each null when refused — a refused read
  // prints "—", never ₱0 or 0 (T28/T29).
  const nums = openId || filter === 'orders_needing_quote' ? null : await readDeskNums(admin);

  const here: DeskAddress = { filter, platform: platformFilter, q: qDisplay };

  return (
    <div
      className="mx-auto w-full max-w-[760px] px-4 pb-10 pt-1 sm:px-6"
      data-money-desk={openId ? 'payment' : filter}
    >
      <PageMasthead
        title="Payments & reconciliation"
      />

      {notice ? (
        <p
          role="alert"
          className="my-2 border-y py-2.5 text-[14px] text-ink"
          style={{ borderColor: `rgb(var(--color-${noticeIsWarn ? 'warn' : 'ok'}))` }}
        >
          {notice}
        </p>
      ) : null}

      {openId ? (
        <OpenedPayment
          payment={payments[0] ?? null}
          readFailed={readFailed}
          back={deskHref(here)}
          typeName={await readEventTypeNames()}
          screenshotUrlMap={screenshotUrlMap}
          sameDayOrderIds={sameDayOrderIds}
          receiptReads={receiptReads}
          eventInfo={eventInfo}
          deskBills={deskBills}
          dupExposure={dupExposure}
          remedyDesk={remedyDesk}
          channelSettings={channelSettings}
          query={qDisplay}
        />
      ) : (
        <>
          <DeskHead here={here} />

          {nums ? <DeskNums nums={nums} sameDay={
                readFailed
                  ? null
                  : payments.filter((p) => p.status === 'pending' && sameDayOrderIds.has(p.order_id)).length
              } /> : null}

          {record ? <RecordPaymentCard record={record} query={qDisplay} /> : null}

          {filter === 'orders_needing_quote' ? (
            <OrdersNeedingQuote
              orders={unquotedOrders}
              vatRatePct={vatRatePct}
              readFailed={readFailed}
              query={qDisplay}
            />
          ) : (
            <PaymentsList
              typeName={await readEventTypeNames()}
              payments={payments}
              here={here}
              sameDayOrderIds={sameDayOrderIds}
              receiptReads={receiptReads}
              deskBills={deskBills}
              dupExposure={dupExposure}
              channelSettings={channelSettings}
              readFailed={readFailed}
              query={qDisplay}
            />
          )}
        </>
      )}
    </div>
  );
}

/** Where the desk is: its filter, platform and search. A row opens the payment
 *  on top of it (`?open=`), and the opened payment's back goes here. */
/**
 * Received this week (matched money with a paid date in the last 7 days) and
 * the exact count of payments to confirm — the newest-100 list below cannot
 * count past 100, so the number is its own count query.
 */
async function readDeskNums(admin: ReturnType<typeof createAdminClient>): Promise<DeskNumsRead> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const [week, pending] = await Promise.all([
    admin.from('payments').select('amount_php').in('status', MONEY_STATUSES).gte('paid_at', weekAgo).limit(5000),
    admin.from('payments').select('payment_id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);
  if (week.error) logQueryError('admin/payments: received this week', week.error);
  if (pending.error) logQueryError('admin/payments: count to confirm', pending.error);
  return {
    receivedWeekPhp:
      week.error || !Array.isArray(week.data)
        ? null
        : week.data.reduce((sum, r) => sum + Number((r as { amount_php: number }).amount_php || 0), 0),
    toConfirm: pending.error ? null : (pending.count ?? null),
  };
}

/**
 * The event behind each order on screen — name, type, date — in one batched
 * read. `orders.event_id` was already selected on this page and used only to
 * ring same-day rows; nothing ever rendered WHICH event the money was
 * for.
 *
 * Distinct from fetchSameDayOrderIds on purpose: that one degrades to an empty
 * set because losing it costs only ORDERING. Losing THIS must be said on the
 * card ("could not read"), because "no celebration" is also a legitimate state
 * (plenty of orders are not event-scoped) and the two must never look alike.
 */
async function fetchOrderEventInfo(
  admin: ReturnType<typeof createAdminClient>,
  payments: readonly PaymentJoined[],
): Promise<OrderEventInfoResult> {
  const ids = [...new Set(payments.map((p) => p.order?.event_id).filter((v): v is string => !!v))];
  const byEventId = new Map<string, OrderEventInfo>();
  if (ids.length === 0) return { byEventId, failed: false };
  const { data, error } = await admin
    .from('events')
    .select('event_id, public_id, display_name, event_type, event_date')
    .in('event_id', ids);
  if (error) console.error('[supabase-error] app/admin/payments/page.tsx · from:events.select', error);
  if (error || !Array.isArray(data)) return { byEventId, failed: true };
  for (const row of data) {
    const r = row as {
      event_id: string;
      public_id: string;
      display_name: string | null;
      event_type: string | null;
      event_date: string | null;
    };
    byEventId.set(r.event_id, {
      publicId: r.public_id,
      displayName: (r.display_name ?? '').trim() || r.public_id,
      eventType: r.event_type,
      eventDate: r.event_date,
    });
  }
  return { byEventId, failed: false };
}

/**
 * Itemise every order on screen.
 *
 * 🔑 REUSES THE ONE AUTHORITY for basket lines — readOnboardingOrderItems
 * (activation, reversal and ownership already read it; a desk with its own
 * read would be the second copy that drifts). Titles + retail prices come from
 * the catalog in one batched read, in the same shape the customer's own pay
 * page renders (lib/payable-by-reference.ts).
 *
 * Setnayan AI's REGULAR price is per event type (lib/setnayan-ai-type-pricing),
 * so its catalog retail (the wedding tier) would overstate the saving on every
 * other type — resolved per type via the display helper, cached per type, and
 * left null (no saving claimed) when the event's type is unknown.
 */
async function fetchDeskBills(
  admin: ReturnType<typeof createAdminClient>,
  payments: readonly PaymentJoined[],
  eventsById: ReadonlyMap<string, OrderEventInfo>,
): Promise<Map<string, DeskBill>> {
  const out = new Map<string, DeskBill>();
  // Distinct orders on screen (several payments can share one order).
  const orders = new Map<string, NonNullable<PaymentJoined['order']>>();
  for (const p of payments) {
    if (p.order && !orders.has(p.order_id)) orders.set(p.order_id, p.order);
  }
  if (orders.size === 0) return out;

  const basketIds = [...orders.entries()]
    .filter(([, o]) => o.service_key === ONBOARDING_SERVICES_SKU)
    .map(([id]) => id);
  const itemsByOrder = new Map<string, Awaited<ReturnType<typeof readOnboardingOrderItems>>>();
  await Promise.all(
    basketIds.map(async (id) => {
      itemsByOrder.set(id, await readOnboardingOrderItems(admin, id));
    }),
  );

  // Every service code the cards will name.
  const codes = new Set<string>();
  for (const items of itemsByOrder.values()) for (const i of items) codes.add(i.serviceCode);
  for (const o of orders.values()) {
    if (o.service_key && o.service_key !== ONBOARDING_SERVICES_SKU) codes.add(o.service_key);
  }
  const titleFor = new Map<string, string>();
  const retailFor = new Map<string, number>();
  if (codes.size > 0) {
    const { data, error } = await admin
      .from('platform_retail_catalog_v2')
      .select('service_code, title, retail_price_php')
      .in('service_code', [...codes]);
    // A failed catalog read degrades to raw codes with NO retail column — the
    // bill still itemises off its own stored lines; only the "normally" figures
    // and the saving line go quiet (regularPhp stays null → no claim invented).
    if (error) logQueryError('admin/payments: bill catalogue titles', error);
    if (!error && Array.isArray(data)) {
      for (const row of data) {
        const r = row as { service_code?: string; title?: string; retail_price_php?: number };
        if (!r.service_code) continue;
        if (typeof r.title === 'string' && r.title.trim()) titleFor.set(r.service_code, r.title);
        const retail = Number(r.retail_price_php);
        if (Number.isFinite(retail) && retail > 0) retailFor.set(r.service_code, retail);
      }
    }
  }

  // Per-event-type regular price for Setnayan AI, cached per type.
  const aiRegularByType = new Map<string, number>();
  const aiRegularFor = async (eventType: string | null): Promise<number | null> => {
    if (!eventType) return null;
    const hit = aiRegularByType.get(eventType);
    if (hit != null) return hit;
    // Display helper by design — never the charge path (this is a screen).
    const php = await resolveSetnayanAiTypePricePhp(admin, eventType, 'regular');
    aiRegularByType.set(eventType, php);
    return php;
  };

  for (const [orderId, o] of orders) {
    const eventType = o.event_id ? (eventsById.get(o.event_id)?.eventType ?? null) : null;
    if (o.service_key === ONBOARDING_SERVICES_SKU) {
      const items = itemsByOrder.get(orderId) ?? [];
      if (items.length === 0) {
        // Could be a failed read or a genuinely empty basket — readOnboarding-
        // OrderItems keeps those apart from nobody on purpose. Either way a
        // basket with no visible lines is not something to approve against.
        out.set(orderId, { kind: 'unreadable' });
        continue;
      }
      const lines: DeskBillLine[] = [];
      for (const i of items) {
        const regularUnit =
          i.serviceCode === SETNAYAN_AI_SKU
            ? await aiRegularFor(eventType)
            : (retailFor.get(i.serviceCode) ?? null);
        lines.push({
          serviceCode: i.serviceCode,
          label: deskBillLineLabel(titleFor.get(i.serviceCode), i.serviceCode, i.quantity),
          quantity: i.quantity,
          chargedPhp: i.unitPricePhp * i.quantity,
          regularPhp: regularUnit != null ? regularUnit * i.quantity : null,
        });
      }
      out.set(orderId, { kind: 'lines', lines });
    } else if (o.service_key) {
      const chargedPhp = Number(o.confirmed_total_php ?? o.requested_total_php);
      const regularPhp =
        o.service_key === SETNAYAN_AI_SKU
          ? await aiRegularFor(eventType)
          : (retailFor.get(o.service_key) ?? null);
      out.set(orderId, {
        kind: 'single',
        line: {
          serviceCode: o.service_key,
          label: deskBillLineLabel(titleFor.get(o.service_key), o.service_key, 1),
          quantity: 1,
          chargedPhp,
          regularPhp,
        },
      });
    } else {
      out.set(orderId, { kind: 'none' });
    }
  }
  return out;
}

/**
 * Which pending payments' references collide with money already counted.
 *
 * DERIVED THE SAME WAY approvePaymentCore derives it — the same MONEY_STATUSES
 * read, the same classifyDuplicate rule (via deskDuplicateVerdict) — so the
 * checkbox appears exactly when the guard would warn, and never otherwise. The
 * guard's read is unbounded for the same reason this one is: a duplicate check
 * with a window is a duplicate check with a blind spot.
 */
async function fetchDuplicateExposure(
  admin: ReturnType<typeof createAdminClient>,
  payments: readonly PaymentJoined[],
): Promise<DuplicateExposureResult> {
  const byPaymentId = new Map<string, CardDuplicate>();
  const pending = payments.filter((p) => p.status === 'pending' && p.reference_number);
  if (pending.length === 0) return { byPaymentId, failed: false };

  const { data, error } = await admin
    .from('payments')
    .select('payment_id, order_id, reference_number, amount_php, status, order:orders(public_id)')
    .in('status', MONEY_STATUSES);
  if (error || !Array.isArray(data)) {
    logQueryError('admin/payments: prior money payments', error);
    return { byPaymentId, failed: true };
  }

  const priors = data.map((row) => {
    // `as unknown` first: PostgREST's generated type for the `order` embed is
    // an ARRAY even though this FK join returns at most one row — the same
    // cast every other embed on this page already uses.
    const r = row as unknown as {
      payment_id: string;
      order_id: string;
      reference_number: string | null;
      amount_php: number;
      status: string;
      order: { public_id: string } | null;
    };
    return {
      paymentId: r.payment_id,
      orderId: r.order_id,
      referenceNumber: r.reference_number,
      status: r.status,
      amountPhp: Number(r.amount_php),
      orderPublicId: r.order?.public_id ?? null,
    };
  });
  const priorById = new Map(priors.map((r) => [r.paymentId, r]));

  for (const p of pending) {
    const verdict: DeskDuplicate | null = deskDuplicateVerdict({
      referenceNumber: p.reference_number,
      orderId: p.order_id,
      // Mirror the guard's `.neq('payment_id', me)` — moot while matched rows
      // can never be pending, kept so the two reads stay the same shape.
      priors: priors.filter((r) => r.paymentId !== p.payment_id),
    });
    if (!verdict) continue;
    if (verdict.kind === 'same_order') {
      byPaymentId.set(p.payment_id, { kind: 'same_order' });
    } else {
      const prior = priorById.get(verdict.priorPaymentId);
      byPaymentId.set(p.payment_id, {
        kind: 'other_order',
        otherOrderPublicId: prior?.orderPublicId ?? null,
        otherAmountPhp: prior?.amountPhp ?? null,
      });
    }
  }
  return { byPaymentId, failed: false };
}


/**
 * Which of these payments belong to an event happening TODAY (Manila)?
 *
 * One batched read keyed on the orders already on screen — never a per-row
 * query, and never a join that could drop rows if it failed. Returns order_ids
 * rather than event_ids so the caller matches on what it already holds.
 *
 * Degrades to an EMPTY set on any failure: losing the same-day jump costs the
 * queue its ordering, which an admin can still work around by reading the event
 * date on the row. Throwing here would take down the payments console itself.
 */
async function fetchSameDayOrderIds(
  admin: ReturnType<typeof createAdminClient>,
  payments: readonly PaymentJoined[],
): Promise<Set<string>> {
  const out = new Set<string>();
  const byEvent = new Map<string, string[]>();
  for (const p of payments) {
    const eid = p.order?.event_id ?? null;
    if (!eid) continue;
    const list = byEvent.get(eid);
    if (list) list.push(p.order_id);
    else byEvent.set(eid, [p.order_id]);
  }
  if (byEvent.size === 0) return out;
  try {
    const { data, error } = await admin
      .from('events')
      .select('event_id, event_date')
      .in('event_id', [...byEvent.keys()]);
    if (error) console.error('[supabase-error] app/admin/payments/page.tsx · from:events.select', error);
    if (error || !Array.isArray(data)) return out;
    for (const row of data) {
      const date = (row as { event_date?: string | null }).event_date ?? null;
      if (!isSameDayInManila(date)) continue;
      for (const oid of byEvent.get(String((row as { event_id?: unknown }).event_id ?? '')) ?? []) {
        out.add(oid);
      }
    }
    return out;
  } catch {
    return out;
  }
}

/**
 * The ONE order a search names exactly, plus Setnayan's receiving accounts.
 * `null` = the search names no single order (nothing to offer). A refused read
 * is its own answer, rendered as such — never as "no such order".
 */
async function fetchRecordTarget(
  admin: ReturnType<typeof createAdminClient>,
  q: string,
): Promise<RecordTarget | null> {
  // ilike WITHOUT wildcards = a case-insensitive EXACT match; `q` is already
  // narrowed to [A-Za-z0-9@_-], so it cannot re-parse as extra filters.
  const { data, error } = await admin
    .from('orders')
    .select('order_id, public_id, reference_code, description, requested_total_php, confirmed_total_php, status')
    .or(`public_id.ilike.${q},reference_code.ilike.${q}`)
    .limit(2);
  if (error) {
    logQueryError('admin/payments: record target', error, { q });
    return { kind: 'readFailed' };
  }
  const rows = (data ?? []) as Array<{
    order_id: string;
    public_id: string | null;
    reference_code: string | null;
    description: string | null;
    requested_total_php: number | null;
    confirmed_total_php: number | null;
    status: string;
  }>;
  if (rows.length !== 1) return null;
  const o = rows[0]!;
  const { settings, readFailed, accountsReadFailed } = await fetchPlatformSettingsMeasured(admin);
  if (readFailed || accountsReadFailed) return { kind: 'readFailed' };
  return {
    kind: 'order',
    orderId: o.order_id,
    publicId: o.public_id,
    referenceCode: o.reference_code,
    description: o.description,
    totalPhp: o.confirmed_total_php ?? o.requested_total_php,
    status: o.status,
    accounts: receivingAccounts(settings),
  };
}
