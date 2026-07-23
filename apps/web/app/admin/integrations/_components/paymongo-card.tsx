import { KeyRound, ShieldAlert, Webhook, Power } from 'lucide-react';
import {
  savePaymongoConfig,
  clearPaymongoSecrets,
  setBookingFeeCollectionEnabled,
} from '../actions';
import { SubmitButton } from '@/app/_components/submit-button';

// Integration Activation Console — PayMongo (booking-fee rail). TWO secrets: the
// checkout SECRET key (sk_…) + the WEBHOOK signing secret (whsk_…). No non-secret
// config. Both are DB-first-resolved, so pasting them applies LIVE with no
// redeploy. Server component; secrets are masked + never echoed (blank = keep).
// ⚠ Credentials make the RAIL work; the fee still won't ENFORCE until the
// booking-fee flags (NEXT_PUBLIC_BOOKING_FEE_ENABLED + _RAIL_LIVE) are on.

export function PaymongoCard({
  secretInDb,
  webhookInDb,
  secretInEnv,
  webhookInEnv,
  collectionEnabled,
}: {
  secretInDb: boolean;
  webhookInDb: boolean;
  secretInEnv: boolean;
  webhookInEnv: boolean;
  collectionEnabled: boolean;
}) {
  const keysReady = (secretInDb || secretInEnv) && (webhookInDb || webhookInEnv);
  const live = keysReady && collectionEnabled;
  return (
    <section className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-1.5 text-lg font-semibold tracking-tight">
          <KeyRound aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          PayMongo — booking-fee rail
        </h3>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
            live
              ? 'bg-emerald-100 text-emerald-900'
              : keysReady
                ? 'bg-amber-100 text-amber-900'
                : 'bg-ink/10 text-ink/70'
          }`}
        >
          {live ? 'Live · collecting' : keysReady ? 'Keys ready · off' : 'No keys'}
        </span>
      </div>

      <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
        The vendor booking-fee gateway. Paste the two keys and they apply live (no
        redeploy). The fee still only starts collecting once the booking-fee flags
        are on.
      </p>

      <p className="inline-flex items-start gap-2 rounded-lg bg-ink/5 px-3 py-2 text-xs text-ink/70">
        <Webhook aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        <span>
          In PayMongo → Developers → Webhooks, register{' '}
          <code className="font-mono">https://&lt;your-domain&gt;/api/webhooks/paymongo</code> for
          the <code className="font-mono">checkout_session.payment.paid</code> event, then paste
          its <code className="font-mono">whsk_…</code> secret below.
        </span>
      </p>

      <form action={savePaymongoConfig} className="space-y-3 border-t border-ink/10 pt-4">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Secret key{secretInDb ? ' (leave blank to keep current)' : ''} ·{' '}
            <span className="text-ink/40">
              {secretInDb ? 'saved here' : secretInEnv ? 'from env' : 'not set'}
            </span>
          </span>
          <input
            type="password"
            name="paymongo_secret_key"
            autoComplete="off"
            placeholder={secretInDb ? '••••••••••••••••' : 'sk_live_... / sk_test_...'}
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-terracotta/50"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Webhook signing secret{webhookInDb ? ' (leave blank to keep current)' : ''} ·{' '}
            <span className="text-ink/40">
              {webhookInDb ? 'saved here' : webhookInEnv ? 'from env' : 'not set'}
            </span>
          </span>
          <input
            type="password"
            name="paymongo_webhook_secret"
            autoComplete="off"
            placeholder={webhookInDb ? '••••••••••••••••' : 'whsk_...'}
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-terracotta/50"
          />
        </label>
        <SubmitButton
          pendingLabel="Saving…"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
        >
          Save
        </SubmitButton>
      </form>

      {secretInDb || webhookInDb ? (
        <form action={clearPaymongoSecrets} className="border-t border-ink/10 pt-4">
          <SubmitButton
            pendingLabel="Clearing…"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-4 py-2 text-sm font-medium text-ink/60 transition-colors hover:border-rose-300 hover:text-rose-700"
          >
            Clear saved keys
          </SubmitButton>
        </form>
      ) : null}

      <form
        action={setBookingFeeCollectionEnabled}
        className="flex items-center justify-between gap-3 rounded-lg border-t border-ink/10 pt-4"
      >
        <input type="hidden" name="enabled" value={collectionEnabled ? '0' : '1'} />
        <div>
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-ink">
            <Power aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Fee collection: {collectionEnabled ? 'ON' : 'OFF'}
          </p>
          <p className="mt-0.5 text-xs text-ink/55">
            {collectionEnabled
              ? keysReady
                ? 'Live — sourced proposals are charged when sent.'
                : 'On, but idle until PayMongo keys are added above.'
              : keysReady
                ? 'Keys are ready. Turn on to start collecting — no redeploy.'
                : 'Add the keys above, then turn this on to go live.'}
          </p>
        </div>
        <SubmitButton
          pendingLabel={collectionEnabled ? 'Turning off…' : 'Turning on…'}
          className={`shrink-0 inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            collectionEnabled
              ? 'border border-ink/15 bg-cream text-ink/70 hover:border-rose-300 hover:text-rose-700'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          {collectionEnabled ? 'Turn off' : 'Turn on'}
        </SubmitButton>
      </form>

      <p className="inline-flex items-start gap-2 text-xs text-ink/55">
        <ShieldAlert aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        <span>Both keys are encrypted (AES-256-GCM) and never shown back. Real money path — set with care.</span>
      </p>
    </section>
  );
}
