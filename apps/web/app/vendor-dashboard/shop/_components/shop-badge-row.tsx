'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight, Gift, Lock, Plus } from 'lucide-react';
import { followLines } from '@/lib/supplier-store';
import { ShopDoorScreen } from '@/app/vendor-dashboard/_components/shop-door-screen';
import { ProgressRing } from '@/app/_components/progress-ring';
import { BadgeFullscreen } from '@/app/_components/award/badge-fullscreen';
import { VerifiedFullscreen } from '@/app/_components/award/verified-fullscreen';
import { LockedTile } from '@/app/_components/award/locked-tile';
import { BADGE_ART_H, BADGE_ART_W, awardedOnWords, badgeArtFit, shelfLines, type ShelfTile } from '@/lib/shop-badge-shelf';
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
 *   · not earned yet / not counted / unread → it RISES (the one `ShopDoorScreen` — a right panel from 701px) with the LOCKED look (`LockedTile`:
 *     the real art under a small lock at its edge, what it takes — owner 18 Nov) and the same lines, the reward box and its door.
 *
 * 🏅 EVERY BADGE SITS IN ITS PROGRESS RING (owner 8 Nov): the shipped `ProgressRing`, drawn in once when seen.
 * 🔒 lib/shop-badge-shelf.test.ts · shop/the-shop-tab-is-v113.test.ts · performance/your-badges-are-on-the-page.test.ts
 */
export function ShopBadgeRow({
  tiles,
  shopName = 'Your shop',
  seeAllHref,
  addHref,
}: {
  tiles: ShelfTile[] | null;
  shopName?: string;
  /** 🛍 The Store remaster (owner 23 Nov 2026): "See all" → the Badges page; the row then shows the three followed
   *  badges (the caller picks them, `followedBadges`) with "N to go" · "<Tier> next" under each. */
  seeAllHref?: string;
  /** The [+] tile at the row's end → the Store's Badges shelf ("Follow another"). */
  addHref?: string;
}) {
  const [open, setOpen] = useState<{ tile: ShelfTile; from: HTMLElement | null } | null>(null);
  const close = () => setOpen(null);
  return (
    <section aria-labelledby="shop-badges-h" data-shop-badges="" data-tour="shop-badges" className="scroll-mt-24" id="badges">
      <div className="flex items-baseline justify-between px-4 pb-2 pt-5">
        <h2 id="shop-badges-h" className="home-k2 !my-0">
          Badges
        </h2>
        {seeAllHref ? (
          <Link href={seeAllHref} className="sn-press inline-flex min-h-11 items-center gap-0.5 text-sn-base font-semibold text-[rgb(var(--color-link))]" data-shop-badges-all="">
            See all
            <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
        ) : (
          <span className="text-xs text-ink/70">Tap a badge to see how it&rsquo;s earned</span>
        )}
      </div>
      {tiles === null ? (
        <p role="status" className="px-4 text-[13.5px] text-ink/70" data-shop-badges-unread="">
          Couldn&rsquo;t load your badges just now.
        </p>
      ) : (
        <ul className="sn-glide-x flex snap-x gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-badge-row="">
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
                {seeAllHref ? (
                  <FollowLines tile={t} />
                ) : (
                  <small className={`text-xs leading-tight ${t.goal ? 'font-semibold text-[color:var(--m-orange-deep)]' : 'text-ink/70'}`}>{t.sub}</small>
                )}
              </button>
            </li>
          ))}
          {addHref ? (
            <li className="flex-none snap-start">
              <Link
                href={addHref}
                className="sn-press flex w-[96px] flex-col items-center gap-1 rounded-2xl px-1 pb-1 pt-1 text-center"
                data-shop-badges-add=""
              >
                <span aria-hidden className="grid h-[68px] w-[68px] place-items-center rounded-full border-2 border-dashed border-[color:var(--m-line)] text-[color:var(--m-slate-2)]">
                  <Plus className="h-6 w-6" strokeWidth={1.8} />
                </span>
                <b className="text-sn-sm font-semibold leading-tight text-ink">Follow another</b>
              </Link>
            </li>
          ) : null}
        </ul>
      )}
      {open ? <BadgeOpen tile={open.tile} from={open.from} shopName={shopName} onClose={close} /> : null}
    </section>
  );
}

/**
 * 📐 A v84 picture placed by its MEASURED art box (`badgeArtFit`, owner 18 Nov: *"the badges are small and not centered
 * properly"*): the drawn badge — not the 300 × 286 canvas around it — fills a `box` square, centred both ways. The
 * canvas's empty margin and the soft shadow under the badge spill outside the square, unseen.
 */
export function FittedArt({ src, box, style, ...rest }: { src: string; box: number; style?: CSSProperties; loading?: 'lazy'; 'data-badge-img'?: string }) {
  const fit = badgeArtFit(src, box);
  return (
    <span className="relative block" style={{ width: box, height: box }} data-badge-art-box="">
      {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size static picture; next/image adds JS for nothing here */}
      <img
        src={src}
        width={BADGE_ART_W}
        height={BADGE_ART_H}
        decoding="async"
        alt=""
        style={
          fit
            ? { position: 'absolute', left: fit.left, top: fit.top, width: fit.width, maxWidth: 'none', height: 'auto', ...style }
            : { width: box, height: 'auto', ...style }
        }
        {...rest}
      />
    </span>
  );
}

/** The lock's own size (px): small enough to sit on the ring's edge, never on the badge. */
const LOCK_PX = 22;

/**
 * 🔓 A LOCKED BADGE SHOWS ITS REAL ART (owner 18 Nov: *"we still want to see how they look like. or it will always
 * stay a mystery until someone unlocks it?"*) — full colour, never grey, so the supplier sees what they are working
 * toward. What says "not yet" is the small lock on the ring and the "5 to go" / "Not yet" line under it. ONE knob for
 * the row and the risen look: `--sn-locked-art-opacity` (1 unless set; 0.85 is the softer option shown to the owner).
 */
export const LOCKED_ART_OPACITY = 'var(--sn-locked-art-opacity, 1)';

/** The v84 picture: the tier reached, or Bronze in its own colours under a small lock before it; Verified is the blue check. */
export function BadgeArt({ tile, size }: { tile: ShelfTile; size: number }) {
  const earned = tile.state === 'earned';
  const look = earned ? undefined : { opacity: LOCKED_ART_OPACITY };
  // ONE visual size for every badge: the Verified check's (0.9 of the slot), so no badge reads smaller than another.
  const art = Math.round(size * 0.9);
  // The lock sits ON THE RING at its lower right (45°), small, never over the badge's face.
  const lockAt = Math.round(size / 2 + size * 0.45 - LOCK_PX / 2);
  return (
    <span className="relative inline-grid place-items-center" style={{ width: size, height: size }} data-badge-art="">
      {tile.src ? (
        <FittedArt src={tile.src} box={art} loading="lazy" style={look} data-badge-img={tile.key} />
      ) : (
        <span
          className="inline-grid"
          style={{ width: art, height: art, ...look }}
          // trusted: the approved v84 art from a constant (lib/verified-v84-art.ts), never user text
          dangerouslySetInnerHTML={{ __html: verifiedV84Svg({ uid: 'row-vr', size: art, word: false }) }}
        />
      )}
      {earned ? null : (
        <span
          className="absolute grid place-items-center rounded-full bg-[color:var(--m-paper)] text-ink/70 shadow"
          style={{ left: lockAt, top: lockAt, width: LOCK_PX, height: LOCK_PX }}
          aria-hidden
          data-badge-lock=""
        >
          <Lock className="h-3 w-3" strokeWidth={2.25} />
        </span>
      )}
    </span>
  );
}

/** The ring around one badge — empty until it scrolls into view, then drawn in once (staggered by its place in the row). */
export function BadgeRing({ tile, i, children }: { tile: ShelfTile; i: number; children: ReactNode }) {
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

/** Not earned yet (or not counted / unread): the locked look (real art, small lock), risen, with every line the old sheet carried. */
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

/** The risen locked look's picture: the same measured fit as the row, 84 px inside the tile's 96 px art slot (clear of the label under it). */
function BadgeArtLarge({ tile }: { tile: ShelfTile }) {
  if (tile.src) return <FittedArt src={tile.src} box={84} loading="lazy" />;
  // trusted: the approved v84 art from a constant, never user text
  return <span dangerouslySetInnerHTML={{ __html: verifiedV84Svg({ uid: 'sheet-vr', size: 96, word: true }) }} />;
}

/** Under a followed badge on the Shop: "60 to go" (the goal, in the orange that marks it) · "Bronze next". */
function FollowLines({ tile }: { tile: ShelfTile }) {
  const l = followLines(tile);
  return (
    <>
      <small className="text-sn-sm font-semibold leading-tight text-[color:var(--m-orange-deep)]" data-badge-to-go="">
        {l.toGo}
      </small>
      {l.next ? <small className="text-sn-xs leading-tight text-[color:var(--m-slate-2)]">{l.next}</small> : null}
    </>
  );
}
