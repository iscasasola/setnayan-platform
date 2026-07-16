import Link from 'next/link';
import {
  Globe,
  Video,
  Sparkles,
  Newspaper,
  Images,
  Film,
  Music,
  Palette,
  Share2,
  Trophy,
  BookOpen,
  Tag,
  Gift,
  Clapperboard,
} from 'lucide-react';
import { WebsiteSurface } from './_surfaces/website-surface';
import { HeroVideoSurface } from './_surfaces/hero-video-surface';
import { RevealStudioSurface } from './_surfaces/reveal-studio-surface';
import { RecapsSurface } from './_surfaces/recaps-surface';
import { RealStoriesSurface } from './_surfaces/real-stories-surface';
import { StorytellersSurface } from './_surfaces/storytellers-surface';
import { PatiktokSurface } from './_surfaces/patiktok-surface';
import { SongsSurface } from './_surfaces/songs-surface';
import { MoodboardLibrarySurface } from './_surfaces/moodboard-library-surface';
import { SpotlightAwardsSurface } from './_surfaces/spotlight-awards-surface';
import { JournalSpotlightsSurface } from './_surfaces/journal-spotlights-surface';
import { DiscountCodesSurface } from './_surfaces/discount-codes-surface';
import { ReferralsSurface } from './_surfaces/referrals-surface';
import { SocialQueueSurface } from './_surfaces/social-queue-surface';

import { requireAdmin } from '@/lib/admin/require-admin';
/**
 * Studio Studio (slice 1) — the tabbed /admin/studio shell that consolidates
 * the Studio menu (the `media` group in ADMIN_NAV_GROUPS) into one surface.
 * The Studio menu has 13 surfaces — too many for a horizontal pill strip (it
 * would blow past the ≤5-pill rule), so this shell uses a VERTICAL NAV RAIL
 * grouped into two labeled sections (Content · Marketing), mirroring the final
 * IA. On mobile the rail collapses to a single horizontally-scrollable strip.
 *
 * Slices 1–2 wired all 8 Content surfaces inline via ?tab=; slice 3 wires 4 of
 * the 5 Marketing surfaces (Spotlight Awards · Journal Spotlights · Discount
 * codes · Referrals). Only Social queue still links OUT to its still-standalone
 * legacy route (converted in slice 4) so the full IA is visible and nothing is
 * a dead link — exactly the Accounts Studio TAB_STRIP pattern.
 *
 * The shared sidebar matcher is query-aware (#2796), so repointing sidebar
 * hrefs to /admin/studio?tab=<key> lights the right item without double-
 * lighting siblings.
 *
 * force-dynamic: the wired surface bodies do admin-client reads
 * (createAdminClient) so this must never be statically generated.
 */
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Studio · Admin' };

// The WIRED tabs this slice renders inline (grows in later slices).
const TABS = [
  'website',
  'hero-video',
  'reveal-studio',
  'recaps',
  'real-stories',
  'storytellers',
  'patiktok',
  'songs',
  'moodboard-library',
  'spotlight-awards',
  'journal-spotlights',
  'discount-codes',
  'referrals',
  'social-queue',
] as const;
type Tab = (typeof TABS)[number];

// First value of a (possibly-array) search param — Next passes ?x=a&x=b as an
// array. Guards every param read below against that shape.
function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function coerceTab(v: string | undefined): Tab {
  return (TABS as readonly string[]).includes(v ?? '') ? (v as Tab) : 'website';
}

// The full 14-item Studio IA, grouped Content · Marketing (Storytellers joined
// as the 14th sibling — PR-D 2026-07-16). `wired` items render
// inline via ?tab=; the not-yet-wired items link out to their still-standalone
// legacy routes (converted to real tabs in later slices) so the final IA is
// visible and nothing is a dead link. Later slices flip `wired:true` + add a
// render branch, exactly like the Accounts Studio TAB_STRIP.
type RailItem = {
  key: string;
  label: string;
  icon: typeof Globe;
  group: 'Content' | 'Marketing';
  wired: boolean;
  legacyHref: string;
};

const RAIL: RailItem[] = [
  // ── Content (9) ─────────────────────────────────────────────────────────
  { key: 'website', label: 'Website', icon: Globe, group: 'Content', wired: true, legacyHref: '/admin/website' },
  { key: 'hero-video', label: 'Hero video', icon: Video, group: 'Content', wired: true, legacyHref: '/admin/hero-video' },
  { key: 'reveal-studio', label: 'Reveal Studio', icon: Sparkles, group: 'Content', wired: true, legacyHref: '/admin/reveal-studio' },
  { key: 'real-stories', label: 'Real Stories', icon: Newspaper, group: 'Content', wired: true, legacyHref: '/admin/real-stories' },
  // Storytellers (PR-D 2026-07-16) — chapter featuring for the /realstories
  // "From Our Storytellers" shelf. Born inside the studio hub (no legacy
  // standalone route ever existed), so legacyHref is its own tab URL.
  { key: 'storytellers', label: 'Storytellers', icon: Clapperboard, group: 'Content', wired: true, legacyHref: '/admin/studio?tab=storytellers' },
  { key: 'recaps', label: 'Recaps', icon: Images, group: 'Content', wired: true, legacyHref: '/admin/recaps' },
  { key: 'patiktok', label: 'Patiktok', icon: Film, group: 'Content', wired: true, legacyHref: '/admin/patiktok' },
  { key: 'songs', label: 'Songs', icon: Music, group: 'Content', wired: true, legacyHref: '/admin/songs' },
  { key: 'moodboard-library', label: 'Moodboard library', icon: Palette, group: 'Content', wired: true, legacyHref: '/admin/moodboard-library' },
  // ── Marketing (5) ───────────────────────────────────────────────────────
  { key: 'social-queue', label: 'Social queue', icon: Share2, group: 'Marketing', wired: true, legacyHref: '/admin/social-queue' },
  { key: 'spotlight-awards', label: 'Spotlight Awards', icon: Trophy, group: 'Marketing', wired: true, legacyHref: '/admin/spotlight-awards' },
  { key: 'journal-spotlights', label: 'Journal Spotlights', icon: BookOpen, group: 'Marketing', wired: true, legacyHref: '/admin/journal-spotlights' },
  { key: 'discount-codes', label: 'Discount codes', icon: Tag, group: 'Marketing', wired: true, legacyHref: '/admin/discount-codes' },
  { key: 'referrals', label: 'Referrals', icon: Gift, group: 'Marketing', wired: true, legacyHref: '/admin/referrals' },
];

const GROUPS = ['Content', 'Marketing'] as const;

function railHref(item: RailItem): string {
  return item.wired ? `/admin/studio?tab=${item.key}` : item.legacyHref;
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminStudioPage({ searchParams }: Props) {
  await requireAdmin();
  const search = await searchParams;
  const tab = coerceTab(first(search.tab));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:gap-8 lg:px-8">
      {/* Vertical nav rail — two labeled groups (Content · Marketing). On lg+
          it's a fixed ~15rem left column; below lg it collapses to a single
          horizontally-scrollable strip so it never eats the screen. */}
      <nav
        aria-label="Studio sections"
        className="shrink-0 lg:w-60"
      >
        {/* Desktop: stacked groups. Mobile: one horizontal scroll strip. */}
        <div className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:gap-4 lg:overflow-visible lg:pb-0">
          {GROUPS.map((group) => (
            <div key={group} className="flex shrink-0 items-center gap-1 lg:flex-col lg:items-stretch lg:gap-1">
              <p className="hidden px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45 lg:block">
                {group}
              </p>
              {RAIL.filter((i) => i.group === group).map((item) => {
                const active = item.wired && item.key === tab;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.key}
                    href={railHref(item)}
                    aria-current={active ? 'page' : undefined}
                    className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:whitespace-normal ${
                      active
                        ? 'bg-terracotta/10 text-terracotta-700'
                        : 'text-ink/65 hover:bg-ink/5 hover:text-ink'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </nav>

      {/* Active surface body. */}
      <div className="min-w-0 flex-1">
        {tab === 'hero-video' ? (
          <HeroVideoSurface />
        ) : tab === 'reveal-studio' ? (
          <RevealStudioSurface />
        ) : tab === 'recaps' ? (
          <RecapsSurface ok={first(search.ok) ?? null} error={first(search.error) ?? null} />
        ) : tab === 'real-stories' ? (
          <RealStoriesSurface ok={first(search.ok)} error={first(search.error)} />
        ) : tab === 'storytellers' ? (
          <StorytellersSurface ok={first(search.ok)} error={first(search.error)} />
        ) : tab === 'patiktok' ? (
          <PatiktokSurface />
        ) : tab === 'songs' ? (
          <SongsSurface
            q={first(search.q)}
            merged={first(search.merged)}
            deleted={first(search.deleted)}
            error={first(search.error)}
          />
        ) : tab === 'moodboard-library' ? (
          <MoodboardLibrarySurface />
        ) : tab === 'spotlight-awards' ? (
          <SpotlightAwardsSurface ok={first(search.ok)} error={first(search.error)} />
        ) : tab === 'journal-spotlights' ? (
          <JournalSpotlightsSurface ok={first(search.ok)} error={first(search.error)} />
        ) : tab === 'discount-codes' ? (
          <DiscountCodesSurface
            filter={first(search.filter)}
            created={first(search.created)}
            updated={first(search.updated)}
            disabled={first(search.disabled)}
            enabled={first(search.enabled)}
          />
        ) : tab === 'referrals' ? (
          <ReferralsSurface />
        ) : tab === 'social-queue' ? (
          <SocialQueueSurface
            posted={first(search.posted)}
            vendor_posted={first(search.vendor_posted)}
            taken_down={first(search.taken_down)}
            settings_saved={first(search.settings_saved)}
            pulled={first(search.pulled)}
            posted_now={first(search.posted_now)}
            retried={first(search.retried)}
            body_saved={first(search.body_saved)}
            announcement_created={first(search.announcement_created)}
            evergreen_saved={first(search.evergreen_saved)}
            error={first(search.error)}
          />
        ) : (
          <WebsiteSurface page={first(search.page)} />
        )}
      </div>
    </div>
  );
}
