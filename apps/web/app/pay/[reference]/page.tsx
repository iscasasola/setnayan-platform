import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CopyButton } from '@/app/_components/copy-button';
import { createClient } from '@/lib/supabase/server';
import { fetchPayableByReference } from '@/lib/payable-by-reference';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { mintOrderQr } from '@/lib/emv-qr';
import { PayPanel, type ChannelInfo } from './_components/pay-panel';

/**
 * /pay/[reference] â THE payment page. One page for every purchase.
 *
 * Owner, 2026-08-21: *"we want a payment page that applies to all, with the
 * custom QR designated to the amount they want to pay going directly to the
 * BDO"* and *"each purchase they make will jump to a payment page describing
 * the purchase they want."*
 *
 * Approved prototype: prototypes/one_payment_page_2026-08-21.html.
 * Three steps, ONE column, top to bottom:
 *   1. what you're paying for (+ the reference that matches it to you)
 *   2. pay this exact amount (the QR carries the figure â nothing to type)
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
  // An anonymous draft session is not an account. Couple checkout already
  // refuses one before it will mint an order (it sends them to sign up), and a
  // payment page must not be the one door that takes money from a session the
  // buyer can lose by closing the tab.
  if (user.is_anonymous) {
    redirect('/signup?next=' + encodeURIComponent(`/pay/${reference}`));
  }

  const payable = await fetchPayableByReference(supabase, decodeURIComponent(reference));
  // Not yours and not real are the same answer on purpose â see the resolver.
  if (!payable) notFound();

  const settings = await fetchPlatformSettings(supabase);

  // Have they already told us â and is that claim still standing?
  //
  // ð¨ THE FORM MUST COME BACK WHEN WE ASK FOR A BETTER PICTURE. The first cut
  // hid it the moment ANY payment row existed. But an admin pressing "ask for a
  // better picture" sets the payment to 'resubmit_requested' and deliberately
  // leaves the ORDER alone â so the shop got an email asking for a clearer
  // screenshot and arrived at a page with no way to send one. 'rejected' is the
  // same shape. Only a live claim ('pending' / 'matched') closes the form.
  //
  // â  A read that ERRORS is not "nothing logged" â an unreadable answer must
  // leave the form OPEN, never silently remove the only way to send proof.
  //
  // ð¨ AND A PLACEHOLDER IS NOT A CLAIM. Eight buy paths INSERT an empty
  // `payments` row at checkout time â no screenshot, no reference, status
  // 'pending' by column default â purely to reserve the row. Asking "does a
  // payment row exist?" turns every one of those into "we're checking your
  // paymentâ¦ nothing else to do", thanking the buyer for money they have not
  // sent and taking away the form they were about to use. The honest question
  // is whether THEY have told us something: a picture, or a number.
  const { data: paymentRows, error: paymentsError } = await supabase
    .from('payments')
    .select('payment_id,status,admin_resubmit_notice,screenshot_url,reference_number,created_at')
    .eq('order_id', payable.orderId)
    .order('created_at', { ascending: false })
    .limit(1);
  const latestPayment = paymentsError ? null : (paymentRows?.[0] ?? null);
  const latestRow = latestPayment as {
    status?: string;
    screenshot_url?: string | null;
    reference_number?: string | null;
    admin_resubmit_notice?: string | null;
  } | null;
  const latestStatus = latestRow?.status ?? null;
  const needsBetterProof = latestStatus === 'resubmit_requested' || latestStatus === 'rejected';
  const carriesProof = Boolean(
    latestRow?.screenshot_url?.trim() || latestRow?.reference_number?.trim(),
  );
  const proofSent = carriesProof && !needsBetterProof;
  /**
   * We are waiting on OUR team, not on this person. The `sent=1` arm is the
   * redirect straight after the form posts, before the proof row is readable.
   */
  const waiting = proofSent || (search.sent === '1' && !needsBetterProof);
  const resubmitNotice =
    needsBetterProof
      ? (latestRow?.admin_resubmit_notice?.trim() ||
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
              ? "This one is settled â there's nothing left to send. Thank you."
              : 'This order was cancelled, so please donât send anything for it.'}
          </p>
          {payable.back && (
            <Link
              href={payable.back.href}
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-link underline"
            >
              {payable.back.label}
            </Link>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[560px] px-4 pb-32 pt-6">
      {payable.back && (
        <Link
          href={payable.back.href}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-link underline"
        >
          {payable.back.label}
        </Link>
      )}
      {/*
        ââ ONCE THE PROOF IS IN, THE INSTRUCTIONS ARE OVER ââââââââââââââââââââ
        Owner, 2026-08-28: *"After I paid, it should say we are currently
        verifying your purchase. kindly wait within 24 hours. (1) and (2) must
        not show anymore."*

        He is right, and it is not only tidiness. A page that still says "scan
        the code" and "pay this exact amount" under a notice saying we are
        checking your payment is telling somebody who has ALREADY PAID to pay â
        and the worst outcome of that sentence is that they pay twice.

        ð THE WAIT IS THE WHOLE PAGE NOW, NOT A CARD AT THE BOTTOM OF IT. What
        stays is what they may still need while waiting: what they bought, what
        it cost, and the reference â because that is the number they will quote
        if they have to ask us about it. What goes is every instruction to act.

        â AND IT COMES BACK BY ITSELF. `proofSent` is false again the moment the
        proof is refused (`needsBetterProof`), so a person asked for a clearer
        picture gets the code, the amount and the form returned to them. Nothing
        here is a one-way door.
      */}
      <section className="sn-tile p-6">
        <div className="mb-4 flex items-center gap-2.5">
          {!waiting && (
            <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-[12px] font-bold text-white">
              1
            </span>
          )}
          <span className="sn-eye">
            {waiting ? 'What you bought' : 'You’re paying for'}
          </span>
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

        {!waiting && (
          <div className="mt-5 border-t border-ink/10 pt-4">
            <p className="sn-eye mb-2">What happens next</p>
            <Step n={1}>Scan the code with your GCash or bank app â the amount is already in it.</Step>
            <Step n={2}>Send us the screenshot and the last 6 digits of your reference number.</Step>
            <Step n={3}>{activates}</Step>
          </div>
        )}
      </section>

      {waiting && (
        <section className="sn-tile mt-5 border-mulberry p-6 text-center">
          <h2 className="text-lg font-semibold text-ink">
            We&rsquo;re verifying your purchase
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink/65">
            Please allow up to 24 hours. You&rsquo;ll get an email the moment it&rsquo;s
            confirmed â there&rsquo;s nothing else for you to do.
          </p>
          <p className="mt-4 text-xs text-ink/50">
            {activates}
          </p>
        </section>
      )}

      {search.error && (
        <p className="sn-tile mt-4 border-mulberry/40 p-4 text-sm text-ink">{search.error}</p>
      )}

      {!waiting && (
      <PayPanel
        proofSent={false}
        resubmitNotice={resubmitNotice}
        requiresReference={payable.requiresReference}
        amountPhp={payable.amountPhp}
        reference={payable.reference}
        orderId={payable.orderId}
        gcash={gcash}
        bdo={bdo}
        activatesLine={activates}
      />
      )}
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
  return 'â±' + n.toLocaleString('en-PH', { minimumFractionDigits: 2 });
}
