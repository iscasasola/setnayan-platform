import Link from 'next/link';
import { ArrowUpRight, BadgePercent, Handshake, Store } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  fetchActiveCreatorCollabs,
  type ActiveCreatorCollab,
} from '@/lib/creator-offers';
import { fetchCreatorInquiriesDriven } from '@/lib/inquiry-attribution';
import { formatAudienceCount } from '@/lib/creator-audience';
import { ShopLogo } from './shop-logo';

/**
 * "Your creator benefits" — the user-home block for a storyteller who ALREADY
 * holds active vendor collabs (owner req #6, plan 2026-07-16; un-deferred from
 * the simplest-approach verdict §2 item 7 with a PER-USER gate). Two parts:
 *
 *   (a) ACTIVE OFFERS — the accepted vendor_creator_offers this user holds as
 *       the creator: vendor (logo + name) + the creator-rate terms THIS vendor
 *       offered them. A door into the offers inbox (/dashboard/creator#offers).
 *   (b) PERFORMANCE — the SAME reach numbers their /u profile shows: followers,
 *       views, and "inquiries driven" (reusing fetchCreatorInquiriesDriven — no
 *       refork). Followers + views always render; inquiries-driven only when >0
 *       (matching /u — no fake influence).
 *
 * GATE (owner-ratified): the whole block renders ONLY once this user has ≥1
 * ACTIVE (accepted) collab. Zero → returns null (the "Become a Storyteller"
 * promo already covers non-creators). Self-fetching + null-returning so the
 * launcher pays one lean RLS-scoped query for the 99% of users with no collab.
 *
 * LOCKS honored: deterministic only (no LLM, no per-call cost — Setnayan-AI
 * Rule 1); these are DISCOUNT benefits the vendor settles off-platform, so the
 * copy says "offers"/"benefits", NEVER "earnings" or cash; no content
 * suggestions / coaching (permanently cut by the council); RLS-scoped to the
 * user's own collabs.
 */
export async function CreatorBenefits({ userId }: { userId: string }) {
  const supabase = await createClient();

  // The gate IS this query — [] for the vast majority, so the block is invisible
  // until a real benefit exists. RLS-scoped to offers addressed to this creator.
  let collabs: ActiveCreatorCollab[] = [];
  try {
    collabs = await fetchActiveCreatorCollabs(supabase, userId);
  } catch {
    return null; // graceful-degrade: never break the launcher for a benefits tile
  }
  if (collabs.length === 0) return null;

  // Performance — only computed now that we KNOW this is a real creator. The
  // followers/views are the same aggregate columns /u reads; inquiries-driven
  // reuses the /u resolver (no refork). All best-effort → 0.
  let followers = 0;
  let views = 0;
  try {
    const { data } = await supabase
      .from('users')
      .select('followers_count, profile_view_count')
      .eq('user_id', userId)
      .maybeSingle();
    followers = (data?.followers_count as number | null) ?? 0;
    views = (data?.profile_view_count as number | null) ?? 0;
  } catch {
    /* best-effort — the performance line degrades to zeros */
  }
  let inquiriesDriven = 0;
  try {
    inquiriesDriven = await fetchCreatorInquiriesDriven(userId);
  } catch {
    inquiriesDriven = 0;
  }

  const shown = collabs.slice(0, 4);
  const more = collabs.length - shown.length;

  return (
    <div className="sn-tile-glass sn-lift-3 sn-reveal rounded-2xl p-4 sm:p-[18px]">
      <p className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[color:var(--sn-gold-700)]">
        <BadgePercent aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Your creator benefits
      </p>

      {/* (a) ACTIVE OFFERS — accepted vendor collabs (the creator rate they
          hold). Off-platform discounts, never earnings. */}
      <p className="mb-0.5 mt-[13px] flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sn-ink-400)]">
        <Handshake aria-hidden className="h-3 w-3" strokeWidth={1.75} />
        {collabs.length} active vendor {collabs.length === 1 ? 'offer' : 'offers'}
      </p>
      <ul className="mt-1 divide-y divide-ink/[0.07]">
        {shown.map((c) => (
          <CollabRow key={c.offerId} collab={c} />
        ))}
      </ul>
      <Link
        href="/dashboard/creator#offers"
        className="sn-press group mt-2 -mx-2 flex items-center gap-2 rounded-xl px-2 py-2 text-xs font-bold text-[color:var(--sn-gold-700)] transition-[background-color,transform] hover:translate-x-0.5 hover:bg-white/70"
      >
        {more > 0 ? `View all ${collabs.length} in your offers inbox` : 'Open your offers inbox'}
        <ArrowUpRight
          aria-hidden
          className="h-[15px] w-[15px] shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        />
      </Link>

      {/* (b) PERFORMANCE — the SAME reach the /u profile shows (followers ·
          views · inquiries driven). Deterministic aggregates, not an LLM. */}
      <div className="mt-[13px] border-t border-ink/[0.08] pt-3">
        <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sn-ink-400)]">
          Your reach for vendors
        </p>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[12.5px] text-[color:var(--sn-ink-500)]">
          <span>
            <span className="font-mono font-bold text-ink">
              {formatAudienceCount(followers)}
            </span>{' '}
            {followers === 1 ? 'follower' : 'followers'}
          </span>
          <span>
            <span className="font-mono font-bold text-ink">
              {formatAudienceCount(views)}
            </span>{' '}
            {views === 1 ? 'view' : 'views'}
          </span>
          {/* Renders NOTHING at 0 — no fabricated influence (matches /u). */}
          {inquiriesDriven > 0 ? (
            <span>
              <span className="font-mono font-bold text-ink">
                {formatAudienceCount(inquiriesDriven)}
              </span>{' '}
              {inquiriesDriven === 1 ? 'inquiry driven' : 'inquiries driven'}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** One accepted-collab row — vendor logo/glyph · name · the creator rate they
 *  were offered. The vendor name links to /v/[slug] when public; the rate is a
 *  plain off-platform discount note, never a money primitive. */
function CollabRow({ collab: c }: { collab: ActiveCreatorCollab }) {
  return (
    <li className="flex items-center gap-[11px] py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[color:var(--sn-gold-100)] text-[color:var(--sn-gold-700)]">
        {c.vendorLogoUrl ? (
          <ShopLogo
            src={c.vendorLogoUrl}
            fallback={<Store className="h-[18px] w-[18px]" />}
          />
        ) : (
          <Store className="h-[18px] w-[18px]" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        {c.vendorSlug ? (
          <Link
            href={`/v/${c.vendorSlug}`}
            className="block truncate text-sm font-bold text-ink hover:underline"
          >
            {c.vendorName}
          </Link>
        ) : (
          <span className="block truncate text-sm font-bold text-ink">
            {c.vendorName}
          </span>
        )}
        <span className="block truncate text-xs text-ink/55">
          <span className="font-medium text-ink/70">Your rate:</span>{' '}
          {c.creatorRateTerms}
        </span>
      </span>
    </li>
  );
}
