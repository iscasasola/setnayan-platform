import Link from 'next/link';
import { ArrowUpRight, Images } from 'lucide-react';

import { getAlaalaWall } from '@/lib/alaala-wall-data';
import { ALAALA_LENSES, lensCounts, type AlaalaLensKey } from '@/lib/alaala-wall';
import { AlaalaLensBody } from '@/app/_components/alaala/lens-body';
import { AlaalaLenses } from './alaala-lenses';

/**
 * AlaalaWall — the home's memory wall: photographs, cut by the five lenses.
 *
 * ── WHAT THIS REPLACED ─────────────────────────────────────────────────────
 * A collapsed "Photos & videos" panel that rendered `PhotosTab` — ONE CARD PER
 * EVENT with a photo count. Alaala had become a second list of events, which is
 * the board's job. Events is for DOING; Alaala is for KEEPING, and the thing it
 * keeps is frames.
 *
 * All five bodies are rendered ONCE, server-side, from ONE `getAlaalaWall`
 * read, and swapped client-side. Nothing here fabricates a number: a lens with
 * no frames says so in its own words, and a lens whose read was REFUSED says
 * that instead — an empty grid and a rejected query look identical from the
 * outside, and only one of them is honest as "nothing yet".
 *
 * Async server component — mount behind Suspense with <AlaalaWallSkeleton/>.
 */

export function AlaalaWallSkeleton() {
  return (
    <div
      aria-hidden
      className="sn-tile-glass h-[18rem] animate-pulse rounded-2xl p-4 sm:p-[18px]"
    />
  );
}

export async function AlaalaWall({ userId }: { userId: string }) {
  const wall = await getAlaalaWall(userId);
  const counts = lensCounts(wall);

  // DERIVED, not hand-typed. The five used to be written out as key/prop pairs,
  // and a mutation proved the pairing was unguarded: rewriting one entry to
  // `owned: <AlaalaLensBody lens="recent" …>` left 17/17 tests green — the guard
  // matches the record KEY, which that mutation preserves, and `Record<K, Node>`
  // gives no key↔prop link. The Owned chip would have quietly shown the Recent
  // wall. Deriving from the one declared list makes the class of bug
  // unexpressible, which beats any guard over hand-typed pairs.
  const bodies = Object.fromEntries(
    ALAALA_LENSES.map(({ key }) => [key, <AlaalaLensBody key={key} lens={key} wall={wall} />]),
  ) as Record<AlaalaLensKey, React.ReactNode>;

  return (
    <div className="sn-tile-glass sn-lift-3 rounded-2xl p-4 sm:p-[18px]">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[color:var(--sn-gold-700)]">
          <Images aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Alaala · everything you keep
        </p>
        <Link
          href="/dashboard/library"
          className="inline-flex items-center gap-1 text-xs font-bold text-[color:var(--sn-gold-700)] transition-colors hover:text-[color:var(--sn-gold-600)]"
        >
          Open Alaala
          <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
      </div>
      <AlaalaLenses bodies={bodies} counts={counts} partial={wall.partial} />
    </div>
  );
}
