'use client';

/**
 * IconTileFolderStrip — Airbnb-style horizontal icon-tile strip for the 12
 * wedding folders. Replaces the chip-only `FolderTabs` (mega-column-tabs.tsx)
 * at the top of `/vendors` per owner directive 2026-05-30 (CLAUDE.md decision
 * log row "Marketplace · Airbnb vibe with uniform sizing").
 *
 * WHY: Owner directive verbatim — *"marketplace is doesnt feel user friendly.
 * we want it to be easy to navigate and direct. the buttons being different
 * sizes is also not appealing. can you fix the design of the marketplace and
 * make more app and desktop friendly. most probably similar to the vibe of
 * shopee/zalora/airbnb to create that easy familiar feel of a marketplace"*
 * + follow-up *"make sure it still follow the theme and understand how the
 * overall look of the app works and keep it that way"*.
 *
 * AIRBNB PATTERN: each folder gets a Lucide icon + short label. Horizontal
 * scroll on mobile (snap-x), full row on desktop. Active state highlights
 * with terracotta accent. All tiles are uniform 88px height (touch-friendly
 * per the global 44pt rule) + ~96-112px width so the strip reads as a tight
 * tab bar rather than the prior variable-width chip strip.
 *
 * THEME PRESERVED: uses Facebook palette via legacy `bg-cream` / `text-ink` /
 * `text-terracotta` / `border-ink/N` classes per the 2026-05-22 brand pivot
 * (globals.css:7-46). In light mode terracotta = Facebook blue #1877F2. In
 * dark mode terracotta = brighter blue #2D88FF. Matches the app shell visual
 * language used across dashboard / admin / vendor-dashboard.
 *
 * SCOPED MODE: when the catalog is scoped to a single folder via `?folder=…`
 * (per PR #310 / Task #47 2026-05-22), other 11 sections are NOT in the DOM.
 * Tab clicks navigate via full URL preserving sibling params, matching the
 * exact behavior of the retired `FolderTabs` component this strip replaces.
 */

import { useEffect, useState, type ComponentType } from 'react';
import {
  Church,
  UtensilsCrossed,
  ClipboardList,
  Camera,
  ChefHat,
  Shirt,
  Sparkles,
  Music,
  Flower2,
  Gem,
  Tent,
  Mail,
  LayoutGrid,
  type LucideProps,
} from 'lucide-react';

import {
  WEDDING_FOLDER_SHORT_LABEL,
  type WeddingFolder,
} from '@/lib/taxonomy';

export type FolderTab = {
  folder: WeddingFolder;
  /** Short label rendered in the chip. Defaults to WEDDING_FOLDER_SHORT_LABEL. */
  label: string;
  /** Lowercase slug used as the section anchor (e.g. `#ceremony`). */
  slug: string;
  /** Number of categories (or venue facets) under this folder. */
  count: number;
};

type Props = {
  tabs: ReadonlyArray<FolderTab>;
  /** Combined count across all folders — drives the "All" tile badge. */
  totalCount: number;
  /**
   * When the catalog is scoped to a single folder via `?folder=…`, the other
   * 11 sections are NOT rendered in the DOM. See `FolderTabs` retirement
   * notes — same scoping contract preserved verbatim.
   */
  scopedFolder?: WeddingFolder | null;
};

/**
 * Lucide icon per folder. Hand-picked to evoke the folder's spirit at glance
 * while staying within Lucide's iconography (avoids inconsistency that comes
 * from mixing icon families). Cross-references:
 *   - Ceremony → Church (covers parish / mosque / chapel / civil registrar)
 *   - Reception → UtensilsCrossed (banquet / garden / beach / tent venues)
 *   - Planning → ClipboardList (coordinators · logistics · stationery)
 *   - Photo & Video → Camera
 *   - Catering → ChefHat
 *   - Attire → Shirt (bridal gown + groom suit + entourage)
 *   - HMUA → Sparkles
 *   - Music & Program → Music
 *   - Decor & Sound → Flower2 (florals dominate the icon)
 *   - Rings → Gem
 *   - Booths & Stations → Tent (cocktail / photobooth / experiential)
 *   - Invites → Mail
 */
const FOLDER_ICON: Record<WeddingFolder, ComponentType<LucideProps>> = {
  ceremony: Church,
  reception: UtensilsCrossed,
  planning_logistics_travel: ClipboardList,
  photo_video: Camera,
  catering: ChefHat,
  attire: Shirt,
  hair_makeup: Sparkles,
  music_program: Music,
  decor_florals_sound: Flower2,
  rings_accessories: Gem,
  booths_stations: Tent,
  invitations_keepsakes: Mail,
};

export function IconTileFolderStrip({
  tabs,
  totalCount,
  scopedFolder = null,
}: Props) {
  // 2026-05-30 PM (second pass) — owner directives on strip visibility:
  //   (a) *"rings have 0 vendors. this should be hidden"* — folders with
  //       count === 0 don't earn a tile slot in universal browse. The
  //       count comes from `buckets.get(folder)?.length` in page.tsx
  //       (post-hide-empty surviving categories per folder). Reception's
  //       hardcoded RECEPTION_FACET_COUNT (=6) means Reception always
  //       passes this filter — intentional, venue facets ARE the
  //       categories for Reception per the existing comment in page.tsx
  //       around RECEPTION_FACET_COUNT.
  //   (b) *"when a parent category is picked, we will only show that
  //       category and the rest are hidden"* — scoped mode collapses
  //       the strip down to just the scoped folder + the All tile
  //       (always visible as the escape hatch). Couples in scoped mode
  //       are focused on one folder; the other 11 tabs are noise. To
  //       switch folders, click All to escape to universal browse,
  //       then pick the next folder.
  //   When scoped to a folder with count === 0 (rare — host typed
  //   /vendors?folder=rings_accessories directly), the scoped tab still
  //   renders so the active state has somewhere to live.
  const visibleTabs =
    scopedFolder !== null
      ? tabs.filter((t) => t.folder === scopedFolder)
      : tabs.filter((t) => t.count > 0);

  // Active tile defaults to the scoped folder when scoping is on; otherwise
  // start on 'all' and let IntersectionObserver take over (unscoped catalog
  // mode tracks active section on scroll, identical to retired FolderTabs).
  const initialActive = scopedFolder
    ? (visibleTabs.find((t) => t.folder === scopedFolder)?.slug ?? 'all')
    : 'all';
  const [activeSlug, setActiveSlug] = useState<string>(initialActive);
  // Captured on mount in the browser so we can preserve sibling URL params
  // when navigating between folders in scoped mode. SSR returns empty string;
  // first paint omits sibling params, then the useEffect rebuilds them.
  const [siblingParams, setSiblingParams] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    params.delete('folder'); // tab hrefs set folder per-tab
    const rest = params.toString();
    setSiblingParams(rest);
  }, []);

  useEffect(() => {
    // Scoped mode: only one section exists. Pin active tile to the scoped
    // folder; skip IntersectionObserver.
    if (scopedFolder !== null) {
      const slug =
        visibleTabs.find((t) => t.folder === scopedFolder)?.slug ?? 'all';
      setActiveSlug(slug);
      return;
    }
    if (typeof window === 'undefined') return;
    // Observe only the visible tabs (post zero-count filter). Sections
    // for hidden tabs aren't in the DOM anyway (page.tsx folder loop
    // emits sections per WEDDING_FOLDER_ORDER but the zero-count folders
    // return null inside the map). Iterating visibleTabs avoids
    // getElementById misses on hidden folders.
    const targets = visibleTabs
      .map((t) => document.getElementById(t.slug))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          );
        const top = visible[0];
        if (top) setActiveSlug(top.target.id);
      },
      {
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0,
      },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [visibleTabs, scopedFolder]);

  /**
   * Build the href for a tile. Unscoped mode → hash-only (`#<slug>`).
   * Scoped mode → full URL with `?folder=<slug>` preserving sibling params
   * (matches retired FolderTabs.hrefFor verbatim — same contract).
   */
  const hrefFor = (slug: string): string => {
    if (scopedFolder === null) {
      return `#${slug}`;
    }
    const suffix = siblingParams ? `&${siblingParams}` : '';
    if (slug === 'all') {
      return siblingParams ? `/vendors?${siblingParams}#all` : '/vendors#all';
    }
    return `/vendors?folder=${slug}${suffix}#${slug}`;
  };

  return (
    <nav
      aria-label="Wedding folders"
      // Sticky placement — owner directive 2026-05-30 (later same day, PR
      // #656) flipped the StickyMarketplaceHeader to `fixed bottom-0` on
      // mobile (search lives at the thumb zone). With the header gone from
      // the top on mobile, the folder strip becomes the top sticky element:
      // `top-0` on mobile. On desktop the header is still pinned at top-0,
      // so the strip stacks below it at `sm:top-[88px]` (header's natural
      // height: eyebrow row + search/filter row + py padding). Both stay
      // visible while content scrolls below on either viewport. -mx-N
      // negatives break out of the page's px-N container so the horizontal
      // scroll feels edge-to-edge per the Airbnb pattern. (Page-level
      // max-w-6xl cap retired 2026-05-30 per PR #655 — content now spans
      // the viewport minus only the responsive px-4/px-6/px-8 gutter,
      // matching the homepage's full-bleed feel.) backdrop-blur +
      // bg-cream/95 keeps the glassy stack feel.
      className="sticky top-0 z-20 -mx-4 border-b border-ink/10 bg-cream/95 backdrop-blur sm:top-[88px] sm:-mx-6 lg:-mx-8"
    >
      <ul
        // snap-x snap-mandatory gives airpod-style click-to-tile snap on touch
        // while keeping smooth horizontal scroll on mouse / trackpad. flex
        // gap-1 keeps the row tight. px keeps the first tile clear of the
        // edge so the leading icon doesn't get clipped on swipe.
        className="flex snap-x snap-mandatory items-stretch gap-1 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8"
      >
        <li className="snap-start shrink-0">
          <TileLink
            href={hrefFor('all')}
            active={activeSlug === 'all'}
            label="All"
            count={totalCount}
            Icon={LayoutGrid}
          />
        </li>
        {visibleTabs.map((tab) => {
          const Icon = FOLDER_ICON[tab.folder];
          const label =
            WEDDING_FOLDER_SHORT_LABEL[tab.folder] ?? tab.label;
          return (
            <li key={tab.slug} className="snap-start shrink-0">
              <TileLink
                href={hrefFor(tab.slug)}
                active={activeSlug === tab.slug}
                label={label}
                count={tab.count}
                Icon={Icon}
              />
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function TileLink({
  href,
  active,
  label,
  count,
  Icon,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  Icon: ComponentType<LucideProps>;
}) {
  // Uniform tile dimensions per owner's "buttons being different sizes is
  // also not appealing" complaint. w-[96px] minimum so the strip reads as a
  // tight tab bar even with short labels (All, Rings, Music). h-[78px] keeps
  // each tile compact enough that the full strip fits within a single
  // viewport row on tablet / desktop without wrapping.
  const base =
    'group flex h-[78px] w-[96px] flex-col items-center justify-center gap-1.5 rounded-xl border px-2 transition-all sm:w-[104px]';
  const cls = active
    ? `${base} border-terracotta bg-terracotta/8 text-terracotta`
    : `${base} border-ink/10 bg-cream text-ink/65 hover:border-terracotta/40 hover:text-terracotta`;
  return (
    <a
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cls}
    >
      <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      <div className="flex flex-col items-center leading-tight">
        <span className="text-[12px] font-medium">{label}</span>
        <span className="font-mono text-[9px] opacity-60">{count}</span>
      </div>
    </a>
  );
}
