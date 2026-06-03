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
 * THEME: Clean Editorial palette via legacy `bg-cream` / `text-ink` /
 * `text-terracotta` / `border-ink/N` classes per the 2026-05-30 unification
 * (globals.css :root + html.dark). In light mode terracotta = Royal
 * Champagne Gold #C5A059. In dark mode terracotta = brighter champagne
 * #E0CCA0. Matches the app shell visual language used across dashboard /
 * admin / vendor-dashboard. Supersedes the 2026-05-22 Facebook palette
 * preservation lock on this component.
 *
 * SCOPED MODE: when the catalog is scoped to a single folder via `?folder=…`
 * (per PR #310 / Task #47 2026-05-22), other 11 sections are NOT in the DOM.
 * Tab clicks navigate via full URL preserving sibling params, matching the
 * exact behavior of the retired `FolderTabs` component this strip replaces.
 */

import { useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  Building2,
  ClipboardList,
  UtensilsCrossed,
  Flower2,
  Music,
  Camera,
  Shirt,
  Tent,
  Mail,
  Car,
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
 * Lucide icon per parent (10-parent model, 2026-05-31). Hand-picked to evoke
 * the parent's spirit at a glance while staying within Lucide's iconography:
 *   - Venue → Building2 (reception + ceremony venues)
 *   - Planning → ClipboardList (coordinators)
 *   - Feast → UtensilsCrossed (cake · catering · stations)
 *   - Design → Flower2 (stylist · florals · lights · LED · fireworks)
 *   - Program → Music (band · choir · DJ · performers · host)
 *   - Documentary → Camera (photo & video · editorial · livestream)
 *   - Look → Shirt (attire · HMUA · grooming · jewellery)
 *   - Booths → Tent (food carts · photo booths · experiential)
 *   - Prints → Mail (printing · souvenirs)
 *   - Transport → Car (bridal car · shuttle · escort)
 */
const FOLDER_ICON: Record<WeddingFolder, ComponentType<LucideProps>> = {
  venue: Building2,
  planning: ClipboardList,
  feast: UtensilsCrossed,
  design: Flower2,
  program: Music,
  documentary: Camera,
  look: Shirt,
  booths: Tent,
  prints: Mail,
  transport: Car,
};

export function IconTileFolderStrip({
  tabs,
  totalCount,
  scopedFolder = null,
}: Props) {
  // Active tile defaults to the scoped folder when scoping is on; otherwise
  // start on 'all' and let IntersectionObserver take over (unscoped catalog
  // mode tracks active section on scroll, identical to retired FolderTabs).
  // Hide empty folder tiles (count === 0) so the strip only surfaces folders
  // that actually have vendors — owner directive 2026-06-03 (TASK 3). The
  // scoped folder is always kept so its active tile still renders even if its
  // own count reads 0 in scoped mode. Used by the observer + the render so the
  // active tile is never one we've hidden.
  const visibleTabs = useMemo(
    () => tabs.filter((t) => t.count > 0 || t.folder === scopedFolder),
    [tabs, scopedFolder],
  );

  const initialActive = scopedFolder
    ? (tabs.find((t) => t.folder === scopedFolder)?.slug ?? 'all')
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
      const slug = visibleTabs.find((t) => t.folder === scopedFolder)?.slug ?? 'all';
      setActiveSlug(slug);
      return;
    }
    if (typeof window === 'undefined') return;
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
