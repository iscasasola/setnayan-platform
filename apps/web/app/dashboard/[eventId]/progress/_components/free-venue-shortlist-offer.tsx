'use client';

/**
 * FreeVenueShortlistOffer — the free first-venue-shortlist card/CTA
 * (owner-locked 2026-07-09 · Pricing.md § 00 free-venue-assist carve-out).
 *
 * Framed as a free Setnayan-AI benefit introducing what Sai does: one tap
 * and Sai builds the couple's first reception-venue shortlist from real
 * marketplace matches (see `_actions/free-venue-shortlist.ts`). The parent
 * server page renders this ONLY while the venue shortlist is empty and the
 * viewer is in the free (non-AI) state, so the offer disappears on its own
 * once anything lands on the shortlist — the state records consumption.
 *
 * Two variants share the machinery:
 *   • 'card'   — standalone offer card atop the decisions board.
 *   • 'inline' — embedded under the venue decision item, when one renders.
 *
 * After a successful build it swaps to the confirmation + upsell beat and a
 * link into the venue bench (no auto-refresh — refreshing would unmount the
 * confirmation; the link lands on fresh data).
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/app/_components/badge';
import { InlineNotice } from '@/app/_components/notices/inline-notice';
import { NOTICE_ACTION } from '@/app/_components/notices/notice-styles';
import {
  FREE_VENUE_ASSIST_BADGE,
  FIRST_VENUE_SHORTLIST_OFFER_TITLE,
  FIRST_VENUE_SHORTLIST_OFFER_SUB,
  firstVenueShortlistUpsell,
  firstVenueShortlistConfirmation,
  freeVenueAssistBenchHref,
} from '@/lib/setnayan-ai-free-assist';
import { buildFirstVenueShortlist } from '../_actions/free-venue-shortlist';

type Phase =
  | { name: 'idle'; error?: string }
  | { name: 'done'; added: number }
  | { name: 'no_matches' }
  | { name: 'already' };

export function FreeVenueShortlistOffer({
  eventId,
  variant,
  fullSaiPhp,
  sell = true,
}: {
  eventId: string;
  variant: 'card' | 'inline';
  /**
   * This event's own Setnayan AI price, resolved SERVER-SIDE from
   * `platform_retail_catalog_v2` by the parent and handed down — never read or
   * guessed here. Optional on purpose: `undefined`/`null`/`0` means the catalog
   * could not be read or Sai is not sold for this event type (Tier E), and the
   * copy then omits the price instead of inventing one. This component is
   * `'use client'`, so it CANNOT resolve the price itself; that is the reason
   * the prop exists rather than a fetch.
   */
  fullSaiPhp?: number | null;
  /**
   * Whether this card may mention the PAID Sai at all. False in the App Store /
   * Play Store shell (guideline 3.1.1; lib/store-shell.ts): the free shortlist
   * is planning and stays, but "the full Sai is a one-time ₱…" — with or
   * without the figure — is an advert for a digital purchase the app cannot
   * sell. The parent decides server-side; default true keeps every other caller
   * unchanged.
   */
  sell?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const [working, startWorking] = useTransition();
  const benchHref = freeVenueAssistBenchHref(eventId);

  function run() {
    if (working) return;
    startWorking(async () => {
      const res = await buildFirstVenueShortlist(eventId);
      if (res.status === 'ok') setPhase({ name: 'done', added: res.added });
      else if (res.status === 'already_has_shortlist') setPhase({ name: 'already' });
      else if (res.status === 'no_matches') setPhase({ name: 'no_matches' });
      else if (res.status === 'not_signed_in')
        setPhase({ name: 'idle', error: 'Please sign in again to continue.' });
      else setPhase({ name: 'idle', error: res.message });
    });
  }

  // 📐 DESIGN TEMPLATE (14 Nov 2026, rules 2 · 5 · 13 · 14): what the offer ANSWERS is a plain block — the shared soft
  // chip, the line, a 13 px door with a › at the 44 px floor — never a tinted bordered card or a gradient-ruled tile.
  const badge = <Badge tone="quiet">✦ {FREE_VENUE_ASSIST_BADGE}</Badge>;

  const benchLink = (label: string) => (
    <Link href={benchHref} className="inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-terracotta-700 hover:underline">
      {label} <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
    </Link>
  );

  let body: React.ReactNode;
  if (phase.name === 'done') {
    body = (
      <>
        <p className="text-[13.5px] leading-relaxed text-ink/80">
          <span aria-hidden className="mr-1 text-terracotta">
            ✦
          </span>
          {firstVenueShortlistConfirmation(phase.added, fullSaiPhp, { sell })}
        </p>
        <div className="mt-2">{benchLink('See your venue shortlist')}</div>
      </>
    );
  } else if (phase.name === 'already') {
    body = (
      <>
        <p className="text-[13.5px] leading-relaxed text-ink/80">
          You already have venues on your shortlist — Sai&rsquo;s free first
          shortlist has been used.
        </p>
        <div className="mt-2">{benchLink('Open your venue shortlist')}</div>
      </>
    );
  } else if (phase.name === 'no_matches') {
    body = (
      <>
        <p className="text-[13.5px] leading-relaxed text-ink/80">
          Sai couldn&rsquo;t find matching reception venues just yet — browse
          the venue category and save your favorites instead.
        </p>
        <div className="mt-2">{benchLink('Browse reception venues')}</div>
      </>
    );
  } else {
    // 🔔 Inventory #29 — an OFFER (a free deal) in the one notice system (owner approved 14 Nov 2026), drawn where it
    // stands: ◆ the offer · Build my venue shortlist · Not now (back after 30 days). The sub-line and the paid-Sai
    // line (never in the app shell) are behind the ⓘ. What it ANSWERS (done / already / no matches) is not a notice.
    return (
      <InlineNotice
        kind="offer"
        noticeKey={`ai-venue-shortlist:${eventId}`}
        title={FIRST_VENUE_SHORTLIST_OFFER_TITLE}
        detail={
          <>
            <span className="block">{FIRST_VENUE_SHORTLIST_OFFER_SUB}</span>
            {sell ? <span className="mt-1 block">{firstVenueShortlistUpsell(fullSaiPhp)}</span> : null}
            {phase.name === 'idle' && phase.error ? <span className="mt-1 block text-danger-700">{phase.error}</span> : null}
          </>
        }
        actions={
          <>
            <button type="button" onClick={run} disabled={working} className={NOTICE_ACTION}>
              {working ? 'Sai is looking…' : 'Build my venue shortlist'}
            </button>
            <Link href={benchHref} className={NOTICE_ACTION}>
              Browse on your own
            </Link>
          </>
        }
        className={variant === 'inline' ? 'mt-2.5' : ''}
      />
    );
  }

  if (variant === 'inline') {
    return (
      <div className="mt-2.5 space-y-1">
        {badge}
        {body}
      </div>
    );
  }
  return (
    <div className="space-y-1 py-2">
      {badge}
      {body}
    </div>
  );
}
