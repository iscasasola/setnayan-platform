import { notFound, redirect } from 'next/navigation';
import { CopyButton } from '@/app/_components/copy-button';
import { createClient } from '@/lib/supabase/server';
import { fetchPayableByReference } from '@/lib/payable-by-reference';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { mintOrderQr } from '@/lib/emv-qr';
import { PayPanel, type ChannelInfo } from './_components/pay-panel';

/**
 * /pay/[reference] — THE payment page. One page for every purchase.
 *
 * Owner, 2026-08-21: *"we want a payment page that applies to all, with the
 * custom QR designated to the amount they want to pay going directly to the
 * BDO"* and *"each purchase they make will jump to a payment page describing
 * the purchase they want."*
 *
 * Approved prototype: prototypes/one_payment_page_2026-08-21.html.
 * Three steps, ONE column, top to bottom:
 *   1. what you're paying for (+ the reference that matches it to you)
 *   2. pay this exact amount (the QR carries the figure — nothing to type)
 *   3. after you pay (screenshot, kept on screen, + the last 6 digits)
 *
 * Everything a buyer needs is HERE, so a buy button's whole job is to mint the
 * order and redirect to this address.
 */

export const metadata = { title: 'Pay' };

type Props = {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ sent?: string; error?: string }>;
};

export default async function PayPage({ params, searchParams }: Props) {
  const { reference } = await params;
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=' + encodeURIComponent(`/pay/${reference}`));

  const payable = await fetchPayableByReference(supabase, decodeURIComponent(reference));
  // Not yours and not real are the same answer on purpose — see the resolver.
  if (!payable) notFound();

  const settings = await fetchPlatformSettings(supabase);

  // Have they already told us — and is that claim still standing?
  //
  // 🚨 THE FORM MUST COME BACK WHEN WE ASK FOR A BETTER PICTURE. The first cut
  // hid it the moment ANY payment row existed. But an admin pressing "ask for a
  // better picture" sets the payment to 'resubmit_requested' and deliberately
  // leaves the ORDER alone — so the shop got an email asking for a clearer
  // screenshot and arrived at a page with no way to send one. 'rejected' is the
  // same shape. Only a live claim ('pending' / 'matched') closes the form.
  //
  // ⚠ A read that ERRORS is not "nothing logged" — an unreadable answer must
  // leave the form OPEN, never silently remove the only way to send proof.
  const { data: paymentRows, error: paymentsError } = await supabase
    .from('payments')
    .select('payment_id,status,admin_resubmit_notice,created_at')
    .eq('order_id', payable.orderId)
    .order('created_at', { ascending: false })
    .limit(1);
  const latestPayment = paymentsError ? null : (paymentRows?.[0] ?? null);
  const latestStatus = (latestPayment as { status?: string } | null)?.status ?? null;
  const needsBetterProof = latestStatus === 'resubmit_requested' || latestStatus === 'rejected';
  const proofSent = latestPayment !== null && !needsBetterProof;
  const resubmitNotice =
    needsBetterProof
      ? ((latestPayment as { admin_resubmit_notice?: string | null } | null)
          ?.admin_resubmit_notice?.trim() ||
        'We could not read the last picture you sent. Please send a clearer one.')
      : null;

  const gcash: ChannelInfo = {
    payload: mintOrderQr(settings.gcash_qr_payload, payable.amountPhp),
    staticUrl: settings.gcash_qr_url,
    number: settings.gcash_number,
    name: settings.gcash_account_name,
    enabled: settings.gcash_enabled !== false,
  };
  const bdo: ChannelInfo = {
    payload: mintOrderQr(settings.bdo_qr_payload, payable.amountPhp),
    staticUrl: settings.bdo_qr_url,
    number: settings.bdo_account_number,
    name: settings.bdo_account_name,
    enabled: settings.bdo_enabled !== false,
  };

  const activates = payable.isVendorPlan
    ? 'Your plan switches on as soon as our team confirms the payment.'
    : 'It switches on as soon as our team confirms the payment.';

  if (payable.status !== 'awaiting_payment') {
    return (
      <main className="mx-auto max-w-[560px] px-4 pb-16 pt-6">
        <section className="sn-tile p-6 text-center">
          <p className="sn-eye">{payable.status === 'settled' ? 'Paid' : 'Closed'}</p>
          <h1 className="mt-2 text-xl font-semibold text-ink">{payable.title}</h1>
          <p className="mt-3 text-sm text-ink/65">
            {payable.status === 'settled'
              ? "This one is settled — there's nothing left to send. Thank you."
              : 'This order was cancelled, so please don’t send anything for it.'}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[560px] px-4 pb-32 pt-6">
      <section className="sn-tile p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-[12px] font-bold text-white">
            1
          </span>
          <span className="sn-eye">You&rsquo;re paying for</span>
        </div>

        <h1 className="text-2xl font-semibold leading-tight text-ink">{payable.title}</h1>
        {payable.who && <p className="mt-1 text-sm text-ink/60">{payable.who}</p>}

        <p className="mt-4 font-mono text-[40px] font-bold leading-none tracking-tight text-ink">
          {peso(payable.amountPhp)}
        </p>

        {payable.rows.length > 0 && (
          <div className="mt-5 border-t border-ink/10 pt-3 text-sm">
            {payable.rows.map((r) => (
              <div key={r.label} className="flex justify-between gap-4 py-1.5">
                <span className="text-ink/60">{r.label}</span>
                <span className="text-ink">{r.value}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center gap-3 rounded-lg border border-ink/12 bg-ink/[0.03] px-4 py-3">
          <div>
            <p className="sn-eye mb-0.5">Your reference</p>
            <code className="font-mono text-[17px] font-semibold tracking-wide text-ink">
              {payable.reference}
            </code>
          </div>
          <div className="ml-auto">
            <CopyButton value={payable.reference} label="Copy" />
          </div>
        </div>
        <p className="mt-2 text-xs text-ink/55">
          Put this in the transfer note. It&rsquo;s how we match your payment to your account.
        </p>

        <div className="mt-5 border-t border-ink/10 pt-4">
          <p className="sn-eye mb-2">What happens next</p>
          <Step n={1}>Scan the code with your GCash or bank app — the amount is already in it.</Step>
          <Step n={2}>Send us the screenshot and the last 6 digits of your reference number.</Step>
          <Step n={3}>{activates}</Step>
        </div>
      </section>

      {search.error && (
        <p className="sn-tile mt-4 border-mulberry/40 p-4 text-sm text-ink">{search.error}</p>
      )}

      <PayPanel
        proofSent={proofSent || (search.sent === '1' && !needsBetterProof)}
        resubmitNotice={resubmitNotice}
        amountPhp={payable.amountPhp}
        reference={payable.reference}
        orderId={payable.orderId}
        gcash={gcash}
        bdo={bdo}
        activatesLine={activates}
      />
    </main>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5 text-sm text-ink/80">
      <span className="mt-0.5 grid h-[22px] w-[22px] flex-none place-items-center rounded-full border border-ink/15 text-[11px] font-bold text-ink">
        {n}
      </span>
      <span>{children}</span>
    </div>
  );
}

function peso(n: number): string {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2 });
}
