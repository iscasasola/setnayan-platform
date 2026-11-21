import Link from 'next/link';
import { CreditCard } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { InfoTip } from '@/app/_components/info-tip';
import { readMayaGate } from '@/lib/maya-checkout.server';
import { mayaEnvironment, mayaRailReasonLine, type MayaEnvironment } from '@/lib/maya-checkout';
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
  return (
    <MayaRailSwitchView
      locked={locked}
      enabled={enabled}
      open={state.open}
      reason={state.open ? null : mayaRailReasonLine(state.reason)}
      env={mayaEnvironment(config.checkoutEndpoint)}
    />
  );
}

/** The card itself, from plain values — the page above and /dev/pay-maya-lab draw the same one. */
export function MayaRailSwitchView({
  locked,
  enabled,
  open,
  reason,
  env,
}: {
  locked: boolean;
  enabled: boolean;
  open: boolean;
  reason: string | null;
  env: MayaEnvironment;
}) {
  return (
    <section className={`mt-10 space-y-3 border-t border-ink/10 pt-8 ${enabled ? '' : 'opacity-75'}`} aria-labelledby="maya-rail">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="maya-rail" className="flex items-center gap-2 text-sm font-semibold text-ink">
          <CreditCard aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Card or Maya{' '}
          <span className="font-normal text-ink/55">
            · {env === 'sandbox' ? 'Sandbox' : 'Production'}
            {enabled ? (open ? '' : ' · Hidden') : ' · Off'}
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
      <div className="flex items-center gap-1 text-xs text-ink/60">
        <span>Payers see it under the QR and pay the exact total.</span>
        <InfoTip label="" ariaLabel="About Maya fees and approval" align="start">
          Setnayan pays Maya&rsquo;s fee. A payment approves itself only after Maya confirms it.
        </InfoTip>
      </div>
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
