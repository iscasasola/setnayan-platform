import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Star } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

// Iteration 0011 — Panood feature reviews list (App Store-style Ratings &
// Reviews deep-link).
//
// Reads from the public.feature_reviews table introduced in
// 20260517000000_feature_reviews.sql. Anyone with the URL can read; the
// write surface (post-event review submission) ships in a follow-up
// once we have a meaningful number of paid Panood orders.

export const metadata = { title: 'Panood reviews · Setnayan' };

type Props = { params: Promise<{ eventId: string }> };

type ReviewRow = {
  public_id: string;
  rating: number;
  body: string | null;
  created_at: string;
};

const FEATURE_KEY = 'panood';

export default async function PanoodReviewsPage({ params }: Props) {
  const { eventId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase
    .from('events')
    .select('event_id')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) notFound();

  const { data: rowsRaw } = await supabase
    .from('feature_reviews')
    .select('public_id, rating, body, created_at')
    .eq('feature_key', FEATURE_KEY)
    .order('created_at', { ascending: false })
    .limit(100);
  const rows = (rowsRaw ?? []) as ReviewRow[];

  const reviewCount = rows.length;
  const avgRating =
    reviewCount === 0 ? null : rows.reduce((s, r) => s + r.rating, 0) / reviewCount;

  // Star-distribution histogram (5★ first, 1★ last).
  const distribution: { stars: 1 | 2 | 3 | 4 | 5; count: number }[] = [
    { stars: 5, count: 0 },
    { stars: 4, count: 0 },
    { stars: 3, count: 0 },
    { stars: 2, count: 0 },
    { stars: 1, count: 0 },
  ];
  for (const r of rows) {
    const bucket = distribution.find((d) => d.stars === r.rating);
    if (bucket) bucket.count += 1;
  }

  return (
    <section className="space-y-8">
      <Link
        href={`/dashboard/${eventId}/add-ons/panood`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to Panood
      </Link>

      <header className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-terracotta">
          Panood · ratings &amp; reviews
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          What couples say about Panood
        </h1>
        <p className="max-w-prose text-sm text-ink/65 sm:text-base">
          Reviews come from couples who used Panood on their wedding. We open the write
          form post-event once your broadcast archive is delivered.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
              Average rating
            </p>
            <p className="mt-1 flex items-baseline gap-2 text-4xl font-semibold tracking-tight text-ink">
              {avgRating === null ? '—' : avgRating.toFixed(1)}
              <span className="text-sm font-normal text-ink/55">out of 5</span>
            </p>
            <p className="mt-1 text-xs text-ink/55">
              {reviewCount === 0
                ? 'No reviews yet — Panood just launched'
                : `Based on ${reviewCount} review${reviewCount === 1 ? '' : 's'}`}
            </p>
          </div>
          <div className="flex-1 min-w-[16rem] space-y-1">
            {distribution.map((d) => {
              const pct = reviewCount === 0 ? 0 : (d.count / reviewCount) * 100;
              return (
                <div key={d.stars} className="flex items-center gap-2 text-xs">
                  <span className="flex w-6 items-center gap-0.5 font-mono text-ink/55">
                    {d.stars}
                    <Star aria-hidden className="h-3 w-3 fill-amber-500 text-amber-500" />
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/5">
                    <div
                      className="h-full rounded-full bg-amber-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-6 text-right font-mono text-ink/55">{d.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {reviewCount === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/15 bg-cream/60 p-6 text-center">
          <p className="text-sm text-ink/70">
            Be one of the first couples to broadcast with Panood — the review form opens
            after your event.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.public_id}
              className="space-y-2 rounded-2xl border border-ink/10 bg-cream p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-0.5 text-amber-500">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      aria-hidden
                      className={
                        s <= r.rating
                          ? 'h-4 w-4 fill-current'
                          : 'h-4 w-4 stroke-current opacity-30'
                      }
                      strokeWidth={1.5}
                    />
                  ))}
                </span>
                <time
                  dateTime={r.created_at}
                  className="font-mono text-[11px] text-ink/55"
                >
                  {new Date(r.created_at).toLocaleDateString('en-PH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </time>
              </div>
              {r.body ? <p className="text-sm text-ink/75">{r.body}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
