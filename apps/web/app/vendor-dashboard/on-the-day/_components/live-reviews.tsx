'use client';

import { useEffect, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { ReviewWithCouple } from '@/lib/reviews';

/**
 * LIVE review feed for the launched day-of console. Subscribes to the base
 * table `public.vendor_reviews` filtered to this vendor's profile (the matview
 * only refreshes on write, so we subscribe to the base table per the council
 * ruling) and prepends new / updates existing reviews as they land.
 *
 * Vendor-private, READ-ONLY, post-completion — reviews are already gated to the
 * couple/coordinator of a booked+completed event by RLS, so this feed can only
 * ever show genuine host verdicts. It is deliberately NOT a public volume
 * leaderboard. Offline-tolerant via the shipped channel + reconcile-timer
 * pattern (wall-projection / chat-message-stream): a ~15s poll backstops any
 * dropped realtime event.
 */
export function LiveReviews({
  vendorProfileId,
  initial,
}: {
  vendorProfileId: string;
  initial: ReviewWithCouple[];
}) {
  const [reviews, setReviews] = useState<ReviewWithCouple[]>(initial);
  const [live, setLive] = useState(false);
  const seen = useRef<Set<string>>(new Set(initial.map((r) => r.review_id)));

  useEffect(() => {
    const supabase = createClient();

    async function reconcile() {
      const { data } = await supabase
        .from('vendor_reviews')
        .select('*')
        .eq('vendor_profile_id', vendorProfileId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (!data) return;
      setReviews((prev) => {
        const byId = new Map(prev.map((r) => [r.review_id, r]));
        for (const row of data as ReviewWithCouple[]) {
          seen.current.add(row.review_id);
          byId.set(row.review_id, { ...byId.get(row.review_id), ...row });
        }
        return [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
      });
    }

    const channel = supabase
      .channel(`vendor-reviews-${vendorProfileId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vendor_reviews',
          filter: `vendor_profile_id=eq.${vendorProfileId}`,
        },
        () => {
          // The realtime payload lacks the joined couple name; reconcile fetches
          // the full row set (cheap — a vendor has few reviews).
          void reconcile();
        },
      )
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));

    // Reconcile timer — backstops any dropped realtime event on weak venue signal.
    const timer = setInterval(reconcile, 15_000);

    return () => {
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [vendorProfileId]);

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h2 className="sn-sec">Reviews, as they land</h2>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{
            background: live ? 'var(--sn-success-soft)' : 'var(--m-line-soft)',
            color: live ? 'var(--sn-success)' : 'var(--m-slate-3)',
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: live ? 'var(--sn-success)' : 'var(--m-slate-3)' }}
          />
          {live ? 'Live' : 'Syncing'}
        </span>
      </div>

      {reviews.length === 0 ? (
        <p className="sn-tile mt-3 text-sm" style={{ color: 'var(--m-slate-2)' }}>
          No reviews yet. When your couple confirms delivery and rates this booking, it appears here
          instantly.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {reviews.map((r) => (
            <li key={r.review_id} className="sn-tile">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
                  {r.couple_display_name ?? 'A couple'}
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-sm" style={{ color: 'var(--m-ink)' }}>
                  <Star aria-hidden className="h-3.5 w-3.5" style={{ color: 'var(--m-gold, #b8860b)' }} strokeWidth={1.75} />
                  {r.rating_overall.toFixed(1)}
                </span>
              </div>
              {r.body ? (
                <p className="mt-1.5 text-sm" style={{ color: 'var(--m-slate-2)' }}>
                  {r.body}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
