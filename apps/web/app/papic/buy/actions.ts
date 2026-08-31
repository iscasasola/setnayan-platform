'use server';

import { redirect } from 'next/navigation';
import { payPath } from '@/lib/pay-path';
import { notifyAdminsPaymentProofSubmitted } from '@/lib/order-admin-notify';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, createMoneyWriterClient } from '@/lib/supabase/admin';
import { readGuestSession } from '@/lib/guest-session';
import { rateLimit } from '@/lib/rate-limit';
import { mintPapicReferenceCode } from '@/lib/papic-cameras';
import { fetchPapicPassTiers } from '@/lib/papic-pass-tiers';
import { fetchPapicOneTiers, papicOneOrderRow } from '@/lib/papic-one';
import { guestOrderRowFor, guestPaymentRowFor } from '@/lib/order-mint-identity';
import { papicGuestBuyEnabled } from '@/lib/papic-guest-buy-flag';
import { eventIsOver } from '@/lib/event-is-over.server';
import { r2Upload } from '@/lib/r2';
import { encodeR2Ref, R2_BUCKETS } from '@/lib/uploads';
import {
  guestOrderDescription,
  hasOpenGuestOrder,
  mintPapicGuestAccessToken,
  normalisePayerName,
  normaliseShortEntry,
  papicGuestOrderRow,
  resolveGuestReloadTarget,
  resolveGuestRung,
  type PapicGuestBuyer,
} from '@/lib/papic-guest-buy';
import { ensureGuestOwnCameraAdmin } from '@/lib/papic-guest-own-camera';

/**
 * GUESTS CAN BUY PAPIC — the I/O half (owner-locked 2026-07-29).
 *
 * Two server actions, both reachable with NO ACCOUNT:
 *
 *   startPapicGuestPurchase  — mint the apply-then-pay order
 *   submitPapicGuestPayment  — log the transfer + its screenshot
 *
 * The pure decisions (which rung, whose camera, is one already open) live in
 * lib/papic-guest-buy.ts and are unit-tested there. What lives HERE is the part
 * that touches the world, and it is written around one question: WHAT PROVES
 * THIS CALLER MAY SPEND AGAINST THIS EVENT?
 *
 * ── THE CREDENTIAL, AND WHY event_id IS NEVER A PARAMETER ─────────────────
 * A guest holds exactly one of two credentials, both minted for another purpose
 * and both already load-bearing elsewhere:
 *
 *   • SEAT   — they claimed a camera QR, so `paparazzi_seats.claim_qr_token`
 *              resolves under their (anonymous) auth session and
 *              `claimer_user_id` is theirs. Same check `/api/upload`'s seat mode
 *              and `recordSeatCapture` make.
 *   • GUEST  — they arrived by personal QR, so the signed, HTTP-only
 *              `setnayan_guest_session` cookie carries `{guest_id, event_id}`.
 *
 * In BOTH cases the event is READ OFF the credential. There is deliberately no
 * `event_id` input on either action: an endpoint that accepted one would let
 * anyone with the public anon key mint orders against arbitrary events and
 * enumerate which ids exist by watching which ones succeeded.
 *
 * ── THE PRICE ─────────────────────────────────────────────────────────────
 * The client sends a `service_code` — a CHOICE. Points come from the
 * admin-editable rung tables, the peso figure from `platform_retail_catalog_v2`,
 * both server-side. No amount is ever read from the form. (SEC-4: the browser
 * may choose WHAT; the server decides the peso figure.)
 *
 * ── THE ACTIVATION GATE ───────────────────────────────────────────────────
 * Nothing in this file grants a single point. The order is minted `submitted`
 * and the payment `pending` (stamped, not supplied — see guestPaymentRowFor).
 * Points appear only when an admin approves the payment in /admin/payments AND
 * the matched total covers what is owed — the shipped shortfall guard, which
 * these orders inherit precisely BECAUSE they are ordinary orders. A short or
 * rejected payment provisions nothing.
 */

/** Screenshots only, and a tighter list than the generic upload route's. */
const PROOF_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/heic',
  'image/heif',
]);

/** Same ceiling the couple's own payment-proof picker enforces. */
const PROOF_MAX_BYTES = 5 * 1024 * 1024;

/** Where a refusal is shown. Errors are codes, never raw messages — see COPY. */
function backTo(returnTo: string, error: string): never {
  const base = safeReturnTo(returnTo);
  redirect(`${base}${base.includes('?') ? '&' : '?'}papic_buy_error=${error}`);
}

/**
 * Only ever bounce back INSIDE the Papic capture surfaces.
 *
 * `return_to` arrives from the client, so an unchecked value is an open
 * redirect — and this one would be handed to somebody mid-purchase, i.e. the
 * moment they are most primed to type a payment detail into whatever page
 * appears. Anything that is not a `/papic/...` path collapses to the Papic
 * root. Same posture as the allowlisted destination in
 * app/papic/me/[token]/session/route.ts.
 */
function safeReturnTo(raw: unknown): string {
  const v = typeof raw === 'string' ? raw.trim() : '';
  if (!v.startsWith('/papic/') || v.startsWith('//')) return '/papic';
  return v;
}

/**
 * Resolve WHO is buying from a credential the browser already holds.
 *
 * Returns null when neither credential checks out. The refusal is deliberately
 * indistinguishable between "no such seat", "that seat is not yours" and "that
 * seat is revoked": all three are the same answer to the caller — you may not
 * spend here — and separating them would turn this into an existence oracle for
 * seat tokens.
 */
async function resolveGuestBuyer(
  seatToken: string,
): Promise<PapicGuestBuyer | null> {
  const admin = createAdminClient();

  if (seatToken) {
    // The SESSION client on purpose: `paparazzi_seats_claimer_read` returns the
    // row only for its claimer, so resolving by token is itself the auth check.
    // The explicit claimer re-assertion below is belt over that brace — the same
    // pairing /api/upload's seat mode uses.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: seat } = await supabase
      .from('paparazzi_seats')
      .select('seat_id, event_id, claimer_user_id, revoked_at')
      .eq('claim_qr_token', seatToken)
      .maybeSingle();
    if (!seat || seat.claimer_user_id !== user.id || seat.revoked_at) return null;
    return {
      kind: 'seat',
      eventId: String(seat.event_id),
      seatId: String(seat.seat_id),
    };
  }

  const session = await readGuestSession();
  if (!session) return null;
  // Re-read the guest under the ADMIN client rather than trusting the cookie
  // alone: the cookie lives 60 days and the guest may have been removed from
  // the event since. A stale cookie must not keep minting orders against an
  // event its holder is no longer part of.
  const { data: guest } = await admin
    .from('guests')
    .select('guest_id, event_id')
    .eq('guest_id', session.guest_id)
    .maybeSingle();
  if (!guest || String(guest.event_id) !== String(session.event_id)) return null;
  return {
    kind: 'guest',
    eventId: String(guest.event_id),
    guestId: String(guest.guest_id),
  };
}

/**
 * A REAL account, or null.
 *
 * An anonymous auth session — which every seat claimer has — is NOT an account
 * the buyer can sign back into, so it is reported as null.
 *
 * ⚖ OWNER RULING 2026-08-21: *"guest needs to have an account to buy."* So null
 * is now a REFUSAL at the mint, not a shape of order. Nothing live changed —
 * `NEXT_PUBLIC_PAPIC_GUEST_BUY` has never been on — and it is what lets a
 * buyer reach the ONE payment page at all: an account-less order carries no
 * `user_id`, `orders_owner_read` has no disjunct that admits it, and `orders`
 * grants nothing to `anon`, so its own buyer would get a 404 on the order they
 * just placed.
 *
 * ⚠ SETTLING an order that ALREADY EXISTS is untouched — see
 * `submitPapicGuestPayment`. A rule about NEW purchases must never strand a
 * debt somebody already owes (the same boundary the 2026-08-21 finished-event
 * ruling drew).
 */
async function resolveRealAccountId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.is_anonymous) return null;
    return user.id;
  } catch {
    return null;
  }
}

/**
 * Step 1 — mint the order. Charges nothing, grants nothing; hands the buyer
 * their reference code and the QR payment instructions.
 */
export async function startPapicGuestPurchase(formData: FormData) {
  const returnTo = safeReturnTo(formData.get('return_to'));
  // The flag gates the SERVER too, not only the surfaces that render the form.
  // Every export of a 'use server' module is POST-able by action id whether or
  // not any UI references it, so a client-only gate would leave the whole
  // purchase path live while the buttons were hidden.
  if (!papicGuestBuyEnabled()) backTo(returnTo, 'unavailable');

  const buyer = await resolveGuestBuyer(String(formData.get('seat_token') ?? '').trim());
  if (!buyer) backTo(returnTo, 'not_here');

  /*
    ── THE CELEBRATION IS OVER: SHOTS BELONG TO A NEW EVENT ────────────────

    Owner, 2026-08-21, asked whether a guest may still buy Papic shots after
    the event: **"no. it needs to be in a new event."**

    Papic credits are scoped to ONE celebration — they are spent by cameras
    shooting it, and there is nothing left to shoot. Selling more into a
    finished event takes money for something the buyer can never use.

    🔑 IT GOES HERE, ON THE CREDENTIAL'S OWN EVENT. Every export of a
    'use server' module is POST-able by action id whether or not any UI
    references it — the same reason the flag check five lines up gates the
    server and not just the surfaces. The event is read off the credential,
    never off a form field, so this cannot be pointed at somebody else's
    event either.

    ⚠ THE SIBLING ACTION IS DELIBERATELY NOT GATED. `submitPapicGuestPayment`
    settles an order that ALREADY EXISTS: a guest who bought before the party
    ended still owes that money and must be able to pay it. Blocking them
    would strand a real debt behind a rule about new purchases.
  */
  if (await eventIsOver(createAdminClient(), buyer!.eventId)) backTo(returnTo, 'event_over');

  // Flood backstop keyed on the CREDENTIAL, not on an IP or a form value, so
  // one camera cannot mint orders faster than a person can plausibly buy.
  // Best-effort by contract (in-memory, per-instance); the one-open-order rule
  // below is the durable half.
  const rlKey = buyer!.kind === 'seat' ? `papic-buy:seat:${buyer!.seatId}` : `papic-buy:guest:${buyer!.guestId}`;
  if (!rateLimit(rlKey, 10, 60_000).ok) backTo(returnTo, 'too_fast');

  const admin = createAdminClient();

  // ── the rung ────────────────────────────────────────────────────────────
  const rawSku = String(formData.get('service_code') ?? '').trim();
  const [poolTiers, oneTiers] = await Promise.all([
    fetchPapicPassTiers(admin),
    fetchPapicOneTiers(admin),
  ]);
  const resolution = resolveGuestRung(rawSku, poolTiers, oneTiers);
  if (!resolution.ok) backTo(returnTo, 'unknown_rung');
  const rung = resolution.rung;

  // ── the camera, for a reload ────────────────────────────────────────────
  // "Their own camera ONLY" is enforced in two places that must BOTH hold: the
  // identity match (the seat they hold is the seat they may reload), and the
  // product rule (only a camera with its own dedicated balance is reloadable —
  // a camera that draws the SHARED pool has no private balance to top up, and
  // granting it one would silently move it off the pool the couple is watching).
  let seatId: string | null = buyer!.kind === 'seat' ? buyer!.seatId : null;
  if (rung.kind === 'one_reload') {
    if (buyer!.kind === 'seat') {
      // String() not a cast: a FormData entry can be a File, and a cast would let
      // one reach `.trim()` and throw where a plain refusal belongs.
      const target = resolveGuestReloadTarget(
        String(formData.get('reload_seat_id') ?? ''),
        buyer!.seatId,
      );
      if (!target.ok) backTo(returnTo, target.reason);
      seatId = target.ok ? target.seatId : null;
    } else {
      // ── THE EVENT-SITE GUEST (2026-08-02) ────────────────────────────────
      // They hold a signed cookie, not a seat — and often no auth user at all —
      // so before this there was nothing for a dedicated balance to attach to
      // and they were refused outright. They are also exactly the guest the
      // owner asked about: the one shooting the free shared pool.
      //
      // Give them a camera of their own. `guest_id` on paparazzi_seats already
      // exists for host-bought Limited cameras, and those already run with a
      // NULL claimer, so this is an INSERT into a shape the product has rather
      // than a new identity model. Reuses their existing camera when they have
      // one; the unique index makes a second impossible either way.
      //
      // 🔒 The guest id comes from `resolveGuestBuyer`, which re-reads the
      // signed cookie under the admin client — never from this form. A form
      // value here would let anyone mint a camera against any guest.
      seatId = await ensureGuestOwnCameraAdmin(
        admin,
        buyer!.eventId,
        buyer!.guestId,
        rung.serviceCode,
      );
      // Fail CLOSED: no camera, no order. Selling points with nowhere to land
      // would take money for shots that could never be granted.
      if (!seatId) backTo(returnTo, 'no_camera');
    }

    // ⚠ NEITHER BRANCH CHECKS "already holds dedicated points" (removed
    // 2026-08-02). It was circular — nobody could buy their FIRST private shots
    // — so a guest whose shared pot ran dry could only top up the HOST's pool,
    // money anyone else could then spend.
    //
    // Nothing is unguarded by its removal. Each branch resolves the camera from
    // the buyer's OWN credential and never from the form: a seat buyer through
    // resolveGuestReloadTarget (a hard refusal for any other seat), a cookie
    // buyer through their signed guest session. What the old check actually
    // protected was the host's pool accounting, and that protects itself —
    // papic_reserve_event_points_for_seat returns -1 only WHILE the seat has
    // dedicated points, so a camera spends what its holder paid for first and
    // rejoins the shared pool the moment those are gone.
  }

  // ── the price — catalog only, never the form ────────────────────────────
  const { data: catalogRow } = await admin
    .from('platform_retail_catalog_v2')
    .select('retail_price_php, is_active')
    .eq('service_code', rung.serviceCode)
    .maybeSingle();
  const pricePhp = Number(catalogRow?.retail_price_php ?? 0);
  // is_active is checked HERE because the shared charge resolver prices by
  // service_code alone — a retired rung would still quote. The reject has to
  // happen before an order exists, not after.
  if (!Number.isFinite(pricePhp) || pricePhp <= 0 || catalogRow?.is_active !== true) {
    backTo(returnTo, 'unavailable');
  }

  // ── one open order per (buyer, rung) ────────────────────────────────────
  // Stops a script minting rows while leaving every honest sequence working.
  // See hasOpenGuestOrder for why the rule is this narrow.
  const ownerFilter =
    buyer!.kind === 'seat'
      ? { column: 'seat_id', value: buyer!.seatId }
      : { column: 'guest_id', value: buyer!.guestId };
  const { data: openRows } = await admin
    .from('papic_guest_orders')
    .select('service_code, order:orders(status)')
    .eq(ownerFilter.column, ownerFilter.value);
  const flattened = (openRows ?? []).map((r) => ({
    service_code: (r as { service_code?: string | null }).service_code ?? null,
    status:
      ((r as { order?: { status?: string | null } | null }).order?.status ?? null) as
        | string
        | null,
  }));
  if (hasOpenGuestOrder(flattened, rung.serviceCode)) backTo(returnTo, 'already_pending');

  // ── an account, or nothing is minted ────────────────────────────────────
  // Owner 2026-08-21. Refuse BEFORE the reference code exists, so a buyer who
  // has to go and sign in never comes back to a half-made order.
  const accountId = await resolveRealAccountId();
  if (!accountId) backTo(returnTo, 'needs_account');

  // ── mint ────────────────────────────────────────────────────────────────
  const referenceCode = mintPapicReferenceCode();
  const accessToken = mintPapicGuestAccessToken();
  const payerName = normalisePayerName(formData.get('payer_name'));

  // AUTHORIZED BY: resolveGuestBuyer above — the event comes off the claimed
  // seat row or the signed guest cookie, never off the form, and the seat's
  // claimer / the guest's event row were both re-asserted server-side.
  const orderRow = guestOrderRowFor(
    {
      eventId: buyer!.eventId,
      seatId: buyer!.kind === 'seat' ? buyer!.seatId : null,
      guestId: buyer!.kind === 'guest' ? buyer!.guestId : null,
      userId: accountId,
    },
    {
      service_key: rung.serviceCode,
      description: guestOrderDescription(rung),
      requested_total_php: pricePhp,
      reference_code: referenceCode,
      status: 'submitted' as const,
      platform: 'web',
    },
  );
  const { data: order, error: orderErr } = await createMoneyWriterClient()
    .from('orders')
    .insert(orderRow)
    .select('order_id')
    .maybeSingle();
  if (orderErr || !order) backTo(returnTo, 'order_failed');
  const orderId = String(order!.order_id);

  /** The order must not survive as a charge nobody can fulfil. */
  const abandon = async (code: string): Promise<never> => {
    await admin.from('orders').update({ status: 'cancelled' }).eq('order_id', orderId);
    return backTo(returnTo, code);
  };

  const { error: provErr } = await admin.from('papic_guest_orders').insert(
    papicGuestOrderRow({
      orderId,
      buyer: buyer!,
      seatId: rung.kind === 'one_reload' ? seatId : (buyer!.kind === 'seat' ? buyer!.seatId : null),
      kind: rung.kind,
      serviceCode: rung.serviceCode,
      points: rung.points,
      payerName,
      accessToken,
    }),
  );
  // Without this row the order has no owner and the buyer has no way back to
  // it — the exact state the removed `user_id NOT NULL` used to make impossible.
  if (provErr) await abandon('order_failed');

  if (rung.kind === 'one_reload') {
    // The SAME conversion row the host's own reload writes. Writing it is what
    // makes `papic_grant_camera_points` (already wired into sku-activation)
    // grant these points to THIS camera on approval — no dispatcher change.
    const { error: oneErr } = await admin.from('papic_one_orders').insert(
      papicOneOrderRow({
        orderId,
        eventId: buyer!.eventId,
        seatId: seatId!,
        serviceCode: rung.serviceCode,
        points: rung.points,
        isReload: true,
      }),
    );
    if (oneErr) await abandon('order_failed');
  }

  // The host's Papic studio shows guest contributions (notification only — they
  // are told, not asked). Refresh it so the line appears without them reloading.
  // Post-mint and best-effort: the buyer's redirect must not wait on it, and a
  // stale card is a cosmetic miss, not a lost order.
  revalidatePath(`/dashboard/${buyer!.eventId}/studio/papic`);

  // THE ONE PAYMENT PAGE (owner 2026-08-21). Now that the buyer must have an
  // account, `orders_owner_read` admits them on `user_id = auth.uid()` and the
  // shared page can do what the token page cannot: put the exact amount INSIDE
  // the QR so nothing is typed.
  //
  // ⚠ The token page is NOT retired. It is the only door onto orders minted
  // before this ruling (account-less, `user_id` NULL), and `submitPapicGuestPayment`
  // still settles through it. The access token is still minted and still
  // stored for exactly that reason.
  redirect(payPath(referenceCode));
}

/**
 * Step 2 — log the transfer. Records a `pending` payment for the admin queue.
 *
 * Grants nothing. Uploading a screenshot is a CLAIM, and the whole point of the
 * apply-then-pay rail is that a human matches that claim against the real bank
 * message before anything is provisioned.
 */
export async function submitPapicGuestPayment(formData: FormData) {
  const token = String(formData.get('access_token') ?? '').trim();
  if (!token) redirect('/papic');
  const back = (code: string): never =>
    redirect(`/papic/order/${encodeURIComponent(token)}?pay_error=${code}`);

  if (!papicGuestBuyEnabled()) back('unavailable');
  if (!rateLimit(`papic-pay:${token}`, 8, 60_000).ok) back('too_fast');

  const admin = createAdminClient();
  const { data: guestOrder } = await admin
    .from('papic_guest_orders')
    .select('order_id, event_id, order:orders(status, requested_total_php, user_id)')
    .eq('access_token', token)
    .maybeSingle();
  if (!guestOrder) back('not_found');

  const order = (guestOrder as { order?: { status?: string | null; requested_total_php?: number | null; user_id?: string | null } | null }).order;
  const status = order?.status ?? '';
  // Only an order still waiting for money accepts a proof. A cancelled order
  // must not be resurrected by an upload, and a paid one must not collect a
  // second pending payment the admin then has to reject.
  if (status !== 'submitted' && status !== 'awaiting_payment') back('not_payable');

  // ── the screenshot ──────────────────────────────────────────────────────
  const file = formData.get('screenshot');
  if (!(file instanceof File) || file.size === 0) back('no_screenshot');
  const proof = file as File;
  const mime = (proof.type || '').split(';')[0]!.trim().toLowerCase();
  if (!PROOF_MIME_TYPES.has(mime)) back('bad_type');
  if (proof.size > PROOF_MAX_BYTES) back('too_big');

  // The object key is derived ENTIRELY server-side from the order id — the
  // client never picks a prefix, so a leaked link can only ever write into its
  // own order's space. Private bucket: the stored `r2://` ref is presigned by
  // /admin/payments at read time, exactly like the couple's own proofs.
  const ext = mime === 'image/jpeg' || mime === 'image/jpg' ? 'jpg' : mime.split('/')[1] || 'bin';
  const key = `payments/${guestOrder!.order_id}/${crypto.randomUUID()}-guest-proof.${ext}`;
  let screenshotRef: string;
  try {
    const bytes = new Uint8Array(await proof.arrayBuffer());
    await r2Upload({
      bucket: R2_BUCKETS.threadFiles,
      key,
      body: bytes,
      contentType: mime,
    });
    screenshotRef = encodeR2Ref(R2_BUCKETS.threadFiles, key);
  } catch {
    back('upload_failed');
  }

  // ── the claimed amount ──────────────────────────────────────────────────
  // This IS taken from the form, and correctly so: it is what the buyer says
  // they sent, which the admin reconciles against the bank message. It never
  // becomes the charge — `orders.requested_total_php` was frozen at mint from
  // the catalog, and the shortfall guard compares the two.
  const claimed = Number(formData.get('amount_php'));
  const amountPhp =
    Number.isFinite(claimed) && claimed > 0
      ? Math.round(claimed * 100) / 100
      : Number(order?.requested_total_php ?? 0);
  if (!(amountPhp > 0)) back('bad_amount');

  const channelRaw = String(formData.get('channel') ?? '').trim().toLowerCase();
  const channel = channelRaw === 'bdo' ? 'bdo' : 'gcash';
  const referenceNumber = normaliseShortEntry(formData.get('reference_number'));

  const payerName = normalisePayerName(formData.get('payer_name'));
  if (payerName) {
    // Best-effort: a receipt name is a nicety, and failing the payment because
    // we could not store one would be the wrong trade.
    await admin
      .from('papic_guest_orders')
      .update({ payer_name: payerName })
      .eq('order_id', guestOrder!.order_id);
  }

  const { error: payErr } = await createMoneyWriterClient().from('payments').insert(
    guestPaymentRowFor(
      { verifiedOrderId: String(guestOrder!.order_id), userId: order?.user_id ?? null },
      {
        amount_php: amountPhp,
        channel,
        reference_number: referenceNumber,
        screenshot_url: screenshotRef!,
        paid_at: new Date().toISOString().slice(0, 10),
      },
    ),
  );
  if (payErr) back('payment_failed');

  // ── SOMEBODY IS TOLD THAT MONEY MOVED ──────────────────────────────────
  // 🔑 "The moment money moves must notify somebody" — the rule
  // `you-are-told-when-you-are-paid.test.ts` was written to enforce, quoted
  // from its own docblock. It enforced it on the couple's `logPayment` and on
  // the payment page, and this settle path was never named, so a guest could
  // upload a bank screenshot for a real Papic order and NOBODY was told.
  //
  // ⚠ `revalidatePath('/admin/payments')` below is NOT this. That is the very
  // thing the guard calls insufficient: "the only trace was a queue somebody
  // had to already be looking at." The daily digest is the safety net UNDER
  // the alert, not a substitute — it fires next morning, and for "your
  // customer has paid" tomorrow is the wrong answer.
  //
  // Best-effort by construction: the notify helper swallows its own failures,
  // so a notification outage can never lose a payment that is already stored.
  // ⚠ Before the redirect, which THROWS to unwind the request — anything after
  // it is dead code.
  await notifyAdminsPaymentProofSubmitted({
    orderId: String(guestOrder!.order_id),
    eventId: '',
    amountPhp,
    channel,
  });

  revalidatePath('/admin/payments');
  redirect(`/papic/order/${encodeURIComponent(token)}?logged=1`);
}
