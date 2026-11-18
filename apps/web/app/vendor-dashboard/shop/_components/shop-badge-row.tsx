'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Gift, Lock } from 'lucide-react';
import { ShopDoorScreen } from '@/app/vendor-dashboard/_components/shop-door-screen';
import { ProgressRing } from '@/app/_components/progress-ring';
import { BadgeFullscreen } from '@/app/_components/award/badge-fullscreen';
import { VerifiedFullscreen } from '@/app/_components/award/verified-fullscreen';
import { LockedTile } from '@/app/_components/award/locked-tile';
import { BADGE_ART_H, BADGE_ART_W, awardedOnWords, shelfLines, type ShelfTile } from '@/lib/shop-badge-shelf';
import { verifiedV84Svg } from '@/lib/verified-v84-art';
import { RING_COLOUR, RING_EASE, RING_MS, ringDelay } from '@/lib/badge-ring';

/**
 * 🏅 SHOP › BADGES — the APPROVED badges only (owner 15 Nov, DECISION_LOG "THE BADGES IN THE APPROVED PROTOTYPE ARE THE
 * ONLY BADGES"; owner 17 Nov on live: *"old pop ups of badges"*). ONE row: Setnayan Verified (the v84 blue check) and
 * the five tiered badges in the v84 art (`public/badges/v84/*.webp`, lazy, fixed size — no JS cost), completed far left,
 * then in progress (the closest saying "N to go"), then not counted / unread (`shopBadgeShelf`, lib/shop-badge-shelf.ts).
 *
 * Tap a badge:
 *   · EARNED tiered badge → the award kit's `BadgeFullscreen` (v84 `bzOpen`: it lifts out of the row, flies to the
 *     middle, lands with a burst and its tap show, floats and turns). Its caption carries what the old sheet said —
 *     Now · how far to the next tier · Next goal · the reward lines · what it counts (`shelfLines`);
 *   · Setnayan Verified, earned → the kit's `VerifiedFullscreen` (v86 `.vfz`);
 *   · not earned yet / not counted / unread → it RISES (the one `ShopDoorScreen` — a right panel from 701px) with the v84 LOCKED look (`LockedTile`:
 *     the art in grey under a lock, what it takes) and the same lines, the reward box and its door.
 *
 * 🏅 EVERY BADGE SITS IN ITS PROGRESS RING (owner 8 Nov): the shipped `ProgressRing`, drawn in once when seen.
 * 🔒 lib/shop-badge-shelf.test.ts · shop/the-shop-tab-is-v113.test.ts · performance/your-badges-are-on-the-page.test.ts
 */
export function ShopBadgeRow({ tiles, shopName = 'Your shop' }: { tiles: ShelfTile[] | null; shopName?: string }) {
  const [open, setOpen] = useState<{ tile: ShelfTile; from: HTMLElement | null } | null>(null);
  const close = () => setOpen(null);
  return (
    <section aria-labelledby="shop-badges-h" data-shop-badges="" data-tour="shop-badges" className="scroll-mt-24" id="badges">
      <div className="flex items-baseline justify-between px-4 pb-2 pt-5">
        <h2 id="shop-badges-h" className="home-k2 !my-0">
          Badges
        </h2>
        <span className="text-xs text-ink/70">Tap a badge to see how it&rsquo;s earned</span>
      </div>
      {tiles === null ? (
        <p role="status" className="px-4 text-[13.5px] text-ink/70" data-shop-badges-unread="">
          Couldn&rsquo;t load your badges just now.
        </p>
      ) : (
        <ul className="flex snap-x gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-badge-row="">
          {tiles.map((t, i) => (
            <li key={t.key} className="flex-none snap-start">
              <button
                type="button"
                onClick={(e) => setOpen({ tile: t, from: e.currentTarget.querySelector<HTMLElement>('[data-badge-art]') })}
                className="flex w-[96px] flex-col items-center gap-1 rounded-2xl px-1 pb-1 pt-1 text-center focus-visible:outline-2"
                data-badge-tile={t.key}
                data-badge-state={t.state}
                data-badge-goal={t.goal ? '' : undefined}
                aria-label={`${t.title} · ${t.sub}`}
              >
                <BadgeRing tile={t} i={i}>
                  <BadgeArt tile={t} size={60} />
                </BadgeRing>
                <b className="line-clamp-2 text-[12.5px] font-semibold leading-tight text-ink">{t.title}</b>
                <small className={`text-xs leading-tight ${t.goal ? 'font-semibold text-[color:var(--m-orange-deep)]' : 'text-ink/70'}`}>{t.sub}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open ? <BadgeOpen tile={open.tile} from={open.from} shopName={shopName} onClose={close} /> : null}
    </section>
  );
}

/** The v84 picture: the tier reached, or Bronze in grey under a lock before it; Verified is the blue check. */
function BadgeArt({ tile, size }: { tile: ShelfTile; size: number }) {
  const earned = tile.state === 'earned';
  const grey = earned ? undefined : 'grayscale(1) contrast(0.75) brightness(1.08)';
  return (
    <span className="relative inline-grid place-items-center" style={{ width: size, height: size }} data-badge-art="">
      {tile.src ? (
        // eslint-disable-next-line @next/next/no-img-element -- a fixed-size static picture; next/image adds JS for nothing here
        <img
          src={tile.src}
          width={BADGE_ART_W}
          height={BADGE_ART_H}
          loading="lazy"
          decoding="async"
          alt=""
          style={{ width: size, height: 'auto', filter: grey, opacity: earned ? 1 : 0.45 }}
          data-badge-img={tile.key}
        />
      ) : (
        <span
          className="inline-grid"
          style={{ width: size * 0.9, height: size * 0.9, filter: grey, opacity: earned ? 1 : 0.45 }}
          // trusted: the approved v84 art from a constant (lib/verified-v84-art.ts), never user text
          dangerouslySetInnerHTML={{ __html: verifiedV84Svg({ uid: 'row-vr', size: Math.round(size * 0.9), word: false }) }}
        />
      )}
      {earned ? null : (
        <span className="absolute grid h-6 w-6 place-items-center rounded-full bg-[color:var(--m-paper)] text-ink/70 shadow" style={{ top: size * 0.62 }} aria-hidden>
          <Lock className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
      )}
    </span>
  );
}

/** The ring around one badge — empty until it scrolls into view, then drawn in once (staggered by its place in the row). */
function BadgeRing({ tile, i, children }: { tile: ShelfTile; i: number; children: ReactNode }) {
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
  const colour = RING_COLOUR[tile.ring];
  const pct = tile.state === 'unread' || tile.state === 'not_counted' ? 0 : tile.pct;
  return (
    <span ref={ref} className="inline-flex" data-badge-ring={tile.ring} data-badge-ring-pct={pct}>
      <ProgressRing
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

/** What a tap opens: the award full screen when earned, the locked look risen otherwise. */
function BadgeOpen({ tile, from, shopName, onClose }: { tile: ShelfTile; from: HTMLElement | null; shopName: string; onClose: () => void }) {
  const awardedOn = awardedOnWords(tile.awardedAt) ?? undefined;
  if (tile.state === 'earned' && tile.key === 'verified') {
    return <VerifiedFullscreen art={verifiedV84Svg({ uid: 'vfz-vr', size: 150, word: true })} shopName={shopName} awardedOn={awardedOn} onClose={onClose} />;
  }
  if (tile.state === 'earned' && tile.family && tile.tier && tile.tierName && tile.src) {
    return (
      <BadgeFullscreen
        art={
          // eslint-disable-next-line @next/next/no-img-element -- the same static v84 picture the row drew, at full size
          <img src={tile.src} width={BADGE_ART_W} height={BADGE_ART_H} alt="" decoding="async" style={{ width: '100%', height: 'auto' }} data-badge-full={tile.key} />
        }
        tier={{ index: tile.tier, name: tile.tierName }}
        title={tile.title}
        family={tile.family}
        lines={shelfLines(tile)}
        shopName={shopName}
        awardedOn={awardedOn}
        origin={from}
        onClose={onClose}
      />
    );
  }
  return <BadgeSheet tile={tile} onClose={onClose} />;
}

/** Not earned yet (or not counted / unread): the v84 locked look, risen, with every line the old sheet carried. */
function BadgeSheet({ tile, onClose }: { tile: ShelfTile; onClose: () => void }) {
  const hid = useId();
  const reward = tile.reward;
  const what = tile.key === 'verified' ? 'Verified' : 'Badge';
  const takes = tile.state === 'unread' ? 'Couldn’t read this count just now.' : (tile.next ?? tile.how);
  return (
    <ShopDoorScreen labelledById={hid} onClose={onClose} data={`badge-${tile.key}`}>
      <div className="space-y-4 px-4 pb-6 pt-2" data-badge-sheet={tile.key}>
        <h2 id={hid} className="sr-only">
          {tile.title}
        </h2>
        <LockedTile art={<BadgeArtLarge tile={tile} />} group={what} name={tile.title} how={tile.state === 'not_counted' ? `${tile.sub} · ${takes}` : takes} />
        {/* What it counts — once: when the locked tile already says it (Verified, or no next goal), it is not repeated. */}
        {takes !== tile.how ? <p className="text-[13.5px] text-ink/70" data-badge-how="">{tile.how}</p> : null}
        {tile.now ? (
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[17px] font-semibold leading-snug text-ink" data-badge-now="">
                {tile.now}
              </p>
              {tile.progress ? <span className="text-xs tabular-nums text-ink/70">{tile.pct}%</span> : null}
            </div>
            {tile.progress ? (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/[0.06]" aria-hidden>
                <span className="block h-full rounded-full" style={{ width: `${tile.pct}%`, background: 'var(--m-orange)' }} />
              </div>
            ) : null}
            {tile.next ? (
              <p className="mt-2 text-[13.5px] text-ink/75" data-badge-goal-line="">
                {tile.next}
              </p>
            ) : null}
          </div>
        ) : null}
        {reward.next || reward.gave ? (
          <div className="space-y-1 rounded-2xl p-3" style={{ background: 'var(--m-orange-4)' }} data-badge-reward="">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: 'var(--m-orange-deep)' }}>
              <Gift aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Reward
            </p>
            {reward.next ? <p className="text-[13.5px] text-ink/80">{reward.next}</p> : null}
            {reward.gave ? <p className="text-[13px] text-ink/70">{reward.gave}</p> : null}
          </div>
        ) : null}
        {tile.door ? (
          <Link href={tile.door.href} className="button-secondary inline-flex" onClick={onClose}>
            {tile.door.label}
          </Link>
        ) : null}
      </div>
    </ShopDoorScreen>
  );
}

function BadgeArtLarge({ tile }: { tile: ShelfTile }) {
  if (tile.src) {
    // eslint-disable-next-line @next/next/no-img-element -- the static v84 picture, greyed by the locked look
    return <img src={tile.src} width={BADGE_ART_W} height={BADGE_ART_H} alt="" loading="lazy" decoding="async" />;
  }
  // trusted: the approved v84 art from a constant, never user text
  return <span dangerouslySetInnerHTML={{ __html: verifiedV84Svg({ uid: 'sheet-vr', size: 96, word: true }) }} />;
}
