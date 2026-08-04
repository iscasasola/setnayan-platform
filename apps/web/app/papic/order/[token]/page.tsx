import { notFound } from 'next/navigation';
import { CopyButton } from '@/app/_components/copy-button';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPlatformSettings, hasMerchantPaymentInfo } from '@/lib/platform-settings';
import { papicGuestBuyEnabled } from '@/lib/papic-guest-buy-flag';
import { submitPapicGuestPayment } from '../../buy/actions';

export const dynamic = 'force-dynamic';

/**
 * A GUEST'S OWN ORDER — reachable with no account (owner-locked 2026-07-29).
 *
 * The account-less half of `/dashboard/[eventId]/orders/[orderId]`. Same rail,
 * same reference code, same static BDO/GCash QR, same "upload your screenshot"
 * step, same /admin/payments queue on the other side — the only difference is
 * WHAT AUTHORIZES THE READ.
 *
 * ── THE BEARER TOKEN ──────────────────────────────────────────────────────
 * A guest cannot read `orders` under RLS (there is no `auth.uid()` to match),
 * so the capability is the unguessable `papic_guest_orders.access_token` in the
 * URL. Consequences that shape this page:
 *
 *   • Everything is read through the ADMIN client, scoped to the one row that
 *     token resolves to. No other order is reachable from here.
 *   • A bad token is `notFound()` — never "no such order", which would confirm
 *     which tokens exist.
 *   • Nothing on this page names anybody. The guest list, the couple's names
 *     and the event's other orders are all absent by construction: the token
 *     buys sight of ONE order, not of an event.
 *
 * ── WHY THE MERCHANT DETAILS RENDER AT ALL ────────────────────────────────
 * The `platform_settings` bdo / gcash columns are anon-REVOKED (20271014400000),
 * deliberately. This page reads them server-side under service_role and prints
 * them into HTML — which is the same exposure the couple's page already has,
 * for the same reason: they are a merchant's public receiving details, and a
 * buyer who cannot see them cannot pay. The revoke stops the BROWSER querying
 * them for arbitrary purposes; it was never a secret.
 *
 * The whole page is behind NEXT_PUBLIC_PAPIC_GUEST_BUY. Off ⇒ 404, so the route
 * does not exist for anyone while the flag is dark.
 */

const PAY_ERROR_COPY: Record<string, string> = {
  unavailable: 'Guest purchases are not open right now.',
  too_fast: 'One moment — try that again in a few seconds.',
  not_found: "We couldn't find that order.",
  not_payable: 'This order is not waiting for a payment any more.',
  no_screenshot: 'Please attach a screenshot of your transfer.',
  bad_type: 'That file type is not supported — send a photo or screenshot.',
  too_big: 'That image is too large. Please send one under 5 MB.',
  upload_failed: "We couldn't save that screenshot. Please try again.",
  bad_amount: 'Please enter the amount you sent.',
  payment_failed: "We couldn't log that payment. Please try again.",
};

export default async function PapicGuestOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!papicGuestBuyEnabled()) notFound();

  const { token } = await params;
  const search = await searchParams;
  const payError = typeof search.pay_error === 'string' ? search.pay_error : '';
  const justLogged = search.logged === '1';

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('papic_guest_orders')
    .select(
      'order_id, purchase_kind, points, payer_name, ' +
        'order:orders(public_id, reference_code, description, requested_total_php, status)',
    )
    .eq('access_token', token)
    .maybeSingle();
  if (!row) notFound();

  const order = (row as {
    order?: {
      public_id?: string | null;
      reference_code?: string | null;
      description?: string | null;
      requested_total_php?: number | null;
      status?: string | null;
    } | null;
  }).order;
  if (!order) notFound();

  const orderId = String((row as unknown as { order_id: string }).order_id);
  const [{ data: payments }, settings] = await Promise.all([
    admin
      .from('payments')
      .select('payment_id, amount_php, status, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false }),
    fetchPlatformSettings(admin),
  ]);

  const status = order.status ?? '';
  const paid = status === 'paid' || status === 'fulfilled';
  const cancelled = status === 'cancelled';
  const canLog = status === 'submitted' || status === 'awaiting_payment';
  const amount = Number(order.requested_total_php ?? 0);
  const points = Number((row as { points?: number }).points ?? 0);
  const referenceCode = order.reference_code ?? '';

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <p className="sn-eye">Papic · your order</p>
        <h1 className="sn-h1 text-2xl">{order.description}</h1>
        <p className="text-sm text-ink/70">
          {paid
            ? `Confirmed — ${points.toLocaleString('en-PH')} shots are live.`
            : cancelled
              ? 'This order was cancelled. Nothing was charged.'
              : 'Send the amount below, then log it here. The shots go live once the ' +
                'Setnayan team confirms your payment — usually within a day.'}
        </p>
        <p className="text-xs text-ink/50">
          Keep this link. It is the only way back to this order — there is no account to
          sign in to.
        </p>
      </header>

      {justLogged ? (
        <p
          role="status"
          className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-800"
        >
          Payment logged. We&rsquo;ll confirm it shortly — you can close this page.
        </p>
      ) : null}
      {payError ? (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-700"
        >
          {PAY_ERROR_COPY[payError] ?? 'Something went wrong. Please try again.'}
        </p>
      ) : null}

      <section className="mt-6 space-y-4 rounded-2xl border border-ink/10 bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="sn-eye">Amount</p>
            <p className="text-2xl font-semibold text-ink">
              &#8369;{amount.toLocaleString('en-PH')}
            </p>
          </div>
          <CopyButton value={String(amount)} label="Copy" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-4">
          <div>
            <p className="sn-eye">Reference code</p>
            <p className="break-all font-mono text-lg text-terracotta-700">{referenceCode}</p>
            <p className="mt-1 text-xs text-ink/60">
              Put this in your transfer note so we can match it instantly.
            </p>
          </div>
          <CopyButton value={referenceCode} label="Copy" />
        </div>

        {hasMerchantPaymentInfo(settings) ? (
          <div className="grid gap-3 border-t border-ink/10 pt-4 sm:grid-cols-2">
            {settings.bdo_account_number || settings.bdo_qr_url ? (
              <div className="sn-row space-y-2 p-4">
                <p className="sn-eye">BDO bank transfer</p>
                {settings.bdo_account_name ? (
                  <p className="text-sm font-medium text-ink">{settings.bdo_account_name}</p>
                ) : null}
                {settings.bdo_account_number ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-all font-mono text-sm text-ink">
                      {settings.bdo_account_number}
                    </p>
                    <CopyButton value={settings.bdo_account_number} label="Copy" />
                  </div>
                ) : null}
                {settings.bdo_qr_url ? (
                  <div className="mt-1 w-fit rounded-xl border border-ink/10 bg-white p-2.5 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={settings.bdo_qr_url}
                      alt="BDO merchant QR"
                      className="h-40 w-40 rounded-lg object-contain"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {settings.gcash_number || settings.gcash_qr_url ? (
              <div className="sn-row space-y-2 p-4">
                <p className="sn-eye">GCash</p>
                {settings.gcash_account_name ? (
                  <p className="text-sm font-medium text-ink">{settings.gcash_account_name}</p>
                ) : null}
                {settings.gcash_number ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-all font-mono text-sm text-ink">
                      {settings.gcash_number}
                    </p>
                    <CopyButton value={settings.gcash_number} label="Copy" />
                  </div>
                ) : null}
                {settings.gcash_qr_url ? (
                  <div className="mt-1 w-fit rounded-xl border border-ink/10 bg-white p-2.5 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={settings.gcash_qr_url}
                      alt="GCash merchant QR"
                      className="h-40 w-40 rounded-lg object-contain"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="border-t border-ink/10 pt-4 text-sm text-ink/60">
            Payment details are being set up. Please check back shortly.
          </p>
        )}
      </section>

      {(payments ?? []).length > 0 ? (
        <section className="mt-6 space-y-2 rounded-2xl border border-ink/10 bg-surface p-5">
          <p className="sn-eye">What you&rsquo;ve logged</p>
          <ul className="space-y-1 text-sm text-ink/70">
            {(payments ?? []).map((p) => (
              <li key={(p as { payment_id: string }).payment_id}>
                &#8369;{Number((p as { amount_php: number }).amount_php).toLocaleString('en-PH')}{' '}
                — {(p as { status: string }).status === 'matched' ? 'confirmed' : 'waiting for review'}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canLog ? (
        <section className="mt-6 space-y-4 rounded-2xl border border-ink/10 bg-surface p-5">
          <div className="space-y-1">
            <p className="sn-eye">Already sent it?</p>
            <p className="text-sm text-ink/70">
              Log the transfer and attach the screenshot. Nothing activates until the
              Setnayan team confirms it against the bank message.
            </p>
          </div>
          <form action={submitPapicGuestPayment} className="space-y-3">
            <input type="hidden" name="access_token" value={token} />
            <label className="block space-y-1">
              <span className="text-xs font-medium text-ink/70">How you sent it</span>
              <select name="channel" className="input-field" defaultValue="gcash">
                <option value="gcash">GCash</option>
                <option value="bdo">BDO</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-ink/70">Amount you sent</span>
              <input
                type="number"
                name="amount_php"
                min="1"
                step="0.01"
                defaultValue={amount || undefined}
                className="input-field"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-ink/70">
                Reference number from GCash / BDO
              </span>
              <input type="text" name="reference_number" className="input-field" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-ink/70">
                Name for your receipt — optional
              </span>
              <input
                type="text"
                name="payer_name"
                defaultValue={(row as { payer_name?: string | null }).payer_name ?? ''}
                className="input-field"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-ink/70">Screenshot of the transfer</span>
              <input
                type="file"
                name="screenshot"
                accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
                required
                className="input-field"
              />
            </label>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-700"
            >
              Log my payment
            </button>
          </form>
        </section>
      ) : null}
    </main>
  );
}
