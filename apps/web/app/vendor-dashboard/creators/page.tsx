import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Clapperboard, Send, Sparkles, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { SubmitButton } from '@/app/_components/submit-button';
import { formatAudienceCount } from '@/lib/creator-audience';
import {
  fetchEligibleCreators,
  fetchVendorSentOffers,
  type EligibleCreator,
  type VendorSentOffer,
} from '@/lib/creator-offers';
import { sendCreatorOffer } from './actions';

export const metadata = { title: 'Creators · Vendor' };
export const dynamic = 'force-dynamic';

type SearchParams = {
  sent?: string;
  minReach?: string;
  error?: string;
};

const STATUS_STYLE: Record<VendorSentOffer['status'], string> = {
  pending: 'bg-amber-100 text-amber-900',
  accepted: 'bg-success-100 text-success-800',
  declined: 'bg-ink/[0.06] text-ink/60',
  expired: 'bg-ink/[0.06] text-ink/50',
};

const STATUS_LABEL: Record<VendorSentOffer['status'], string> = {
  pending: 'Awaiting response',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired · token refunded',
};

export default async function VendorCreatorsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const minReach = Math.max(0, Number.parseInt(search.minReach ?? '0', 10) || 0);

  const [creators, sentOffers] = await Promise.all([
    fetchEligibleCreators({ minReach, limit: 60 }),
    fetchVendorSentOffers(supabase, profile.vendor_profile_id),
  ]);

  // Creators this vendor already has an OUTSTANDING (pending) offer to — hide
  // the send form for them (the DB also enforces one-pending-per-pair).
  const pendingCreatorIds = new Set(
    sentOffers.filter((o) => o.status === 'pending').map((o) => o.creatorUserId),
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/vendor-dashboard/shop" className="sn-chip sn-press mb-4 w-fit">
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Back to My Shop
      </Link>

      <header className="mb-6 space-y-2">
        <p className="sn-eye">
          <Clapperboard aria-hidden strokeWidth={1.75} />
          Grow · Creator collabs
        </p>
        <h1 className="sn-h1">Creators</h1>
        <p className="text-base text-ink/65">
          Offer a discount to a creator — a Setnayan account telling their story
          in published chapters — and earn a credited feature inside a trusted
          story. Sending an offer spends a{' '}
          <span className="font-medium text-ink/80">reach token</span> (held, and
          refunded automatically if they don’t respond). You keep 100% of any
          booking — the discount settles off-platform between you two.
        </p>
      </header>

      {search.error ? (
        <FormFlash tone="error">{decodeURIComponent(search.error)}</FormFlash>
      ) : null}
      {search.sent ? (
        <FormFlash tone="success">
          Offer sent — a reach token is held until the creator responds.
        </FormFlash>
      ) : null}

      {/* Reach bar */}
      <section className="sn-tile mb-8">
        <form method="GET" className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="block text-xs font-medium text-ink">
              Minimum followers
            </span>
            <input
              type="number"
              name="minReach"
              min={0}
              defaultValue={minReach || ''}
              placeholder="e.g. 500"
              className="input-field w-40"
            />
          </label>
          <SubmitButton
            className="button-secondary inline-flex items-center gap-2"
            pendingLabel="Filtering…"
          >
            <Users aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Set reach bar
          </SubmitButton>
        </form>
      </section>

      {/* Sent offers */}
      {sentOffers.length > 0 ? (
        <section className="mb-10 space-y-3">
          <h2 className="sn-sec">Your offers ({sentOffers.length})</h2>
          <ul className="space-y-3">
            {sentOffers.map((o) => (
              <li key={o.offerId} className="sn-row p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-ink">
                      {o.creatorSlug ? (
                        <Link
                          href={`/u/${o.creatorSlug}`}
                          className="hover:underline"
                        >
                          {o.creatorName}
                        </Link>
                      ) : (
                        o.creatorName
                      )}
                    </p>
                    <p className="text-[12.5px] text-ink/70">
                      Creator rate: {o.creatorRateTerms}
                    </p>
                    {o.audienceRateTerms ? (
                      <p className="text-[12.5px] text-ink/60">
                        Audience rate: {o.audienceRateTerms}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] ${STATUS_STYLE[o.status]}`}
                  >
                    {STATUS_LABEL[o.status]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Eligible creators */}
      <section className="space-y-3">
        <h2 className="sn-sec">
          Eligible creators ({creators.length})
          {minReach > 0 ? ` · ${formatAudienceCount(minReach)}+ followers` : ''}
        </h2>
        {creators.length === 0 ? (
          <div className="sn-tile border-dashed p-8 text-center">
            <Clapperboard
              aria-hidden
              className="mx-auto mb-2 h-6 w-6 text-ink/30"
              strokeWidth={1.5}
            />
            <p className="text-sm text-ink/55">
              No creators match{minReach > 0 ? ' this reach bar' : ' yet'}. A
              creator is any account with a published chapter on a public
              profile.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {creators.map((c) => (
              <li key={c.userId}>
                <CreatorCard
                  creator={c}
                  hasPending={pendingCreatorIds.has(c.userId)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CreatorCard({
  creator: c,
  hasPending,
}: {
  creator: EligibleCreator;
  hasPending: boolean;
}) {
  return (
    <div className="sn-tile space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            {c.slug ? (
              <Link href={`/u/${c.slug}`} className="hover:underline">
                {c.displayName}
              </Link>
            ) : (
              c.displayName
            )}
          </p>
          <p className="mt-0.5 text-[12px] text-ink/60">
            {formatAudienceCount(c.followersCount)}{' '}
            {c.followersCount === 1 ? 'follower' : 'followers'} ·{' '}
            {formatAudienceCount(c.viewCount)} views · {c.chapterCount}{' '}
            {c.chapterCount === 1 ? 'chapter' : 'chapters'}
          </p>
        </div>
      </div>

      {hasPending ? (
        <p className="rounded-tile border border-dashed border-ink/15 p-2.5 text-[12px] text-ink/55">
          Offer pending — waiting for their response.
        </p>
      ) : (
        <details className="group">
          <summary className="button-secondary inline-flex cursor-pointer items-center gap-2 text-xs">
            <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Send a discount offer
          </summary>
          <form action={sendCreatorOffer} className="mt-3 space-y-3">
            <input type="hidden" name="creator_user_id" value={c.userId} />
            <label className="block space-y-1">
              <span className="block text-[11px] font-medium text-ink">
                Creator rate (their own booking) — required
              </span>
              <input
                name="creator_rate_terms"
                required
                maxLength={280}
                placeholder="e.g. 20% off any package for you"
                className="input-field"
              />
            </label>
            <label className="block space-y-1">
              <span className="block text-[11px] font-medium text-ink">
                Audience rate (your viewers) — optional
              </span>
              <input
                name="audience_rate_terms"
                maxLength={280}
                placeholder="e.g. 10% off for anyone booking through your chapter"
                className="input-field"
              />
            </label>
            <p className="text-[11px] text-ink/50">
              Sending spends 1 reach token (held until they respond; refunded if
              they don’t). Discounts settle off-platform — Setnayan never touches
              the money.
            </p>
            <SubmitButton
              className="button-primary inline-flex items-center gap-2"
              pendingLabel="Sending…"
            >
              <Send aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Send offer
            </SubmitButton>
          </form>
        </details>
      )}
    </div>
  );
}
