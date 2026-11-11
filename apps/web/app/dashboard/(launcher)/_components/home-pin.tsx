'use client';

import { useRouter } from 'next/navigation';
import { Plus, Search, Settings } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { ActionButton } from '@/components/action-button';
import { PinnedRow } from '@/app/_components/pinned-row/pinned-row';
import { usePinFold } from '@/app/_components/pinned-row/use-pin-fold';
import type { PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { HOME_SEG_LABEL, homeSegHref, type HomeSeg } from '@/lib/home-segments';
import hp from './home-profile.module.css';

/**
 * home-pin.tsx — 📌 HOME'S ONE PINNED ROW (owner 11 Nov 2026, "One profile page approve" — v3 row 7).
 *
 *   [Segment ▾] · doors · one action · ⚙
 *
 * ONE row for every section of Home — the app's shared `PinnedRow`, never a copy. The picker (the shipped `PickMenu`,
 * grouped) holds Home's sections and the section's own views; the doors are the section's cheap, MEASURED numbers
 * only (events planning · celebrated; service cards · online) — People and Memories carry words, no number (v3: a
 * number we have not read is worse than none); the action is the section's one verb (＋ Event · ＋ Card; Memories has
 * none, so the seat stays empty); ⚙ is Profile & settings. People keeps its OWN shipped pinned row
 * (`people-pinned-row.tsx`), whose picker gains the same "Home" group — so each section still has exactly one row.
 *
 * Everything crossing from the server is plain data (hrefs, words, numbers); the row turns it into presses here.
 * 🔒 lib/home-is-the-profile.test.ts
 */

export type HomePinOption = { key: string; label: string; group: string; href: string };
export type HomePinDoor = { key: string; n: number; word: string; href: string; hot?: boolean };
export type HomePinAction = { label: string; ariaLabel?: string; href: string; mark: string };

/** The picker's "Home" group — the sections, as `seg:<section>` keys. */
export function homeSegOptions(segs: readonly HomeSeg[]): HomePinOption[] {
  return segs.map((s) => ({ key: `seg:${s}`, label: HOME_SEG_LABEL[s], group: 'Home', href: homeSegHref(s) }));
}

/** ⚙ — Profile & settings (the avatar sheet's same door). A link, so it needs no sheet of its own. */
export function HomeGear() {
  return (
    <span className="inline-flex shrink-0" data-home-gear="">
      <ActionButton tone="neutral" iconOnly icon={Settings} label="Profile & settings" href="/dashboard/profile" />
    </span>
  );
}

/** Goes to `href` — an in-page `#anchor` scrolls to its section instead of leaving. */
function useGo() {
  const router = useRouter();
  return (href: string) => {
    if (href.startsWith('#')) {
      document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    router.push(href, { scroll: false });
  };
}

export function HomePinnedRow({
  seg,
  segs,
  sub = [],
  doors,
  note = null,
  action = null,
}: {
  seg: HomeSeg;
  segs: readonly HomeSeg[];
  /** The section's own views — a group after "Home". */
  sub?: readonly HomePinOption[];
  doors: readonly HomePinDoor[];
  note?: string | null;
  action?: HomePinAction | null;
}) {
  const go = useGo();
  const options: (PickOption & { href: string })[] = [...homeSegOptions(segs), ...sub];
  // 📌 Once the page runs under it, the row folds its doors into one slim line and back (the shared `usePinFold` +
  // `pin-fold.css`, the supplier pages' own motion; none under reduced motion).
  const pinRef = useRef<HTMLDivElement>(null);
  usePinFold(pinRef);
  return (
    <div ref={pinRef} className={hp.stick} data-home-pin={seg} data-pin-fold="">
      <PinnedRow
        data={{ 'data-home-pinned': seg }}
        picker={{
          label: `${HOME_SEG_LABEL[seg]} — sections and views`,
          value: `seg:${seg}`,
          buttonText: HOME_SEG_LABEL[seg],
          options,
          onPick: (k) => {
            const o = options.find((x) => x.key === k);
            if (o) go(o.href);
          },
        }}
        doors={doors.map((d) => ({ key: d.key, n: d.n, word: d.word, hot: d.hot, on: false, onTap: () => go(d.href) }))}
        note={note}
        action={action ? { label: action.label, ariaLabel: action.ariaLabel, icon: Plus, mark: action.mark, href: action.href } : null}
        gear={<HomeGear />}
      />
    </div>
  );
}

/**
 * The section's FIRST ROW — its search, which was the bottom thumb row's field (v3 row 7: "the thumb rows' search
 * fields become each segment's first row, not pinned"). It scrolls with the page.
 */
export function HomeFindRow({ words, children, tour }: { words: string; children: ReactNode; tour?: string }) {
  return (
    <label className={hp.find} data-home-find={words} data-tour={tour}>
      <Search className="h-4 w-4 shrink-0 text-ink/55" strokeWidth={1.9} aria-hidden />
      {children}
    </label>
  );
}
