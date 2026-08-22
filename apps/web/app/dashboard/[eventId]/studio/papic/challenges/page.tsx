/**
 * PICK YOUR GUESTS' CHALLENGES — a screen of its own.
 *
 * Owner, 2026-08-21: *"the need to have a real screen to pick their challenges
 * up to 20 challenges."*
 *
 * ── WHY IT LEFT THE PAPIC SETUP PAGE ────────────────────────────────────────
 * The picker started as a block near the bottom of `/studio/papic`, under the
 * camera ladder, the pool balance, the Drive connection and the seat list. That
 * was defensible for twenty story questions and is not defensible for 631: the
 * couple is CHOOSING here, one item at a time, comparing and searching, and a
 * choosing task buried under a settings page is a task people abandon.
 *
 * The setup page keeps a summary and a way in. Nothing was duplicated — the
 * list, the picker and the cost line MOVED.
 *
 * ── THE NUMBER IS THE POINT ─────────────────────────────────────────────────
 * Twenty. It is stated at the top, counted down as they pick, and the Add
 * buttons stop when it is reached. Before this, the couple's own lane was capped
 * at TEN while the board showed twenty: a couple who picked twelve got ten, and
 * the two that did not fit had no board position and no explanation anywhere.
 * Migration 20271155952591 lifts the ceiling; this screen is what makes it
 * legible.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { papicGamesEnabled } from '@/lib/papic-games-flag';
import { CoupleChallengesManager } from '../couple-challenges-manager';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Papic Challenges',
  // Not indexable and not shareable: this sits behind the couple's own login.
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ cq?: string; ccat?: string; ckind?: string; add?: string }>;
};

export default async function ChallengesPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;

  // The flag gates the whole Papic games feature. A route that renders an empty
  // shell when it is off is a door onto nothing; 404 is the honest answer.
  if (!papicGamesEnabled()) notFound();

  // ⚠ THE ROUTE IS NOT THE GATE — THE DATABASE IS. Everything this page renders
  // is read through the couple's own RLS-scoped client, so a stranger with the
  // URL sees nothing regardless of what happens here. This check exists to send
  // them somewhere useful rather than to an empty page.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/${eventId}/studio/papic/challenges`);

  return (
    <div className="sn-col py-6">
      {/* The way back is the only chrome. The page header pattern is retired
          (owner, 2026-08-21) — no title bar, no (i), just the action and the
          content. */}
      <Link
        href={`/dashboard/${eventId}/studio/papic`}
        className="inline-flex items-center gap-1.5 text-sm text-link underline-offset-2 hover:underline"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Papic
      </Link>

      {/* 🔑 A GUARD THAT REFUSES IN SILENCE IS INDISTINGUISHABLE FROM ONE THAT
          PASSED. The server action refuses an over-the-ceiling Add and an
          uncountable board; both write an outcome into the URL, and this is
          where somebody reads it. Without this the button would appear to do
          nothing — the failure mode that got three separate guards written in
          this repo already. */}
      {search.add === 'full' ? (
        <p className="mt-4 rounded-lg bg-ink/5 px-3 py-2 text-sm text-ink/75">
          That one didn&rsquo;t go on &mdash; your board is already full. Remove a
          challenge below and it will fit.
        </p>
      ) : null}
      {search.add === 'unavailable' ? (
        <p className="mt-4 rounded-lg bg-terracotta/10 px-3 py-2 text-sm text-terracotta-700">
          We couldn&rsquo;t check your board just now, so nothing was added. Try
          again in a moment &mdash; nothing has changed.
        </p>
      ) : null}

      <div className="mt-4">
        <CoupleChallengesManager eventId={eventId} search={search} standalone />
      </div>
    </div>
  );
}
