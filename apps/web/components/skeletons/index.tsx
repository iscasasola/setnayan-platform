/**
 * Shared skeleton system — the animated "loading shell" primitives + page
 * templates that every route's `loading.tsx` composes.
 *
 * WHY (owner directive 2026-06-03 — "we want an animation loading so they do
 * not feel they are waiting too long"): Next.js shows a route's nearest
 * `loading.tsx` as an INSTANT Suspense fallback the moment a navigation
 * starts, while the server is still running its Supabase queries (~50-200ms
 * RTT each from Singapore). A right-shaped shimmer makes the wait feel
 * structured and fast instead of a frozen tap. The prior seam (CLAUDE.md
 * 2026-05-30) was that child routes inherited the event-home skeleton — the
 * wrong shape. These templates fix that: each route gets a loader that
 * mirrors its own layout.
 *
 * The animated sheen comes from the `.skeleton` class in globals.css (a
 * GPU-only background-position sweep). It is automatically frozen to a static
 * block under `prefers-reduced-motion: reduce` by the global a11y block, so
 * these templates need no motion guards of their own.
 *
 * Every block is decorative (`aria-hidden`); the wrapping <Screen> carries
 * `aria-busy` + an sr-only "Loading…" so assistive tech announces the state
 * once, not 40 times.
 */
import type { CSSProperties, ReactNode } from 'react';

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

/** A single shimmer block. Size/shape it with Tailwind utilities; the
 *  `.skeleton` class paints the animated sheen + base tint. */
export function Sk({
  className = '',
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <div aria-hidden className={`skeleton ${className}`} style={style} />;
}

/** One text line. `w` is any Tailwind width class (default 100%). */
export function SkLine({ w = 'w-full', className = '' }: { w?: string; className?: string }) {
  return <Sk className={`h-3.5 rounded ${w} ${className}`} />;
}

/** A circle (avatars, icon chips). */
export function SkCircle({ size = 'h-10 w-10', className = '' }: { size?: string; className?: string }) {
  return <Sk className={`${size} rounded-full ${className}`} />;
}

/**
 * Loading screen wrapper — the structural <section> every template returns.
 * Provides consistent vertical rhythm + the single accessibility hook.
 */
export function Screen({
  children,
  className = 'space-y-6',
  label = 'Loading',
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <section aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}…</span>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Composites
 * ------------------------------------------------------------------ */

/** Eyebrow + title (+ optional trailing action buttons). */
export function HeaderSkeleton({ actions = 0 }: { actions?: number }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        <Sk className="h-3 w-28 rounded" />
        <Sk className="h-8 w-56 max-w-full rounded-md" />
      </div>
      {actions > 0 ? (
        <div className="flex gap-2">
          {Array.from({ length: actions }).map((_, i) => (
            <Sk key={i} className="h-11 w-28 rounded-md" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Search + sort toolbar row. */
export function ToolbarSkeleton() {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Sk className="h-11 flex-1 rounded-md" />
      <Sk className="h-11 w-full rounded-md sm:w-44" />
    </div>
  );
}

/** A horizontal strip of stat cards (RSVP counts, money tiles, etc.). */
export function StatStripSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="rounded-lg border border-ink/10 p-3">
          <Sk className="h-2.5 w-16 rounded" />
          <Sk className="mt-2 h-6 w-10 rounded-full" />
        </li>
      ))}
    </ul>
  );
}

/** A single list row: avatar + two lines + trailing pill. */
export function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink/10 bg-cream p-3">
      <SkCircle />
      <div className="min-w-0 flex-1 space-y-2">
        <Sk className="h-3.5 w-2/5 rounded" />
        <Sk className="h-3 w-1/4 rounded" />
      </div>
      <Sk className="h-6 w-16 rounded-full" />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Page templates — each is self-contained (wraps itself in <Screen>) so a
 * route's loading.tsx can be a one-line default re-export:
 *   export { ListPageSkeleton as default } from '@/components/skeletons';
 * ------------------------------------------------------------------ */

/** List/roster pages: header → toolbar → rows. (Guests, clients, reviews…) */
export function ListPageSkeleton({
  rows = 8,
  toolbar = true,
  stats = 0,
  actions = 2,
}: {
  rows?: number;
  toolbar?: boolean;
  stats?: number;
  actions?: number;
}) {
  return (
    <Screen>
      <HeaderSkeleton actions={actions} />
      {stats > 0 ? <StatStripSkeleton count={stats} /> : null}
      {toolbar ? <ToolbarSkeleton /> : null}
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    </Screen>
  );
}

/** Card-grid / gallery pages: header → responsive tile grid. (Services, add-ons, vendors…) */
export function GridPageSkeleton({
  tiles = 9,
  cols = 'sm:grid-cols-2 lg:grid-cols-3',
  tileClass = 'h-44',
  actions = 1,
}: {
  tiles?: number;
  cols?: string;
  tileClass?: string;
  actions?: number;
}) {
  return (
    <Screen>
      <HeaderSkeleton actions={actions} />
      <ul className={`grid grid-cols-1 gap-4 ${cols}`}>
        {Array.from({ length: tiles }).map((_, i) => (
          <li
            key={i}
            className={`${tileClass} rounded-2xl border border-ink/10 bg-ink/[0.02] p-4`}
          >
            <Sk className="h-24 w-full rounded-xl" />
            <Sk className="mt-3 h-3.5 w-3/4 rounded" />
            <Sk className="mt-2 h-3 w-1/2 rounded" />
          </li>
        ))}
      </ul>
    </Screen>
  );
}

/** Form / editor pages: header → stacked label+field pairs → submit. */
export function FormPageSkeleton({ fields = 6, actions = 0 }: { fields?: number; actions?: number }) {
  return (
    <Screen className="mx-auto max-w-2xl space-y-6">
      <HeaderSkeleton actions={actions} />
      <div className="space-y-5 rounded-2xl border border-ink/10 bg-cream p-5">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Sk className="h-3 w-24 rounded" />
            <Sk className="h-11 w-full rounded-md" />
          </div>
        ))}
        <Sk className="h-11 w-36 rounded-md" />
      </div>
    </Screen>
  );
}

/** Detail pages: header → 2-col (main panel + aside). */
export function DetailPageSkeleton() {
  return (
    <Screen>
      <HeaderSkeleton actions={1} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Sk className="h-48 w-full rounded-2xl" />
          <Sk className="h-3.5 w-3/4 rounded" />
          <Sk className="h-3.5 w-2/3 rounded" />
          <Sk className="h-3.5 w-1/2 rounded" />
          <div className="h-px" />
          <Sk className="h-32 w-full rounded-2xl" />
        </div>
        <aside className="space-y-3">
          <Sk className="h-40 w-full rounded-2xl" />
          <Sk className="h-24 w-full rounded-2xl" />
        </aside>
      </div>
    </Screen>
  );
}

/** Admin table pages: header → toolbar → table rows. */
export function TablePageSkeleton({ rows = 10, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <Screen>
      <HeaderSkeleton actions={1} />
      <ToolbarSkeleton />
      <div className="overflow-hidden rounded-xl border border-ink/10">
        <div className="flex gap-4 border-b border-ink/10 bg-ink/[0.02] px-4 py-3">
          {Array.from({ length: cols }).map((_, i) => (
            <Sk key={i} className="h-3 flex-1 rounded" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 border-b border-ink/5 px-4 py-3.5">
            {Array.from({ length: cols }).map((_, c) => (
              <Sk key={c} className={`h-3.5 flex-1 rounded ${c === 0 ? 'max-w-[40%]' : ''}`} />
            ))}
          </div>
        ))}
      </div>
    </Screen>
  );
}

/** Thread / feed pages: header → stacked message-ish cards. (Messages, activity…) */
export function FeedPageSkeleton({ items = 6 }: { items?: number }) {
  return (
    <Screen>
      <HeaderSkeleton actions={0} />
      <div className="space-y-3">
        {Array.from({ length: items }).map((_, i) => (
          <div key={i} className="flex gap-3 rounded-2xl border border-ink/10 bg-cream p-4">
            <SkCircle size="h-11 w-11" />
            <div className="flex-1 space-y-2">
              <Sk className="h-3.5 w-1/3 rounded" />
              <Sk className="h-3 w-full rounded" />
              <Sk className="h-3 w-4/5 rounded" />
            </div>
          </div>
        ))}
      </div>
    </Screen>
  );
}

/** Canvas / board editor pages: toolbar → sidebar + big canvas. (Seating, site-editor…) */
export function BoardPageSkeleton() {
  return (
    <Screen>
      <HeaderSkeleton actions={2} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Sk key={i} className="h-12 w-full rounded-xl" />
          ))}
        </aside>
        <Sk className="h-[460px] w-full rounded-2xl" />
      </div>
    </Screen>
  );
}

/** Generic fallback for the long tail — a calm, content-shaped shell. */
export function PageSkeleton() {
  return (
    <Screen>
      <HeaderSkeleton actions={1} />
      <Sk className="h-40 w-full rounded-2xl" />
      <div className="space-y-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    </Screen>
  );
}
