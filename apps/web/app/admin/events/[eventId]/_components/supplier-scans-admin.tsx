'use client';

import { useState, useTransition } from 'react';
import { scanNumberLabel } from '@/lib/supplier-scan';
import type { AdminScanClaim } from '@/lib/supplier-scan.server';
import { supplierScan } from '@/app/_actions/supplier-scan-actions';

/**
 * 🎟 Admin › the event › Suppliers' scans — where Setnayan sees every claim a supplier's scanner recorded at this event
 * (names included: this is the console) and takes back one recorded in error. A removal asks first, is written to
 * `admin_audit_log`, and leaves the number unused: a visible gap is the honest mark of a correction.
 */
export function SupplierScansAdmin({ eventId, claims }: { eventId: string; claims: AdminScanClaim[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const remove = (c: AdminScanClaim) => {
    if (!window.confirm(`Remove ${scanNumberLabel(c.number)} · ${c.guestName} (${c.service})? The guest is no longer counted as claimed.`)) return;
    setError(null);
    start(async () => {
      const reply = await supplierScan({ op: 'admin_remove', eventId, kind: c.kind, claimId: c.claimId });
      // The action revalidates this page itself — its answer carries the new render.
      if (!(reply.op === 'admin_remove' && reply.result.ok)) setError(reply.op === 'admin_remove' ? (reply.result.error ?? 'Couldn’t remove it.') : 'Couldn’t remove it.');
    });
  };
  return (
    <>
      {error ? (
        <p role="alert" className="mb-2 text-sm text-mulberry">
          {error}
        </p>
      ) : null}
      <ul className="divide-y divide-ink/10 text-sm">
        {claims.map((c) => (
          <li key={`${c.kind}-${c.claimId}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
            <span className="min-w-0">
              <span className="text-ink">
                <span className="tabular-nums">{scanNumberLabel(c.number)}</span> · {c.guestName}
              </span>
              <span className="block text-ink/60">
                {[c.service, c.shop, c.kind === 'souvenir' ? 'souvenir desk record' : null, c.method === 'supplier_nfc' ? 'tag' : 'QR', new Date(c.at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => remove(c)}
              className="rounded-lg border border-ink/20 px-3 py-1.5 text-sm text-ink hover:bg-ink/5 disabled:opacity-50"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
