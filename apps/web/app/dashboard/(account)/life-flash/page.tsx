import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { after } from 'next/server';
import { ArrowLeft, Sparkles } from 'lucide-react';

import { getCurrentUser } from '@/lib/auth';
import { reScreenStuckCaptures } from '@/lib/nsfw-screen';
import { createClient } from '@/lib/supabase/server';
import { lifeStoryEnabled } from '@/lib/life-story-flag';
import {
  fetchMomentGraph,
  parseFlashScope,
  scopeMomentGraph,
  scopeOptions,
  flashScopeKey,
} from '@/lib/life-story-moment-graph';
import { lifeStoryFixtureGraph } from '@/lib/life-story-fixtures';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import type { MomentGraph, ScoredMoment } from '@/lib/life-story-types';
import { compileBeats } from '@/lib/life-story-beats';
import { ScrollReel, type ReelMoment } from './_components/scroll-reel';
import { StoryPeople, type StoryPerson } from './_components/story-people';
import { Flash, type FlashBeatView } from './_components/flash';

export const metadata = { title: 'Life-Flash' };

/**
 * Life-Flash — the living memorial of your celebrations (Phase 1 · own events).
 * Product name owner-locked 2026-07-08 ("name it Life-Flash"); internal lib
 * modules keep the life-story-* codename.
 *
 * Reframe owner-locked 2026-07-08: experienced while you're alive, pointed
 * forward — never a death surface. Scopes (owner, same day): whole life ·
 * per-year · per-month · per-event — one engine pointed at a slice, offered
 * only where the dignity thresholds clear. Strategic frame: the payoff engine
 * that maximizes the value of everything Papic collects.
 *
 * Media discipline (Build Plan §1): presign only what's surfaced — the first
 * REEL_PAGE_SIZE moments — never the whole graph. Fixture mode (dev/preview
 * only, ?fixtures=1) skips signing entirely; tiles render deterministic
 * placeholder stills.
 */

const REEL_PAGE_SIZE = 48;

/** Human name list for the memoriam hold: "A" · "A & B" · "A, B & C". */
function joinNames(names: string[]): string {
  if (names.length === 0) return 'They';
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

/**
 * Presign a list of R2 keys PRESERVING index alignment + nulls. Unlike
 * `displayUrlsForStoredAssets`, which `.filter()`s nulls out and shifts the
 * array, so a null hero/frame would slide a DIFFERENT event's photo under the
 * wrong name (a person's caption landing on the wrong face).
 */
async function signedUrlsAligned(
  keys: ReadonlyArray<string | null | undefined>,
): Promise<(string | null)[]> {
  return Promise.all(keys.map((k) => displayUrlForStoredAsset(k)));
}

export default async function LifeFlashPage({
  searchParams,
}: {
  searchParams: Promise<{ fixtures?: string; scope?: string }>;
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

  // Heal stuck-unscreened media (owner 2026-07-11 · the strict `clean` gate's
  // mitigation). Screening is fail-open + fire-and-forget, so a dropped screen
  // leaves a row 'unscreened' forever — invisible to Life-Flash's clean-only
  // gate even though the couple's own gallery still shows it. Opening Life-Flash
  // re-screens the couple's events (bounded, idempotent, non-blocking), so those
  // frames flow back in on the next open. Same after() pattern as the Papic
  // moderation surface.
  if (!useFixtures && !loadError) {
    after(() =>
      Promise.all(
        graph.events.map((e) => reScreenStuckCaptures(e.eventId).catch(() => 0)),
      ),
    );
  }

  // Scope — whole life (default) · year · month · event. The scoped graph
  // drives the flash + reel; the ✦ people section stays LIFETIME-scoped.
  const scope = parseFlashScope(sp.scope);
  const scoped = scopeMomentGraph(graph, scope);
  const options = scopeOptions(graph);
  const activeScopeKey = flashScopeKey(scope);
  const scopeHref = (key: string) => {
    const params = new URLSearchParams();
    if (useFixtures) params.set('fixtures', '1');
    if (key !== 'life') params.set('scope', key);
    const qs = params.toString();
    return qs ? `/dashboard/life-flash?${qs}` : '/dashboard/life-flash';
  };

  // Fixture media carry real https demo URLs (picsum / sample clips) — pass
  // them straight through. Real rows always carry R2 keys and take the signed
  // path; this branch never runs in production (useFixtures gate above).
  const fixtureUrl = (key: string | null | undefined) =>
    key && key.startsWith('https://') ? key : null;

  // Surface-only signing: the first reel page (graph is significance-ordered).
  const surfaced = scoped.moments.slice(0, REEL_PAGE_SIZE);
  const urls = useFixtures
    ? surfaced.map((m) => fixtureUrl(m.media.r2Key))
    : await signedUrlsAligned(surfaced.map((m) => m.media.r2Key));

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
    // High-trust only, same gate as the memoriam beat — a ✦ marker never lands
    // on a photo where the remembered person is only a table-QR / auto-face guess.
    memoriam: m.peoplePresentHighTrust.some((p) => p.inMemoriam),
  }));

  // Sparse dignity: events with no surfaced media become quiet chapter cards.
  // (Scoped recaps drop empty events by construction — cards appear on whole-life.)
  const eventIdsWithMoments = new Set(scoped.moments.map((m) => m.eventId));
  const emptyEvents = scoped.events.filter((e) => !eventIdsWithMoments.has(e.eventId));
  const heroUrls = useFixtures
    ? emptyEvents.map((e) => fixtureUrl(e.heroImageUrl))
    : await signedUrlsAligned(emptyEvents.map((e) => e.heroImageUrl));

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
  // The viewer can NEVER mark their OWN node in-memoriam. The self-claim trigger
  // stamps every account holder's own person with created_by_user_id = self, so
  // the created_by ownership check alone would (wrongly) offer the ✦ toggle on
  // themselves — a living couple could memorialize themselves and, being the
  // most-recurring person, open their own flash on a memorial orb. Exclude the
  // viewer's own person here AND in the server action (markPersonInMemoriam).
  const viewerPersonId = graph.viewer.personId;
  const storyPeople: StoryPerson[] = durablePeople.map((p) => ({
    personId: p.personId,
    displayName: p.displayName,
    inMemoriam: p.inMemoriam,
    recurrence: p.recurrence,
    canEdit: !useFixtures && editableIds.has(p.personId) && p.personId !== viewerPersonId,
  }));

  // The flash — compile the arc server-side (pure) from the SCOPED graph,
  // presign only its media (≤ MAX_BEATS items), hand the client a view.
  const beats = compileBeats(scoped);
  const beatMoments = beats.flatMap((b) =>
    'moment' in b && b.moment ? [b.moment] : [],
  ) as ScoredMoment[];
  const beatUrls = useFixtures
    ? beatMoments.map((m) => fixtureUrl(m.media.r2Key))
    : await signedUrlsAligned(beatMoments.map((m) => m.media.r2Key));
  const urlByMomentId = new Map(beatMoments.map((m, i) => [m.id, beatUrls[i] ?? null]));

  const flashBeats: FlashBeatView[] = beats.map((b): FlashBeatView => {
    if (b.kind === 'face_open') {
      return {
        kind: 'face_open',
        dwellMs: b.dwellMs,
        name: b.person.displayName,
        memoriam: b.person.inMemoriam,
        recurrence: b.person.recurrence,
      };
    }
    if (b.kind === 'present_forward') {
      return {
        kind: 'present_forward',
        dwellMs: null,
        id: b.moment?.id ?? null,
        url: b.moment ? (urlByMomentId.get(b.moment.id) ?? null) : null,
        type: b.moment?.media.type ?? null,
      };
    }
    const m = b.moment;
    return {
      kind: b.kind,
      dwellMs: b.dwellMs,
      id: m.id,
      url: urlByMomentId.get(m.id) ?? null,
      type: m.media.type,
      eventName: m.eventName,
      year: m.eventDate.slice(0, 4),
      peopleCount: m.peoplePresent.length,
      byName: m.capturedBy.displayName,
      bySelf: m.capturedBy.kind === 'self',
      ...(b.kind === 'memoriam_hold' ? { personName: joinNames(b.people.map((p) => p.displayName)) } : {}),
    };
  });

  const empty = graph.moments.length === 0 && graph.events.length === 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/dashboard" className="sn-chip sn-press mb-4 w-fit">
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Back to events
      </Link>

      <header className="mb-6 space-y-2">
        <p className="sn-eye">
          <Sparkles aria-hidden strokeWidth={1.75} />
          Gathered while you live them
        </p>
        <h1 className="sn-h1">Life-Flash</h1>
        <p className="max-w-prose text-base text-ink/65">
          The moments that mattered most, and the people who kept showing up — seen through
          every camera that was there. Gathered while you&rsquo;re living them.
        </p>
      </header>

      {!loadError && !empty ? (
        <nav aria-label="Flash scope" className="mb-6 flex flex-wrap gap-2">
          {[
            { key: 'life', label: 'Whole life', count: graph.moments.length },
            ...options.years,
            ...options.months,
            ...options.events,
          ].map((o) => (
            <Link
              key={o.key}
              href={scopeHref(o.key)}
              aria-current={o.key === activeScopeKey ? 'page' : undefined}
              className={`sn-chip sn-press ${o.key === activeScopeKey ? 'selected' : ''}`}
            >
              {o.label}
            </Link>
          ))}
        </nav>
      ) : null}

      {loadError ? (
        <p className="sn-tile px-4 py-6 text-sm text-ink/60">
          Your story couldn&rsquo;t load just now. Try again in a moment.
        </p>
      ) : empty ? (
        <div className="sn-tile px-4 py-8 text-sm text-ink/60">
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
          {scoped.moments.length === 0 ? (
            <p className="sn-tile mb-6 px-4 py-6 text-sm text-ink/60">
              Nothing gathered in this stretch yet — pick another scope above.
            </p>
          ) : (
            <Flash beats={flashBeats} scopeKind={scope.kind} />
          )}

          <ScrollReel moments={reelMoments} />

          {emptyEvents.length > 0 ? (
            <section className="mt-10">
              <div className="mb-3 flex items-baseline gap-2">
                <h2 className="sn-sec">Chapters still to fill</h2>
                <span className="font-mono text-xs text-ink/40">{emptyEvents.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {emptyEvents.map((e, i) => (
                  <article
                    key={e.eventId}
                    className="sn-card overflow-hidden"
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
