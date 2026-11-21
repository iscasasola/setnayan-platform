import { KeyRound, ShieldAlert, Webhook } from 'lucide-react';
import { saveMayaConfig, clearMayaSecrets } from '../actions';
import { mayaEnvironment, MAYA_WEBHOOK_EVENTS, MAYA_WEBHOOK_SOURCE_IPS } from '@/lib/maya-checkout';
import { SubmitButton } from '@/app/_components/submit-button';
import { SwitchTrack, SWITCH_BUTTON } from '@/app/_components/switch-track';
import { PasswordField } from '@/app/_components/password-field';
import { ADMIN_FRAME } from '@/app/admin/_components/admin-frame';

// Integration Activation Console — PR4c. Bespoke card for Maya/PayMaya: TWO
// secrets (public + secret key form the Basic-auth pair) + one config (checkout
// endpoint). Server component; secrets are masked + never echoed (blank = keep).
// 💳 2026-11-21 (owner, "MAYA CHECKOUT — BUILD IT"): the build-time
// NEXT_PUBLIC_MAYA_STATUS gate is RETIRED. The rail is on when the admin switch
// (Settings › Payment methods) is ON and both keys here are set. This card adds
// "Register webhooks" and, at its top, the "Payers see Maya" switch — its one
// home (DECISION_LOG v2/v3 drawing rows) — both `intent`s on saveMayaConfig, no
// new server action; and says whether the saved endpoint is SANDBOX or PRODUCTION.

export function MayaCard({
  publicInDb,
  secretInDb,
  publicInEnv,
  secretInEnv,
  endpointValue,
  endpointFromEnv,
  webhookUrl,
  webhookNotice,
  payersSeeMaya,
}: {
  publicInDb: boolean;
  secretInDb: boolean;
  publicInEnv: boolean;
  secretInEnv: boolean;
  endpointValue: string;
  endpointFromEnv: boolean;
  /** Our webhook address, as it will be registered with Maya. */
  webhookUrl: string;
  /** The result of the last "Register webhooks" press, from the redirect. */
  webhookNotice: { ok: boolean; text: string } | null;
  /** The "Payers see Maya" switch (`maya_checkout_enabled`), read fail-closed. */
  payersSeeMaya: boolean;
}) {
  const keysReady = (publicInDb || publicInEnv) && (secretInDb || secretInEnv);
  const secretReady = secretInDb || secretInEnv;
  const env = mayaEnvironment(endpointValue || 'https://pg-sandbox.paymaya.com');
  return (
    <section className={`${ADMIN_FRAME} space-y-4 p-5`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-1.5 text-lg font-semibold tracking-tight">
          <KeyRound aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          Maya — automated checkout
        </h3>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
            keysReady
              ? 'bg-emerald-100 text-emerald-900'
              : 'bg-ink/10 text-ink/70'
          }`}
        >
          {keysReady ? `Keys set · ${env === 'sandbox' ? 'Sandbox' : 'Production'}` : 'No keys'}
        </span>
      </div>

      {/* 💳 PAYERS SEE MAYA — the switch's one home (v3 drawing). One tap saves it; next page load takes it. */}
      <form action={saveMayaConfig} className="flex items-center justify-between gap-3 border-b border-ink/10 pb-4" data-maya-switch="">
        <input type="hidden" name="intent" value="payers_see_maya" />
        <input type="hidden" name="enabled" value={payersSeeMaya ? '0' : '1'} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Payers see Maya</p>
          <p className="text-xs text-ink/60">
            {payersSeeMaya
              ? keysReady
                ? 'On — QR Ph, wallet, card and ShopeePay lead the pay page.'
                : 'On, but hidden — a Maya key is missing. Payers see the BDO QR.'
              : 'Off — every payer sees only the BDO QR.'}
          </p>
        </div>
        <SubmitButton
          role="switch"
          aria-checked={payersSeeMaya}
          aria-label="Payers see Maya"
          pendingLabel=""
          overlay={false}
          className={SWITCH_BUTTON}
        >
          {/* The house switch — one drawing everywhere (app/_components/switch-track.tsx). */}
          <SwitchTrack on={payersSeeMaya} />
        </SubmitButton>
      </form>

      <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
        Both keys form the Basic-auth pair.
      </p>
      <p className="text-xs text-ink/60" data-maya-env={env}>
        {env === 'sandbox'
          ? 'Sandbox — test payments, no money moves.'
          : 'Production — real money.'}
      </p>

      <form action={saveMayaConfig} className="space-y-3 border-t border-ink/10 pt-4">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Public API key{publicInDb ? ' (leave blank to keep current)' : ''} ·{' '}
            <span className="text-ink/40">
              {publicInDb ? 'saved here' : publicInEnv ? 'from env' : 'not set'}
            </span>
          </span>
          <PasswordField
            wrapperClassName="mt-1"
            name="maya_public_api_key"
            autoComplete="off"
            placeholder={publicInDb ? '••••••••••••••••' : 'pk-...'}
            className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-terracotta/50"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Secret API key{secretInDb ? ' (leave blank to keep current)' : ''} ·{' '}
            <span className="text-ink/40">
              {secretInDb ? 'saved here' : secretInEnv ? 'from env' : 'not set'}
            </span>
          </span>
          <PasswordField
            wrapperClassName="mt-1"
            name="maya_secret_api_key"
            autoComplete="off"
            placeholder={secretInDb ? '••••••••••••••••' : 'sk-...'}
            className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-terracotta/50"
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
        <SubmitButton
          pendingLabel="Saving…"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
        >
          Save
        </SubmitButton>
      </form>

      <form action={saveMayaConfig} className="space-y-2 border-t border-ink/10 pt-4">
        <input type="hidden" name="intent" value="register_webhooks" />
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-ink">
          <Webhook aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Webhooks
        </p>
        <p className="break-all font-mono text-[11px] text-ink/60">{webhookUrl}</p>
        <p className="text-xs text-ink/55">
          Registers {MAYA_WEBHOOK_EVENTS.join(', ')} with Maya ({env}). Maya sends from{' '}
          {MAYA_WEBHOOK_SOURCE_IPS[env].join(' and ')}.
        </p>
        {webhookNotice ? (
          <p role="status" className={`text-xs ${webhookNotice.ok ? 'text-success-800' : 'text-danger-700'}`}>
            {webhookNotice.text}
          </p>
        ) : null}
        <SubmitButton
          pendingLabel="Registering…"
          disabled={!secretReady}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-4 text-sm font-medium text-ink/80 transition-colors hover:border-ink/30"
        >
          Register webhooks
        </SubmitButton>
      </form>

      {publicInDb || secretInDb ? (
        <form action={clearMayaSecrets} className="border-t border-ink/10 pt-4">
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
        <span>Both keys are encrypted (AES-256-GCM) and never shown back. Real money path — set with care.</span>
      </p>
    </section>
  );
}
