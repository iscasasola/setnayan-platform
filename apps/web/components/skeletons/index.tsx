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
 * 👻 THE SKELETON STYLE IS "D · GHOST" (owner 18 Nov 2026, motion standard § 9): whatever is ALREADY KNOWN shows at
 * once, as itself — the page title, section names, names from the last visit. Only the UNKNOWN parts are grey
 * blocks under the Sheen. When nothing is known it falls back to the Sheen alone ("A · Sheen").
 *   · `Ghost` is the one part that decides: `known` text → the text; nothing known → a grey `Sk` block.
 *   · Every template takes `title` as `true` (a title is drawn but not known here → grey) or as the title's own
 *     words (known → shown at once); a list takes `names`; `SkSection` takes a section's `name`.
 *   · Names from the LAST VISIT come from the one shipped cache — `LastSeenFallback`
 *     (`app/_components/last-seen/*`, five host pages, never money) wraps the template and paints the kept copy;
 *     nothing kept → the Ghost template; nothing known → the Sheen. There is no second cache.
 *
 * The motion is the `.skeleton` class in globals.css: the block waits 150 ms before it shows (load rule 1 — a fast
 * page shows no skeleton at all), then one light strip crosses it by transform every 1.4 s (the Sheen, the ONE
 * allowed loop). Reduced motion: still grey blocks. Known parts never wait and never move.
 *
 * Every block is decorative (`aria-hidden`); the wrapping <Screen> carries
 * `aria-busy` + an sr-only "Loading…" so assistive tech announces the state
 * once, not 40 times.
 */
import type { CSSProperties, ReactNode } from 'react';
import { LoadingActivity } from '@/components/loading-activity';

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

/**
 * 👻 GHOST — the one part that decides between "known" and "unknown".
 *
 * `known` (non-empty text) → the text itself, at once: no wait, no grey, no motion. Nothing known → `fallback`
 * (default: a grey `Sk` block sized by `className`), which waits and carries the Sheen.
 *
 * `textClassName` styles the known text. Give it the SAME height as the block it replaces (`leading-*` /
 * `min-h-*`), so a page with a known title and one without it reserve the same space and nothing jumps.
 *
 * 🔒 lib/the-ghost-falls-back-to-sheen.test.ts
 */
export function Ghost({
  known,
  className = '',
  textClassName = '',
  fallback,
}: {
  known?: string | null | false;
  className?: string;
  textClassName?: string;
  fallback?: ReactNode;
}) {
  const text = typeof known === 'string' ? known.trim() : '';
  if (text) {
    // Decorative like every other part of a loading screen: the wrapping <Screen> announces "Loading…" once,
    // and the real page announces its own heading when it lands.
    return (
      <span aria-hidden data-ghost="known" className={`block truncate ${textClassName}`}>
        {text}
      </span>
    );
  }
  return <>{fallback ?? <Sk className={className} />}</>;
}

/** What a template's `title` may be: nothing drawn · drawn but unknown here (grey) · the title's own words. */
export type GhostTitle = boolean | string;

/**
 * A named section of a loading screen: the section's NAME is known copy, so it shows at once; its content is not,
 * so `children` are the grey blocks. No name → a grey line where the name will be (the Sheen fallback).
 */
export function SkSection({
  name,
  children,
  className = 'space-y-3',
}: {
  name?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Ghost
        known={name}
        className="h-3 w-40 rounded"
        textClassName="min-h-3 text-xs font-semibold uppercase leading-3 tracking-wide text-ink/55"
      />
      {children}
    </div>
  );
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
      <LoadingActivity />
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Composites
 * ------------------------------------------------------------------ */

/**
 * The top strip — and on most pages there is no longer one to draw.
 *
 * 🛑 A SKELETON IS A PROMISE ABOUT THE PAGE THAT REPLACES IT. This one drew an
 * eyebrow pill and a 32px title bar on every screen that composed it, and
 * `<PageMasthead>` stopped drawing either of those things: the eyebrow went on
 * 2026-07-21, the lede on 08-18, the title and the back chevron on 08-21, the
 * (i) hours after that. What ships now is an `sr-only` <h1> and, on a handful of
 * pages, an actions row — "the page begins at its own first element". The
 * skeletons never followed, so for months the shimmer reserved ~52px of chrome
 * that never arrived and every screen jumped upward the moment it landed.
 *
 * So the title is now OPT-IN, and the default is nothing at all:
 *   • `title` — pass it only when the real screen genuinely draws a big heading
 *     of its own (a door card, a buy hero, a form page that kept its <h1>).
 *     Measured comment-stripped: 142 loaders compose a template, 41 opt in and
 *     101 want none. (This line first said "91 of 144" — 144 was a raw
 *     name-match that counted two docblock mentions, and 91 was the
 *     needed-no-edit figure borrowed for a different quantity.)
 *   • `actions` — how many buttons the page's masthead actually renders. Zero
 *     means the strip does not exist, exactly as the masthead's own early
 *     return means it does not exist.
 * With neither, this renders NULL — no box, no margin, no gap.
 *
 * ⛔ The eyebrow bar is DELETED, not made opt-in. It is a retired element, and a
 * prop named after it is an invitation to bring it back. The ~10 door screens
 * whose card really does carry a terracotta eyebrow lose one 12px pill from
 * their shimmer; that is the deliberate price of not keeping the retired shape
 * alive in the shared component.
 *
 * 🛡 `the-skeleton-promises-only-what-the-page-draws.test.ts` derives the answer
 * for every loader from its own route's page tree, so this cannot drift back.
 */
export function HeaderSkeleton({
  title = false,
  actions = 0,
  actionsAt = 'always',
}: {
  /** `true` = a title is drawn but its words are not known here (grey). A string = the title itself, shown at once. */
  title?: GhostTitle;
  actions?: number;
  /**
   * WHERE the page's buttons are actually visible.
   *
   * 🔑 A PAGE THAT HIDES ITS BUTTONS ON A PHONE NEEDS A SKELETON THAT HIDES
   * THEM TOO. `/dashboard/[eventId]/guests` puts its two header links inside a
   * `hidden … lg:flex` shell, so reserving two 44px pills at every width is
   * right on a laptop and 44px of phantom chrome on a phone — the same defect
   * this component was just fixed for, one breakpoint down. Passing `'lg'`
   * makes the reservation follow the buttons instead of guessing one answer for
   * both widths, which is what the guard used to have to exempt.
   */
  actionsAt?: 'always' | 'lg';
}) {
  // The common case: the page starts at its content, so the skeleton does too.
  if (!title && actions < 1) return null;

  // Same wrapper the masthead uses, so the strip cannot land in a different
  // place from the one the skeleton reserved for it.
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {title ? (
        <Ghost
          known={title === true ? null : title}
          className="h-8 w-56 max-w-full rounded-md"
          textClassName="min-h-8 max-w-full text-2xl font-semibold leading-8 tracking-tight text-ink"
        />
      ) : null}
      {actions > 0 ? (
        <div
          className={`${
            actionsAt === 'lg' ? 'hidden lg:flex' : 'flex'
          } w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto`}
        >
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

/** A single list row: avatar + two lines + trailing pill. `name` = the row's name, when it is already known. */
export function RowSkeleton({ name }: { name?: string | null } = {}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink/10 bg-cream p-3">
      <SkCircle />
      <div className="min-w-0 flex-1 space-y-2">
        {/* 👻 A name already known (the last visit's) shows at once; an unknown one is the grey line. */}
        <Ghost
          known={name}
          className="h-3.5 w-2/5 rounded"
          textClassName="min-h-3.5 text-sm font-medium leading-[0.875rem] text-ink/80"
        />
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
  actions = 0,
  actionsAt = 'always' as const,
  title = false,
  names,
}: {
  rows?: number;
  /** 👻 Names already known for the first rows (the last visit's). Rows past the list stay grey. */
  names?: readonly string[];
  toolbar?: boolean;
  stats?: number;
  actions?: number;
  actionsAt?: 'always' | 'lg';
  title?: GhostTitle;
}) {
  return (
    <Screen>
      <HeaderSkeleton title={title} actions={actions} actionsAt={actionsAt} />
      {stats > 0 ? <StatStripSkeleton count={stats} /> : null}
      {toolbar ? <ToolbarSkeleton /> : null}
      <div className="space-y-2.5">
        {Array.from({ length: Math.max(rows, names?.length ?? 0) }).map((_, i) => (
          <RowSkeleton key={i} name={names?.[i]} />
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
  actions = 0,
  actionsAt = 'always' as const,
  title = false,
}: {
  tiles?: number;
  cols?: string;
  tileClass?: string;
  actions?: number;
  actionsAt?: 'always' | 'lg';
  title?: GhostTitle;
}) {
  return (
    <Screen>
      <HeaderSkeleton title={title} actions={actions} actionsAt={actionsAt} />
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
export function FormPageSkeleton({
  fields = 6,
  actions = 0,
  actionsAt = 'always' as const,
  title = false,
}: {
  fields?: number;
  actions?: number;
  actionsAt?: 'always' | 'lg';
  title?: GhostTitle;
}) {
  return (
    <Screen className="mx-auto max-w-2xl space-y-6">
      <HeaderSkeleton title={title} actions={actions} actionsAt={actionsAt} />
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
export function DetailPageSkeleton({
  actions = 0,
  actionsAt = 'always' as const,
  title = false,
}: {
  actions?: number;
  actionsAt?: 'always' | 'lg';
  title?: GhostTitle;
} = {}) {
  return (
    <Screen>
      <HeaderSkeleton title={title} actions={actions} actionsAt={actionsAt} />
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
export function TablePageSkeleton({
  rows = 10,
  cols = 5,
  actions = 0,
  actionsAt = 'always' as const,
  title = false,
}: {
  rows?: number;
  cols?: number;
  actions?: number;
  actionsAt?: 'always' | 'lg';
  title?: GhostTitle;
}) {
  return (
    <Screen>
      <HeaderSkeleton title={title} actions={actions} actionsAt={actionsAt} />
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
export function FeedPageSkeleton({
  items = 6,
  actions = 0,
  actionsAt = 'always' as const,
  title = false,
}: {
  items?: number;
  actions?: number;
  actionsAt?: 'always' | 'lg';
  title?: GhostTitle;
}) {
  return (
    <Screen>
      <HeaderSkeleton title={title} actions={actions} actionsAt={actionsAt} />
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
export function BoardPageSkeleton({
  actions = 0,
  actionsAt = 'always' as const,
  title = false,
}: {
  actions?: number;
  actionsAt?: 'always' | 'lg';
  title?: GhostTitle;
} = {}) {
  return (
    <Screen>
      <HeaderSkeleton title={title} actions={actions} actionsAt={actionsAt} />
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
export function PageSkeleton({
  actions = 0,
  actionsAt = 'always' as const,
  title = false,
}: {
  actions?: number;
  actionsAt?: 'always' | 'lg';
  title?: GhostTitle;
} = {}) {
  return (
    <Screen>
      <HeaderSkeleton title={title} actions={actions} actionsAt={actionsAt} />
      <Sk className="h-40 w-full rounded-2xl" />
      <div className="space-y-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    </Screen>
  );
}
