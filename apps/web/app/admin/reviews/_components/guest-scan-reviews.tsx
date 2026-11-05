'use client';

import { useState, useTransition } from 'react';
import type { AdminScanReview } from '@/lib/supplier-scan.server';
import { supplierScan } from '@/app/_actions/supplier-scan-actions';

/**
 * ⭐ Admin › Reviews › Guests' ratings from the scanner (supplier claim scanner, slice 5; DECISION_LOG 2026-09-25
 * "…AN OPTIONAL REVIEW CAN POP UP ON THEIR EVENT HUB" — "guest reviews are NEW and need their own store + admin
 * moderation (reuse admin/reviews)"). Publish or Hide each — audited. Published reaches the supplier's public page in its own
 * "Guest ratings" section, apart from the couple reviews (owner 2026-11-05: "separate"); Hide takes it back off.
 */
export function GuestScanReviews({ reviews }: { reviews: AdminScanReview[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const set = (id: string, state: 'published' | 'hidden') => {
    setError(null);
    start(async () => {
      const reply = await supplierScan({ op: 'admin_review', reviewId: id, state });
      // The action revalidates Admin › Reviews itself — its answer carries the new render.
      if (!(reply.op === 'admin_review' && reply.result.ok)) setError(reply.op === 'admin_review' ? (reply.result.error ?? 'Couldn’t save.') : 'Couldn’t save.');
    });
  };
  return (
    <>
      {error ? (
        <p role="alert" className="text-sm text-mulberry">
          {error}
        </p>
      ) : null}
      <ul className="divide-y divide-ink/10">
        {reviews.map((r) => (
          <li key={r.reviewId} className="space-y-1 py-3 text-xs text-ink/70" data-guest-scan-review={r.state}>
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/60">
              {'★'.repeat(r.stars)} · {r.service}
              {r.shop ? ` · ${r.shop}` : ''}
              {r.eventName ? ` · ${r.eventName}` : ''} · {r.at.slice(0, 10)} · {r.state}
            </p>
            {r.line ? <p className="text-sm text-ink">&ldquo;{r.line}&rdquo;</p> : null}
            <div className="flex gap-2 pt-1">
              {r.state !== 'published' ? (
                <button type="button" disabled={pending} onClick={() => set(r.reviewId, 'published')} className="rounded-lg border border-ink/20 px-3 py-1.5 text-sm text-ink hover:bg-ink/5 disabled:opacity-50">
                  Publish
                </button>
              ) : null}
              {r.state !== 'hidden' ? (
                <button type="button" disabled={pending} onClick={() => set(r.reviewId, 'hidden')} className="rounded-lg border border-ink/20 px-3 py-1.5 text-sm text-ink hover:bg-ink/5 disabled:opacity-50">
                  Hide
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
