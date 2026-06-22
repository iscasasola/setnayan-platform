import { KeyRound, ShieldAlert } from 'lucide-react';
import { saveMayaConfig, clearMayaSecrets } from '../actions';

// Integration Activation Console — PR4c. Bespoke card for Maya/PayMaya: TWO
// secrets (public + secret key form the Basic-auth pair) + one config (checkout
// endpoint). Server component; secrets are masked + never echoed (blank = keep).
// ⚠ Branch B activation ALSO needs NEXT_PUBLIC_MAYA_STATUS=APPROVED (build-time)
// → that flip still requires a redeploy; this card only sets the credentials.

export function MayaCard({
  publicInDb,
  secretInDb,
  publicInEnv,
  secretInEnv,
  endpointValue,
  endpointFromEnv,
  statusApproved,
}: {
  publicInDb: boolean;
  secretInDb: boolean;
  publicInEnv: boolean;
  secretInEnv: boolean;
  endpointValue: string;
  endpointFromEnv: boolean;
  statusApproved: boolean;
}) {
  const keysReady = (publicInDb || publicInEnv) && (secretInDb || secretInEnv);
  return (
    <section className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-1.5 text-lg font-semibold tracking-tight">
          <KeyRound aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          Maya — automated checkout
        </h3>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
            keysReady && statusApproved
              ? 'bg-emerald-100 text-emerald-900'
              : 'bg-ink/10 text-ink/70'
          }`}
        >
          {keysReady ? (statusApproved ? 'Live' : 'Keys set · not approved') : 'No keys'}
        </span>
      </div>

      <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
        PayMaya automated checkout (Branch B). Both keys form the Basic-auth pair.
        {statusApproved
          ? ''
          : ' Activation also requires NEXT_PUBLIC_MAYA_STATUS=APPROVED, which is build-time — that flip still needs a redeploy.'}
      </p>

      <form action={saveMayaConfig} className="space-y-3 border-t border-ink/10 pt-4">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Public API key{publicInDb ? ' (leave blank to keep current)' : ''} ·{' '}
            <span className="text-ink/40">
              {publicInDb ? 'saved here' : publicInEnv ? 'from env' : 'not set'}
            </span>
          </span>
          <input
            type="password"
            name="maya_public_api_key"
            autoComplete="off"
            placeholder={publicInDb ? '••••••••••••••••' : 'pk-...'}
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-terracotta/50"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Secret API key{secretInDb ? ' (leave blank to keep current)' : ''} ·{' '}
            <span className="text-ink/40">
              {secretInDb ? 'saved here' : secretInEnv ? 'from env' : 'not set'}
            </span>
          </span>
          <input
            type="password"
            name="maya_secret_api_key"
            autoComplete="off"
            placeholder={secretInDb ? '••••••••••••••••' : 'sk-...'}
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-terracotta/50"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Checkout endpoint{endpointFromEnv ? ' · from env' : ''}
          </span>
          <input
            type="text"
            name="maya_checkout_endpoint"
            defaultValue={endpointValue}
            autoComplete="off"
            spellCheck={false}
            placeholder="https://pg-sandbox.paymaya.com/checkout/v1/checkouts"
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-terracotta/50"
          />
        </label>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
        >
          Save
        </button>
      </form>

      {publicInDb || secretInDb ? (
        <form action={clearMayaSecrets} className="border-t border-ink/10 pt-4">
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-4 py-2 text-sm font-medium text-ink/60 transition-colors hover:border-rose-300 hover:text-rose-700"
          >
            Clear saved keys
          </button>
        </form>
      ) : null}

      <p className="inline-flex items-start gap-2 text-xs text-ink/55">
        <ShieldAlert aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        <span>Both keys are encrypted (AES-256-GCM) and never shown back. Real money path — set with care.</span>
      </p>
    </section>
  );
}
