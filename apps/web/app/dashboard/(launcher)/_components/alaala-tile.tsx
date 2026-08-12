import Link from 'next/link';
import { Play, Sparkles } from 'lucide-react';

import { getMomentGraphForWall } from '@/lib/alaala-wall-data';
import { lifeFlashSummaryLine } from '@/lib/life-story-summary-line';
import { orbBackground } from '../../(account)/life-flash/_components/placeholder';

/**
 * AlaalaTile — the obsidian focal tile of the four-surface home (owner-approved
 * final design 2026-07-15; the prototype's "ALAALA · LIFE-FLASH" panel).
 *
 * The tile carries LIFE-FLASH: the headline, the face row, the who-line and the
 * Play affordance. That is its whole job.
 *
 * ── THE LENSES LEFT THIS TILE (2026-08-13) ─────────────────────────────────
 * The five lenses (Recent · Owned · Attended · People · With me) used to live
 * in a 64px slot at the bottom of this tile, `sm:` and up only. A slot that
 * size can hold a sentence, so every lens answered with a sentence — and
 * "Owned" answered with a bulleted LIST OF EVENT NAMES. That is what made
 * Alaala read as a second list of events; the board is the list of events.
 * They now own the full width beneath this tile, over real photographs, on
 * every screen size: `_components/alaala-wall.tsx`.
 *
 * Flag behavior:
 *  - `lifeOn` (NEXT_PUBLIC_LIFE_STORY): when ON, the moment-graph summary is
 *    fetched (graceful degrade) and "Play Life-Flash" links to
 *    /dashboard/life-flash. When OFF, the fetch is skipped entirely (no new
 *    query on the busiest authed page) and the Play button is omitted — the
 *    tile shows the honest invite copy, no dead door (/dashboard/life-flash
 *    404s while the flag is off).
 *
 * Async server component — mount behind Suspense with <AlaalaTileSkeleton/>.
 */

const MAX_FACES = 5;

export function AlaalaTileSkeleton() {
  return (
    <div
      aria-hidden
      className="h-[15rem] animate-pulse rounded-2xl border border-white/10 bg-ink/90"
    />
  );
}

export async function AlaalaTile({
  userId,
  lifeOn,
}: {
  userId: string;
  lifeOn: boolean;
}) {
  let momentCount = 0;
  let peopleCount = 0;
  let faces: Array<{ personId: string; displayName: string; inMemoriam: boolean }> =
    [];

  if (lifeOn) {
    try {
      // Request-scoped: the wall below asks for the same graph and both get one
      // fetch. Two components deriving the same faces from two reads is how a
      // surface ends up disagreeing with itself.
      const graph = await getMomentGraphForWall(userId);
      momentCount = graph.moments.length;
      peopleCount = graph.people.length;
      faces = graph.people
        .filter(
          (p) => !p.personId.startsWith('guest:') || p.displayName !== 'Someone',
        )
        .slice(0, MAX_FACES)
        .map((p) => ({
          personId: p.personId,
          displayName: p.displayName,
          inMemoriam: p.inMemoriam,
        }));
    } catch {
      // Graceful degrade — the tile renders its invite state.
    }
  }

  // Built in lib/ because this component is async and the unit runner cannot
  // import it — the sentence is guarded there. It omits the people clause when
  // nobody is tagged rather than printing "· 0 people who made them".
  const whoLine = lifeFlashSummaryLine(momentCount, peopleCount);

  // The obsidian tile (proto .tile.dark.alaala — surface recipe lives once in
  // globals.css as .sn-tile-obsidian; .sn-bloom materializes it LAST, after
  // the glass cascade).
  return (
    <div className="sn-tile-obsidian sn-bloom relative flex flex-col gap-4 overflow-hidden rounded-2xl p-4 shadow-[0_26px_50px_-28px_rgba(23,22,15,0.7)] sm:gap-5 sm:p-[18px]">
      {/* Life-Flash veil lift + capiz shimmer sweep — decorative, aria-hidden,
          display:none under prefers-reduced-motion (see globals.css). */}
      <span aria-hidden className="sn-veil" />
      <span aria-hidden className="sn-capiz" />
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[color:var(--sn-gold-300)]">
          <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Alaala · Life-Flash
        </p>
      </div>

      <h3 className="max-w-[20ch] text-lg font-extrabold leading-[1.12] tracking-[-0.01em] text-[color:var(--sn-gold-100)] sm:text-[21px]">
        See your whole life — while you’re still in it.
      </h3>

      <div className="flex items-center gap-2.5">
        {faces.length > 0 ? (
          <span
            aria-hidden
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-xs font-bold text-ink"
            style={{
              background: orbBackground(
                faces[0]!.displayName,
                faces[0]!.inMemoriam,
              ),
            }}
          >
            {faces[0]!.displayName.charAt(0).toUpperCase()}
          </span>
        ) : null}
        <p className="text-xs text-terracotta-100/70">{whoLine}</p>
      </div>

      {lifeOn ? (
        <Link
          href="/dashboard/life-flash"
          className="sn-press inline-flex w-fit items-center gap-2 rounded-full bg-terracotta px-4 py-[9px] text-[13px] font-extrabold text-[color:var(--sn-ink-black)] transition-[background-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:bg-terracotta-300 hover:shadow-[0_12px_26px_-10px_rgba(203,167,102,0.7)]"
        >
          <Play
            aria-hidden
            className="h-[15px] w-[15px] fill-current"
            strokeWidth={1.75}
          />
          Play Life-Flash
        </Link>
      ) : null}

    </div>
  );
}
