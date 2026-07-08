import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { lifeStoryEnabled } from '@/lib/life-story-flag';
import { fetchMomentGraph } from '@/lib/life-story-moment-graph';
import { lifeStoryFixtureGraph } from '@/lib/life-story-fixtures';
import { displayUrlsForStoredAssets } from '@/lib/uploads';
import type { MomentGraph } from '@/lib/life-story-types';
import { ScrollReel, type ReelMoment } from './_components/scroll-reel';
import { StoryPeople, type StoryPerson } from './_components/story-people';

export const metadata = { title: 'Life Story' };

/**
 * Life Story — the living memorial of your celebrations (Phase 1 · own events).
 *
 * Reframe owner-locked 2026-07-08: experienced while you're alive, pointed
 * forward — never a death surface. This route hosts the scroll reel + the ✦
 * opt-in (PR-3); the cinematic flash mounts here in PR-4.
 *
 * Media discipline (Build Plan §1): presign only what's surfaced — the first
 * REEL_PAGE_SIZE moments — never the whole graph. Fixture mode (dev/preview
 * only, ?fixtures=1) skips signing entirely; tiles render deterministic
 * placeholder stills.
 */

const REEL_PAGE_SIZE = 48;

export default async function LifeStoryPage({
  searchParams,
}: {
  searchParams: Promise<{ fixtures?: string }>;
}) {
  if (!lifeStoryEnabled()) notFound();

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const sp = await searchParams;
  // Fixture mode for QA: local dev AND Vercel previews (which build with
  // NODE_ENV=production — VERCEL_ENV is the honest signal). Never real prod.
  const nonProdEnv =
    process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'preview';
  const useFixtures = sp.fixtures === '1' && nonProdEnv;

  let graph: MomentGraph;
  let loadError = false;
  if (useFixtures) {
    graph = lifeStoryFixtureGraph(8);
  } else {
    try {
      const supabase = await createClient();
      graph = await fetchMomentGraph(supabase, user.id);
    } catch {
      loadError = true;
      graph = { moments: [], people: [], events: [], viewer: { personId: null, birthDate: null } };
    }
  }

  // Surface-only signing: the first reel page (graph is significance-ordered).
  const surfaced = graph.moments.slice(0, REEL_PAGE_SIZE);
  const urls = useFixtures
    ? surfaced.map(() => null)
    : await displayUrlsForStoredAssets(surfaced.map((m) => m.media.r2Key));

  const reelMoments: ReelMoment[] = surfaced.map((m, i) => ({
    id: m.id,
    url: urls[i] ?? null,
    type: m.media.type,
    eventName: m.eventName,
    year: m.eventDate.slice(0, 4),
    capturedAt: m.capturedAt,
    significance: m.significance,
    byName: m.capturedBy.displayName,
    bySelf: m.capturedBy.kind === 'self',
    byGuest: m.capturedBy.kind === 'guest',
    peopleNames: m.peoplePresent.slice(0, 3).map((p) => p.displayName),
    peopleCount: m.peoplePresent.length,
    memoriam: m.peoplePresent.some((p) => p.inMemoriam),
  }));

  // Sparse dignity: events with no surfaced media become quiet chapter cards.
  const eventIdsWithMoments = new Set(graph.moments.map((m) => m.eventId));
  const emptyEvents = graph.events.filter((e) => !eventIdsWithMoments.has(e.eventId));
  const heroUrls = useFixtures
    ? emptyEvents.map(() => null)
    : await displayUrlsForStoredAssets(emptyEvents.map((e) => e.heroImageUrl));

  // ✦ opt-in rows: durable people only (pseudo guest:* keys can't be marked),
  // editable = people the viewer added (created_by ownership, checked here so
  // the client only offers the toggle where the action can succeed).
  const durablePeople = graph.people.filter((p) => !p.personId.startsWith('guest:'));
  let editableIds = new Set<string>();
  if (durablePeople.length > 0 && !useFixtures) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('people')
      .select('person_id')
      .eq('created_by_user_id', user.id)
      .in('person_id', durablePeople.map((p) => p.personId));
    editableIds = new Set((data ?? []).map((r) => r.person_id as string));
  }
  const storyPeople: StoryPerson[] = durablePeople.map((p) => ({
    personId: p.personId,
    displayName: p.displayName,
    inMemoriam: p.inMemoriam,
    recurrence: p.recurrence,
    canEdit: useFixtures ? false : editableIds.has(p.personId),
  }));

  const empty = graph.moments.length === 0 && graph.events.length === 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to events
      </Link>

      <header className="mb-6 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Life Story</h1>
        <p className="max-w-prose text-base text-ink/65">
          The moments that mattered most, and the people who kept showing up — seen through
          every camera that was there. Gathered while you&rsquo;re living them.
        </p>
      </header>

      {loadError ? (
        <p className="rounded-xl border border-ink/10 bg-white/40 px-4 py-6 text-sm text-ink/60">
          Your story couldn&rsquo;t load just now. Try again in a moment.
        </p>
      ) : empty ? (
        <div className="rounded-xl border border-ink/10 bg-white/40 px-4 py-8 text-sm text-ink/60">
          <p className="font-medium text-ink">Your story starts with a celebration.</p>
          <p className="mt-1">
            Host an event and let Papic gather everyone&rsquo;s photos — they&rsquo;ll settle
            here for life.
          </p>
          <Link
            href="/dashboard/create-event"
            className="mt-4 inline-block rounded-full border border-ink/15 px-4 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/5 hover:text-ink"
          >
            Plan what&rsquo;s next
          </Link>
        </div>
      ) : (
        <>
          <ScrollReel moments={reelMoments} />

          {emptyEvents.length > 0 ? (
            <section className="mt-10">
              <div className="mb-3 flex items-baseline gap-2">
                <h2 className="text-base font-semibold text-ink">Chapters still to fill</h2>
                <span className="text-xs text-ink/40">{emptyEvents.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {emptyEvents.map((e, i) => (
                  <article
                    key={e.eventId}
                    className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm"
                  >
                    <div className="relative aspect-[4/3] bg-ink/5">
                      {heroUrls[i] ? (
                        // eslint-disable-next-line @next/next/no-img-element -- presigned R2 URL isn't in the next/image allowlist
                        <img
                          src={heroUrls[i]!}
                          alt={e.eventName}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-3xl text-ink/20">
                          ✦
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-medium text-ink">{e.eventName}</p>
                      <p className="text-xs text-ink/55">
                        No photos gathered yet — this chapter is waiting.
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <StoryPeople people={storyPeople} />
        </>
      )}
    </div>
  );
}
