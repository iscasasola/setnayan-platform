import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CopyButton } from '@/app/_components/copy-button';
import { createClient } from '@/lib/supabase/server';
import { fetchPayableByReference } from '@/lib/payable-by-reference';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { qrWords, everyOpenRailCarriesAmount } from '@/lib/qr-amount-truth';
import { mintedQrImage } from '@/lib/qr-image.server';
import { parseStage } from '@/lib/pay-stages';
import { payAmount } from '@/lib/pay-amount';
import { PayPanel, type ChannelInfo } from './_components/pay-panel';
import { removeSetupExtras } from './actions';
import { isChannelOpen } from '@/lib/payment-channels';
import { logQueryError } from '@/lib/supabase/error-detect';

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
 *   2. pay this exact amount (the QR carries the figure when it CAN — and
 *      every sentence about that comes from `lib/qr-amount-truth.ts`, never
 *      from a line typed here)
 *   3. after you pay (screenshot, kept on screen, + the last 6 digits)
 *
 * Everything a buyer needs is HERE, so a buy button's whole job is to mint the
 * order and redirect to this address.
 */

export const metadata = { title: 'Pay' };

type Props = {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{
    sent?: string;
    error?: string;
    recheck?: string;
    setup?: string;
    /** Which of the three stages to paint — see lib/pay-stages.ts. */
    step?: string;
  }>;
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

  const payable = await fetchPayableByReference(
    supabase,
    decodeURIComponent(reference),
    // Who is looking decides the way out — a shop paying its own booking fee
    // must not be pointed at the couple's dashboard. See lib/pay-back-link.ts.
    user.id,
  );
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
  //
  // 🚨 AND A PLACEHOLDER IS NOT A CLAIM. Eight buy paths INSERT an empty
  // `payments` row at checkout time — no screenshot, no reference, status
  // 'pending' by column default — purely to reserve the row. Asking "does a
  // payment row exist?" turns every one of those into "we're checking your
  // payment… nothing else to do", thanking the buyer for money they have not
  // sent and taking away the form they were about to use. The honest question
  // is whether THEY have told us something: a picture, or a number.
  const { data: paymentRows, error: paymentsError } = await supabase
    .from('payments')
    .select('payment_id,status,admin_resubmit_notice,screenshot_url,reference_number,created_at')
    .eq('order_id', payable.orderId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (paymentsError) logQueryError('pay/[reference]: latest payment', paymentsError, { order_id: payable.orderId });
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

  /**
   * ── THE LAST STEP OF SETTING UP, RATHER THAN A BILL SOMEBODY CAME BACK TO ──
   *
   * ⚖ Owner, 2026-08-28: *"i will go here? it should be settled first. […] Then
   * the onboarding end. No option to pay later. then need to go back to uncheck
   * their papic and setnayan AI purchase."*
   *
   * 🔑 THE PAGE IS THE SAME; ITS FRAMING AND ITS EXITS ARE NOT. In setup mode
   * the "back" link is removed — it points at the dashboard, which on this
   * screen reads as exactly the "pay later" door the owner struck — and it is
   * replaced by the two doors he named: settle it, or remove the items.
   *
   * ⚖ AND REMOVING IS NOT LOSING THE CELEBRATION. The event is already created
   * and its free shots are already live by the time anybody reaches this page;
   * what a removal cancels is the BILL. Anything else would make a payment
   * screen the thing that decides whether somebody's birthday exists.
   */
  const setup = search.setup === '1';
  const resubmitNotice =
    needsBetterProof
      ? (latestRow?.admin_resubmit_notice?.trim() ||
        'We could not read the last picture you sent. Please send a clearer one.')
      : null;

  /**
   * 🔑 ONE VERDICT PER RAIL, AND EVERY SENTENCE ON THIS PAGE READS OFF IT.
   * Step 1 below and the caption under the code used to be written by hand in
   * two files, and on 2026-09-20 they contradicted each other on the owner's
   * own screen — step 1 said the amount was in the code while the caption six
   * lines down said to type it. `resolveQrAmount` is now the only thing that
   * knows, and `qrWords` is the only thing that phrases it.
   */
  //
  // 🔑 PAINTED HERE, NOT IN THE BROWSER. Both rails are rendered up front
  // because the payer switches tabs client-side and a tab that has to fetch
  // its own code re-opens the window this page just closed. Two inline PNGs is
  // ~10 KB — cheaper than one wrong scan.
  const [gcashImage, bdoImage] = await Promise.all([
    mintedQrImage(settings.gcash_qr_payload, payable.amountPhp),
    mintedQrImage(settings.bdo_qr_payload, payable.amountPhp),
  ]);

  const gcash: ChannelInfo = {
    mintedUrl: gcashImage?.dataUrl ?? null,
    staticUrl: settings.gcash_qr_url,
    number: settings.gcash_number,
    name: settings.gcash_account_name,
    // The ONE rule (switch AND something to pay to), never the flag alone.
    enabled: isChannelOpen(settings, 'gcash'),
  };
  const bdo: ChannelInfo = {
    mintedUrl: bdoImage?.dataUrl ?? null,
    staticUrl: settings.bdo_qr_url,
    number: settings.bdo_account_number,
    name: settings.bdo_account_name,
    enabled: isChannelOpen(settings, 'bdo'),
  };

  /**
   * Step 1 names BOTH rails in one breath, so it may only promise a pre-filled
   * amount when both OPEN codes carry one — see `everyOpenRailCarriesAmount`.
   * The caption beside each code then narrows it to the rail they are on.
   */
  const words = qrWords(
    everyOpenRailCarriesAmount({
      amountPhp: payable.amountPhp,
      rails: [
        // ⚠ THE RAIL'S ANSWER IS THE IMAGE WE ACTUALLY PAINTED, not the stored
        // payload. A payload that mints but fails to RENDER puts the static
        // code on screen, and the sentence must follow the pixels.
        { open: gcash.enabled, payload: gcashImage ? settings.gcash_qr_payload : null },
        { open: bdo.enabled, payload: bdoImage ? settings.bdo_qr_payload : null },
      ],
    }),
    payAmount(payable.amountPhp),
    { reference: payable.reference },
  );

  const activates = payable.isVendorPlan
    ? 'Your plan switches on as soon as our team confirms the payment.'
    : 'It switches on as soon as our team confirms the payment.';

  /**
   * STAGE 1's CONTENTS, built here on the server and handed to the client
   * stage machinery as a prop. It reads the payable, the catalogue rows and
   * the event name; none of that belongs in a client bundle just because the
   * thing that SHOWS it is interactive.
   *
   * ⚠ In the waiting state there are no stages at all — the page is the wait
   * (owner 2026-08-28) — so this is rendered directly instead.
   */
  const summary = (
    /* ── ONCE THE PROOF IS IN, THE INSTRUCTIONS ARE OVER ──────────────
    Owner, 2026-08-28: *"After I paid, it should say we are currently
    verifying your purchase. kindly wait within 24 hours. (1) and (2) must
    not show anymore."*

    He is right, and it is not only tidiness. A page that still says "scan
    the code" and "pay this exact amount" under a notice saying we are
    checking your payment is telling somebody who has ALREADY PAID to pay —
    and the worst outcome of that sentence is that they pay twice.

    🔑 THE WAIT IS THE WHOLE PAGE NOW, NOT A CARD AT THE BOTTOM OF IT. What
    stays is what they may still need while waiting: what they bought, what
    it cost, and the reference — because that is the number they will quote
    if they have to ask us about it. What goes is every instruction to act.

    ⚖ AND IT COMES BACK BY ITSELF. `proofSent` is false again the moment the
    proof is refused (`needsBetterProof`), so a person asked for a clearer
    picture gets the code, the amount and the form returned to them. Nothing
    here is a one-way door.
    */
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
      {payAmount(payable.amountPhp)}
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
    <p className="mt-2 text-xs text-ink/55">{words.note}</p>

    {!waiting && (
      <div className="mt-5 border-t border-ink/10 pt-4">
        <p className="sn-eye mb-2">What happens next</p>
        <Step n={1}>{words.scanStep}</Step>
        <Step n={2}>Send us the screenshot and the last 6 digits of your reference number.</Step>
        <Step n={3}>{activates}</Step>
      </div>
    )}
  </section>
  );


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
      {setup ? (
        <p className="mb-4 rounded-[var(--m-r-lg)] border border-terracotta/30 bg-terracotta/[0.07] px-4 py-3 text-sm leading-relaxed text-ink">
          <span className="font-semibold">Last step.</span>{' '}
          {waiting
            ? 'Your celebration is set up and live. We just need to confirm this payment.'
            : 'Your celebration is already set up and its free credits are live. Settle this and the extras you picked switch on too.'}
        </p>
      ) : (
        payable.back && (
          <Link
            href={payable.back.href}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-link underline"
          >
            {payable.back.label}
          </Link>
        )
      )}
      {waiting && summary}
      {waiting && (
        <section className="sn-tile mt-5 border-mulberry p-6 text-center">
          <h2 className="text-lg font-semibold text-ink">
            We&rsquo;re verifying your purchase
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink/65">
            Please allow up to 24 hours. You&rsquo;ll get an email the moment it&rsquo;s
            confirmed — there&rsquo;s nothing else for you to do.
          </p>
          <p className="mt-4 text-xs text-ink/50">
            {activates}
          </p>
        </section>
      )}

      {search.error && (
        <p className="sn-tile mt-4 border-mulberry/40 p-4 text-sm text-ink">{search.error}</p>
      )}

      {/*
        THE ONE ASK. The reference they typed was not on the picture they sent,
        so we hand it back once — owner 2026-08-28: *"if the reference code did
        not match, please type again or upload a cleaner photo."*

        ⚠ IT IS NOT AN ERROR AND IS NOT PAINTED AS ONE. Nothing has failed and
        nothing has been refused; the person may well be right and our reader
        wrong. It wears the notice tone, it says what to do, and the sentence
        that keeps it honest — "if you are sure, just send it again" — is part of
        the message the action redirects with, so it cannot be dropped by styling
        this block differently.
      */}
      {search.recheck && (
        <p className="sn-tile mt-4 border-[color:var(--sn-warning)]/40 bg-[var(--sn-warning-soft)] p-4 text-sm text-[color:var(--sn-warning-deep)]">
          {search.recheck}
        </p>
      )}

      {/*
        ── THE TWO DOORS, AND THERE IS NO THIRD ───────────────────────────────
        Owner: *"No option to pay later. then need to go back to uncheck their
        papic and setnayan AI purchase."* So: settle it (the panel below), or
        remove the extras. What is deliberately absent is the third door that
        used to be here as a "back to your dashboard" link — on this screen that
        reads as "skip this", which is the one thing he struck.

        ⚖ The removal is worded as a CHOICE, not a warning, and it names the cost
        of it: they can add these later, at the price without the set-up
        discount. Hiding that would make the cheaper offer feel like a trap.
      */}
      {setup && !waiting && (
        <form action={removeSetupExtras} className="mt-5 text-center">
          <input type="hidden" name="order_id" value={payable.orderId} />
          <input type="hidden" name="reference" value={payable.reference} />
          {payable.eventId && <input type="hidden" name="event_id" value={payable.eventId} />}
          <button
            type="submit"
            className="text-sm text-ink/60 underline underline-offset-4 hover:text-ink"
          >
            I don&rsquo;t want these after all — remove them
          </button>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-ink/45">
            Your celebration and its free credits stay live. You can add these any time
            from your studio — at the normal price, without the set-up discount.
          </p>
        </form>
      )}

      {/*
        ── THE WAITING PAGE MUST NOT BE A DEAD END ───────────────────────

        Owner, 2026-09-20, looking at his own verifying screen: *"after paying,
        there is no way to return to that event overview."*

        🔑 HE WAS AT THE BOTTOM OF THE PAGE AND THE ONLY EXIT WAS AT THE TOP.
        `payable.back` has always rendered — as a small underlined link above the
        first tile, which is scrolled off by the time somebody has read what they
        bought, the reference, and the verifying notice. /pay carries no site
        chrome either (SiteChrome self-gates to the marketing routes), so from
        there the browser's back button is the whole of the navigation.

        ⚖ THE SET-UP FLOW ALREADY HAD THIS AND THE ORDINARY ONE DID NOT. `setup
        && waiting` got a "Finish setting up" button here, so the person who paid
        during onboarding was handed back to their celebration and the person who
        paid from inside it was left staring at a card. Same state, same need —
        so the exit is unconditional in `waiting`, and the ordinary arm is built
        from the SAME `payable.back` the top link uses, never a second spelling
        of where this buyer came from.
      */}
      {waiting &&
        (setup && payable.eventId ? (
          <div className="mt-5 text-center">
            <Link href={`/dashboard/${payable.eventId}`} className="button-primary inline-flex">
              Finish setting up
            </Link>
            <p className="mt-2 text-xs text-ink/45">
              Nothing else to do here — we&rsquo;ll email you the moment it&rsquo;s confirmed.
            </p>
          </div>
        ) : payable.back ? (
          <div className="mt-5 text-center">
            <Link href={payable.back.href} className="button-primary inline-flex">
              {payable.back.label}
            </Link>
            <p className="mt-2 text-xs text-ink/45">
              Nothing else to do here — we&rsquo;ll email you the moment it&rsquo;s confirmed.
            </p>
          </div>
        ) : null)}

      {!waiting && (
      <PayPanel
        /*
          Their second attempt carries `rechecked`, which tells the action to
          accept whatever the picture says. We ask once and then get out of the
          way — a person who has already sent money must always have a way
          through.
        */
        rechecked={Boolean(search.recheck)}
        /*
          Carried so the recheck redirect can put it back. Without it, asking a
          buyer to check their reference would silently drop them OUT of the
          set-up flow — the "remove these extras" door disappears and the
          discount framing with it. Two changes that each behave correctly alone.
        */
        setup={setup}
        proofSent={false}
        resubmitNotice={resubmitNotice}
        requiresReference={payable.requiresReference}
        amountPhp={payable.amountPhp}
        reference={payable.reference}
        orderId={payable.orderId}
        gcash={gcash}
        bdo={bdo}
        activatesLine={activates}
        summary={summary}
        initialStage={parseStage(search.step)}
        /*
          ⚠ EVERY OTHER PARAMETER RIDES ALONG. `?setup=1` is what tells this
          page it is the last step of setting a celebration up — a Continue
          link that dropped it would silently remove the "remove these extras"
          door and the set-up discount framing, and `?recheck=` is the only
          copy telling somebody what to fix.
        */
        carryQuery={{
          setup: search.setup,
          sent: search.sent,
          error: search.error,
          recheck: search.recheck,
        }}
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

