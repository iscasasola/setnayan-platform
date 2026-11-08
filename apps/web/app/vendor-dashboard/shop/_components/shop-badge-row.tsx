'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Gift } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { ImageBadge } from '@/app/_components/image-badge';
import { ProgressRing } from '@/app/_components/progress-ring';
import { nextGoalLine, nowLine, type BadgeTile } from '@/lib/shop-badge-row';
import { RING_COLOUR, RING_EASE, RING_MS, ringDelay, ringGroup, ringPct } from '@/lib/badge-ring';

/**
 * 🏅 SHOP › BADGES — ONE row of image badges, the closest goal first with "N to go" (owner v110/v112; spec §1). Tap a
 * badge → its sheet: Now · the bar (ladders only) · "Next goal: N — M to go" · the reward box from the ONE reward table
 * (`lib/badge-rewards.ts`, #7298 with the APPROVED 8 Nov table). No graph (v112). Rating has no goal.
 *
 * The tiles are `shopBadgeRow` (`lib/shop-badge-row.ts`) — built on the shipped tracker, never beside it.
 * `tiles === null` = the badges could not be read: "Couldn't load your badges", never an empty shelf.
 *
 * 🏅 EVERY BADGE SITS IN ITS PROGRESS RING (Build 2 §10 #32, owner 8 Nov: *"a progress bar for all the badges… like a
 * ring"*): the shipped `ProgressRing`, thick and round-capped, filled by `lib/badge-ring.ts` (a ladder toward its next
 * tier · an earned one-off full · not yet empty · Rating = average / 5), coloured by group with a faint track of the same
 * colour. It draws in ONCE when the badge scrolls into view (1.1 s, staggered); reduced motion = drawn still.
 * 🔒 lib/shop-badge-row.test.ts · lib/badge-ring.test.ts · shop/the-shop-tab-is-v113.test.ts
 */
export function ShopBadgeRow({ tiles }: { tiles: BadgeTile[] | null }) {
  const [open, setOpen] = useState<BadgeTile | null>(null);
  return (
    <section aria-labelledby="shop-badges-h" data-shop-badges="" data-tour="shop-badges" className="scroll-mt-24" id="badges">
      <div className="flex items-baseline justify-between px-4 pb-2 pt-5">
        <h2 id="shop-badges-h" className="sn-eye">
          Badges
        </h2>
        <span className="text-[11.5px] text-ink/50">grey = not yet · tap one</span>
      </div>
      {tiles === null ? (
        <p role="status" className="px-4 text-[13.5px] text-ink/65" data-shop-badges-unread="">
          Couldn&rsquo;t load your badges just now.
        </p>
      ) : (
        <ul className="flex snap-x gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-badge-row="">
          {tiles.map((t, i) => (
            <li key={t.key} className="flex-none snap-start">
              <button
                type="button"
                onClick={() => setOpen(t)}
                className="flex w-[96px] flex-col items-center gap-1 rounded-2xl px-1 pb-1 pt-1 text-center focus-visible:outline-2"
                data-badge-tile={t.key}
                data-badge-goal={t.goal ? '' : undefined}
                aria-label={`${t.title} · ${t.sub}`}
              >
                <BadgeRing tile={t} i={i}>
                  <ImageBadge shape={t.shape} face={t.face} num={t.num} mini={t.mini} on={t.on} uid={`row-${t.key}`} size={56} />
                </BadgeRing>
                <b className="line-clamp-2 text-[12.5px] font-semibold leading-tight text-ink">{t.title}</b>
                <small className={`text-[11.5px] leading-tight ${t.goal ? 'font-semibold text-[color:var(--m-orange-deep)]' : 'text-ink/55'}`}>{t.sub}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open ? <BadgeSheet tile={open} onClose={() => setOpen(null)} /> : null}
    </section>
  );
}

/** The ring around one badge — empty until it scrolls into view, then drawn in once (staggered by its place in the row). */
function BadgeRing({ tile, i, children }: { tile: BadgeTile; i: number; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const colour = RING_COLOUR[ringGroup(tile)];
  const pct = ringPct(tile);
  return (
    <span ref={ref} className="inline-flex" data-badge-ring={ringGroup(tile)} data-badge-ring-pct={pct}>
      <ProgressRing
        // Before it is seen the ring is its track alone; seen, it sweeps 0 → pct once (the global reduced-motion rule
        // snaps the sweep to its end).
        key={seen ? 'seen' : 'unseen'}
        pct={seen ? pct : 0}
        size={84}
        stroke={7}
        color={colour}
        trackColor={`color-mix(in srgb, ${colour} 16%, transparent)`}
        sweep={seen ? { delayMs: ringDelay(i), durationMs: RING_MS, easing: RING_EASE } : undefined}
      >
        {children}
      </ProgressRing>
    </span>
  );
}

function BadgeSheet({ tile, onClose }: { tile: BadgeTile; onClose: () => void }) {
  const hid = useId();
  const goal = nextGoalLine(tile);
  const reward = tile.row.reward;
  const l = tile.ladder;
  return (
    <Sheet open onClose={onClose} labelledById={hid} rise>
      <div className="space-y-4 px-4 pb-6 pt-2" data-badge-sheet={tile.key}>
        <div className="flex flex-col items-center gap-2 pt-2">
          <ImageBadge shape={tile.shape} face={tile.face} num={tile.num} mini={tile.mini} on={tile.on} uid={`sheet-${tile.key}`} size={120} />
          <h2 id={hid} className="text-[15px] font-semibold text-ink">
            {tile.title}
          </h2>
        </div>
        <p className="text-[13.5px] text-ink/65">{tile.how}</p>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[17px] font-semibold leading-snug text-ink" data-badge-now="">
              {nowLine(tile)}
            </p>
            {l && l.next !== null ? <span className="text-[12px] tabular-nums text-ink/55">{l.pct}%</span> : null}
          </div>
          {l && l.next !== null ? (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/[0.06]" aria-hidden>
              <span className="block h-full rounded-full" style={{ width: `${l.pct}%`, background: 'var(--m-orange)' }} />
            </div>
          ) : null}
          {goal ? (
            <p className="mt-2 text-[13.5px] text-ink/75" data-badge-goal-line="">
              {goal}
            </p>
          ) : null}
        </div>
        {reward && (reward.next || reward.gave || reward.upgrade) ? (
          <div className="space-y-1 rounded-2xl p-3" style={{ background: 'var(--m-orange-4)' }} data-badge-reward="">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: 'var(--m-orange-deep)' }}>
              <Gift aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Reward
            </p>
            {reward.next ? <p className="text-[13.5px] text-ink/80">{reward.next}</p> : null}
            {reward.gave ? <p className="text-[13px] text-ink/65">{reward.gave}</p> : null}
            {reward.upgrade ? <p className="text-[13px] text-ink/65">{reward.upgrade}</p> : null}
          </div>
        ) : null}
        {tile.row.door ? (
          <Link href={tile.row.door.href} className="button-secondary inline-flex" onClick={onClose}>
            {tile.row.door.label}
          </Link>
        ) : null}
      </div>
    </Sheet>
  );
}
