/**
 * /dev/pay-maya-lab — the Maya Checkout rail (owner 2026-11-21) on fixtures: no sign-in, no database. DEV-ONLY:
 * production builds 404 it, the same kill-switch as every `/dev/*` lab.
 *
 * Draws the REAL pay panel (`app/pay/[reference]/_components/pay-panel.tsx`) at stage 2 with the REAL Maya button,
 * and the REAL admin cards, so a walk can screenshot Now beside Proposed at 390 px, light and dark:
 *
 *   ?v=now        the pay page as shipped — the BDO QR alone (the rail is off)
 *   ?v=proposed   the same page with "Pay with card or Maya" under the QR (switch on + keys + within the ceiling)
 *   ?v=back       back from Maya without paying — the one honest line
 *   ?v=admin      Settings › Payment methods: the switch off · on but hidden (no secret key) · on and live;
 *                 Integrations › Maya card with Register webhooks
 *
 * Buttons post to the real server actions, which refuse without a session — a lab press changes nothing.
 */
import { notFound } from 'next/navigation';
import { PayPanel, type ChannelInfo } from '@/app/pay/[reference]/_components/pay-panel';
import { MayaPayButton } from '@/app/pay/[reference]/_components/maya-pay-button';
import { MayaRailSwitchView } from '@/app/admin/settings/payment-methods/_components/maya-rail-switch';
import { MayaCard } from '@/app/admin/integrations/_components/maya-card';
import { mintedQrImage } from '@/lib/qr-image.server';
import { payAmount } from '@/lib/pay-amount';
import { mayaReturnLine, mayaRailReasonLine, mayaWebhookNotice } from '@/lib/maya-checkout';

const REF = 'SNLAB2611';
const AMOUNT = 1499;
// A real QR Ph payload (the gift-QR fixture), re-minted with the amount like the page does.
const PAYLOAD =
  '00020101021127830012com.p2pqrpay0111GXCHPHM2XXX02089996440303152170200000006560417DWQM4TK3JDNWIWRDY5204601653036085802PH5908Setnayan6011Holy Spirit6104123463045E2D';

export default async function PayMayaLabPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { v = 'proposed' } = await searchParams;

  if (v === 'admin') {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="sn-eye mb-2 block">Settings › Payment methods</p>
        <MayaRailSwitchView locked={false} enabled={false} open={false} reason={null} env="sandbox" />
        <MayaRailSwitchView locked={false} enabled open={false} reason={mayaRailReasonLine('missing_secret_key')} env="sandbox" />
        <MayaRailSwitchView locked={false} enabled open reason={null} env="production" />
        <p className="sn-eye mb-2 mt-8 block">Integrations › Maya</p>
        <MayaCard
          publicInDb
          secretInDb
          publicInEnv={false}
          secretInEnv={false}
          endpointValue="https://pg-sandbox.paymaya.com/checkout/v1/checkouts"
          endpointFromEnv={false}
          webhookUrl="https://www.setnayan.com/api/webhooks/maya"
          webhookNotice={mayaWebhookNotice('ok')}
        />
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
  const summary = (
    <section className="rounded-card bg-[color:var(--m-paper-2)] p-6">
      <h1 className="text-2xl font-semibold leading-tight text-ink">Event Pro</h1>
      <p className="mt-4 text-[40px] font-bold leading-none tracking-tight tabular-nums text-ink">{payAmount(AMOUNT)}</p>
    </section>
  );
  const line = v === 'back' ? mayaReturnLine('cancel') : null;

  return (
    <main className="mx-auto max-w-[560px] px-4 pb-32 pt-6">
      {line ? <p role="status" className="mt-4 text-sm text-ink/75">{line}</p> : null}
      <PayPanel
        rechecked={false}
        setup={false}
        proofSent={false}
        resubmitNotice={null}
        requiresReference={false}
        amountPhp={AMOUNT}
        reference={REF}
        orderId="00000000-0000-4000-8000-000000000001"
        rails={rails}
        activatesLine="It switches on as soon as our team confirms the payment."
        summary={summary}
        initialStage={2}
        carryQuery={{}}
        maya={v === 'now' ? null : <MayaPayButton reference={REF} />}
      />
    </main>
  );
}
