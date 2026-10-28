'use client';

import type { ReactNode } from 'react';
import { InfoTip } from '@/app/_components/info-tip';
import { Count } from '@/components/count';
import { SnapCarousel, type CarouselCard } from '@/components/snap-carousel';
import styles from './guests-screen.module.css';

/**
 * 🎠 THE GUESTS SUMMARY ROW, FOR SEATS AND MARCH (owner 2026-10-28, on #7028's side-by-side, verbatim: *"you can improve
 * how this looks. the label of 20 walks, 34 walking can be like the carousel row of guests"*).
 *
 * NOT A SECOND CAROUSEL: the shipped `SnapCarousel` (centre snap, peeks, loop) holding cards drawn in Guests › List's
 * OWN classes (`guests-screen.module.css` — `.summary` · `.card` · `.beside` / `.cardLabel` / `.cardBig` / `.cardSub` ·
 * `.four` / `.mini` / `.miniWord` · the ⓘ in the same top-right spot, `.cardTip`), so the three views read as one page.
 * A card is either a headline (label · big line · small line) or a row of counts, each count a door when it has one.
 *
 * 🔒 READS ARE HONEST: a count that could not be read is `null` and draws "—" with "couldn't read" — never a 0.
 */
export type ViewCount = {
  key: string;
  word: string;
  /** Null: it could not be read — said, never drawn as 0. */
  value: number | null;
  /** A count that is a door (Not walking opens the tray, Unseated the people). */
  onPress?: () => void;
  pressed?: boolean;
};

export type ViewSummaryCard = {
  key: string;
  /** What the card is, for "2 of 3: …" and its ⓘ's name. */
  label: string;
  /** ⓘ — everything that is not the one visible line (owner 2026-10-23, "details go inside the ⓘ"). */
  tip: ReactNode;
} & ({ big: ReactNode; sub?: ReactNode; counts?: never } | { counts: ViewCount[]; big?: never; sub?: never });

function CountCell({ c, id }: { c: ViewCount; id: string }) {
  const body = (
    <>
      <b>{c.value === null ? '—' : <Count value={c.value} id={id} />}</b>{' '}
      <span className={styles.miniWord}>{c.value === null ? `${c.word} · couldn’t read` : c.word}</span>
    </>
  );
  return c.onPress && c.value !== null ? (
    <button type="button" className={styles.mini} aria-pressed={c.pressed ?? false} onClick={c.onPress} data-view-count={c.key}>
      {body}
    </button>
  ) : (
    <span className={styles.mini} data-view-count={c.key}>
      {body}
    </span>
  );
}

export function ViewSummaryCards({ cards, label, view }: { cards: ViewSummaryCard[]; label: string; view: string }) {
  const slides: CarouselCard[] = cards.map((card) => ({
    key: card.key,
    label: card.label,
    node: (
      <div className={styles.card} data-guests-card={card.key}>
        {card.counts ? (
          <span className={styles.four} style={{ gridTemplateColumns: `repeat(${card.counts.length}, minmax(0, 1fr))` }}>
            {card.counts.map((c) => (
              <CountCell key={c.key} c={c} id={`gs-${view}-${c.key}`} />
            ))}
          </span>
        ) : (
          <span className={styles.beside}>
            <span className={styles.cardLabel}>{card.label}</span>
            <span className={styles.cardBig}>{card.big}</span>
            {card.sub ? <span className={styles.cardSub}>{card.sub}</span> : null}
          </span>
        )}
        <InfoTip label={card.label} labelClassName="sr-only" align="end" className={styles.cardTip}>
          {card.tip}
        </InfoTip>
      </div>
    ),
  }));
  return (
    <div className={`${styles.summary} ${styles.rise}`} data-view-summary={view}>
      <SnapCarousel cards={slides} label={label} attrs={{ 'data-guests-carousel': view }} />
    </div>
  );
}

/**
 * 🗂 R4 · THE FIXED COUNT ROW (owner 2026-10-29, on the Guests prototype v12 — *"walks walking and not walking needs to be
 * fixed together, maybe we can use this row to add the preview walk so it is not lost?"*; Seats: Seated · Unseated ·
 * Tables · ✨ Auto arrange). Seats and March do not swipe: their counts are ONE row of equal tiles, the prototype's
 * `.fixedrow` / `.tile` at its one count-row height (`--count-h`, clamp(56px, 7.4cqh, 66px)), and the row's last tile is
 * the view's one forward step (terracotta). Every tile is a door (a frame only on what you press). A count nobody could
 * read is "—", never 0. Four tiles fit at 375 without truncation (labels ellipsize, numbers never do).
 */
export type CountTile =
  | { key: string; word: string; value: number | null; onPress?: () => void }
  | { key: string; word: string; main: true; icon: ReactNode; onPress?: () => void; disabled?: boolean; about?: string };

export function ViewCountRow({ view, tiles }: { view: string; tiles: CountTile[] }) {
  return (
    <div
      data-view-count-row={view}
      className="grid gap-[5px] py-2"
      style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}
    >
      {tiles.map((t) =>
        'main' in t ? (
          <button
            key={t.key}
            type="button"
            onClick={t.onPress}
            disabled={t.disabled || !t.onPress}
            title={t.about}
            aria-label={t.about ? `${t.word} — ${t.about}` : t.word}
            data-view-tile={t.key}
            className="sn-press flex h-[clamp(56px,7.4cqh,66px)] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-sn-accent bg-sn-accent px-1 text-sn-on-accent disabled:opacity-45 [&_svg]:h-[18px] [&_svg]:w-[18px]" // no-card-ok: a pressable count tile (a door), not a container
          >
            {t.icon}
            <span className="max-w-full truncate text-[11px] font-medium">{t.word}</span>
          </button>
        ) : (
          <button
            key={t.key}
            type="button"
            onClick={t.onPress}
            disabled={!t.onPress || t.value === null}
            data-view-tile={t.key}
            aria-label={t.value === null ? `${t.word} — couldn’t read` : `${t.value} ${t.word}`}
            className="sn-press flex h-[clamp(56px,7.4cqh,66px)] min-w-0 flex-col items-start justify-center gap-px rounded-xl border border-ink/10 bg-cream px-[7px] text-left text-ink dark:bg-raised" // no-card-ok: a pressable count tile (a door), not a container
          >
            <span className="text-[21px] font-medium leading-[1.05] tabular-nums">{t.value === null ? '—' : <Count value={t.value} id={`gs-${view}-tile-${t.key}`} />}</span>
            <span className="max-w-full truncate text-[10.5px] tracking-[-0.01em] text-ink/55">{t.value === null ? 'couldn’t read' : t.word}</span>
          </button>
        ),
      )}
    </div>
  );
}
