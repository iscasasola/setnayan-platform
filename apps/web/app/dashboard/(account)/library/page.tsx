import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Images, Heart, Newspaper } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { lifeStoryEnabled } from '@/lib/life-story-flag';
import { getAlaalaWall } from '@/lib/alaala-wall-data';
import { AlaalaLensBody } from '@/app/_components/alaala/lens-body';
import { PhotosTab } from './_components/photos-tab';
import { VendorsTab } from './_components/vendors-tab';
import { EditorialsTab } from './_components/editorials-tab';
import { PageMasthead } from '@/app/_components/page-masthead';
import { AlbumShelf } from './_components/album-shelf';

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
 * (the phone tab literally reads "Alaala") and `home-board.tsx` (the dark
 * board tile reads "Alaala"). The page they landed on introduced itself as
 * something else — the same two-names-for-one-idea defect the home fix
 * addressed, one level down.
 *
 * ── ONE VOCABULARY: THE FIVE LENSES ────────────────────────────────────────
 * The Alaala tile names five lenses (Recent · Owned · Attended · People · With
 * me — `(launcher)/_components/alaala-lenses.tsx`). This page used a SECOND,
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
 */

/** The Alaala tile's five lenses, in the tile's own order. */
const LENS_KEYS = ['recent', 'owned', 'attended', 'people', 'with_me'] as const;
/**
 * Reachable, deliberately NOT lenses.
 *
 * `albums` is the per-event grid this page used to answer three of the five
 * lenses with. It is a real job — opening one celebration and downloading all
 * of it — but it is a LIST OF EVENTS, and a list of events is the board's
 * answer, not Alaala's. It keeps its door; it stops being the memory.
 */
const KEPT_KEYS = ['albums', 'editorials', 'vendors'] as const;

type LensKey = (typeof LENS_KEYS)[number];
type KeptKey = (typeof KEPT_KEYS)[number];
type ViewKey = LensKey | KeptKey;

const ALL_KEYS: readonly ViewKey[] = [...LENS_KEYS, ...KEPT_KEYS];

function isLens(view: ViewKey): view is LensKey {
  return (LENS_KEYS as readonly string[]).includes(view);
}

/**
 * Legacy `?tab=` values, kept working forever. `?tab=photos` is still sent by
 * `lib/daily-email-jobs.ts` (a real email already in people's inboxes) and was
 * the first tab of the old hub; it is the Recent lens now.
 */
const LEGACY_TAB: Record<string, ViewKey> = {
  photos: 'recent',
};

const LENSES: { key: LensKey; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: 'owned', label: 'Owned' },
  { key: 'attended', label: 'Attended' },
  { key: 'people', label: 'People' },
  { key: 'with_me', label: 'With me' },
];

const KEPT: { key: KeptKey; label: string; Icon: typeof Images }[] = [
  { key: 'albums', label: 'Albums by event', Icon: Images },
  { key: 'editorials', label: 'Editorials', Icon: Newspaper },
  { key: 'vendors', label: 'Saved vendors', Icon: Heart },
];

export default async function AlaalaPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const requested = LEGACY_TAB[sp.tab ?? ''] ?? sp.tab;
  const active: ViewKey = ALL_KEYS.includes(requested as ViewKey)
    ? (requested as ViewKey)
    : 'recent';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
  const wall = lens ? await getAlaalaWall(user.id) : null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* The account spokes' documented convention is a "Back to home" link
          (see (account)/layout.tsx) — and home is where the Alaala tile lives,
          so "back to events" named the wrong thing on the wrong surface. */}
      <PageMasthead
        title="Memories"
      />

      {/* Life-Flash entry — the everyone-reachable path (single-event couples
          bypass the account hub via its redirect); flag-gated (Build Plan §5) */}
      {lifeStoryEnabled() ? (
        <Link
          href="/dashboard/life-flash"
          className="sn-card sn-press group mb-8 flex items-center justify-between gap-4 p-4"
        >
          <div>
            <p className="text-sm font-semibold text-ink">Life-Flash</p>
            <p className="text-xs text-ink/55">
              The moments that mattered most, through every camera that was there — gathered
              while you&rsquo;re living them
            </p>
          </div>
          <span
            aria-hidden
            className="text-ink/40 transition-transform group-hover:translate-x-0.5 group-hover:text-terracotta"
          >
            ▶
          </span>
        </Link>
      ) : null}

      {/* THE SHELF — one cover per event, oldest first, above the library grid
          (owner 2026-08-19: "first row should be chronological albums of each
          event. then under it can be all the photos in grid"). */}
      <AlbumShelf userId={user.id} />

      {/* LENSES — the same five words as the tile. Plain links so the page
          stays a Server Component. */}
      <nav aria-label="Memories lenses" className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {LENSES.map(({ key, label }) => {
          const isActive = key === active;
          return (
            <Link
              key={key}
              href={`/dashboard/library?tab=${key}`}
              aria-current={isActive ? 'page' : undefined}
              className={`sn-chip sn-press shrink-0 ${isActive ? 'selected' : ''}`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* ALSO KEPT — reachable, deliberately not a lens. Editorials are stories
          rather than albums; saved vendors are not a memory at all. */}
      <nav
        aria-label="Also kept"
        className="mb-8 flex flex-wrap items-center gap-2"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
          Also kept
        </span>
        {KEPT.map(({ key, label, Icon }) => {
          const isActive = key === active;
          return (
            <Link
              key={key}
              href={`/dashboard/library?tab=${key}`}
              aria-current={isActive ? 'page' : undefined}
              className={`sn-chip sn-press shrink-0 ${isActive ? 'selected' : ''}`}
            >
              <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* key remount on view change → the body cross-fades in (§ 2d) */}
      <div key={active} className="sn-lens-swap">
        {/* All five lenses answer with MEMORIES, from one read. They used to
            answer with `PhotosTab` — one card per event with a photo count —
            which made this page a second list of events, and left People and
            With me as prose because neither is an album. Frames, not
            occasions. */}
        {lens && wall ? (
          <AlaalaLensBody lens={lens} wall={wall} tiles={36} />
        ) : null}
        {active === 'albums' ? (
          <div className="space-y-4">
            <p className="rounded-2xl border border-ink/10 bg-white/60 p-4 text-sm text-ink/60">
              One card per celebration — this is where a whole event downloads at
              once. Your memories themselves live in the lenses above.
            </p>
            <PhotosTab userId={user.id} />
          </div>
        ) : null}
        {active === 'editorials' ? <EditorialsTab userId={user.id} /> : null}
        {active === 'vendors' ? (
          <div className="space-y-4">
            <p className="rounded-2xl border border-ink/10 bg-white/60 p-4 text-sm text-ink/60">
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
    </div>
  );
}
