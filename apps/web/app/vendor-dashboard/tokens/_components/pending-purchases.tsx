import { Clock, Copy } from 'lucide-react';
import type { PlatformSettingsRow } from '@/lib/platform-settings';

/**
 * PendingPurchases — apply-then-pay instructions for any token-pack order the
 * vendor has started but not yet had confirmed.
 *
 * Shows the reference code (must appear in the payment note so the team can
 * reconcile) + the BDO / GCash receiving accounts from platform_settings.
 * Once an admin confirms at /admin/token-purchases, the row flips to 'paid',
 * the wallet is credited, and the order drops off this list.
 *
 * NO money is moved on-platform — Setnayan never holds the funds here; the
 * vendor pays our receiving account directly. (Standing disclosure per
 * [[project_setnayan_vendor_payment_disclosure]].)
 */

export type PendingPurchase = {
  purchase_id: string;
  reference_code: string;
  token_count: number;
  amount_php: number;
  created_at: string;
};

const NUMBER = new Intl.NumberFormat('en-PH');

export function PendingPurchases({
  purchases,
  settings,
}: {
  purchases: PendingPurchase[];
  settings: PlatformSettingsRow;
}) {
  if (purchases.length === 0) return null;

  return (
    <div className="m-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <Clock aria-hidden className="h-4 w-4 text-orange" strokeWidth={2} />
        <p className="m-label-mono">Awaiting payment</p>
      </div>

      <ul className="space-y-4">
        {purchases.map((p) => (
          <li
            key={p.purchase_id}
            className="rounded-lg border p-4"
            style={{ borderColor: 'var(--m-line)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">
                  {NUMBER.format(p.token_count)} tokens · ₱
                  {NUMBER.format(p.amount_php)}
                </p>
                <p className="mt-0.5 text-[11px] text-ink/50">
                  Started{' '}
                  {new Date(p.created_at).toLocaleString('en-PH', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <span className="rounded-full bg-orange/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-orange">
                Pending
              </span>
            </div>

            {/* Reference code — the reconciliation key */}
            <div
              className="mt-3 flex items-center justify-between gap-2 rounded-md px-3 py-2"
              style={{ background: 'rgba(45, 48, 56, 0.04)' }}
            >
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-ink/50">
                  Payment reference
                </p>
                <p className="font-mono text-sm font-semibold text-ink">
                  {p.reference_code}
                </p>
              </div>
              <Copy aria-hidden className="h-3.5 w-3.5 text-ink/40" strokeWidth={2} />
            </div>
            <p className="mt-2 text-xs text-ink/60">
              Put <span className="font-mono text-ink/80">{p.reference_code}</span>{' '}
              in the payment note so we can match it to your account.
            </p>
          </li>
        ))}
      </ul>

      {/* Receiving accounts */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <PayBox
          label="BDO"
          name={settings.bdo_account_name}
          number={settings.bdo_account_number}
        />
        <PayBox
          label="GCash"
          name={settings.gcash_account_name}
          number={settings.gcash_number}
        />
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-ink/50">
        Setnayan does not hold these funds in escrow — you pay our receiving
        account directly. Tokens are credited after our team confirms the
        payment (within 24 hours). You&rsquo;ll see the balance update here.
      </p>
    </div>
  );
}

function PayBox({
  label,
  name,
  number,
}: {
  label: string;
  name: string | null;
  number: string | null;
}) {
  const configured = Boolean(number?.trim());
  return (
    <div
      className="rounded-md border px-3 py-2.5"
      style={{ borderColor: 'var(--m-line)' }}
    >
      <p className="text-[10px] uppercase tracking-[0.15em] text-ink/50">{label}</p>
      {configured ? (
        <>
          <p className="mt-1 font-mono text-sm font-semibold text-ink">{number}</p>
          {name?.trim() && (
            <p className="text-[11px] text-ink/55">{name}</p>
          )}
        </>
      ) : (
        <p className="mt-1 text-[11px] text-ink/45">
          Account details coming — our team will email them with your reference.
        </p>
      )}
    </div>
  );
}
