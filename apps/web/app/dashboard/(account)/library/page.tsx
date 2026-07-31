import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  Images,
  Heart,
  Newspaper,
  Sparkles,
  Users,
  UserCircle,
  Settings,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { lifeStoryEnabled } from '@/lib/life-story-flag';
import { personLifeStoriesEnabled } from '@/lib/person-life-stories';
import { PhotosTab } from './_components/photos-tab';
import { VendorsTab } from './_components/vendors-tab';
import { EditorialsTab } from './_components/editorials-tab';

export const metadata = { title: 'Alaala' };

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
 * The lenses are now the page's primary navigation, and they are not a new
 * read: `Album.role` is already `'couple' | 'guest'`, which IS Owned vs
 * Attended, so three of the five are a filter over albums we already fetch.
 * The tile and the page now answer the same question with the same words.
 *
 * ── WHAT THE LENSES CANNOT ANSWER ──────────────────────────────────────────
 * People and With me are not albums, and neither is faked here. People is a
 * real doorway to `/dashboard/people` (which renders its own honest coming-
 * soon preview while `peopleConnectionsEnabled()` is off). With me is gated by
 * the counsel-gated `personLifeStoriesEnabled()` and says so plainly rather
 * than rendering an empty grid that looks broken.
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
/** Kept-but-not-a-memory views. Reachable, not peers of the lenses. */
const KEPT_KEYS = ['editorials', 'vendors'] as const;

type LensKey = (typeof LENS_KEYS)[number];
type KeptKey = (typeof KEPT_KEYS)[number];
type ViewKey = LensKey | KeptKey;

const ALL_KEYS: readonly ViewKey[] = [...LENS_KEYS, ...KEPT_KEYS];

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

  const withMeOn = personLifeStoriesEnabled();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      {/* The account spokes' documented convention is a "Back to home" link
          (see (account)/layout.tsx) — and home is where the Alaala tile lives,
          so "back to events" named the wrong thing on the wrong surface. */}
      <Link href="/dashboard" className="sn-chip sn-press mb-4 w-fit">
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Back to home
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="sn-eye">
            <Sparkles aria-hidden strokeWidth={1.75} />
            Kept for life
          </p>
          <h1 className="sn-h1">Alaala</h1>
          <p className="max-w-prose text-base text-ink/65">
            Every photo, video and story you&rsquo;re part of — across every event you
            host or attend. Same Alaala as the tile on your home, opened full.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/dashboard/profile" className="sn-chip sn-press">
            <UserCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Profile
          </Link>
          <Link href="/dashboard/profile#settings" className="sn-chip sn-press">
            <Settings aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Settings
          </Link>
        </div>
      </header>

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

      {/* LENSES — the same five words as the tile. Plain links so the page
          stays a Server Component. */}
      <nav aria-label="Alaala lenses" className="mb-3 flex gap-2 overflow-x-auto pb-1">
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
        {active === 'recent' || active === 'owned' || active === 'attended' ? (
          // `active` is narrowed to the three album lenses by the test above.
          <PhotosTab userId={user.id} lens={active} />
        ) : null}
        {active === 'people' ? <PeopleLens /> : null}
        {active === 'with_me' ? <WithMeLens enabled={withMeOn} /> : null}
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

/**
 * The People lens. The Alaala tile shows faces from the moment graph when
 * NEXT_PUBLIC_LIFE_STORY is on; this surface does NOT re-derive them — a
 * second, drifting source of the same faces is exactly the defect this PR
 * exists to remove. It carries the tile's own sentence and the real door.
 */
function PeopleLens() {
  return (
    <div className="rounded-2xl border border-dashed border-ink/15 p-10 text-center">
      <span className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
        <Users aria-hidden className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <p className="mx-auto max-w-sm text-sm text-ink/60">
        Family, godparents and friends — suggested from your events, confirmed by
        both sides. Connections are coming soon.
      </p>
      <Link
        href="/dashboard/people"
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-terracotta px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-terracotta-600"
      >
        Open People
        <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={2} />
      </Link>
    </div>
  );
}

/**
 * The With-me lens. Cross-event participant media (Phase 1.5) is COUNSEL-gated
 * behind `personLifeStoriesEnabled()`, off in production. An empty grid would
 * read as a bug; the honest line reads as a promise, which is what it is.
 */
function WithMeLens({ enabled }: { enabled: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink/15 p-10 text-center">
      <span className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
        <Images aria-hidden className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <p className="mx-auto max-w-sm text-sm text-ink/60">
        {enabled
          ? 'Photos and clips you appear in gather here, event by event — open an album below to see the ones you’re tagged in.'
          : 'Photos and clips you appear in will gather here. Until then, the Attended lens shows every event whose photos you can already open.'}
      </p>
      <Link
        href="/dashboard/library?tab=attended"
        className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-4 py-2 text-sm font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
      >
        See Attended
        <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={2} />
      </Link>
    </div>
  );
}
