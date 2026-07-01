import { notFound, redirect } from 'next/navigation';
import { Heart, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ReviewForm } from './_components/review-form';

/**
 * Couple review surface (admin account-access model PR 3). The landing page for
 * the admin-requested "we'd love your review" notification (review_request).
 * Shows a star-form unless the couple already reviewed this feature_key (then a
 * warm thank-you). The default feature_key is a general SETNAYAN_EXPERIENCE
 * review — what a gifted couple is asked for.
 */
const FEATURE_LABEL: Record<string, string> = {
  SETNAYAN_EXPERIENCE: 'your Setnayan experience',
};

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ feature?: string; submitted?: string }>;
}) {
  const { eventId } = await params;
  const sp = await searchParams;
  const featureKey = (sp.feature ?? 'SETNAYAN_EXPERIENCE').slice(0, 64);
  const justSubmitted = sp.submitted === '1';
  const label = FEATURE_LABEL[featureKey] ?? 'your Setnayan experience';

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

  const { data: existing } = await supabase
    .from('feature_reviews')
    .select('review_id')
    .eq('feature_key', featureKey)
    .eq('event_id', eventId)
    .eq('couple_user_id', user.id)
    .maybeSingle();

  const done = justSubmitted || !!existing;

  return (
    <div className="mx-auto max-w-md px-4 py-10 text-center">
      <span className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 text-gold">
        {done ? (
          <Heart aria-hidden className="h-7 w-7 text-mulberry" strokeWidth={1.5} />
        ) : (
          <Sparkles aria-hidden className="h-7 w-7" strokeWidth={1.5} />
        )}
      </span>

      {done ? (
        <>
          <h1 className="mb-2 font-serif text-2xl text-ink">Thank you</h1>
          <p className="text-sm leading-relaxed text-ink/70">
            Your review means a lot to the Setnayan Team. Wishing you a beautiful wedding.
          </p>
        </>
      ) : (
        <>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-gold">
            A note from the Setnayan Team
          </p>
          <h1 className="mb-2 font-serif text-2xl text-ink">How’s it going?</h1>
          <p className="mb-6 text-sm leading-relaxed text-ink/70">
            We’d love to hear how {label} is helping with your wedding.
          </p>
          <div className="rounded-2xl border border-gold/30 bg-cream p-6 text-left">
            <ReviewForm eventId={eventId} featureKey={featureKey} />
          </div>
        </>
      )}
    </div>
  );
}
