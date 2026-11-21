import Link from 'next/link';
import { CreditCard } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { InfoTip } from '@/app/_components/info-tip';
import { readMayaGate } from '@/lib/maya-checkout.server';
import { mayaEnvironment, mayaRailReasonLine } from '@/lib/maya-checkout';
import { savePaymentInstruments } from '../../actions';

/**
 * 💳 The Maya Checkout switch (owner 2026-11-21): an ADDITIONAL rail — "Pay
 * with card or Maya" under the BDO QR. Same shape as an account's own switch
 * (one press, saves at once). The rail shows to payers only while this is ON
 * **and** both Maya keys are set; when the switch is on and a key is missing,
 * this card says which one (`mayaRailReasonLine`) instead of looking live.
 */
export async function MayaRailSwitch({ locked }: { locked: boolean }) {
  const { state, enabled, config } = await readMayaGate();
  const env = mayaEnvironment(config.checkoutEndpoint);
  const reason = state.open ? null : mayaRailReasonLine(state.reason);
  return (
    <section className={`mt-6 space-y-3 sn-tile p-5 ${enabled ? '' : 'opacity-75'}`} aria-labelledby="maya-rail">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="maya-rail" className="flex items-center gap-2 text-sm font-semibold text-ink">
          <CreditCard aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Card or Maya{' '}
          <span className="font-normal text-ink/55">
            · {env === 'sandbox' ? 'Sandbox' : 'Production'}
            {enabled ? (state.open ? '' : ' · Hidden') : ' · Off'}
          </span>
        </h3>
        <form action={savePaymentInstruments}>
          <input type="hidden" name="intent" value="maya_checkout_toggle" />
          <input type="hidden" name="enabled" value={enabled ? '0' : '1'} />
          <SubmitButton
            className="inline-flex h-11 items-center rounded-md border border-ink/15 px-3 text-xs font-medium text-ink/80 hover:border-ink/30"
            pendingLabel="Saving…"
            disabled={locked}
          >
            {enabled ? 'Turn off' : 'Turn on'}
          </SubmitButton>
        </form>
      </div>
      <p className="text-xs text-ink/60">
        Payers see it under the QR and pay the exact total.{' '}
        <InfoTip label="" ariaLabel="About Maya fees and approval" align="start">
          Setnayan pays Maya&rsquo;s fee. A payment approves itself only after Maya confirms it.
        </InfoTip>
      </p>
      {enabled && reason ? (
        <p role="status" className="rounded-md bg-[var(--sn-warning-soft)] px-3 py-2 text-xs text-[color:var(--sn-warning-deep)]">
          {reason}{' '}
          <Link href="/admin/integrations" className="underline underline-offset-2">
            Open Integrations
          </Link>
        </p>
      ) : null}
    </section>
  );
}
