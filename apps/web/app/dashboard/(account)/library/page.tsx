import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getPhotosAlbums } from './_data/photos-albums';
import { lifeStoryEnabled } from '@/lib/life-story-flag';
import { getAlaalaWall } from '@/lib/alaala-wall-data';
import { AlaalaLensBody } from '@/app/_components/alaala/lens-body';
import { PhotosTab } from './_components/photos-tab';
import { VendorsTab } from './_components/vendors-tab';
import { EditorialsTab } from './_components/editorials-tab';
import { PageMasthead } from '@/app/_components/page-masthead';
import { fetchScheduleBlocks } from '@/lib/schedule';
import { formatCount } from '@/lib/format-number';
import { MemoriesChapters } from './_components/memories-chapters';
import { MemoriesThumb } from './_components/memories-thumb';
import {
  KEPT,
  LENSES,
  isLens,
  resolveLibraryView,
  type LensKey,
  type ViewKey,
} from './_data/library-views';

export const metadata = { title: 'Memories' };

/**
 * ALAALA — the account-level, CROSS-EVENT memory surface. This route is
 * `/dashboard/library` and STAYS `/dashboard/library`: renaming a live URL
 * breaks every link already shipped into it (the phone pill nav, the home
 * board tile, the ⌘K palette, `lib/daily-email-jobs.ts`). The SURFACE is
 * renamed; the URL is not.
 *
 * ── WHY (owner, 2026-07-31) ────────────────────────────────────────────────
 * "the memories hub is still not integrated" · "ala ala is not fixed."
 *
 * Alaala is the product's single MEMORY dimension, and the hub name this page
 * used to carry was simply its older label (now retired — see
 * `apps/web/.retired-strings.json`). Two shipped nav surfaces already send
 * people here calling it Alaala: `(launcher)/_components/home-pill-nav.tsx`
 * (the phone tab literally reads "Alaala") and the home's board tile (deleted
 * with the board, 2026-09-18). The page they landed on introduced itself as
 * something else — the same two-names-for-one-idea defect the home fix
 * addressed, one level down.
 *
 * ── ONE VOCABULARY: THE FIVE LENSES ────────────────────────────────────────
 * Alaala has five lenses (Recent · Owned · Attended · People · With me —
 * declared once as `ALAALA_LENSES` in `lib/alaala-wall.ts`). This page used a SECOND,
 * unrelated axis: three tabs (Photos & Videos · Saved Vendors · Editorials).
 * The lenses are the page's primary navigation, and both surfaces now render
 * the SAME body (`app/_components/alaala/lens-body.tsx`) from the same read.
 *
 * ── AND THE LENSES ANSWER WITH PHOTOGRAPHS (2026-08-13) ────────────────────
 * Three of them used to answer with `PhotosTab` — one card per event with a
 * photo count — and the other two with prose, because People and With me are
 * not albums. So Alaala was a second list of events, which is the board's job:
 * Events is for DOING, Alaala is for KEEPING. "With me" is every photo of you
 * across six years and belongs to NO SINGLE EVENT, which is exactly why an
 * album grid could never be its answer.
 *
 * The per-event grid is not gone — it is "Albums by event" under "Also kept",
 * where downloading one whole celebration is a real job.
 *
 * ── "ALSO KEPT" — AND WHY SAVED VENDORS IS NOT A LENS ──────────────────────
 * A shortlist of vendors is not a memory. The owner put saved vendors in
 * Spaces ("saved vendors can be with the group of your shop, hq, and creators
 * lab, and favorite vendors") and the home now links them from there. But
 * `?tab=vendors` is a LIVE deep link — the home's Spaces row points straight
 * at it — so it keeps working exactly as before and keeps a visible door here.
 * It just stops being presented as a peer of the memory lenses: it sits under
 * "Also kept", labelled with where it belongs.
 *
 * Tab/lens state lives in the query string so the whole page stays a Server
 * Component (no client island, no hydration cost on a media-heavy page).
 *
 * ── 2026-10-22: MEMORIES WEARS THE PAPIC GALLERY ───────────────────────────
 * Owner: *"Memories must look similar to the gallery of papic. Somewhat but not exactly."* The approved
 * prototype (`prototypes/people_and_memories_template_2026-10-22.html` M1–M4) folds the four shapes that stood
 * before the first photograph — the framed Life-Flash card, the cover shelf, the "Gallery" rows, the dashed box —
 * into ONE: the Life-Flash tile as the grid's first row, then one gold chapter per event (every event, the empty
 * ones with their monogram), each with its Gallery › door (`memories-chapters.tsx`). The Show dropdown is the
 * same list in a new seat — the glass thumb row, beside a new Event dropdown (`?event=`); one event picked, the
 * chapters become the day's and ⤓ Download all joins the row. Owner, same day: NO counts line at the top.
 * The People lens and the three "Also kept" views draw exactly what they drew.
 */

export default async function AlaalaPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; event?: string }>;
}) {
  const sp = await searchParams;
  const active: ViewKey = resolveLibraryView(sp.tab);

  // ⚡ The account layout already asked the auth server who this is (`getCurrentUser`, remembered per request) —
  // asking again here was a second auth round trip on every open of Memories (2026-10-23, the speed pass).
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // ONE read, whichever lens is open — the same wall the home renders, opened
  // full. Only fetched for a lens that answers with memories; the "also kept"
  // views (albums · editorials · vendors) do their own reads.
  //
  // `isLens` is a type predicate rather than a chain of `||`: a narrowing that
  // lives in the DECLARED lens list cannot drift out of step with it, and a
  // sixth key added to LENS_KEYS is then a compile error here rather than a
  // lens that silently renders nothing.
  const lens: LensKey | null = isLens(active) ? active : null;
  // The events list — every event, the shelf's read — feeds the chapters AND the Event dropdown.
  const [wall, albumsRead] = await Promise.all([
    lens ? getAlaalaWall(user.id) : Promise.resolve(null),
    getPhotosAlbums(user.id),
  ]);
  // Oldest first — the shelf's order (owner 2026-08-19: "chronological albums of each event").
  const albums = [...albumsRead.albums].sort((a, b) => {
    const da = a.event.event_date;
    const db = b.event.event_date;
    if (da && db) return da < db ? -1 : da > db ? 1 : 0;
    if (da) return -1;
    if (db) return 1;
    return 0;
  });
  const picked = typeof sp.event === 'string' ? (albums.find((a) => a.event.event_id === sp.event) ?? null) : null;
  const frameLens = lens && lens !== 'people' ? lens : null;

  const href = (tab: string, eventId: string | null) =>
    `/dashboard/library?tab=${tab}${eventId ? `&event=${encodeURIComponent(eventId)}` : ''}`;
  const keep = picked?.event.event_id ?? null;
  // SHOW — the shipped list, unchanged: five lenses, then "Also kept". A pick keeps the picked event.
  const show = [
    ...LENSES.map(({ key, label }) => ({ key, label, group: 'Memories', href: href(key, isLens(key) && key !== 'people' ? keep : null) })),
    ...KEPT.map(({ key, label }) => ({ key, label, group: 'Also kept', href: href(key, null) })),
  ];
  // EVENT — the one new control: every event you host or attended, its count on the right (`getPhotosAlbums`).
  const eventsMenu = frameLens
    ? [
        { key: 'all', label: 'All events', href: href(frameLens, null) },
        ...albums.map((a) => ({
          key: a.event.event_id,
          label: a.event.display_name,
          group: a.role === 'couple' ? 'Hosting' : 'Attended',
          trail: { text: formatCount(a.count), tone: 'muted' as const },
          href: href(frameLens, a.event.event_id),
        })),
      ]
    : null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-24 pt-2 sm:px-6 lg:px-8">
      <PageMasthead title="Memories" />

      {/* key remount on view change → the body cross-fades in (§ 2d) */}
      <div key={`${active}:${keep ?? ''}`} className="sn-lens-swap mx-auto w-full max-w-3xl">
        {/* The four frame lenses answer with frames, chaptered — by event, or by the day once one event is
            picked. The People lens keeps its faces and "Open People" (`AlaalaLensBody`, unchanged). */}
        {frameLens && wall ? (
          <MemoriesChapters
            lens={frameLens}
            wall={wall}
            albums={albums}
            albumsMeasured={albumsRead.albumsMeasured}
            eventId={keep}
            lifeFlash={lifeStoryEnabled()}
            blocksFor={async (id) =>
              (await fetchScheduleBlocks(await createClient(), id)).map((b) => ({
                blockId: b.block_id,
                label: b.label,
                startAt: b.start_at,
                endAt: b.end_at,
                actualStartAt: b.actual_start_at,
                actualEndAt: b.actual_end_at,
              }))
            }
          />
        ) : null}
        {lens === 'people' && wall ? <div className="pt-3"><AlaalaLensBody lens="people" wall={wall} tiles={36} /></div> : null}
        {active === 'albums' ? (
          <div className="space-y-4 pt-3">
            <p className="text-sm text-ink/60">
              One card per event — this is where a whole event downloads at
              once. Your memories themselves live in the lenses above.
            </p>
            <PhotosTab userId={user.id} />
          </div>
        ) : null}
        {active === 'editorials' ? <div className="pt-3"><EditorialsTab userId={user.id} /></div> : null}
        {active === 'vendors' ? (
          <div className="space-y-4 pt-3">
            <p className="text-sm text-ink/60">
              A shortlist isn&rsquo;t a memory — these live in{' '}
              <Link href="/dashboard" className="font-semibold text-ink underline decoration-ink/25 underline-offset-2 hover:decoration-ink">
                Spaces on your home
              </Link>
              , beside your shop and consoles. They&rsquo;re shown here because this is
              where they&rsquo;ve always opened.
            </p>
            <VendorsTab userId={user.id} />
          </div>
        ) : null}
      </div>

      {/* THE THUMB ROW — Event ▾ · Show ▾ · ⤓ (owner 2026-10-05: tools in the lower third). From 1024 the rail
          also carries the Show rows (`MemoriesRailContext`, the same LENSES/KEPT). */}
      <MemoriesThumb
        events={eventsMenu}
        eventValue={keep ?? 'all'}
        show={show}
        showValue={active}
        download={picked && picked.role === 'couple' && picked.count > 0 ? `/dashboard/${picked.event.event_id}/studio/papic/gallery-zip` : null}
      />
    </div>
  );
}
