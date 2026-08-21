'use server';

/**
 * apps/web/app/dashboard/[eventId]/checkout/actions.ts
 *
 * Server actions for the inline checkout drawer.
 *
 * WHY · Day 2 of the 4-day pre-pilot voucher + inline-checkout sprint
 *       (CLAUDE.md 2026-05-29 Day 2 row · V1 SCOPE EXPANSION approved
 *       by owner · pilot 2026-06-01 in 4 days). Replaces the 2-step
 *       /orders/new + /orders/[id] flow with a single drawer that
 *       mounts on every add-on detail page. The drawer surfaces:
 *         (1) optional voucher-code apply (this file: applyVoucherAction)
 *         (2) BDO + GCash QR codes from platform_settings
 *         (3) screenshot upload + reference number
 *         (4) atomic order submit (this file: submitOrderAction)
 *
 *       submitOrderAction lands the order at status='pending_approval'
 *       directly (no intermediate 'pending_payment' state) since the
 *       inline drawer requires the screenshot before submit. Day 3 admin
 *       approval flips to 'paid' (state machine: paid = APPROVED for
 *       backward-compat; new 'completed' value added on top).
 *
 * Locked policy from architect spec brief (CLAUDE.md 2026-05-29 Day 2 row):
 *   • One service per order · single-voucher per order
 *   • Voucher apply BEFORE order creation · invalid clears field + brand-voice error
 *   • BIR receipt shows net paid (iteration 0026 · Day 3 integration)
 *   • Voucher field hidden behind "Have a code?" toggle (drawer UI)
 *   • Codes case-insensitive input · stored UPPERCASE
 *   • State machine: pending_approval → approved → active → completed
 *   • order_ledger writes at every transition (use appendLedger helper)
 *
 * Cross-references:
 *   • PR #594 + PR #595 schema (discount_codes · redemptions · order_ledger)
 *   • apps/web/lib/ledger.ts (canonical append helper)
 *   • apps/web/lib/vouchers/validate.ts (DB-layer voucher check)
 *   • apps/web/lib/vouchers/calculate.ts (pure-function discount math)
 *   • apps/web/app/dashboard/[eventId]/orders/actions.ts (the createOrder
 *     this drawer's submit supersedes for the inline path · payment-
 *     instructions email kept wired for the post-submit confirmation)
 *   • PR #591 + #593 sendEmail platform-settings pattern preserved here
 */

import { revalidatePath } from 'next/cache';
import { insertFaultLog } from '@/lib/telemetry/fault-log';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, createMoneyWriterClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { resolveChannel } from '@/lib/payment-channels';
import { parseClientRef, inlineCheckoutProofPolicy } from '@/lib/r2-client-ref';
import { validateAndCalculateVoucher } from '@/lib/vouchers/validate';
import { appendLedger } from '@/lib/ledger';
import { resolveServiceSellability } from '@/lib/v2-catalog';
import { isVendorSurfaceServiceKey } from '@/lib/vendor-surface-service-keys';
import { ADD_ONS } from '@/lib/add-ons-catalog';
import { getMenuLifecyclePhase } from '@/lib/day-of-mode';
import {
  resolveOrderChargeCentavos,
  refusalMessage,
  chargeOverchargesDisplayedPrice,
  orderTotalToPhp,
  type OrderTotalCentavos,
} from '@/lib/order-charge-authority';
import { computeVatFromBase } from '@/lib/receipts';
import { getEffectiveVatRatePct } from '@/lib/platform-settings';
import { coordinatorMoneyScopeAllowed } from '@/lib/coordinator-money-scope';
import { orderRowFor, paymentRowFor } from '@/lib/order-mint-identity';
import { getRequestPlatform, isRequestPlatform } from '@/lib/request-platform';
import { notifyAdminsOrderAwaitingReconciliation } from '@/lib/order-admin-notify';

/**
 * Same reference-code shape as createOrder · 'SN' prefix + 8 uppercase hex.
 */
function generateReferenceCode(): string {
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  return (
    'SN' +
    Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/**
 * applyVoucherAction — invoked by the drawer's voucher field via the
 * form action pattern. Returns a JSON-serializable result the drawer
 * client component renders inline. NO DB writes — pure read-only check.
 *
 * Input shape (FormData):
 *   • code — voucher code string (case-insensitive · uppercased server-side)
 *   • service_key — SKU code from the calling add-on page
 *   • original_centavos — string-encoded BigInt centavos (e.g. "149900")
 *
 * Output shape (return value):
 *   • applied: boolean
 *   • code: string | null — normalized code if applied
 *   • discount_php: string — formatted peso string (e.g. "₱500.00")
 *   • final_php: string — formatted peso string for total post-voucher
 *   • reason?: string — brand-voice rejection copy if NOT applied
 */
export type ApplyVoucherResult = {
  applied: boolean;
  code: string | null;
  discount_centavos: string; // BigInt-as-string for client round-trip
  final_centavos: string;
  discount_php: string;
  final_php: string;
  reason?: string;
};

export async function applyVoucherAction(
  prevState: ApplyVoucherResult | null,
  formData: FormData,
): Promise<ApplyVoucherResult> {
  void prevState;

  const code = formData.get('code');
  const serviceKey = formData.get('service_key');
  const originalRaw = formData.get('original_centavos');

  if (
    typeof code !== 'string' ||
    typeof serviceKey !== 'string' ||
    typeof originalRaw !== 'string'
  ) {
    return {
      applied: false,
      code: null,
      discount_centavos: '0',
      final_centavos: '0',
      discount_php: '₱0.00',
      final_php: '₱0.00',
      reason: "We couldn't check that code. Please try again.",
    };
  }

  // Parse the original price as BigInt. The drawer ships the centavos as
  // a plain integer string · validate it before BigInt() throws.
  let originalCentavos: bigint;
  try {
    originalCentavos = BigInt(originalRaw);
  } catch {
    return {
      applied: false,
      code: null,
      discount_centavos: '0',
      final_centavos: '0',
      discount_php: '₱0.00',
      final_php: '₱0.00',
      reason: "We couldn't check that code. Please try again.",
    };
  }

  // Auth gate — couples only.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      applied: false,
      code: null,
      discount_centavos: '0',
      final_centavos: originalCentavos.toString(),
      discount_php: '₱0.00',
      final_php: formatPesoFromCentavos(originalCentavos),
      reason: 'Please sign in to apply a code.',
    };
  }

  const result = await validateAndCalculateVoucher({
    code,
    service_key: serviceKey,
    original_centavos: originalCentavos,
    couple_user_id: user.id,
  });

  return {
    applied: result.applied,
    code: result.code_normalized,
    discount_centavos: result.discount_centavos.toString(),
    final_centavos: result.final_centavos.toString(),
    discount_php: formatPesoFromCentavos(result.discount_centavos),
    final_php: formatPesoFromCentavos(result.final_centavos),
    reason: result.reason,
  };
}

/**
 * Format a BigInt centavos to a peso display string. Mirrors the helper
 * in calculate.ts (kept private here to avoid pulling the BigInt type
 * across the server-action boundary unnecessarily).
 */
function formatPesoFromCentavos(centavos: bigint): string {
  const pesos = Number(centavos) / 100;
  return `₱${pesos.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * submitOrderAction — atomic transaction landing 4-5 rows:
 *   (1) orders row at status='pending_approval' (existing enum value
 *       'submitted' maps semantically; we land at 'submitted' since the
 *       existing payment-reconciliation flow reads that value. Day 3
 *       enum extension is queued but NOT shipped THIS PR — the existing
 *       state machine carries the same intent.)
 *   (2) payments row at status='pending' with screenshot_url + amount
 *   (3) discount_code_redemptions row IF voucher applied
 *   (4) order_ledger 'order_created' event
 *   (5) order_ledger 'voucher_applied' event IF voucher applied
 *   (6) order_ledger 'payment_uploaded' event
 *
 * Idempotency: NOT idempotent at the action level. The drawer disables
 * submit-button while pending + client_idempotency_key on payments
 * (Task 8 pilot hardening pattern from createOrder) catches double-submit
 * retries. Order INSERT itself has no idempotency key in V1 schema; one
 * order per drawer-submit is the pilot contract.
 *
 * Self-comp branch · vendor self-purchase confirm modal (CLAUDE.md
 * 2026-05-15 § 3.1a) is NOT supported by this inline path during pilot.
 * Vendors using inline-checkout submit a real order. The legacy
 * /orders/new path stays available via direct URL for self-comp workflows
 * (it just stops being the primary entry point); the redirect from
 * /orders/new lands them on /add-ons where they can pick the SKU again.
 * V1.x adds self-comp branch to the drawer when vendor-side dogfooding
 * needs it during pilot polish.
 *
 * Returns the created order_id so the drawer can redirect / link the
 * couple to the status tracker.
 */
export type SubmitOrderResult =
  | {
      ok: true;
      order_id: string;
      reference_code: string;
    }
  | {
      ok: false;
      reason: string;
      /** Anon-draft: set when the order was blocked because the user hasn't
       *  secured their account yet — the drawer routes them to /signup. */
      needsAccount?: true;
    };

export async function submitOrderAction(
  formData: FormData,
): Promise<SubmitOrderResult> {
  const eventId = formData.get('event_id');
  const serviceKey = formData.get('service_key');
  const displayName = formData.get('display_name');
  const originalRaw = formData.get('original_centavos');
  const referenceNumber = formData.get('reference_number');
  const screenshotRefRaw = formData.get('screenshot_ref');
  const channel = formData.get('channel'); // 'bdo' or 'gcash'
  const voucherCodeRaw = formData.get('voucher_code'); // optional · applied at apply step
  const voucherDiscountRaw = formData.get('voucher_discount_centavos'); // optional

  if (
    typeof serviceKey !== 'string' ||
    typeof displayName !== 'string' ||
    typeof channel !== 'string'
  ) {
    return { ok: false, reason: 'Missing required fields. Please refresh and try again.' };
  }

  // 🔒 EVERY SKU IS EVENT-SCOPED (owner 2026-08-01: "it is per event").
  // `SETNAYAN_AI_SUB`, the per-USER term pass, was the ONE eventless SKU and had
  // an exemption here that skipped the event_id requirement — the same exemption
  // that let a forged POST mint an order with no event to check membership
  // against. It is retired along with the rest of the per-user path, so the
  // requirement is now unconditional.
  const eventIdClean =
    typeof eventId === 'string' && eventId.trim().length > 0 ? eventId.trim() : null;
  if (!eventIdClean) {
    return { ok: false, reason: 'Missing required fields. Please refresh and try again.' };
  }

  // ⭐ SEC-7 · `original_centavos` IS NO LONGER A PRICE.
  //
  // It used to seed the charge and survive whenever no catalog row resolved —
  // which is every key in NEITHER catalog, SETNAYAN_AI_SUB included. It is now
  // parsed for ONE purpose: the one-way overcharge tripwire further down (the
  // customer consented to the figure their screen showed, so resolving HIGHER is
  // a refusal). It never becomes the charge, and a malformed / absent value is
  // simply "no display reference" rather than an error — there is nothing left
  // for it to break.
  let displayedCentavos: bigint | null = null;
  if (typeof originalRaw === 'string' && originalRaw.trim().length > 0) {
    try {
      const parsed = BigInt(originalRaw.trim());
      displayedCentavos = parsed >= 0n ? parsed : null;
    } catch {
      displayedCentavos = null;
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, reason: 'Please sign in to submit your order.' };
  }
  // Anon-draft money floor: an order ties a real PHP charge, a BIR receipt, and
  // refund contactability to the buyer — none of which work under a placeholder
  // identity. Block anonymous users and signal the drawer to route them to
  // /signup (convert-in-place keeps their event + cart context).
  if (user.is_anonymous) {
    return {
      ok: false,
      reason: 'Create your account to complete this purchase — your plan stays exactly as it is.',
      needsAccount: true,
    };
  }

  // ⭐ The channel kill switch is enforced HERE, not just in the picker.
  //
  // Setnayan receives on PERSONAL accounts, and a personal GCash wallet FAILS
  // incoming transfers once it passes its monthly receiving cap — it does not
  // queue them. When the owner closes a rail because its account is at cap,
  // accepting an order on it would send the couple to pay into an account that
  // physically cannot receive, and the failure surfaces as "I paid and nothing
  // happened". A hidden radio button in the client does not prevent that; this
  // does. See lib/payment-channels.ts + migration 20271028100000.
  const channelSettings = await fetchPlatformSettings(supabase);
  const openChannel = resolveChannel(channel, channelSettings);
  if (!openChannel) {
    return {
      ok: false,
      reason:
        'Payments are paused right now while we switch receiving accounts. Please try again shortly — nothing has been charged.',
    };
  }
  if (openChannel !== channel) {
    // The posted rail is closed. Refuse rather than silently rebooking onto a
    // different account: the couple is looking at the QR and details for the
    // rail they picked, and quietly moving them would mean paying the wrong
    // destination.
    return {
      ok: false,
      reason: `${channel === 'gcash' ? 'GCash' : 'BDO'} is temporarily unavailable. Please refresh and choose another payment method.`,
    };
  }

  // #13 (money bug-hunt): the order must be for an event the buyer belongs to.
  // The orders RLS only checks `user_id = auth.uid()`, so a forged `event_id`
  // would otherwise bind the order (and its pax-priced amount) to a stranger's
  // event.
  //
  // 🔒 This check is now UNCONDITIONAL. It used to be skipped for the eventless
  // per-USER subscription (`if (!isAiSub)`); that SKU was retired 2026-08-01, and
  // with it the only path through checkout that reached the insert without a
  // membership check.
  {
    const { data: membership } = await supabase
      .from('event_members')
      .select('event_id')
      .eq('event_id', eventIdClean)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership) {
      return { ok: false, reason: 'You can only check out for your own event.' };
    }
    // Consent-scoped coordinator checkout (owner 2026-07-19 #5). The membership
    // check above admits ANY event member — including coordinators. Behind
    // NEXT_PUBLIC_COORDINATOR_CONSENT_GATE_ENABLED, a non-couple member may
    // check out only when the couple granted the 'checkout' scope at invite
    // time (coordinator_access_consents.scopes). Flag OFF = exact current
    // behavior (helper returns true without reading).
    const checkoutAllowed = await coordinatorMoneyScopeAllowed(
      createAdminClient(),
      eventIdClean as string,
      user.id,
      'checkout',
    );
    if (!checkoutAllowed) {
      return {
        ok: false,
        reason:
          'The couple has not approved payment handling for your coordinator access — ask them to re-invite you with payment permission.',
      };
    }
  }

  // ── GENERIC RETIREMENT GUARD ─────────────────────────────────────────────
  // Generalizes the 2026-06-29 GUIDED_PACK/MEDIA_PACK denylist this replaces.
  // `is_active=false` is the ONLY retirement switch in either catalog, and
  // `submitOrderAction` is POST-able with any serviceKey (its action id ships in
  // the client bundle of every InlineCheckoutDrawer mount), so the gate has to
  // live HERE — not in a page component, and not as a per-SKU denylist someone
  // has to remember to extend. Found 2026-07-21: COUPLE_WEBSITE_PRO (₱4,999) and
  // INDOOR_BLUEPRINT (₱1,499) were both retired and both still fully purchasable.
  //
  // ⚠ It MUST run BEFORE both charge resolvers, and it must be a REJECT rather
  // than an is_active filter inside them. "Resolver returns null" is exactly the
  // bypass: the code below keeps the tamperable CLIENT price on a null resolve
  // (see its own comment — "Only SKUs in NEITHER catalog … keep the client
  // value"). Filtering inside the resolver would turn a retired SKU from
  // "charged its real price" into "charged whatever the browser sent".
  //
  // 'unknown' (in neither catalog) deliberately ALLOWS keys with no catalog
  // row: SETNAYAN_AI_SUB, PAPIC_CAMERAS and vendor_additional_branch__<uuid>.
  // A "must map to an active row" rule would break them. Sellability is NOT the
  // price gate — resolveOrderChargeCentavos is, and it refuses anything it
  // cannot price server-side.
  //
  // ⚠ This list has been wrong twice, in opposite directions, and both errors
  // were load-bearing. Verify before trusting a list like this.
  //   • It named 'save-the-date:<slug>', which DOES NOT EXIST anywhere in the
  //     codebase (the real SKU is STD_PREMIUM_OPENINGS, an ordinary retail row).
  //     Corrected 2026-07-26.
  //   • It OMITTED setnayan_service__{category}, which was genuinely
  //     drawer-mounted and genuinely undefended. Added 2026-07-26 during the
  //     SEC-7 review — and REMOVED from the list again later the same day, when
  //     the owner deleted that purchase path outright rather than repricing it.
  //     Nothing mounts a drawer against that key now and no resolver owns it, so
  //     it is no longer a legitimate 'unknown': it reaches
  //     resolveOrderChargeCentavos only via a forged POST, and is refused there.
  //
  // ── SEC-4b · vendor-surface keys are not sellable here ────────────────────
  // Runs BEFORE the sellability gate because it is NOT a pricing question. The
  // four `vendor_*__<id>` families encode a vendor-owned target in the key, and
  // activateOrderSku's PREFIX_HOOKS provision straight off that string with no
  // check that the order relates to the owning vendor.
  //
  // ⚠ This is defence in depth, not a live fix: SEC-7 already refuses these at
  // resolveOrderChargeCentavos ('no_price_source'), because none of them has a
  // catalog row. That protection is a PRICING accident, though — add one of
  // these prefixes to platform_retail_catalog_v2 and SEC-7 will resolve a price
  // and wave it through. This check does not care what the catalog says.
  //
  // Nothing legitimate is lost: each family is minted by its own
  // vendor-dashboard action (branches / team / custom plan / the booking-fee
  // lock), never by the couple drawer.
  if (isVendorSurfaceServiceKey(serviceKey)) {
    return {
      ok: false,
      // Deliberately generic — it must not confirm whether the referenced
      // charge / branch / profile exists.
      reason: 'That service is not available from this checkout.',
    };
  }

  /*
    ── THE CELEBRATION IS OVER: THE DAY-OF SERVICES STOP SELLING ────────────

    Owner, 2026-08-21, asked what should happen to Live Studio, Papic cameras
    and Custom QR once the event has finished: **"stop offering them."**

    🔑 IT HAS TO LIVE HERE, FOR THE REASON THE RETIREMENT GUARD ABOVE ALREADY
    STATES: `submitOrderAction` is POST-able with ANY serviceKey — its action id
    ships in the client bundle of every drawer mount — so a gate in a page
    component closes the button and not the door. Fourteen drawer surfaces
    mount against these keys; this one refusal closes all of them, and closes a
    stale tab and a back-button too.

    ⚠ A REJECT, BEFORE THE CHARGE RESOLVERS — same rule as the retirement guard
    directly below. Filtering inside a resolver turns "refused" into "charged
    whatever the browser sent".

    ⚠ AND IT ASKS THE LIFECYCLE RESOLVER, NOT THE CAPTURE WINDOW. Papic's own
    capture window FAILS OPEN when a couple never set bounds, so a gate built on
    it would simply not exist for most events. `getMenuLifecyclePhase` is the
    one answer to "has this happened", shared with the Overview, the rail, the
    guest list and the public page.

    Fail-soft on the read: an event row we cannot fetch does NOT block a sale.
    Refusing a paying customer because of a transient read is the worse error
    here — the presentation layers have already closed the card, so reaching
    this line at all means something unusual.
  */
  const dayOfOnlyKeys = new Set(
    ADD_ONS.filter((a) => a.dayOfOnly)
      .map((a) => a.serviceKey)
      .filter((k): k is string => Boolean(k)),
  );
  if (dayOfOnlyKeys.has(serviceKey)) {
    // Service-role: the phase is an EVENT fact, and the caller may be a
    // coordinator whose RLS view of `events` is narrower than the couple's.
    const { data: lifecycleRow } = await createAdminClient()
      .from('events')
      .select('event_date, event_end_date, cleared_at, timezone')
      .eq('event_id', eventIdClean)
      .maybeSingle();
    if (lifecycleRow) {
      const phase = getMenuLifecyclePhase(
        (lifecycleRow as { event_date?: string | null }).event_date ?? null,
        (lifecycleRow as { cleared_at?: string | null }).cleared_at ?? null,
        (lifecycleRow as { timezone?: string | null }).timezone ?? undefined,
        undefined,
        (lifecycleRow as { event_end_date?: string | null }).event_end_date ?? null,
      );
      if (phase === 'after') {
        return {
          ok: false,
          reason:
            'This one only runs during your celebration, and yours has finished. Everything that turns the day into a keepsake is still open.',
        };
      }
    }
  }

  // Fails CLOSED on a read error. This knowingly reverses the older "a transient
  // read failure NEVER blocks an order" stance for THIS check only: a checkout
  // blocked for thirty seconds beats an order created at a client-supplied price.
  const sellability = await resolveServiceSellability(serviceKey);
  if (sellability === 'retired') {
    return {
      ok: false,
      reason:
        'This service is no longer available. Pick the software you want from your dashboard instead.',
    };
  }
  if (sellability === 'error') {
    return {
      ok: false,
      reason: 'We could not confirm this service is available. Please try again in a moment.',
    };
  }

  // ── ⭐ SEC-7 · THE SERVER RESOLVES THE CHARGE, OR THERE IS NO SALE ─────────
  //
  // ONE call, TOTAL-OR-NOTHING. `lib/order-charge-authority.ts` runs every
  // authoritative resolver in order (the AI subscription's unit × validated
  // cycles → retail catalog → the AI per-event-type ladder → package catalog)
  // and either hands back a fully-multiplied total or REFUSES. A fifth resolver,
  // for the booked first-party `setnayan_service__{category}` deal, was removed
  // 2026-07-26 with the purchase path it served.
  //
  // What changed, and why it is the whole bug:
  //
  //   BEFORE  originalCentavos = BigInt(formData.get('original_centavos'))
  //           …overwritten ONLY IF a catalog row resolved.
  //           → every key in neither catalog kept the browser's number, and a
  //             transient read error did too. SETNAYAN_AI_SUB is such a key, and
  //             its branch skips the event_members check, so ₱0.01 bought a
  //             28-day AI subscription from any signed-in account.
  //
  //   AFTER   the client value is not an input to the charge AT ALL. A key with
  //           no resolver fails the sale; a resolver that ERRORS fails the sale.
  //
  // ⚠ ORDERING IS LOAD-BEARING and unchanged: `resolveServiceSellability` above
  // is a REJECT that runs BEFORE this, never an `is_active` filter inside a
  // resolver. `is_active=false` is OVERLOADED (on SETNAYAN_AI_RENEW it means "not
  // independently sellable", not "retired"), and filtering inside a resolver used
  // to demote "retired SKU charged its real price" into "charged whatever the
  // browser sent". Both properties survive.
  //
  // ⚠ `cycles` IS NOT PARSED HERE, and as of 2026-08-01 it is not parsed
  // ANYWHERE: retiring the per-USER subscription removed the only SKU with a
  // cycle multiplier, so the charge path no longer multiplies at all. Every
  // total is a catalog figure sealed as-is into a branded `OrderTotalCentavos`,
  // and arithmetic on that brand yields a plain bigint that will not type-check
  // back into a total. The 36× overcharge is now unrepresentable rather than
  // guarded. See the module header.
  const authority = await resolveOrderChargeCentavos({
    serviceKey,
    eventId: eventIdClean,
  });
  if (!authority.ok) {
    await insertFaultLog({
      event_type: 'OTHER',
      element_name: 'Checkout charge authority refused',
      file_path: 'app/dashboard/[eventId]/checkout/actions.ts',
      error_message: `${authority.refusal}: ${authority.detail ?? ''}`,
      payload_snapshot: {
        eventId: eventIdClean,
        serviceKey,
        displayedCentavos: displayedCentavos?.toString() ?? null,
      },
    });
    return { ok: false, reason: refusalMessage(authority.refusal) };
  }

  // The ONE authoritative amount for this order. `const` + the brand means it
  // cannot be reassigned or re-multiplied downstream.
  const chargeTotal: OrderTotalCentavos = authority.total;
  // SEC-3: the pax this order is PRICED at, frozen onto the order row below.
  // events.estimated_pax is legitimately host-writable and stays that way, so
  // the billed pax must never be re-derivable from it after the fact. Same
  // idea as the orders.setnayan_fee_bps snapshot. Null for every non-pax SKU.
  const paxSnapshot: number | null = authority.paxSnapshot;

  // ── The one-way overcharge tripwire ───────────────────────────────────────
  // The buyer consented to the peso figure their screen showed. Resolving HIGHER
  // than that is refused rather than billed — this is the structural guard
  // against the 36× cycles² class (the AI subscribe card already ships
  // unit × cycles as `original_centavos`; a second multiply would resolve 36× the
  // displayed total and this stops it dead). Resolving LOWER is allowed on
  // purpose: the vendor-unlocked 3D Plan discount does exactly that, and the
  // server figure wins either way, so a posted value tampered DOWN only blocks
  // the tamperer's own checkout. Pax-priced totals are exempt — they legitimately
  // rise after render, because SEC-3 prices them off live headcount rather than
  // the host-writable estimate.
  if (
    chargeOverchargesDisplayedPrice({
      total: chargeTotal,
      displayedCentavos,
      volatile: authority.volatile,
    })
  ) {
    await insertFaultLog({
      event_type: 'OTHER',
      element_name: 'Checkout would overcharge the displayed price',
      file_path: 'app/dashboard/[eventId]/checkout/actions.ts',
      error_message: `resolved ${chargeTotal.toString()} > displayed ${displayedCentavos?.toString()}`,
      payload_snapshot: { eventId: eventIdClean, serviceKey, source: authority.source },
    });
    return {
      ok: false,
      reason: 'The price for this changed. Please refresh the page and try again.',
    };
  }

  const originalCentavos: bigint = chargeTotal;

  // Re-validate the voucher server-side EVEN THOUGH the apply step already
  // checked. Two reasons: (a) defence-in-depth · the client could lie about
  // the discount; (b) the apply was at T-N seconds, the code might have
  // been deactivated in the interim. Re-checking + re-computing keeps
  // the order math honest.
  let voucherFinalCentavos = originalCentavos;
  let voucherDiscountCentavos = 0n;
  let voucherCodeNormalized: string | null = null;
  let voucherCodeId: string | null = null;

  if (typeof voucherCodeRaw === 'string' && voucherCodeRaw.trim().length > 0) {
    const recheck = await validateAndCalculateVoucher({
      code: voucherCodeRaw.trim(),
      service_key: serviceKey,
      original_centavos: originalCentavos,
      couple_user_id: user.id,
    });
    if (recheck.applied) {
      voucherFinalCentavos = recheck.final_centavos;
      voucherDiscountCentavos = recheck.discount_centavos;
      voucherCodeNormalized = recheck.code_normalized;
      voucherCodeId = recheck.discount_code_id;
    } else {
      // The code became invalid between apply and submit. Surface and stop.
      // The drawer will clear the field and let the couple retry.
      return {
        ok: false,
        reason: recheck.reason ?? 'That code is no longer valid. Please try again.',
      };
    }
  } else if (
    typeof voucherDiscountRaw === 'string' &&
    voucherDiscountRaw.trim().length > 0
  ) {
    // Client claimed a discount but didn't send the code · suspicious. Reject.
    return {
      ok: false,
      reason: 'Voucher state did not match. Please reapply your code.',
    };
  }

  // Resolve the screenshot ref. The drawer uses <FileUpload name="screenshot_ref">,
  // which uploads direct-to-R2 (PRIVATE thread-files bucket) and emits the r2:// ref.
  //
  // ⛔ The legacy `<input type="file" name="screenshot">` fallback was DELETED
  // 2026-07-30: it wrote payment proofs — bank / GCash screenshots carrying
  // account numbers and names — to the PUBLIC `setnayan-media` bucket, which is
  // served unsigned to anyone holding the key. Nothing produced that field on
  // this action, so it was a loaded gun rather than a live leak. Removing it is
  // safe to fail: a submit with no valid ref falls through to the existing
  // "A payment screenshot is required." reject below, so the buyer is told
  // rather than silently having their proof published.
  // `payment-proof-public-bucket.test.ts` keeps it deleted.
  let screenshotUrl: string | null = null;
  // SEC-1: the order row does not exist yet here, so the ref is bound to the
  // event + the buyer's own user id — the two server-known keys the drawer and
  // the historical uploader write under. A bare `startsWith('r2://')` accepted
  // any key in any bucket, which an admin then renders while reconciling.
  if (
    typeof screenshotRefRaw === 'string' &&
    parseClientRef(
      screenshotRefRaw.trim(),
      inlineCheckoutProofPolicy(eventIdClean, user.id),
    )
  ) {
    screenshotUrl = screenshotRefRaw.trim();
  }

  if (!screenshotUrl) {
    return { ok: false, reason: 'A payment screenshot is required.' };
  }

  // Idempotency key for the payments INSERT (Task 8 pilot hardening pattern).
  const idempotencyKeyRaw = formData.get('client_idempotency_key');
  const idempotencyKey =
    typeof idempotencyKeyRaw === 'string' && idempotencyKeyRaw.trim().length > 0
      ? idempotencyKeyRaw.trim().slice(0, 64)
      : null;

  const referenceNumberClean =
    typeof referenceNumber === 'string' && referenceNumber.trim().length > 0
      ? referenceNumber.trim()
      : null;

  // ---- Atomic-ish transaction ----
  //
  // Supabase doesn't expose multi-statement transactions to the JS client
  // (the RPC pattern would · we use the simpler sequential-write approach
  // with rollback on failure). If the orders INSERT succeeds but the
  // payments INSERT fails, we delete the order to avoid orphan rows.
  // If the redemption INSERT fails on a UNIQUE-violation race (parallel
  // tab), the couple gets a clear error and the order rolls back too.

  // Reference code: prefer the client PRE-MINTED code (the drawer shows it
  // BEFORE the couple leaves to pay, so they can put it in their BDO/GCash
  // transfer note → the reconciliation matcher pairs the inbound bank message
  // to this order by reference). Accept it only when well-formed (SN + 8 hex);
  // otherwise mint one here as before. The code is a non-sensitive tag — a
  // (astronomically rare) collision just fails this INSERT on the unique
  // reference_code, it can never hijack another order.
  const premintedRaw = formData.get('preminted_reference');
  const referenceCode =
    typeof premintedRaw === 'string' && /^SN[0-9A-F]{8}$/.test(premintedRaw.trim())
      ? premintedRaw.trim()
      : generateReferenceCode();
  // The stored pre-VAT base IS the server-resolved total — never the posted one.
  const originalPriceForOrderTotal = orderTotalToPhp(chargeTotal);
  // Owner ruling 2026-06-25: catalog prices are PRE-VAT; the couple pays the
  // VAT-INCLUSIVE gross (+12%). computeOrderTotals + the BIR receipt already gross
  // the stored pre-VAT base, so the amount we INSTRUCT the couple to pay here
  // (payment.amount_php + the confirmation email + the admin reconciliation notice)
  // MUST be the gross too — else the order under-collects the 12% and shows a
  // phantom 'remaining'. The stored requested_total_php stays the PRE-VAT base
  // (computeOrderTotals grosses it); the voucher-adjusted base is what VAT applies
  // to, mirroring the gross the order will owe once approval sets confirmed_total_php.
  // Effective rate from platform_settings — 0 while Setnayan is non-VAT registered. Previously
  // a hardcoded 12 that ignored the configured 0, billing every customer SKU 12% over its
  // advertised price (a ₱2,500 SKU instructed at ₱2,800).
  const finalAmountForPayment = computeVatFromBase(
    Number(voucherFinalCentavos) / 100,
    await getEffectiveVatRatePct(supabase),
  ).gross;

  // Existing schema uses NUMERIC(12,2) requested_total_php · we land
  // the ORIGINAL price in that field (consistent with the legacy createOrder
  // flow where requested_total_php is the quote · admin confirms to
  // confirmed_total_php on approval). voucher_discount_centavos column
  // (PR #594) carries the post-voucher delta. The orders row's
  // confirmed_total_php gets set on admin approval (Day 3) to the
  // voucher-adjusted figure so the BIR receipt shows net paid.
  // Originating platform (web / ios / android) for /admin/payments visibility.
  // Prefer an explicit, validated form hint (lets the route-to-web hand-off
  // carry the app origin through the external browser — PR #1538 follow-up);
  // otherwise the detected request platform. Defaults to 'web' on any miss.
  const platformHint = formData.get('platform');
  const orderPlatform = isRequestPlatform(platformHint)
    ? platformHint
    : await getRequestPlatform();

  // ── SEC-4b · service-role mint, identity stamped server-side ──────────────
  // `orders` INSERT is revoked from `authenticated` (migration 20271008178212),
  // so this write goes through service_role — which bypasses
  // `orders_owner_write`'s `WITH CHECK (user_id = auth.uid())`, the only thing
  // that used to bind the row to the buyer. `orderRowFor` restores that binding
  // in code: user_id can only be the id `supabase.auth.getUser()` returned, and
  // supplying it in `fields` is a compile error.
  //
  // AUTHORIZATION FOR THIS ROW ALREADY RAN ABOVE and is unchanged: signed in +
  // not anonymous (line ~307), an `event_members` row for (event, user)
  // (line ~321), and `coordinatorMoneyScopeAllowed(… 'checkout')` (line ~336).
  // RLS never checked event_id here — that scoping was always code-side.
  //
  // The invariant this once had to special-case now holds by construction: an
  // event id is only ever written when a membership check covered it, because
  // every SKU is event-scoped and the check above is unconditional. (History: the
  // eventless per-USER AI subscription skipped that check while still carrying
  // the caller-supplied `eventIdClean`, which under service_role was a way to
  // bind a purchase to a stranger's event. Both the SKU and the exemption were
  // removed 2026-08-01.)
  const insertPayload: Record<string, unknown> = orderRowFor(
    {
      userId: user.id,
      eventId: eventIdClean,
      vendorProfileId: null, // couple-side purchase — never vendor-billed.
    },
    {
      service_key: serviceKey,
      description: displayName,
      requested_total_php: originalPriceForOrderTotal,
      reference_code: referenceCode,
      platform: orderPlatform,
      // Land at 'submitted' which is the existing canonical "queued for admin
      // review" state. The new spec's 'pending_approval' maps semantically;
      // a follow-up migration extends the enum with the new value names but
      // backward-compat readers (admin payment reconciliation queue at
      // /admin/payments) continue to filter on the current enum so we
      // preserve their behaviour.
      // SEC-3 · migration 20271008000839. Frozen at insert, never recomputed.
      // Omitted entirely when null so a stale env without the column still
      // accepts the insert (same defensive shape the rest of this payload uses).
      // Kept through the SEC-4b conversion: the mint moved to service_role but
      // the snapshot is still the value priced at order time.
      ...(paxSnapshot != null ? { pax_snapshot: paxSnapshot } : {}),
      status: 'submitted',
    },
  );

  // Voucher snapshot columns from PR #594. orders_voucher_coherence CHECK
  // requires (code NULL AND discount = 0) OR (code NOT NULL AND discount > 0).
  if (voucherCodeNormalized && voucherDiscountCentavos > 0n) {
    insertPayload.voucher_code_applied = voucherCodeNormalized;
    insertPayload.voucher_discount_centavos = Number(voucherDiscountCentavos);
  }

  const moneyWriter = createMoneyWriterClient();

  const { data: orderRow, error: orderErr } = await moneyWriter
    .from('orders')
    .insert(insertPayload)
    .select('order_id')
    .maybeSingle();

  if (orderErr || !orderRow) {
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Create checkout order (orders INSERT)',
      file_path: 'app/dashboard/[eventId]/checkout/actions.ts',
      error_message: String(orderErr?.message ?? 'orders insert returned no row'),
      payload_snapshot: { eventId: eventIdClean, serviceKey, referenceCode, voucherApplied: Boolean(voucherCodeNormalized) },
    });
    return {
      ok: false,
      reason: orderErr?.message ?? 'Could not create your order. Please try again.',
    };
  }

  const orderId = orderRow.order_id as string;

  // payments row · this carries the screenshot. The drawer always includes
  // a screenshot at submit-time so we never have an orphan "no payment yet"
  // state · the order lands directly ready for admin reconciliation.
  //
  // SEC-4b: `payments` INSERT is revoked from `authenticated` too, so this also
  // goes through service_role. `verifiedOrderId` is the row we just minted in
  // this same request for this same user — the strongest possible proof it is
  // the caller's own order (`payments_owner_insert` never checked that: the FK
  // validates existence only, so a session-role POST could pin a payment onto a
  // stranger's order).
  const paymentInsert: Record<string, unknown> = paymentRowFor(
    { userId: user.id, verifiedOrderId: orderId },
    {
      amount_php: finalAmountForPayment,
      channel,
      reference_number: referenceNumberClean,
      screenshot_url: screenshotUrl,
      paid_at: new Date().toISOString().slice(0, 10),
    },
  );
  if (idempotencyKey) {
    paymentInsert.client_idempotency_key = idempotencyKey;
  }

  const { data: paymentRow, error: paymentErr } = await moneyWriter
    .from('payments')
    .insert(paymentInsert)
    .select('payment_id')
    .maybeSingle();

  if (paymentErr || !paymentRow) {
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Log checkout payment (payments INSERT)',
      file_path: 'app/dashboard/[eventId]/checkout/actions.ts',
      error_message: String(paymentErr?.message ?? 'payments insert returned no row'),
      payload_snapshot: { orderId, eventId: eventIdClean, serviceKey, channel },
    });
    // Rollback the orders row to avoid an orphan. Same client that minted it —
    // a mixed-client compensation is how a rollback silently stops rolling back.
    await moneyWriter.from('orders').delete().eq('order_id', orderId);
    return {
      ok: false,
      reason: paymentErr?.message ?? 'Could not log payment. Please try again.',
    };
  }
  const paymentId = paymentRow.payment_id as string;

  // discount_code_redemptions row IF voucher applied. UNIQUE (order_id)
  // from PR #594 + UNIQUE (discount_code_id, couple_user_id) from PR #595
  // are the structural guarantees. 23505 unique-violation here means the
  // couple raced two tabs · we roll back both INSERTs and surface the
  // friendly error.
  if (voucherCodeId && voucherDiscountCentavos > 0n) {
    const { error: redemptionErr } = await supabase
      .from('discount_code_redemptions')
      .insert({
        discount_code_id: voucherCodeId,
        order_id: orderId,
        couple_user_id: user.id,
        discount_centavos_applied: Number(voucherDiscountCentavos),
      });
    if (redemptionErr) {
      await insertFaultLog({
        event_type: 'SUPABASE_SAVE_ERROR',
        element_name: 'Apply checkout voucher (discount_code_redemptions INSERT)',
        file_path: 'app/dashboard/[eventId]/checkout/actions.ts',
        error_message: String(redemptionErr.message),
        payload_snapshot: { orderId, paymentId, eventId: eventIdClean, serviceKey, voucherCodeId, dbErrorCode: (redemptionErr as { code?: string }).code },
      });
      // Rollback both prior INSERTs.
      //
      // ⚠ BUG FIXED IN PASSING: the payments DELETE was on the SESSION client,
      // and public.payments has NO DELETE policy for `authenticated` — RLS
      // matched zero rows, so this "rollback" silently deleted nothing and left
      // an orphan payment behind whenever a voucher race fired. On service_role
      // it actually rolls back.
      await moneyWriter.from('payments').delete().eq('payment_id', paymentId);
      await moneyWriter.from('orders').delete().eq('order_id', orderId);
      const code = (redemptionErr as { code?: string }).code;
      const reason =
        code === '23505'
          ? "Looks like you've already used this code."
          : 'Could not apply your voucher. Please try again.';
      return { ok: false, reason };
    }

    // Increment uses_count on the discount_codes row (best-effort via the admin
    // client). #12 (money bug-hunt): use the atomic increment_discount_uses RPC
    // instead of a read-then-write — the latter lost updates under concurrency,
    // so the apply-time cap (uses_count < max_uses) under-counted and the cap
    // could be exceeded. The counter is now accurate. (Full apply-time atomicity
    // — gating the discount on an atomic conditional increment — is a larger
    // follow-up; the discount_codes_uses_within_cap CHECK still backstops an
    // over-increment.)
    try {
      const admin = createAdminClient();
      await admin.rpc('increment_discount_uses', { p_id: voucherCodeId });
    } catch (counterErr) {
      // Counter drift is recoverable via admin reconciliation; never
      // unwind the parent transaction.
      console.warn('[checkout] discount_codes uses_count bump failed:', counterErr);
    }
  }

  // ---- order_ledger writes (best-effort · NEVER throws) ----
  //
  // Three events on submit per the locked policy:
  //   • order_created — the row exists
  //   • voucher_applied — only if a voucher landed
  //   • payment_uploaded — the screenshot landed
  //
  // The ledger helper swallows + logs all failures · these calls never
  // unwind the parent transaction even if RLS rejects.

  await appendLedger(supabase, {
    order_id: orderId,
    event_type: 'order_created',
    actor_user_id: user.id,
    actor_role: 'couple',
    amount_centavos: Number(originalCentavos),
    metadata: { service_key: serviceKey, display_name: displayName },
  });

  if (voucherCodeNormalized && voucherDiscountCentavos > 0n) {
    await appendLedger(supabase, {
      order_id: orderId,
      event_type: 'voucher_applied',
      actor_user_id: user.id,
      actor_role: 'couple',
      amount_centavos: Number(voucherDiscountCentavos),
      voucher_code: voucherCodeNormalized,
      metadata: {
        original_centavos: Number(originalCentavos),
        final_centavos: Number(voucherFinalCentavos),
      },
    });
  }

  await appendLedger(supabase, {
    order_id: orderId,
    event_type: 'payment_uploaded',
    actor_user_id: user.id,
    actor_role: 'couple',
    amount_centavos: Number(voucherFinalCentavos),
    payment_id: paymentId,
    metadata: { channel, reference_number: referenceNumberClean },
  });

  // ---- Admin confirmation (best-effort · Notification Foundation Phase B) ----
  //
  // Fan out to every admin/internal/team user that a new order is in the
  // /admin/payments reconciliation queue. The order already carries a
  // screenshot at this point, so the admin can act immediately. Fail-soft:
  // a failed notification never affects the order that already landed.
  await notifyAdminsOrderAwaitingReconciliation({
    orderId,
    description: displayName,
    amountPhp: finalAmountForPayment,
    referenceCode,
  });

  // ---- Payment-instructions email (best-effort · matches PR #591/#593) ----
  //
  // We preserve the email-on-submit behaviour from createOrder so couples
  // get the reference code in their inbox AND a deep-link back to the
  // order detail page. The same fetchPlatformSettings(supabase) source-
  // of-truth refactor from PR #593 (BDO/GCash from public.platform_settings,
  // not env vars) is preserved verbatim. Email failure NEVER blocks the
  // order — the row is the truth · this email is the convenience surface.
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    // Eventless subscription orders have no event route — link to the dashboard.
    const orderUrl = eventIdClean
      ? `${appUrl}/dashboard/${eventIdClean}/orders/${orderId}`
      : `${appUrl}/dashboard`;
    const settings = await fetchPlatformSettings(supabase);
    const hasBdo = Boolean(settings.bdo_account_number?.trim());
    const hasGcash = Boolean(settings.gcash_number?.trim());

    const amountFormatted = finalAmountForPayment.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const lines: string[] = [
      `Salamat — your order is in.`,
      ``,
      `Here are the details for your records.`,
      ``,
      `Order: ${displayName}`,
      `Amount: ₱${amountFormatted}`,
      `Reference code: ${referenceCode}`,
      ``,
    ];

    if (voucherCodeNormalized) {
      lines.push(`Voucher applied: ${voucherCodeNormalized}`);
      lines.push(``);
    }

    lines.push(
      `Our team will reconcile your payment within one business day. We'll email again once your order moves to approved.`,
    );
    lines.push(``);
    // Day 3 of the voucher + inline-checkout sprint (CLAUDE.md 2026-05-29 Day 3
    // row): forward-looking voucher reminder for the couple's NEXT purchase.
    // Suppressed when a voucher was already applied to this order · the hint
    // is for couples who didn't realize codes existed AND for repeat purchases.
    if (!voucherCodeNormalized) {
      lines.push(`If you have a special code, type it in the "Have a code?" field on the order page before paying.`);
      lines.push(``);
    }
    lines.push(`Track your order anytime:`);
    lines.push(orderUrl);
    lines.push(``);
    lines.push(`—`);
    lines.push(`Set na 'yan.`);

    // Best-effort: same pattern as orders/actions.ts line 222.
    await sendEmail({
      to: user.email ?? '',
      subject: `Setnayan order ${referenceCode} — received`,
      text: lines.join('\n'),
    });
  } catch (emailErr) {
    console.warn('[checkout] payment confirmation email send threw:', emailErr);
  }

  // Revalidate the dashboard + add-ons grid so the couple sees the new
  // pending order on their next render. Event-scoped paths only when there is an
  // event (the per-user subscription is eventless → just refresh the dashboard).
  if (eventIdClean) {
    revalidatePath(`/dashboard/${eventIdClean}/orders`);
    revalidatePath(`/dashboard/${eventIdClean}/orders/${orderId}`);
    revalidatePath(`/dashboard/${eventIdClean}/studio`);
  } else {
    revalidatePath('/dashboard', 'layout');
  }

  return { ok: true, order_id: orderId, reference_code: referenceCode };
}
