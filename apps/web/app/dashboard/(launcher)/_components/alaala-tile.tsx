import Link from 'next/link';
import { Play, Sparkles } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { fetchMomentGraph } from '@/lib/life-story-moment-graph';
import { orbBackground } from '../../(account)/life-flash/_components/placeholder';
import { AlaalaLenses, type AlaalaLensKey } from './alaala-lenses';

/**
 * AlaalaTile — the obsidian focal tile of the four-surface home (owner-approved
 * final design 2026-07-15; the prototype's "ALAALA · LIFE-FLASH" panel).
 *
 * One dark tile carries the whole memory dimension: the Life-Flash headline +
 * face row + Play affordance on top, and the five LENSES (Recent · Owned ·
 * Attended · People · With me) beneath — each lens body server-rendered with
 * REAL state (never fabricated counts) and swapped client-side by the
 * AlaalaLenses island.
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
      className="h-[22rem] animate-pulse rounded-2xl border border-white/10 bg-ink/90"
    />
  );
}

export async function AlaalaTile({
  userId,
  lifeOn,
  ownedEvents,
  attendedCount,
  personStoriesOn,
}: {
  userId: string;
  lifeOn: boolean;
  /** The user's own (couple) events — name + a short date label, for the
   *  "Owned" lens. Already fetched by the page; passed serialized. */
  ownedEvents: Array<{ name: string; dateLabel: string }>;
  /** Events the user is on as a guest (real count; null = count unavailable —
   *  the lens degrades to the invite line, never a fabricated number). */
  attendedCount: number | null;
  /** NEXT_PUBLIC_PERSON_LIFE_STORIES — the "With me" lens is live when on. */
  personStoriesOn: boolean;
}) {
  let momentCount = 0;
  let peopleCount = 0;
  let faces: Array<{ personId: string; displayName: string; inMemoriam: boolean }> =
    [];

  if (lifeOn) {
    try {
      const supabase = await createClient();
      const graph = await fetchMomentGraph(supabase, userId);
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

  const whoLine =
    momentCount > 0
      ? `${momentCount} ${momentCount === 1 ? 'moment' : 'moments'} · ${peopleCount} ${
          peopleCount === 1 ? 'person' : 'people'
        } who made them — gathered while you’re living them`
      : 'Moments gather here live, from every celebration you’re part of.';

  // ── Lens bodies — server-rendered, REAL state only ────────────────────────
  const bodies: Record<AlaalaLensKey, React.ReactNode> = {
    recent:
      momentCount > 0 ? (
        <p>
          Your latest{' '}
          <span className="font-mono text-white/80">{momentCount}</span> moments
          show first — gathered live from your events.
        </p>
      ) : (
        <p>Your story starts with a celebration — moments land here as they happen.</p>
      ),
    owned:
      ownedEvents.length > 0 ? (
        <ul className="space-y-1.5">
          {ownedEvents.map((e) => (
            <li key={`${e.name}-${e.dateLabel}`} className="flex items-baseline gap-2">
              <span aria-hidden className="h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-full bg-terracotta/70" />
              <span className="min-w-0 truncate text-white/80">{e.name}</span>
              <span className="ml-auto shrink-0 font-mono text-xs text-white/45">
                {e.dateLabel}
              </span>
            </li>
          ))}
          <li className="pt-1 text-xs text-white/45">
            Each becomes an album here once its day passes.
          </li>
        </ul>
      ) : (
        <p>The events you host become albums here once their day passes.</p>
      ),
    attended:
      attendedCount != null && attendedCount > 0 ? (
        <p>
          You’re a guest at{' '}
          <span className="font-mono text-white/80">{attendedCount}</span>{' '}
          {attendedCount === 1 ? 'event' : 'events'} — they gather here too.
        </p>
      ) : (
        <p>No events attended yet — the ones you’re invited to gather here too.</p>
      ),
    people: (
      <div className="space-y-2.5">
        {faces.length > 0 ? (
          <div className="flex items-center gap-2">
            {faces.map((f) => (
              <span
                key={f.personId}
                title={f.displayName}
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-ink ring-2 ring-white/15"
                style={{ background: orbBackground(f.displayName, f.inMemoriam) }}
              >
                {f.displayName.charAt(0).toUpperCase()}
                {f.inMemoriam ? (
                  <span aria-hidden className="absolute -right-0.5 -top-0.5 text-[9px]">
                    ✦
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        ) : null}
        <p>
          Family, godparents, and friends — suggested from your events, confirmed
          by both sides. Connections are coming soon.
        </p>
      </div>
    ),
    with_me: personStoriesOn ? (
      <p>Photos and clips you appear in gather below, event by event.</p>
    ) : (
      <p>Photos and clips you appear in will gather here.</p>
    ),
  };

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-ink p-5 shadow-[0_26px_50px_-28px_rgba(23,22,15,0.7)] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-terracotta">
          <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Alaala · Life-Flash
        </p>
      </div>

      <h3 className="m-serif max-w-[22ch] text-2xl leading-snug text-cream sm:text-[1.7rem]">
        See your whole life —{' '}
        <span className="text-cream/60">while you’re still in it.</span>
      </h3>

      <div className="flex items-center gap-3">
        {faces.length > 0 ? (
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-ink"
            style={{
              background: orbBackground(faces[0]!.displayName, faces[0]!.inMemoriam),
            }}
          >
            {faces[0]!.displayName.charAt(0).toUpperCase()}
          </span>
        ) : null}
        <p className="text-sm text-white/60">{whoLine}</p>
      </div>

      {lifeOn ? (
        <Link
          href="/dashboard/life-flash"
          className="inline-flex w-fit items-center gap-2 rounded-full bg-terracotta px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-terracotta-600"
        >
          <Play aria-hidden className="h-4 w-4 fill-current" strokeWidth={1.75} />
          Play Life-Flash
        </Link>
      ) : null}

      <div aria-hidden className="h-px bg-white/10" />

      <AlaalaLenses bodies={bodies} />
    </div>
  );
}
