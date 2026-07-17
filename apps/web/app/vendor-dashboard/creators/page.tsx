import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, BarChart3, Clapperboard, Send, Sparkles, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { SubmitButton } from '@/app/_components/submit-button';
import { isTierAtLeast } from '@/lib/vendor-tier-caps';
import { resolveVendorTier } from '@/lib/vendor-feature-gate';
import { VendorTierGate } from '../_components/tier-gate';
import { formatAudienceCount } from '@/lib/creator-audience';
import { CreatorTierChip } from '@/app/_components/creator-tier-chip';
import {
  fetchEligibleCreators,
  fetchVendorSentOffers,
  type EligibleCreator,
  type VendorSentOffer,
} from '@/lib/creator-offers';
import {
  fetchVendorCreatorRoi,
  type VendorCreatorRoiRow,
} from '@/lib/creator-analytics';
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

  // PRO-AND-UP (owner ratification decision #4, 2026-07-16 — Market Intel
  // precedent; supersedes P1's `tier != 'free'`). Unconditional like the RPC's
  // own TIER_BELOW_PRO_NO_REACH floor — a sub-Pro vendor sees the upsell, not
  // the browse. `custom` ranks above enterprise, so isTierAtLeast('pro')
  // admits pro/enterprise/custom exactly.
  const tier = await resolveVendorTier(supabase, profile.vendor_profile_id);
  if (!isTierAtLeast(tier, 'pro')) {
    return (
      <VendorTierGate
        feature="Creator collabs"
        requiredTier="pro"
        blurb="Browse Setnayan storytellers, offer them your promo for a credited feature inside a trusted story, and see the inquiries their chapters drive to you. You keep 100% of every booking."
        icon={<Clapperboard aria-hidden className="h-5 w-5" strokeWidth={1.75} />}
      />
    );
  }

  const minReach = Math.max(0, Number.parseInt(search.minReach ?? '0', 10) || 0);

  const [creators, sentOffers, roi] = await Promise.all([
    fetchEligibleCreators({ minReach, limit: 60 }),
    fetchVendorSentOffers(supabase, profile.vendor_profile_id),
    // P3 per-creator ROI — ledger facts only (inquiries driven · reach tokens
    // spent · collab status). NO "discount given" (settles off-platform).
    fetchVendorCreatorRoi(supabase, profile.vendor_profile_id),
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
          {/* Ratified vendor one-breath copy (simplest-approach verdict §6). */}
          Spend one token to offer a storyteller your promo — they publish their
          story crediting you for free, and anyone who books you through it gets
          the deal you chose. You keep 100%.
        </p>
      </header>

      {search.error ? (
        <FormFlash tone="error">{decodeURIComponent(search.error)}</FormFlash>
      ) : null}
      {search.sent ? (
        <FormFlash tone="success">
          Offer sent — 1 token spent; refunded only if no reply in 14 days.
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
                  <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] ${STATUS_STYLE[o.status]}`}
                    >
                      {STATUS_LABEL[o.status]}
                    </span>
                    {/* PR-C fulfillment state — fulfilled/unfulfilled + the
                        discount↔chapter link is the WHOLE outcome model (no
                        clawback): an unfulfilled collab is simply visible, and
                        you don't offer again. */}
                    {o.status === 'accepted' ? (
                      o.fulfilledAt ? (
                        <span className="rounded-full bg-success-100 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-success-800">
                          Fulfilled · chapter linked
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-amber-900">
                          Unfulfilled · awaiting chapter
                        </span>
                      )
                    ) : null}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Per-creator ROI (P3) — ledger facts for the creators you've collab'd
          with: the inquiries their chapters drove, the reach tokens you spent
          reaching them, and where each collab stands. NO "discount given" — that
          settles off-platform between you and the creator, so Setnayan can't
          (and won't) report it. Renders only once you've sent an offer. */}
      {roi.length > 0 ? (
        <section className="mb-10 space-y-3">
          <h2 className="sn-sec inline-flex items-center gap-2">
            <BarChart3 aria-hidden className="h-4 w-4 text-ink/50" strokeWidth={1.75} />
            Your collab ROI
          </h2>
          <p className="text-[12.5px] text-ink/55">
            Inquiries driven is each creator&rsquo;s all-time public number (the
            inquiries their chapters drove that a vendor unlocked). Reach tokens
            spent is what you paid to reach them. Discounts settle off-platform,
            so they&rsquo;re not shown here.
          </p>
          <div className="overflow-x-auto rounded-tile border border-ink/10 bg-white">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="border-b border-ink/10 bg-ink/[0.03] text-[11px] uppercase tracking-[0.12em] text-ink/55">
                <tr>
                  <th className="px-4 py-3 font-medium">Creator</th>
                  <th className="px-4 py-3 text-right font-medium">Inquiries driven</th>
                  <th className="px-4 py-3 text-right font-medium">Reach tokens spent</th>
                  <th className="px-4 py-3 font-medium">Collab</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/8">
                {roi.map((r) => (
                  <RoiRow key={r.creatorUserId} row={r} />
                ))}
              </tbody>
            </table>
          </div>
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
            {/* PR-C — the one influence metric; renders nothing at 0. */}
            {c.inquiriesDriven > 0 ? (
              <>
                {' · '}
                <span className="font-medium text-ink/80">
                  {formatAudienceCount(c.inquiriesDriven)}{' '}
                  {c.inquiriesDriven === 1 ? 'inquiry driven' : 'inquiries driven'}
                </span>
                {/* P3 tier band — a rendering of the number above (Nano/Micro/
                    Macro/Mega); hides at 0 alongside the line itself. */}
                <CreatorTierChip
                  inquiriesDriven={c.inquiriesDriven}
                  className="ml-1.5 align-middle"
                />
              </>
            ) : null}
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
              {/* LIVE as of PR-C: the Book CTA on chapters that credit you
                  shows these terms to viewers, and quoting an attributed
                  inquiry pre-labels the discount line "Viewer promo". */}
              <span className="block text-[11px] text-ink/55">
                Viewer promo — shown at the Book CTA on chapters that credit
                you; anyone booking through the chapter sees these terms.
              </span>
            </label>
            <p className="text-[11px] text-ink/50">
              {/* Ratified send-time token copy (verdict §3 "one line of copy"). */}
              1 token; refunded only if no reply in 14 days. Discounts settle
              off-platform — Setnayan never touches the money.
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

// ROI status chip reuses the sent-offer status vocabulary. An accepted +
// fulfilled collab reads "Fulfilled"; accepted-but-unfulfilled reads "Awaiting
// chapter" — the whole outcome model (no clawback).
function roiStatusLabel(row: VendorCreatorRoiRow): string {
  if (row.collabStatus === 'accepted') {
    return row.fulfilled ? 'Fulfilled · chapter linked' : 'Accepted · awaiting chapter';
  }
  return STATUS_LABEL[row.collabStatus];
}

function roiStatusStyle(row: VendorCreatorRoiRow): string {
  if (row.collabStatus === 'accepted' && !row.fulfilled) {
    return 'bg-amber-100 text-amber-900';
  }
  return STATUS_STYLE[row.collabStatus];
}

function RoiRow({ row }: { row: VendorCreatorRoiRow }) {
  return (
    <tr>
      <td className="px-4 py-3 align-top">
        <p className="text-sm font-medium text-ink">
          {row.creatorSlug ? (
            <Link href={`/u/${row.creatorSlug}`} className="hover:underline">
              {row.creatorName}
            </Link>
          ) : (
            row.creatorName
          )}
        </p>
      </td>
      <td className="px-4 py-3 text-right align-top">
        <span className="inline-flex items-center justify-end gap-1.5 font-mono text-sm tabular-nums text-ink">
          {formatAudienceCount(row.inquiriesDriven)}
          {/* Same tier band as the browse card + /u — a rendering of the number
              to its left; hides at 0. */}
          <CreatorTierChip inquiriesDriven={row.inquiriesDriven} />
        </span>
      </td>
      <td className="px-4 py-3 text-right align-top font-mono text-sm tabular-nums text-ink">
        {formatAudienceCount(row.reachTokensSpent)}
      </td>
      <td className="px-4 py-3 align-top">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] ${roiStatusStyle(row)}`}
        >
          {roiStatusLabel(row)}
        </span>
      </td>
    </tr>
  );
}
