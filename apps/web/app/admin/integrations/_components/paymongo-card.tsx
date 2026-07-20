import { KeyRound, ShieldAlert } from 'lucide-react';
import { savePayMongoConfig, clearPayMongoSecrets } from '../actions';
import { SubmitButton } from '@/app/_components/submit-button';

// PayMongo one-time Checkout Sessions — Phase 0. Bespoke card: ONE API secret
// key (Basic-auth base64("<key>:")) + TWO webhook signing secrets (separate test
// vs live) + one non-secret config (API base URL). Server component; secrets are
// masked + never echoed (blank = keep). ⚠ Activation ALSO needs
// NEXT_PUBLIC_PAYMONGO_STATUS=APPROVED (build-time) → that flip still requires a
// redeploy; this card only sets the credentials. Nothing charges until the keys
// AND the flag are both set.

export function PayMongoCard({
  secretInDb,
  secretInEnv,
  webhookTestInDb,
  webhookTestInEnv,
  webhookLiveInDb,
  webhookLiveInEnv,
  endpointValue,
  endpointFromEnv,
  statusApproved,
}: {
  secretInDb: boolean;
  secretInEnv: boolean;
  webhookTestInDb: boolean;
  webhookTestInEnv: boolean;
  webhookLiveInDb: boolean;
  webhookLiveInEnv: boolean;
  endpointValue: string;
  endpointFromEnv: boolean;
  statusApproved: boolean;
}) {
  const keyReady = secretInDb || secretInEnv;
  const webhookReady =
    webhookTestInDb || webhookTestInEnv || webhookLiveInDb || webhookLiveInEnv;
  return (
    <section className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-1.5 text-lg font-semibold tracking-tight">
          <KeyRound aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          PayMongo — automated checkout
        </h3>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
            keyReady && statusApproved
              ? 'bg-emerald-100 text-emerald-900'
              : 'bg-ink/10 text-ink/70'
          }`}
        >
          {keyReady ? (statusApproved ? 'Live' : 'Keys set · not approved') : 'No keys'}
        </span>
      </div>

      <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
        PayMongo Checkout Sessions (Card · GCash · Maya · GrabPay · QR Ph). The
        secret key authenticates the API; the webhook signing secrets verify
        inbound payment events.
        {statusApproved
          ? ''
          : ' Activation also requires NEXT_PUBLIC_PAYMONGO_STATUS=APPROVED, which is build-time — that flip still needs a redeploy.'}
      </p>

      <form action={savePayMongoConfig} className="space-y-3 border-t border-ink/10 pt-4">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Secret API key{secretInDb ? ' (leave blank to keep current)' : ''} ·{' '}
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
            Webhook signing secret · TEST
            {webhookTestInDb ? ' (leave blank to keep current)' : ''} ·{' '}
            <span className="text-ink/40">
              {webhookTestInDb ? 'saved here' : webhookTestInEnv ? 'from env' : 'not set'}
            </span>
          </span>
          <input
            type="password"
            name="paymongo_webhook_secret_test"
            autoComplete="off"
            placeholder={webhookTestInDb ? '••••••••••••••••' : 'whsk_test_...'}
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-terracotta/50"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Webhook signing secret · LIVE
            {webhookLiveInDb ? ' (leave blank to keep current)' : ''} ·{' '}
            <span className="text-ink/40">
              {webhookLiveInDb ? 'saved here' : webhookLiveInEnv ? 'from env' : 'not set'}
            </span>
          </span>
          <input
            type="password"
            name="paymongo_webhook_secret_live"
            autoComplete="off"
            placeholder={webhookLiveInDb ? '••••••••••••••••' : 'whsk_live_...'}
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-terracotta/50"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            API base URL{endpointFromEnv ? ' · from env' : ''}
          </span>
          <input
            type="text"
            name="paymongo_api_endpoint"
            defaultValue={endpointValue}
            autoComplete="off"
            spellCheck={false}
            placeholder="https://api.paymongo.com"
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-terracotta/50"
          />
        </label>
        <SubmitButton
          pendingLabel="Saving…"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
        >
          Save
        </SubmitButton>
      </form>

      {secretInDb || webhookTestInDb || webhookLiveInDb ? (
        <form action={clearPayMongoSecrets} className="border-t border-ink/10 pt-4">
          <SubmitButton
            pendingLabel="Clearing…"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-4 py-2 text-sm font-medium text-ink/60 transition-colors hover:border-rose-300 hover:text-rose-700"
          >
            Clear saved keys
          </SubmitButton>
        </form>
      ) : null}

      <p className="inline-flex items-start gap-2 text-xs text-ink/55">
        <ShieldAlert aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        <span>
          All secrets are encrypted (AES-256-GCM) and never shown back. Real money
          path — set with care. Webhook: {webhookReady ? 'configured' : 'not set'}.
        </span>
      </p>
    </section>
  );
}
