'use client';

// ============================================================================
// Real Stories gallery — "a wall of living front pages" (iteration 0046)
// ============================================================================
//
// Client island that renders every published editorial as a newspaper cover
// (The [Name] Chronicle — Vol. I, No. X), organised by a dedup cascade:
//
//   1. The Cover        — lowest featureRank (admin-pinned hero). 1 story.
//   2. Most loved       — the next editor-ranked picks.
//   3. Just published   — newest by date, of whatever's left.
//   4. The archive      — everything still unseen.
//
// Event type filter chips collapse the cascade into a filtered grid.
// A search box further filters across all stories.
//
// Live video: a card whose hero is a clip plays it on a seamless, continuous
// forward→reverse (ping-pong) loop via <BoomerangVideo>. The clip file is a
// PRE-BAKED boomerang (forward + reversed, concatenated), so native loop alone
// gives a smooth back-and-forth. Viewport-gated, max 3 playing at once, muted.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, X, ArrowRight, Play } from 'lucide-react';

export type GalleryItem = {
  href: string;
  /** Couple names for weddings; person's name for debuts, graduations, etc. */
  coupleNames: string;
  /** Short meta string — kept for real-showcase entries; not rendered in tile. */
  metaLine: string;
  ceremonyType?: string;
  venueSetting?: string;
  theme?: string;
  city?: string | null;
  palette: string[];
  heroImageUrl: string | null;
  heroVideoUrl: string | null;
  featureRank: number | null;
  publishedSort: string;
  isSample: boolean;
  searchText: string;
  // Editorial identity
  eventType?: string | null;     // Wedding · Debut · Anniversary · Graduation · Reunion · …
  witnessQuote?: string | null;  // quote from a witness, NOT the subject
  witnessAttribution?: string | null;
  services?: string[] | null;    // ['Papic', 'Panood', 'Monogram', 'Setnayan AI']
  editionNumber?: number | null; // Vol. I, No. X
};

// ── Boomerang (ping-pong) video player ──────────────────────────────────────
// Pre-baked boomerang source → native loop gives seamless forward→reverse.
// Plays only while the card is in view; caps at 3 concurrent across the page.

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

function BoomerangVideo({ src, poster, alt }: { src: string; poster: string | null; alt: string }) {
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
    if (reduce) return;

    const conn = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType ?? ''))) return;

    const startPlaying = () => video.play().catch(() => {});
    const stopPlaying = () => video.pause();

    const grant = () => {
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

function Tile({ item, size, tag }: { item: GalleryItem; size: TileSize; tag?: string }) {
  const minH =
    size === 'cover'
      ? 'min-h-[320px] sm:min-h-[460px]'
      : size === 'loved'
        ? 'min-h-[280px]'
        : 'min-h-[220px]';
  const base = item.palette[0] ?? '#6B4E3D';
  const showVideo = Boolean(item.heroVideoUrl);

  return (
    <Link
      href={item.href}
      className={`group relative flex flex-col justify-end overflow-hidden rounded-2xl sm:rounded-3xl ${minH}`}
      style={{ backgroundColor: base }}
    >
      {/* Background: video > image > palette strip */}
      {showVideo ? (
        <BoomerangVideo src={item.heroVideoUrl as string} poster={item.heroImageUrl} alt={item.coupleNames} />
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

      {/* Legibility scrim */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          height: size === 'cover' ? '68%' : '74%',
          background: 'linear-gradient(to top, rgba(12,10,8,0.82), rgba(12,10,8,0.35) 52%, rgba(12,10,8,0))',
        }}
        aria-hidden
      />

      {/* Top tags: event type (left) · section + media + sample (right) */}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-1.5">
        {item.eventType ? (
          <span className="rounded-full bg-white/90 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-ink">
            {item.eventType}
          </span>
        ) : (
          <span aria-hidden />
        )}
        <div className="flex flex-wrap items-start justify-end gap-1.5">
          {tag ? (
            <span className="rounded-full bg-white/90 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-ink">
              {tag}
            </span>
          ) : null}
          {showVideo ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-terracotta px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-white">
              <Play aria-hidden className="h-2.5 w-2.5" fill="currentColor" strokeWidth={0} />
              Live · 5s
            </span>
          ) : null}
          {item.isSample ? (
            <span className="rounded-full border border-white/40 bg-white/10 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-white/80 backdrop-blur-sm">
              Sample
            </span>
          ) : null}
        </div>
      </div>

      {/* Body — newspaper nameplate layout */}
      <div className={`relative text-white ${size === 'cover' ? 'p-6 sm:p-9' : 'p-4 sm:p-5'}`}>
        {/* Nameplate — "The [Name] Chronicle" in serif italic */}
        <h3
          className={`m-serif italic font-normal leading-[1.1] tracking-tight text-white ${
            size === 'cover' ? 'text-[1.75rem] sm:text-[2.75rem]' : size === 'loved' ? 'text-[1.3rem]' : 'text-[1.15rem]'
          }`}
        >
          The {item.coupleNames} Chronicle
        </h3>

        {/* Edition dateline */}
        <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/55">
          Vol.&nbsp;I&nbsp;&middot;&nbsp;No.&nbsp;{item.editionNumber ?? '–'}
          {item.city ? <>&nbsp;&middot;&nbsp;{item.city}</> : null}
        </p>

        {/* Divider — cover only */}
        {size === 'cover' ? (
          <div className="mt-4 h-px w-full bg-white/20" aria-hidden />
        ) : null}

        {/* Witness pull-quote — cover and loved */}
        {(size === 'cover' || size === 'loved') && item.witnessQuote ? (
          <blockquote className={`${size === 'cover' ? 'mt-4' : 'mt-3'} border-l border-white/30 pl-3`}>
            <p
              className={`m-serif italic leading-snug text-white/88 ${
                size === 'cover' ? 'text-[0.9375rem] sm:text-base' : 'text-[0.8125rem]'
              }`}
            >
              &ldquo;{item.witnessQuote}&rdquo;
            </p>
            {size === 'cover' && item.witnessAttribution ? (
              <footer className="mt-1 font-mono text-[9px] uppercase tracking-[0.13em] text-white/45">
                — {item.witnessAttribution}
              </footer>
            ) : null}
          </blockquote>
        ) : null}

        {/* Service badges */}
        {item.services && item.services.length > 0 ? (
          <div className={`${size === 'cover' ? 'mt-4' : 'mt-3'} flex flex-wrap gap-1`}>
            {item.services.map((s) => (
              <span
                key={s}
                className="rounded-full bg-white/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-white/70 backdrop-blur-[2px]"
              >
                {s}
              </span>
            ))}
          </div>
        ) : null}

        {size === 'cover' ? (
          <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-white">
            Read the story
            <ArrowRight aria-hidden className="h-4 w-4 transition group-hover:translate-x-0.5" strokeWidth={2} />
          </span>
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
  const [activeType, setActiveType] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const q = query.trim().toLowerCase();

  // Derive event types from items — only show types that exist.
  const eventTypes = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const it of items) {
      if (it.eventType && !seen.has(it.eventType)) {
        seen.add(it.eventType);
        out.push(it.eventType);
      }
    }
    return out;
  }, [items]);

  // Filtered results when search or type filter is active.
  const filtered = useMemo(() => {
    let out = items;
    if (activeType) out = out.filter((i) => i.eventType === activeType);
    if (q) out = out.filter((i) => i.searchText.includes(q));
    return out;
  }, [items, activeType, q]);

  const isFiltering = Boolean(q || activeType);

  // Dedup cascade — runs across all items when no filter is active.
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
    const loved = take(byRank, 3);
    const fresh = take(byDate, 3);
    const archive = items.filter((i) => !seen.has(i.href));
    return { cover, loved, fresh, archive };
  }, [items]);

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
          placeholder="Search by name, city, milestone, theme…"
          aria-label="Search real stories"
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

      {/* Event type filter chips */}
      {eventTypes.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter by milestone type">
          <button
            type="button"
            onClick={() => setActiveType(null)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
              !activeType
                ? 'bg-ink text-white'
                : 'border border-ink/15 bg-white/60 text-ink/65 hover:bg-white hover:text-ink'
            }`}
          >
            All
          </button>
          {eventTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setActiveType(activeType === type ? null : type)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                activeType === type
                  ? 'bg-ink text-white'
                  : 'border border-ink/15 bg-white/60 text-ink/65 hover:bg-white hover:text-ink'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      ) : null}

      {/* Results when filtering / searching */}
      {isFiltering ? (
        <>
          <SectionHead
            title={
              filtered.length === 0
                ? 'No stories found'
                : `${filtered.length} ${filtered.length === 1 ? 'story' : 'stories'}${activeType ? ` · ${activeType}` : ''}${q ? ` for "${query}"` : ''}`
            }
            note={q ? 'searching every editorial' : undefined}
          />
          {filtered.length === 0 ? (
            <p className="rounded-2xl border border-ink/10 bg-white/50 p-8 text-center text-sm text-ink/55">
              No stories match yet — try a different name, city, or milestone type.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((it) => (
                <Tile key={it.href} item={it} size="card" />
              ))}
            </div>
          )}
        </>
      ) : (
        /* Dedup cascade */
        <>
          {sections.cover[0] ? (
            <>
              <SectionHead title="The cover" note="featured edition" />
              <Tile item={sections.cover[0]} size="cover" tag="Featured" />
            </>
          ) : null}

          {sections.loved.length > 0 ? (
            <>
              <SectionHead title="Most loved" note="editors' picks" />
              <div className="grid gap-4 sm:grid-cols-2">
                {sections.loved.map((it) => (
                  <Tile key={it.href} item={it} size="loved" />
                ))}
              </div>
            </>
          ) : null}

          {sections.fresh.length > 0 ? (
            <>
              <SectionHead title="Just published" note="the latest editions" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sections.fresh.map((it) => (
                  <Tile key={it.href} item={it} size="card" tag="New" />
                ))}
              </div>
            </>
          ) : null}

          {sections.archive.length > 0 ? (
            <>
              <SectionHead title="The archive" note="every edition" />
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
