import { Receipt } from 'lucide-react';

/**
 * PurchaseHistory — the vendor's resolved token-pack orders (paid + rejected).
 * Pending orders live in the PendingPurchases panel (they're actionable);
 * this is the settled record so a vendor can see what they've bought.
 */

export type ResolvedPurchase = {
  purchase_id: string;
  token_count: number;
  amount_php: number;
  reference_code: string;
  status: 'paid' | 'rejected';
  created_at: string;
  paid_at: string | null;
  rejection_reason: string | null;
};

const NUMBER = new Intl.NumberFormat('en-PH');

function fmt(s: string) {
  return new Date(s).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function PurchaseHistory({ purchases }: { purchases: ResolvedPurchase[] }) {
  return (
    <div className="m-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <Receipt aria-hidden className="h-4 w-4 text-ink/60" strokeWidth={1.75} />
        <p className="m-label-mono">Purchase history</p>
      </div>

      {purchases.length === 0 ? (
        <p className="text-sm text-ink/55">
          No completed purchases yet. Your paid token packs will appear here.
        </p>
      ) : (
        <ul className="divide-y" style={{ borderColor: 'var(--m-line)' }}>
          {purchases.map((p) => {
            const paid = p.status === 'paid';
            return (
              <li
                key={p.purchase_id}
                className="flex items-start justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {NUMBER.format(p.token_count)} tokens
                    <span className="ml-2 font-mono text-[10px] text-ink/40">
                      {p.reference_code}
                    </span>
                  </p>
                  <p className="text-[11px] text-ink/50">
                    {paid
                      ? `Paid ${fmt(p.paid_at ?? p.created_at)}`
                      : `Rejected${p.rejection_reason ? ` · ${p.rejection_reason}` : ''}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-ink">
                    ₱{NUMBER.format(p.amount_php)}
                  </p>
                  <span
                    className={
                      'mt-0.5 inline-block rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] ' +
                      (paid
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-ink/5 text-ink/55')
                    }
                  >
                    {paid ? 'Credited' : 'Rejected'}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
