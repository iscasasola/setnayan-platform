/**
 * /dev/pay-maya-lab — the Maya pay page (owner 2026-11-21, approved v3 drawing
 * `Setnayan-specs/prototypes/pay_maya_2026-11-21/pay_maya_fable.html`) on fixtures: no sign-in, no database. DEV-ONLY:
 * production builds 404 it, the same kill-switch as every `/dev/*` lab.
 *
 * Draws the REAL pay panel (`app/pay/[reference]/_components/pay-panel.tsx`) with the REAL Maya stage, checking card
 * and admin card, so a walk can screenshot Now beside Proposed at 390 px and on a computer, light and dark:
 *
 *   ?v=now        Maya off / no keys — the shipped BDO page (stage 2), untouched
 *   ?v=proposed   Maya on — the Maya pay stage: amount · order summary · Pay with · pinned "Pay ₱X"
 *   ?v=back       back from Maya without paying — the same stage with one line
 *   ?v=busy       Maya would not open — the BDO QR with "Maya is busy — pay by BDO QR. Nothing has been charged."
 *   ?v=checking   back from Maya, not confirmed yet — "Checking your payment…", no pay controls
 *   ?v=admin      Integrations › Maya: "Payers see Maya" on, on-but-no-key, off
 *
 * Buttons post to the real server actions, which refuse without a session — a lab press changes nothing.
 */
import { notFound } from 'next/navigation';
import { PayPanel, type ChannelInfo } from '@/app/pay/[reference]/_components/pay-panel';
import { MayaPayStage } from '@/app/pay/[reference]/_components/maya-pay-stage';
import { MayaChecking } from '@/app/pay/[reference]/_components/maya-checking';
import { MayaCard } from '@/app/admin/integrations/_components/maya-card';
import { mintedQrImage } from '@/lib/qr-image.server';
import { payAmount } from '@/lib/pay-amount';
import { MAYA_BUSY_LINE, mayaReturnLine, mayaWebhookNotice } from '@/lib/maya-checkout';

const REF = 'SNLAB2611';
const AMOUNT = 2499;
// A real QR Ph payload (the gift-QR fixture), re-minted with the amount like the page does.
const PAYLOAD =
  '00020101021127830012com.p2pqrpay0111GXCHPHM2XXX02089996440303152170200000006560417DWQM4TK3JDNWIWRDY5204601653036085802PH5908Setnayan6011Holy Spirit6104123463045E2D';

function adminCard(on: boolean, keys: boolean) {
  return (
    <MayaCard
      publicInDb={keys}
      secretInDb={keys}
      publicInEnv={false}
      secretInEnv={false}
      endpointValue="https://pg.maya.ph/checkout/v1/checkouts"
      endpointFromEnv={false}
      webhookUrl="https://www.setnayan.com/api/webhooks/maya"
      webhookNotice={on && keys ? mayaWebhookNotice('ok') : null}
      payersSeeMaya={on}
      payersSeeMayaUnread={false}
    />
  );
}

export default async function PayMayaLabPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { v = 'proposed' } = await searchParams;

  if (v === 'admin') {
    return (
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        {adminCard(true, true)}
        {adminCard(true, false)}
        {adminCard(false, true)}
      </main>
    );
  }

  const summary = (
    <section className="rounded-card bg-[color:var(--m-paper-2)] p-6">
      <p className="sn-eye">What you bought</p>
      <h1 className="mt-2 text-2xl font-semibold leading-tight text-ink">Papic · Thank-you add-on</h1>
      <p className="mt-1 text-sm text-ink/70">For Ana &amp; Migs · Wedding · 19 Dec</p>
      <p className="mt-4 text-[40px] font-bold leading-none tracking-tight tabular-nums text-ink">{payAmount(AMOUNT)}</p>
    </section>
  );

  if (v === 'checking') {
    return (
      <main className="mx-auto max-w-[560px] px-4 pb-32 pt-6">
        {summary}
        <MayaChecking back={{ href: '/dashboard', label: 'Back to your event' }} />
      </main>
    );
  }

  const image = await mintedQrImage(PAYLOAD, AMOUNT);
  const rails: ChannelInfo[] = [
    {
      id: 'bdo',
      label: 'BDO',
      kind: 'bank',
      mintedUrl: image?.dataUrl ?? null,
      staticUrl: null,
      number: '0012 3456 7890',
      name: 'Setnayan',
    },
  ];
  const mayaOn = v === 'proposed' || v === 'back';

  return (
    <main className={`mx-auto px-4 pb-32 pt-6 ${mayaOn ? 'max-w-[560px] md:max-w-3xl' : 'max-w-[560px]'}`}>
      {v === 'busy' ? <p role="status" className="mt-4 text-sm text-ink/75">{MAYA_BUSY_LINE}</p> : null}
      <PayPanel
        rechecked={false}
        setup={false}
        proofSent={false}
        resubmitNotice={null}
        amountPhp={AMOUNT}
        reference={REF}
        orderId="00000000-0000-4000-8000-000000000001"
        rails={rails}
        activatesLine="It switches on as soon as our team confirms the payment."
        summary={summary}
        initialStage={2}
        carryQuery={{}}
        maya={
          mayaOn ? (
            <MayaPayStage
              reference={REF}
              amountPhp={AMOUNT}
              title="Papic · Thank-you add-on"
              who="For Ana & Migs · Wedding · 19 Dec"
              billedToName="Ana Reyes"
              billedToEmail="ana.reyes@example.com"
              line={v === 'back' ? mayaReturnLine('cancel') : null}
            />
          ) : null
        }
      />
    </main>
  );
}
