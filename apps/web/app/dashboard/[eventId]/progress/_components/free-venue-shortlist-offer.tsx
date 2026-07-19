'use client';

/**
 * FreeVenueShortlistOffer — the free first-venue-shortlist card/CTA
 * (owner-locked 2026-07-09 · Pricing.md § 00 free-venue-assist carve-out).
 *
 * Framed as a free Setnayan-AI benefit introducing what Suri does: one tap
 * and Suri builds the couple's first reception-venue shortlist from real
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
import {
  FREE_VENUE_ASSIST_BADGE,
  FIRST_VENUE_SHORTLIST_OFFER_TITLE,
  FIRST_VENUE_SHORTLIST_OFFER_SUB,
  FIRST_VENUE_SHORTLIST_UPSELL,
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
}: {
  eventId: string;
  variant: 'card' | 'inline';
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

  const badge = (
    <span className="inline-flex items-center gap-1 rounded-full bg-mulberry/10 px-2.5 py-0.5 text-[11px] font-bold text-mulberry">
      <span aria-hidden className="text-terracotta">
        ✦
      </span>
      {FREE_VENUE_ASSIST_BADGE}
    </span>
  );

  const benchLink = (label: string) => (
    <Link href={benchHref} className="text-[12.5px] font-bold text-mulberry">
      {label} →
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
          {firstVenueShortlistConfirmation(phase.added)}
        </p>
        <div className="mt-2">{benchLink('See your venue shortlist')}</div>
      </>
    );
  } else if (phase.name === 'already') {
    body = (
      <>
        <p className="text-[13.5px] leading-relaxed text-ink/80">
          You already have venues on your shortlist — Suri&rsquo;s free first
          shortlist has been used.
        </p>
        <div className="mt-2">{benchLink('Open your venue shortlist')}</div>
      </>
    );
  } else if (phase.name === 'no_matches') {
    body = (
      <>
        <p className="text-[13.5px] leading-relaxed text-ink/80">
          Suri couldn&rsquo;t find matching reception venues just yet — browse
          the venue category and save your favorites instead.
        </p>
        <div className="mt-2">{benchLink('Browse reception venues')}</div>
      </>
    );
  } else {
    body = (
      <>
        <p className="m-serif mt-1.5 text-lg leading-snug text-ink">
          {FIRST_VENUE_SHORTLIST_OFFER_TITLE}
        </p>
        <p className="mt-1 max-w-[58ch] text-[13px] text-ink/60">
          {FIRST_VENUE_SHORTLIST_OFFER_SUB}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={working}
            className="rounded-full bg-gradient-to-r from-mulberry-700 to-mulberry px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60"
          >
            {working ? 'Suri is looking…' : 'Build my venue shortlist'}
          </button>
          {benchLink('Browse on your own')}
        </div>
        {phase.error ? (
          <p role="alert" className="mt-2 text-[12.5px] text-mulberry">
            {phase.error}
          </p>
        ) : null}
        <p className="mt-2 text-[11.5px] text-ink/45">
          {FIRST_VENUE_SHORTLIST_UPSELL}
        </p>
      </>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="mt-2.5 rounded-xl border border-terracotta/40 bg-terracotta/[0.06] px-3.5 py-3">
        {badge}
        {body}
      </div>
    );
  }
  return (
    <div className="m-card relative overflow-hidden border-terracotta/50 px-5 py-4">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-terracotta to-transparent"
      />
      {badge}
      {body}
    </div>
  );
}
