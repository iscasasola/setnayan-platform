import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { fetchMomentGraph } from '@/lib/life-story-moment-graph';
import { orbBackground } from '../life-flash/_components/placeholder';

/**
 * Life-Flash · the rich user-home entry (owner "build it" 2026-07-08).
 *
 * The quiet doorway made inviting: a dark "lights going down" card carrying the
 * face-row of the people who keep showing up + a one-line summary, linking into
 * /dashboard/life-flash. Async server component — flag-gated by the caller.
 *
 * Defensive by construction (this renders on the most-hit authed page): the
 * whole summary is wrapped in try/catch and degrades to a plain invite card, so
 * a slow/failed graph read never breaks the dashboard. Faces are gradient orbs
 * with initials (no profile-photo presigning on the home path).
 */

const MAX_FACES = 5;

/** Streaming placeholder — keeps the (busiest authed page) dashboard painting
 *  instantly while the graph summary resolves behind a Suspense boundary. */
export function LifeFlashHomeCardSkeleton() {
  return (
    <div
      aria-hidden
      className="h-[132px] animate-pulse rounded-lg border border-white/10 bg-ink/90"
    />
  );
}

export async function LifeFlashHomeCard({ userId }: { userId: string }) {
  let momentCount = 0;
  let peopleCount = 0;
  let faces: Array<{ personId: string; displayName: string; inMemoriam: boolean }> = [];

  try {
    const supabase = await createClient();
    const graph = await fetchMomentGraph(supabase, userId);
    momentCount = graph.moments.length;
    peopleCount = graph.people.length;
    faces = graph.people
      .filter((p) => !p.personId.startsWith('guest:') || p.displayName !== 'Someone')
      .slice(0, MAX_FACES)
      .map((p) => ({
        personId: p.personId,
        displayName: p.displayName,
        inMemoriam: p.inMemoriam,
      }));
  } catch {
    // Graceful degrade — fall through to the invite card below.
  }

  const eyebrow = (
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
      Life-Flash
    </p>
  );
  const chevron = (
    <span
      aria-hidden
      className="shrink-0 text-white/40 transition-colors group-hover:text-white"
    >
      ▶
    </span>
  );
  const cardClass =
    'group block overflow-hidden rounded-lg border border-white/10 bg-ink p-5 transition-transform hover:-translate-y-0.5';

  // Nothing gathered yet — a forward-looking invite, never a rebuke.
  if (momentCount === 0) {
    return (
      <Link href="/dashboard/life-flash" className={cardClass}>
        <div className="flex items-start justify-between gap-4">
          <div>
            {eyebrow}
            <p className="mt-1.5 text-lg font-medium leading-snug text-white">
              Your story starts with a celebration.
            </p>
            <p className="mt-2 text-xs text-white/55">
              Let Papic gather everyone&rsquo;s photos — they&rsquo;ll settle here for life.
            </p>
          </div>
          {chevron}
        </div>
      </Link>
    );
  }

  return (
    <Link href="/dashboard/life-flash" className={cardClass}>
      <div className="flex items-start justify-between gap-4">
        <div>
          {eyebrow}
          <p className="mt-1.5 text-lg font-medium leading-snug text-white">
            See your whole life —{' '}
            <span className="text-white/60">while you&rsquo;re still in it.</span>
          </p>
        </div>
        {chevron}
      </div>

      {faces.length > 0 ? (
        <div className="mt-4 flex items-center" aria-hidden>
          {faces.map((p, i) => (
            <span
              key={p.personId}
              title={p.displayName}
              className={`relative grid h-9 w-9 place-items-center rounded-full border-2 border-ink text-xs font-medium text-white ${
                i > 0 ? '-ml-2' : ''
              }`}
              style={{ background: orbBackground(p.displayName, p.inMemoriam) }}
            >
              {p.displayName.slice(0, 1)}
              {p.inMemoriam ? (
                <span className="absolute -right-1 -top-1 text-[10px] text-[#c9cee0]">✦</span>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}

      <p className="mt-3 text-xs text-white/55">
        {momentCount} {momentCount === 1 ? 'moment' : 'moments'} · {peopleCount}{' '}
        {peopleCount === 1 ? 'person' : 'people'} who made them — gathered while you&rsquo;re
        living them
      </p>
    </Link>
  );
}
