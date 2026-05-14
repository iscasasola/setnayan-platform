'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, Wallet, Gift, X } from 'lucide-react';

/**
 * Decision 1 (CLAUDE.md 2026-05-15) — § 3.1a Self-purchase confirm modal.
 *
 * When the order author is a vendor owner or team member of any vendor
 * profile, the New-order form intercepts submission and renders this modal.
 * The user picks "Pay full price" (standard flow — submits the form as-is)
 * or "Comp for myself" (flips a hidden input to mark the order as a self-
 * comp; the server action picks that up and inserts a comp_grants row +
 * marks the order paid).
 *
 * Pure client wrapper around a regular `<form action={…}>` — the parent
 * keeps using a Server Action; we just gate submission on the modal answer.
 */

type Role = {
  vendor_profile_id: string;
  business_name: string;
  role: 'owner' | 'admin' | 'agent' | 'viewer';
};

type Quota = {
  vendor_profile_id: string;
  quarterly_cap: number;
  quarter_used: number;
  remaining: number;
};

type Props = {
  roles: ReadonlyArray<Role>;
  quotas: ReadonlyArray<Quota>;
  children: ReactNode; // the full <form> (with hidden inputs)
};

export function SelfPurchaseConfirm({ roles, quotas, children }: Props) {
  // The wrapper attaches a native capture-phase submit listener to its
  // container; that intercepts the inner <form>'s submit before the React
  // action runs. When the user picks a path in the modal, we re-submit
  // via form.submit() — which skips React's synthetic event so the action
  // fires once.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<HTMLFormElement | null>(null);
  const skipRef = useRef(false);

  const skipGate = roles.length === 0;

  const ownerOrAdminRoles = roles.filter(
    (r) => r.role === 'owner' || r.role === 'admin',
  );
  const canSelfComp = ownerOrAdminRoles.length > 0;
  const targetRole = ownerOrAdminRoles[0] ?? roles[0] ?? null;
  const quotaForTarget = targetRole
    ? quotas.find((q) => q.vendor_profile_id === targetRole.vendor_profile_id)
    : undefined;
  const quotaRemaining = quotaForTarget?.remaining ?? 12;
  const quotaCap = quotaForTarget?.quarterly_cap ?? 12;
  const compDisabled = !canSelfComp || quotaRemaining <= 0;

  useEffect(() => {
    if (skipGate) return;
    const node = containerRef.current;
    if (!node) return;

    const onSubmit = (event: Event) => {
      // Skip the gate when we re-fire submit() programmatically post-modal.
      if (skipRef.current) {
        skipRef.current = false;
        return;
      }
      const target = event.target;
      if (!(target instanceof HTMLFormElement)) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingSubmit(target);
      setOpen(true);
    };

    node.addEventListener('submit', onSubmit, true);
    return () => {
      node.removeEventListener('submit', onSubmit, true);
    };
  }, [skipGate]);

  if (skipGate || !targetRole) {
    // No vendor relationship — render the form as-is, no gate.
    return <>{children}</>;
  }

  const handleChoice = (action: 'pay_full_price' | 'comp_for_myself') => {
    if (!pendingSubmit) return;
    const form = pendingSubmit;
    let hidden = form.querySelector<HTMLInputElement>(
      'input[name="self_purchase_action"]',
    );
    if (!hidden) {
      hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'self_purchase_action';
      form.appendChild(hidden);
    }
    hidden.value = action;

    if (action === 'comp_for_myself') {
      let vendorHidden = form.querySelector<HTMLInputElement>(
        'input[name="self_purchase_vendor_profile_id"]',
      );
      if (!vendorHidden) {
        vendorHidden = document.createElement('input');
        vendorHidden.type = 'hidden';
        vendorHidden.name = 'self_purchase_vendor_profile_id';
        form.appendChild(vendorHidden);
      }
      vendorHidden.value = targetRole.vendor_profile_id;
    }

    setOpen(false);
    setPendingSubmit(null);
    skipRef.current = true;
    // requestSubmit() preserves the React action binding; the skipRef
    // ensures our capture listener lets this submit through.
    form.requestSubmit();
  };

  return (
    <>
      <div ref={containerRef}>{children}</div>
      {open ? (
        <SelfPurchaseModal
          role={targetRole}
          quota={quotaForTarget}
          compDisabled={compDisabled}
          quotaRemaining={quotaRemaining}
          quotaCap={quotaCap}
          onCancel={() => {
            setOpen(false);
            setPendingSubmit(null);
          }}
          onPick={handleChoice}
        />
      ) : null}
    </>
  );
}

function SelfPurchaseModal({
  role,
  quota,
  compDisabled,
  quotaRemaining,
  quotaCap,
  onCancel,
  onPick,
}: {
  role: Role;
  quota: Quota | undefined;
  compDisabled: boolean;
  quotaRemaining: number;
  quotaCap: number;
  onCancel: () => void;
  onPick: (action: 'pay_full_price' | 'comp_for_myself') => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="self-purchase-heading"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
    >
      <div className="w-full max-w-md rounded-2xl bg-cream p-6 shadow-2xl ring-1 ring-ink/10">
        <header className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
              Self-purchase
            </p>
            <h2 id="self-purchase-heading" className="text-xl font-semibold tracking-tight">
              This is your own vendor account.
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="rounded-full p-1 text-ink/50 hover:bg-ink/5 hover:text-ink"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </header>

        <p className="mt-3 text-sm text-ink/70">
          You{role.role === 'owner' ? ' own' : `'re on the team for`}{' '}
          <span className="font-medium text-ink">{role.business_name}</span>. How do you
          want to handle this order?
        </p>

        <div className="mt-5 space-y-3">
          <button
            type="button"
            onClick={() => onPick('pay_full_price')}
            className="flex w-full items-start gap-3 rounded-xl border border-ink/15 bg-white p-4 text-left transition-colors hover:border-terracotta hover:bg-terracotta/5"
          >
            <Wallet
              aria-hidden
              className="mt-0.5 h-5 w-5 shrink-0 text-terracotta"
              strokeWidth={1.75}
            />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-ink">Pay full price</p>
              <p className="text-xs text-ink/60">
                Standard payment — same price as any customer. Counts toward vendor revenue
                and sales analytics.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onPick('comp_for_myself')}
            disabled={compDisabled}
            className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
              compDisabled
                ? 'cursor-not-allowed border-ink/10 bg-ink/5 opacity-60'
                : 'border-ink/15 bg-white hover:border-emerald-500 hover:bg-emerald-50'
            }`}
          >
            <Gift
              aria-hidden
              className={`mt-0.5 h-5 w-5 shrink-0 ${
                compDisabled ? 'text-ink/40' : 'text-emerald-700'
              }`}
              strokeWidth={1.75}
            />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-ink">Comp for myself</p>
              <p className="text-xs text-ink/60">
                Skip payment for this order. Audit-logged.{' '}
                {compDisabled ? (
                  <span className="text-rose-700">
                    {quotaRemaining <= 0
                      ? `You've used all ${quotaCap} self-comps for this quarter — pay full price or contact admin to raise the cap.`
                      : 'Only owners and admins can self-comp.'}
                  </span>
                ) : (
                  <>
                    {quotaRemaining} of {quotaCap} self-comps remaining this quarter.
                  </>
                )}
              </p>
            </div>
          </button>
        </div>

        <footer className="mt-5 flex items-center justify-between gap-3 border-t border-ink/10 pt-4 text-xs text-ink/55">
          <p className="inline-flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
            Self-comp orders are excluded from your vendor analytics.
          </p>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 font-medium text-ink/70 hover:bg-ink/5 hover:text-ink"
          >
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
}
