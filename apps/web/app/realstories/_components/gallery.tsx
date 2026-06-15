'use client';

// ============================================================================
// Real Stories gallery — "a wall of living front pages" (iteration 0046)
// ============================================================================
//
// Client island that renders every published editorial as a magazine cover,
// organised by a single DEDUP CASCADE so no story repeats across sections:
//
//   1. The Cover        — lowest featureRank (admin-pinned hero). 1 story.
//   2. Most loved       — the next editor-ranked picks. (Editors'-pick stand-in
//                         for "most viewed" until real view tracking ships.)
//   3. Just published   — newest by date, of whatever's left.
//   4. The archive      — everything still unseen, so we flex them all.
//
// A search box collapses the sections into one filtered grid across ALL stories.
//
// Live video: a card whose hero is a clip plays it on a seamless, continuous
// forward→reverse (ping-pong) loop via <BoomerangVideo>. The clip file is a
// PRE-BAKED boomerang (forward + reversed, concatenated), so native loop alone
// gives a smooth back-and-forth with no per-frame seeking. Viewport-gated, max 3
// playing at once, muted, with the still as poster + a reduced-motion fallback.
// (The locked "Daily-Prophet" editorial rule, applied at the index level.)
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, X, ArrowRight, Play } from 'lucide-react';

export type GalleryItem = {
  href: string;
  coupleNames: string;
  metaLine: string; // e.g. "Catholic · Tagaytay"
  ceremonyType?: string;
  venueSetting?: string;
  theme?: string;
  city?: string | null;
  palette: string[]; // fallback visual strip / base colour
  heroImageUrl: string | null;
  heroVideoUrl: string | null;
  featureRank: number | null; // 1 = Cover, then Most loved, in order
  publishedSort: string; // ISO — newest-first ordering
  isSample: boolean;
  searchText: string; // pre-lowercased haystack
};

// ── Boomerang (ping-pong) video player ──────────────────────────────────────
// The source is a pre-baked boomerang (forward + reversed frames concatenated),
// so a plain native `loop` gives a seamless, continuous forward→reverse cycle —
// no jump-cut, no per-frame currentTime seeking (which stutters on compressed
// video). This component just gates playback: it plays only while the card is in
// view, and caps concurrency globally at 3 to protect mobile battery/decoders
// (the Daily-Prophet "≤3 concurrent" rule); extra cards hold on the poster.

const MAX_CONCURRENT = 3;
let liveCount = 0;
const waiters: Array<() => void> = [];
function acquireSlot(grant: () => void): boolean {
  if (liveCount < MAX_CONCURRENT) {
    liveCount += 1;
    return true;
  }
  waiters.push(grant);
  return false;
}
function releaseSlot() {
  liveCount = Math.max(0, liveCount - 1);
  const next = waiters.shift();
  if (next) {
    liveCount += 1;
    next();
  }
}

function BoomerangVideo({
  src,
  poster,
  alt,
}: {
  src: string;
  poster: string | null;
  alt: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const hasSlot = useRef(false);
  const inView = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    const wrap = wrapRef.current;
    if (!video || !wrap) return;

    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return; // poster only — never autoplay under reduced motion.

    // The clip is a pre-baked boomerang, so native loop carries the continuous
    // forward→reverse cycle — we only start/stop it.
    const startPlaying = () => video.play().catch(() => {});
    const stopPlaying = () => video.pause();

    const grant = () => {
      // Only claim the slot if we still need it; otherwise hand it straight
      // back so a queued-but-since-scrolled-away card never holds a slot.
      if (inView.current) {
        hasSlot.current = true;
        startPlaying();
      } else {
        releaseSlot();
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e) return;
        if (e.isIntersecting) {
          inView.current = true;
          if (hasSlot.current) startPlaying();
          else acquireSlot(grant) && grant();
        } else {
          inView.current = false;
          stopPlaying();
          if (hasSlot.current) {
            hasSlot.current = false;
            releaseSlot();
          }
        }
      },
      { threshold: 0.25 },
    );
    io.observe(wrap);

    return () => {
      io.disconnect();
      stopPlaying();
      if (hasSlot.current) {
        hasSlot.current = false;
        releaseSlot();
      }
    };
  }, [src]);

  return (
    <div ref={wrapRef} className="absolute inset-0" aria-hidden>
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        src={src}
        poster={poster ?? undefined}
        muted
        playsInline
        loop
        preload="none"
        aria-label={alt}
      />
    </div>
  );
}

// ── Tile ────────────────────────────────────────────────────────────────────

type TileSize = 'cover' | 'loved' | 'card';

function Tile({
  item,
  size,
  tag,
}: {
  item: GalleryItem;
  size: TileSize;
  tag?: string;
}) {
  const minH =
    size === 'cover'
      ? 'min-h-[300px] sm:min-h-[420px]'
      : size === 'loved'
        ? 'min-h-[260px]'
        : 'min-h-[200px]';
  const base = item.palette[0] ?? '#6B4E3D';
  const showVideo = Boolean(item.heroVideoUrl);

  return (
    <Link
      href={item.href}
      className={`group relative flex flex-col justify-end overflow-hidden rounded-2xl sm:rounded-3xl ${minH}`}
      style={{ backgroundColor: base }}
    >
      {showVideo ? (
        <BoomerangVideo
          src={item.heroVideoUrl as string}
          poster={item.heroImageUrl}
          alt={item.coupleNames}
        />
      ) : item.heroImageUrl ? (
        <img
          src={item.heroImageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
          loading={size === 'cover' ? 'eager' : 'lazy'}
        />
      ) : (
        <div className="absolute inset-0 flex" aria-hidden>
          {item.palette.map((hex) => (
            <span key={hex} className="flex-1" style={{ backgroundColor: hex }} />
          ))}
        </div>
      )}

      {/* Legibility scrim — solid (no gradient flash), heavier on the cover. */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          height: size === 'cover' ? '62%' : '70%',
          background:
            'linear-gradient(to top, rgba(18,14,10,0.72), rgba(18,14,10,0.30) 55%, rgba(18,14,10,0))',
        }}
        aria-hidden
      />

      {/* Tags */}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-center gap-1.5">
        {tag ? (
          <span className="rounded-full bg-white/95 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink">
            {tag}
          </span>
        ) : null}
        {showVideo ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-terracotta px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-white">
            <Play aria-hidden className="h-2.5 w-2.5" fill="currentColor" strokeWidth={0} />
            Live · 5s loop
          </span>
        ) : null}
        {item.isSample ? (
          <span className="rounded-full border border-white/50 bg-white/10 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-white backdrop-blur-sm">
            Sample
          </span>
        ) : null}
      </div>

      {/* Body */}
      <div className={`relative ${size === 'cover' ? 'p-6 sm:p-9' : 'p-4 sm:p-5'} text-white`}>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/85">
          {item.metaLine}
        </p>
        <h3
          className={`mt-1.5 font-semibold leading-[1.12] tracking-tight text-white ${
            size === 'cover' ? 'text-2xl sm:text-4xl' : size === 'loved' ? 'text-xl' : 'text-lg'
          }`}
        >
          {item.coupleNames}
        </h3>
        {size === 'cover' ? (
          <>
            {item.theme ? (
              <p className="mt-2.5 max-w-xl text-sm text-white/85 sm:text-base">
                {[item.theme, item.venueSetting?.toLowerCase(), item.city].filter(Boolean).join(' · ')}
              </p>
            ) : null}
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white">
              Read the story
              <ArrowRight aria-hidden className="h-4 w-4 transition group-hover:translate-x-0.5" strokeWidth={2} />
            </span>
          </>
        ) : null}
      </div>
    </Link>
  );
}

// ── Section header ──────────────────────────────────────────────────────────

function SectionHead({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-3 mt-10 flex items-baseline justify-between gap-3 sm:mt-12">
      <h2 className="text-base font-semibold tracking-tight text-ink sm:text-lg">{title}</h2>
      {note ? <span className="text-[11px] text-ink/45">{note}</span> : null}
    </div>
  );
}

// ── Gallery ─────────────────────────────────────────────────────────────────

export function RealStoriesGallery({ items }: { items: GalleryItem[] }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const q = query.trim().toLowerCase();

  // Dedup cascade. Each section claims from a shrinking pool by priority.
  const sections = useMemo(() => {
    const seen = new Set<string>();
    const take = (pool: GalleryItem[], k: number) => {
      const out: GalleryItem[] = [];
      for (const it of pool) {
        if (out.length >= k) break;
        if (!seen.has(it.href)) {
          out.push(it);
          seen.add(it.href);
        }
      }
      return out;
    };
    const byRank = [...items]
      .filter((i) => i.featureRank != null)
      .sort((a, b) => (a.featureRank as number) - (b.featureRank as number));
    const byDate = [...items].sort((a, b) => (a.publishedSort < b.publishedSort ? 1 : -1));

    const cover = take(byRank, 1);
    const loved = take(byRank, 3); // next editor-ranked picks after the cover
    const fresh = take(byDate, 3); // newest of whatever's left
    const archive = items.filter((i) => !seen.has(i.href));
    return { cover, loved, fresh, archive };
  }, [items]);

  const results = useMemo(() => {
    if (!q) return [];
    return items.filter((i) => i.searchText.includes(q));
  }, [items, q]);

  return (
    <div>
      {/* Search */}
      <div className="relative mt-8">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink/40"
          strokeWidth={1.75}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search couples, city, ceremony, venue, theme…"
          aria-label="Search real wedding stories"
          className="h-12 w-full rounded-full border border-ink/15 bg-white/70 pl-11 pr-11 text-[15px] text-ink outline-none transition placeholder:text-ink/40 focus:border-terracotta/50 focus:bg-white"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink/50 hover:bg-ink/5 hover:text-ink"
          >
            <X aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        ) : null}
      </div>

      {q ? (
        <>
          <SectionHead
            title={`${results.length} ${results.length === 1 ? 'story' : 'stories'} for “${query}”`}
            note="searching every editorial"
          />
          {results.length === 0 ? (
            <p className="rounded-2xl border border-ink/10 bg-white/50 p-8 text-center text-sm text-ink/55">
              No stories match yet — try a city, ceremony type, or theme.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((it) => (
                <Tile key={it.href} item={it} size="card" />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {sections.cover[0] ? (
            <>
              <SectionHead title="The cover" note="featured editorial" />
              <Tile item={sections.cover[0]} size="cover" tag="Featured" />
            </>
          ) : null}

          {sections.loved.length > 0 ? (
            <>
              <SectionHead title="Most loved" note="editors’ picks" />
              <div className="grid gap-4 sm:grid-cols-2">
                {sections.loved.map((it) => (
                  <Tile key={it.href} item={it} size="loved" />
                ))}
              </div>
            </>
          ) : null}

          {sections.fresh.length > 0 ? (
            <>
              <SectionHead title="Just published" note="the latest stories" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sections.fresh.map((it) => (
                  <Tile key={it.href} item={it} size="card" tag="New" />
                ))}
              </div>
            </>
          ) : null}

          {sections.archive.length > 0 ? (
            <>
              <SectionHead title="The archive" note="every other story" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sections.archive.map((it) => (
                  <Tile key={it.href} item={it} size="card" />
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
