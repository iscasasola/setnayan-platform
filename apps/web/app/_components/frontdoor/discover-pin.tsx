'use client';

/**
 * Discover's pinned row — "Discover ▾ · N upcoming · Following · ⚙" (walker D2a, 18 Nov 2026; approved 28 Oct, drawn in
 * `user_dashboard_clean_2026-11-17_fable.html`). The SAME `PinnedRow` Home, People and Memories wear — never a second
 * copy — pinned by the same `CollapsingTop`. What it counts and lists is `lib/discover-pin.ts`.
 *
 *   Discover ▾  — jumps to one of Discover's own parts (a part not on the page is skipped).
 *   N upcoming  — the upcoming events the shelves read; a refused read says "Couldn't count", never 0.
 *   Following   — a toggle: only the people you follow (`?following=1`); pressed again it shows everyone.
 *   ⚙           — Profile & settings, Home's own ⚙.
 */
import { useRouter } from 'next/navigation';
import { UserCheck } from 'lucide-react';
import { CollapsingTop } from '@/app/_components/collapsing-top/collapsing-top';
import { PinnedRow } from '@/app/_components/pinned-row/pinned-row';
import { HomeGear } from '@/app/dashboard/(launcher)/_components/home-pin';
import { DISCOVER_PARTS, discoverFollowingHref } from '@/lib/discover-pin';

function scrollToPart(selector: string) {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;
  if (selector === '[data-fd-page]') window.scrollTo({ top: 0, behavior: 'smooth' });
  else el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function DiscoverPinnedRow({ upcoming, following }: { upcoming: number | null; following: boolean }) {
  const router = useRouter();
  const options = DISCOVER_PARTS.map((p) => ({ key: `part:${p.key}`, label: p.label, group: 'Discover' }));
  const row = (
    <PinnedRow
      data={{ 'data-discover-pinned': '' }}
      picker={{
        label: 'Discover — its parts',
        value: 'part:all',
        buttonText: 'Discover',
        options,
        onPick: (k) => {
          const part = DISCOVER_PARTS.find((p) => `part:${p.key}` === k);
          if (part) scrollToPart(part.selector);
        },
      }}
      doors={
        upcoming === null
          ? []
          : [{ key: 'upcoming', n: upcoming, word: 'upcoming', on: false, onTap: () => scrollToPart(DISCOVER_PARTS[1]!.selector) }]
      }
      note={upcoming === null ? 'Couldn’t count upcoming' : null}
      action={{
        // The drawing's one word, both ways; the ✓ says it is on (a press turns it off).
        label: following ? 'Following ✓' : 'Following',
        ariaLabel: following ? 'Showing only people you follow — show everyone' : 'Show only people you follow',
        icon: UserCheck,
        mark: 'discover-following',
        onTap: () => router.push(discoverFollowingHref(following), { scroll: false }),
      }}
      gear={<HomeGear />}
    />
  );
  return (
    // ↔ The row wears the page's own gutter (16 px, 24 from 1024 — the `px-4 lg:px-6` Discover's content carries):
    // `.sn-ct-row` is absolute at left 0 / right 0, so without it "Discover ▾" sat on the screen edge (BUILD_RULES §2,
    // "left and right gutters equal, at least 16 px"; measured x = 0 at 390 px, 19 Nov).
    <CollapsingTop rowAtRest data={{ 'discover-top': '' }} row={<div className="w-full min-w-0 px-4 lg:px-6">{row}</div>}>
      {/* The room the row is drawn over at rest — the row's own 44 + a breath, as Home reserves it. */}
      <div style={{ height: 'var(--sn-pin-h, 44px)', marginTop: 8 }} aria-hidden />
    </CollapsingTop>
  );
}
