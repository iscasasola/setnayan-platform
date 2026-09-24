import type { CSSProperties, ReactElement, ReactNode } from 'react';
import Link from 'next/link';
import { AlertCircle, MapPin, Plus } from 'lucide-react';
import { ProgressRing } from '@/app/_components/progress-ring';
import { CountUp } from '@/app/_components/count-up';

/**
 * THE COLLECTION CARD — one shell that every collection fills.
 *
 * Owner, 2026-09-23: *"should be the standard look on alaga, samahan,
 * shortlist. These is a proper template that can help us manage and have a
 * unified design."* The standard is `build-sessions/STANDARD-collection-card.md`
 * — seven slots (cover · kicker · title · mark · meta · attention · progress),
 * six rules, and the closing `+ New <thing>` tile.
 *
 * ─── WHERE THIS CAME FROM ──────────────────────────────────────────────────
 * It was `GlassEventCard`'s body, inline in `app/dashboard/(launcher)/page.tsx`.
 * Step 1 of the standard is extraction with Planning as the only caller and
 * NOTHING changing on screen; the extraction was proved by rendering the old
 * inline card and this one for the same fixture events and comparing the HTML
 * byte for byte. The Planning-specific decisions (which stance, which href,
 * when the ring shows, what the attention row counts) stayed with Planning —
 * this file only knows how a card is LAID OUT, never what an event is.
 *
 * ─── NO FORKS ──────────────────────────────────────────────────────────────
 * `collection-card-is-the-only-card.test.ts` fails if the shell's markup
 * reappears in another file. A second collection adopts this component and
 * fills its slots; it does not copy the card and restyle it. Four lookalikes
 * is exactly what the owner's ruling exists to stop.
 *
 * ─── SERVER-SAFE BY CONSTRUCTION ───────────────────────────────────────────
 * No `'use client'`, no hooks, no function props. Every slot is data or an
 * already-rendered element, so a server page can fill it and nothing callable
 * ever crosses into a client bundle (a LucideIcon prop took prod down
 * 2026-09-23).
 */

/**
 * A kicker chip. A plain string renders in the house mono chip (the type
 * badge — "KASAL"); an element renders as given (Planning's stance chip).
 */
export type CollectionChip = string | ReactElement;

/**
 * THE ONE ATTENTION ROW (rule 1 — one row, never two).
 *
 * 🔑 UNKNOWN IS NOT ZERO (rule 2). `count: null` means the count could not be
 * read, and it renders "couldn't load" — never a number, never silence. A
 * confident "0 need you" printed off a failed read is this codebase's
 * signature defect; the type makes the caller choose.
 *
 *   • `count: null`           → the couldn't-load row.
 *   • `count <= 0`            → no row: nothing is waiting, and that is known.
 *   • `count > 0` + `label`   → the amber row naming the most urgent thing.
 *
 * `count` is the TOTAL waiting; `label` names the top item and is count-led
 * ("9 tasks overdue"); `labelCount` is how many the label itself covers. The
 * total leads ("24 need you · …") only when it says something the label does
 * not — i.e. when other kinds are waiting too. When they are equal, printing
 * both is the "9 need you · 9 tasks overdue" repetition the owner caught.
 *
 * An ABSENT `attention` prop means the collection does not track attention
 * for this item at all (an invited card) — not "couldn't load".
 */
export type CollectionAttention =
  | { count: null; unknownLabel?: string }
  | { count: number; label: string; labelCount?: number };

/**
 * THE PROGRESS ROW — ring + plain-language remainder (rule 3: the sentence is
 * the information, the ring is decoration).
 *
 *   • `pct: undefined` → no ring (not applicable — a finished or invited card).
 *   • `pct: null`      → no ring and a "couldn't load" line (rule 2).
 *   • `pct: number`    → the ring, printing the figure once.
 */
export type CollectionProgress = {
  pct?: number | null;
  /** The plain-language remainder — "86 days to go". */
  remainder: string;
  /** Screen-reader noun after the ring's figure ("planned"). */
  srLabel?: string;
  /** One quiet line under the remainder ("Kept for good"). */
  note?: string | null;
};

export type CollectionCardProps = {
  /** Where the whole card goes (rule 6). `null` renders an INERT card —
   *  inert in look as well as behaviour — see `CardShell`. */
  href: string | null;
  /** Why an inert card does not open. Shown whenever `href` is null and this
   *  is set — a silent dead card reads as the app being broken. */
  inertReason?: string | null;
  /** The thing's name. The only required slot (rule 4). */
  title: string;
  /** A leading ★ before the title (Planning: the primary event). */
  starred?: boolean;
  /** The quiet place line under the title, on the cover. Omitted, never guessed. */
  place?: string | null;
  /** The image layer behind the head. Absent → the house fallback treatment. */
  cover?: ReactNode;
  /** Up to two chips over the cover. */
  kicker?: readonly [CollectionChip] | readonly [CollectionChip, CollectionChip];
  /** Monogram / logo at the cover's edge. Position it with `collectionMarkClass`. */
  mark?: ReactNode;
  /** One quiet line ("Dec 18"). */
  meta?: string | null;
  attention?: CollectionAttention;
  progress?: CollectionProgress;
  /** A kept / put-away card: quieter until pointed at. */
  muted?: boolean;
  /** Position in the grid — drives the entrance cascade and ring stagger. */
  index?: number;
  /** Reserve the cover's top-right corner for the overflow ⋮ (a SIBLING of
   *  the card, never nested inside the link — rule 6). */
  reserveMenuCorner?: boolean;
  /**
   * `'poster'` — the approved collection template (owner 2026-09-24, "the
   * template is good"): the `cover` IS the card, 3:4, and carries the title and
   * the date itself; a private glass strip over its foot carries only what the
   * poster cannot — ONE attention item and the remainder. The title and `meta`
   * are then NOT printed a second time; they become the link's accessible name.
   * Default `'card'` is the extracted glass card, unchanged.
   */
  layout?: 'card' | 'poster';
  /** Poster only: the art is dark, so the chips and the strip go dark glass. */
  coverTone?: 'light' | 'dark';
};

/** Where a `mark` sits: overhanging the cover's bottom-right corner. */
export const collectionMarkClass =
  'absolute -bottom-4 right-3 border-2 border-white/80 shadow-[var(--sn-sh-tile)]';

/**
 * The press + hover affordances. Stripped from a card that has nowhere to go —
 * see CardShell. Kept as one list so "which classes make this look pressable"
 * has a single answer.
 */
const PRESSABLE_CLASSES = ['sn-press', 'sn-lift-4'] as const;

/**
 * …and every `hover:` variant, because a named list is a bill you keep paying.
 * The first cut stripped the two classes above and left `hover:border-mulberry/30`
 * on the desktop card, so a dead card still lit its border under the pointer.
 * Anything that changes on hover is an affordance.
 */
const isHoverAffordance = (c: string) => c.startsWith('hover:');

/**
 * A card is a LINK when there is somewhere to send this person, and an INERT
 * panel when there is not — inert in look as well as in behaviour.
 *
 * 🪤 An INVITED event whose host has never opened a public page has no guest
 * surface at all — and one prod event is in exactly that state. Linking it to
 * `/dashboard/<id>`, which admits organisers only, would show the person told
 * they belong a 404. Rendering the card without a link is the honest version.
 *
 * 🚨 AND THE FIRST CUT OF THIS SHELL WAS A DEAD CONTROL THAT LOOKED ALIVE.
 * It passed the caller's `className` straight through to the `<div>`, and that
 * string carries `sn-press` (`:active { scale: 0.97 }`) and `sn-lift-4`
 * (`:hover { translateY(-4px) }`) — both plain class selectors in globals.css,
 * so they fire on a div exactly as on a link. The card lifted when you pointed
 * at it and squashed when you pressed it, and then did nothing (found
 * 2026-08-13). **A control that animates under your finger has promised
 * something.**
 */
function CardShell({
  href,
  className,
  style,
  children,
}: {
  href: string | null;
  className: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  if (!href) {
    const inert = className
      .split(/\s+/)
      .filter(
        (c) =>
          !(PRESSABLE_CLASSES as readonly string[]).includes(c) &&
          !isHoverAffordance(c),
      )
      .join(' ');
    return (
      <div className={inert} style={style}>
        {children}
      </div>
    );
  }
  return (
    <Link href={href} className={className} style={style}>
      {children}
    </Link>
  );
}

/** The house chip for a string kicker (the type badge). */
function KickerChip({ chip }: { chip: CollectionChip }) {
  if (typeof chip !== 'string') return chip;
  return (
    <span className="inline-flex rounded-full bg-white/85 px-2 py-1 font-mono text-[9px] font-normal uppercase tracking-[0.12em] text-[color:var(--sn-gold-700)] shadow-[0_2px_8px_rgba(30,26,18,0.08)]">
      {chip}
    </span>
  );
}

/**
 * The attention row — see `CollectionAttention` for the three states.
 *
 * 🚨 THE TOTAL NEEDS ITS OWN NOUN. The label is ALREADY count-led ("3 payments
 * to settle"), so printing the total straight before it rendered "9 3 payments
 * to settle". "need you" is what makes the first number a TOTAL and the second
 * a BREAKDOWN. The number is first so it survives truncation on the narrowest
 * card — the label is what gives way, never the count.
 */
export function CollectionAttentionRow({
  attention,
}: {
  attention: CollectionAttention | undefined;
}) {
  if (!attention) return null;
  if (attention.count === null) {
    return (
      <span className="flex items-center gap-1.5 rounded-lg bg-ink/[0.05] px-[9px] py-[5px] text-[color:var(--sn-ink-500)]">
        <AlertCircle aria-hidden className="h-[13px] w-[13px] shrink-0" />
        <span className="truncate text-[11px] font-bold">
          {attention.unknownLabel ?? 'Couldn’t load what needs you'}
        </span>
      </span>
    );
  }
  if (attention.count <= 0) return null;
  const count =
    attention.labelCount != null && attention.count > attention.labelCount
      ? attention.count
      : undefined;
  return (
    <span className="flex items-center gap-1.5 rounded-lg bg-[color:var(--sn-warning-soft)] px-[9px] py-[5px] text-[color:var(--sn-warning)]">
      <AlertCircle aria-hidden className="h-[13px] w-[13px] shrink-0" />
      {count != null ? (
        <span className="shrink-0 font-mono text-[12px] font-bold leading-none">
          {count} need you
        </span>
      ) : null}
      <span className="truncate text-[11px] font-bold">
        {count != null ? <span className="opacity-60">· </span> : null}
        {attention.label}
      </span>
    </span>
  );
}

export function CollectionCard({
  href,
  inertReason = null,
  title,
  starred = false,
  place = null,
  cover,
  kicker,
  mark,
  meta = null,
  attention,
  progress,
  muted = false,
  index = 0,
  reserveMenuCorner = false,
  layout = 'card',
  coverTone = 'light',
}: CollectionCardProps) {
  if (layout === 'poster') {
    return (
      <PosterCard
        href={href}
        inertReason={inertReason}
        title={title}
        meta={meta}
        cover={cover}
        kicker={kicker}
        attention={attention}
        progress={progress}
        muted={muted}
        index={index}
        reserveMenuCorner={reserveMenuCorner}
        dark={coverTone === 'dark'}
      />
    );
  }
  const pct = progress?.pct;
  const showBottom = progress != null || inertReason != null;
  return (
    <CardShell
      href={href}
      className={`sn-tile-glass sn-lift-4 sn-press sn-reveal group flex h-full min-h-[196px] flex-col overflow-hidden rounded-2xl hover:border-mulberry/30 ${
        muted ? 'opacity-75 hover:opacity-100' : ''
      }`}
      style={{ animationDelay: `${0.5 + index * 0.08}s` }}
    >
      <div className="relative h-32 shrink-0 sm:h-36">
        {cover ?? (
          // Rule 4 — no cover still looks deliberate: a dark wash the white
          // title stays legible on, never a blank box.
          <span
            aria-hidden
            className="absolute inset-0 block bg-gradient-to-br from-ink/80 via-ink/65 to-ink/50"
          />
        )}
        {kicker && kicker.length > 0 ? (
          <div
            className={`absolute left-3 top-3 flex flex-wrap items-center gap-1.5 ${
              reserveMenuCorner ? 'max-w-[calc(100%-3.75rem)]' : 'max-w-[calc(100%-1.5rem)]'
            }`}
          >
            {kicker.map((chip, i) => (
              <KickerChip key={i} chip={chip} />
            ))}
          </div>
        ) : null}
        {mark}
        {/* Title + place ON the cover. `right-[4.75rem]` keeps them clear of
            the mark that overhangs the cover's bottom-right corner. */}
        <div className="absolute inset-x-3 bottom-2.5 right-[4.75rem] min-w-0">
          <p className="flex items-center gap-1.5 text-[15px] font-extrabold text-white drop-shadow-[0_1px_6px_rgba(23,22,15,0.6)]">
            {starred ? (
              <span
                aria-hidden
                className="shrink-0 text-xs text-[color:var(--sn-terra)]"
              >
                ★
              </span>
            ) : null}
            <span className="truncate">{title}</span>
          </p>
          {place ? (
            <p className="flex items-center gap-1 text-[11.5px] text-white/75">
              <MapPin aria-hidden className="h-3 w-3 shrink-0" strokeWidth={1.75} />
              <span className="truncate">{place}</span>
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4 pt-5">
        {meta != null ? (
          <p className="truncate text-[12.5px] text-[color:var(--sn-ink-500)]">
            {meta}
          </p>
        ) : null}
        {/* What is waiting outranks how far along it is — above the progress
            row. Absent entirely when nothing waits. */}
        <CollectionAttentionRow attention={attention} />
        {showBottom ? (
          <div className="mt-auto flex items-center gap-2.5 pt-1">
            {typeof pct === 'number' ? (
              <ProgressRing
                pct={pct}
                size={44}
                stroke={4.5}
                trackColor="rgb(var(--color-ink) / 0.08)"
                sweep={{ delayMs: 600 + 150 * index }}
                className="rounded-full shadow-[0_6px_16px_-8px_rgba(30,26,18,0.3)]"
              >
                <span
                  aria-hidden
                  className="absolute inset-[4.5px] rounded-full bg-white/[0.78] backdrop-blur-[6px]"
                />
                <span className="relative font-mono text-[10px] font-bold text-ink">
                  <CountUp value={pct} suffix="%" delayMs={600 + 150 * index} />
                  {/* The ring is the ONE place the figure prints; this keeps
                      the noun for screen readers. */}
                  {progress?.srLabel ? (
                    <span className="sr-only">{` ${progress.srLabel}`}</span>
                  ) : null}
                </span>
              </ProgressRing>
            ) : null}
            <div className="min-w-0">
              {progress ? (
                <p className="truncate text-[12.5px] font-bold text-ink">
                  {progress.remainder}
                </p>
              ) : null}
              {progress?.note ? (
                <p className="truncate text-[11px] text-ink/45">{progress.note}</p>
              ) : null}
              {pct === null ? (
                <p className="truncate text-[11px] text-ink/45">
                  Progress couldn’t load
                </p>
              ) : null}
              {href === null && inertReason ? (
                <p className="text-[11px] leading-snug text-ink/45">{inertReason}</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </CardShell>
  );
}

/** The grid every collection lays its cards in — one column on a phone, two
 *  from `sm`, three from `lg`, four from `xl`. */
export function CollectionGrid({
  children,
  layout = 'card',
}: {
  children: ReactNode;
  /** `'poster'`: 3:4 posters, two to a row on a phone, up to five on a wide
   *  screen (the approved prototype's four viewports). */
  layout?: 'card' | 'poster';
}) {
  if (layout === 'poster') {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {children}
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  );
}

/**
 * The grid's closing `+ New <thing>` tile (rule 5 — part of the grid, not a
 * button elsewhere; it is how a collection says it can grow). At base a
 * compact dashed ROW; from `sm` the dashed ghost card with the same footprint
 * as a card.
 */
export function NewThingTile({
  href,
  label,
  delay = 0,
  layout = 'card',
}: {
  href: string;
  /** "New event" — the whole visible label. */
  label: string;
  delay?: number;
  /** `'poster'`: the dashed 3:4 ghost of a poster, at every width. */
  layout?: 'card' | 'poster';
}) {
  if (layout === 'poster') {
    return (
      <Link
        href={href}
        className="sn-press sn-reveal group grid aspect-[3/4] place-items-center rounded-2xl border-[1.5px] border-dashed border-ink/15 text-[13px] text-[color:var(--sn-ink-500)] transition-[color,background-color,border-color,transform] duration-300 hover:border-[color:var(--sn-gold-500)] hover:bg-white/40 hover:text-[color:var(--sn-gold-700)]"
        style={{ animationDelay: `${delay}s` }}
      >
        <span className="flex flex-col items-center gap-1 text-center">
          <Plus aria-hidden className="h-6 w-6" strokeWidth={1.5} />
          {label}
        </span>
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className="sn-press sn-reveal group flex flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-ink/20 bg-white/[0.35] px-4 py-3.5 text-[13px] font-bold text-[color:var(--sn-ink-500)] transition-[color,background-color,border-color,transform] duration-200 hover:-translate-y-[3px] hover:border-terracotta hover:bg-white/50 hover:text-[color:var(--sn-gold-700)] sm:min-h-[196px] sm:flex-col sm:rounded-2xl sm:p-4" // no-card-ok: a pressable Link — radius stays on what you can press (DESIGN-LANGUAGE-AMENDMENT)
      style={{ animationDelay: `${delay}s` }}
    >
      <Plus aria-hidden className="h-[22px] w-[22px] text-[color:var(--sn-gold-600)]" />
      {label}
    </Link>
  );
}

/**
 * One stop of the template's pager, with its href already built. The caller
 * builds the hrefs because only the caller knows which other parameters its
 * URL carries (Planning keeps `?putaway=1`).
 */
export type CollectionPagerLink =
  | { kind: 'page'; href: string; label: string; current: boolean }
  | { kind: 'gap' };

/**
 * The template's pager — "1 · 2 · … · Last" beside "1–10 of N" (owner-approved
 * 2026-09-24). LINKS, not buttons: a page is a URL (`?page=2`), so it is
 * server-rendered, linkable and survives the back button — no server action,
 * no client state. The numbers come from `paginateCollection`
 * (`lib/collection-pagination.ts`).
 *
 * Renders nothing when handed no stops — the pager "appears only when a page
 * fills".
 */
export function CollectionPager({
  links,
  rangeLabel,
  label,
}: {
  links: readonly CollectionPagerLink[];
  /** "1–10 of 100". */
  rangeLabel: string;
  /** The nav landmark's name — "Planning pages". */
  label: string;
}) {
  if (links.length === 0) return null;
  return (
    <nav aria-label={label} className="mt-5 flex flex-wrap items-center gap-1">
      {links.map((l, i) =>
        l.kind === 'gap' ? (
          <span
            key={`gap-${i}`}
            aria-hidden
            className="inline-grid h-[30px] place-items-center px-0.5 text-[12.5px] text-[color:var(--sn-ink-400)]"
          >
            …
          </span>
        ) : (
          <Link
            key={`p-${i}`}
            href={l.href}
            aria-current={l.current ? 'page' : undefined}
            className={`sn-press inline-grid h-[30px] min-w-[30px] place-items-center rounded-lg px-[9px] text-[12.5px] transition-colors duration-200 ${
              l.current
                ? 'bg-ink font-semibold text-white'
                : 'text-[color:var(--sn-ink-500)] hover:bg-white'
            }`}
          >
            {l.label}
          </Link>
        ),
      )}
      {rangeLabel ? (
        <span className="ml-auto text-[11.5px] text-[color:var(--sn-ink-400)]">
          {rangeLabel}
        </span>
      ) : null}
    </nav>
  );
}

/**
 * The template's empty state — what a collection says while it holds nothing
 * to show, and the one door to its first thing.
 *
 * 🔑 IT MAKES NO ZERO-CLAIM. The reads behind a collection commonly degrade to
 * `[]` on a refused read (`fetchUserEvents` does), so an empty list cannot be
 * told apart from a list that did not load. The caller's copy therefore says
 * what the collection is FOR and how to start one — never "you have none".
 */
export function CollectionEmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  /** The start door, rendered as given. */
  action: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border-[1.5px] border-dashed border-ink/15 px-6 py-11 text-center">
      <h3 className="mb-1.5 text-base font-semibold text-ink">{title}</h3>
      <p className="mb-4 max-w-prose text-[13px] text-[color:var(--sn-ink-500)]">{body}</p>
      {action}
    </div>
  );
}

/**
 * The words of the ONE attention item the poster strip carries, split so the
 * number can lead large ("25" · "need you"). Mirrors `CollectionAttentionRow`'s
 * rule: the TOTAL leads only when it says more than the label; otherwise the
 * count-led label speaks for itself ("17 tasks overdue" → "17" · "tasks
 * overdue").
 */
export function stripAttention(
  attention: CollectionAttention | undefined,
): { kind: 'none' } | { kind: 'unknown'; text: string } | { kind: 'count'; n: string; words: string } {
  if (!attention) return { kind: 'none' };
  if (attention.count === null) {
    return { kind: 'unknown', text: attention.unknownLabel ?? 'Couldn’t load what needs you' };
  }
  if (attention.count <= 0) return { kind: 'none' };
  if (attention.labelCount != null && attention.count > attention.labelCount) {
    return { kind: 'count', n: String(attention.count), words: 'need you' };
  }
  const led = /^(\d[\d,]*)\s+(.+)$/.exec(attention.label);
  return led
    ? { kind: 'count', n: led[1]!, words: led[2]! }
    : { kind: 'count', n: String(attention.count), words: attention.label };
}

/** "86 days to go" → "86 days" over "to go"; anything else stays one line. */
function splitRemainder(remainder: string): { lead: string; sub: string | null } {
  const m = /^(.+?)\s+(to go)$/.exec(remainder);
  return m ? { lead: m[1]!, sub: m[2]! } : { lead: remainder, sub: null };
}

/**
 * The card's accessible name when its words are art: the title, the quiet
 * meta, what needs the reader and how long is left — the same facts, once, in
 * reading order ("Maria & Jose · Kasal, you organise this · Saturday 12
 * December 2026 · 17 tasks overdue · 79 days to go").
 */
export function posterCardLabel(input: {
  title: string;
  meta?: string | null;
  attention?: CollectionAttention;
  progress?: CollectionProgress;
  inertReason?: string | null;
}): string {
  const a = stripAttention(input.attention);
  return [
    input.title,
    input.meta ?? null,
    a.kind === 'unknown' ? a.text : a.kind === 'count' ? `${a.n} ${a.words}` : null,
    input.progress?.pct === null ? 'progress couldn’t load' : null,
    input.progress?.remainder ?? null,
    input.inertReason ?? null,
  ]
    .filter((x): x is string => typeof x === 'string' && x.length > 0)
    .join(' · ');
}

/**
 * THE POSTER CARD — the cover fills a 3:4 card; the chips sit on it; the
 * private strip carries the one attention item and the remainder over its foot.
 * Rounded, because it is pressable (DESIGN-LANGUAGE-AMENDMENT: radius stays on
 * what you can press); no border — seated by shadow.
 */
function PosterCard({
  href,
  inertReason,
  title,
  meta,
  cover,
  kicker,
  attention,
  progress,
  muted,
  index,
  reserveMenuCorner,
  dark,
}: {
  href: string | null;
  inertReason: string | null;
  title: string;
  meta: string | null;
  cover: ReactNode;
  kicker: CollectionCardProps['kicker'];
  attention: CollectionAttention | undefined;
  progress: CollectionProgress | undefined;
  muted: boolean;
  index: number;
  reserveMenuCorner: boolean;
  dark: boolean;
}) {
  const label = posterCardLabel({ title, meta, attention, progress, inertReason: href ? null : inertReason });
  const a = stripAttention(attention);
  const pct = progress?.pct;
  const rem = progress ? splitRemainder(progress.remainder) : null;
  const solo = a.kind === 'none';
  return (
    <CardShell
      href={href}
      className={`sn-press sn-lift-4 sn-reveal group relative block aspect-[3/4] overflow-hidden rounded-2xl bg-[color:var(--m-paper-2)] shadow-[0_1px_0_rgba(44,42,41,0.05),0_20px_44px_-26px_rgba(44,42,41,0.55)] transition-shadow duration-300 hover:shadow-[0_30px_54px_-26px_rgba(44,42,41,0.6)] ${
        muted ? 'opacity-75 hover:opacity-100' : ''
      }`}
      style={{ animationDelay: `${0.5 + index * 0.05}s` }}
    >
      {/* THE ACCESSIBLE NAME. Every visible layer below is aria-hidden (the
          poster is art; the chips and the strip repeat facts this sentence
          already carries), so a screen reader hears this one line, once. */}
      <span className="sr-only">{label}</span>
      {cover ?? (
        <span aria-hidden className="absolute inset-0 block bg-gradient-to-br from-ink/80 via-ink/65 to-ink/50" />
      )}
      {kicker && kicker.length > 0 ? (
        <span
          aria-hidden
          className={`absolute left-2 top-2 z-[5] flex flex-wrap items-center gap-1 ${
            reserveMenuCorner ? 'right-11' : 'right-2'
          }`}
        >
          {kicker.map((chip, i) => (
            <KickerChip key={i} chip={chip} />
          ))}
        </span>
      ) : null}
      <span
        aria-hidden
        className={`absolute inset-x-0 bottom-0 z-[5] flex h-[54px] items-center gap-1.5 pl-3 pr-2.5 backdrop-blur-[18px] backdrop-saturate-150 ${
          solo ? 'justify-start' : 'justify-between'
        } ${
          dark
            ? 'bg-[rgba(24,16,18,0.5)] text-[color:var(--sn-gold-100)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
            : 'bg-white/[0.62] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]'
        }`}
      >
        {a.kind === 'unknown' ? (
          <span className={`min-w-0 text-[10.5px] italic leading-tight ${dark ? 'opacity-70' : 'text-[color:var(--sn-ink-500)]'}`}>
            {a.text}
          </span>
        ) : a.kind === 'count' ? (
          <span
            className={`flex min-w-0 items-baseline gap-[3px] overflow-hidden whitespace-nowrap ${
              dark ? 'text-[color:var(--sn-gold-300)]' : 'text-[color:var(--sn-gold-700)]'
            }`}
          >
            <b className="text-[18px] font-bold leading-none tracking-[-0.02em] tabular-nums">{a.n}</b>
            <small className="truncate text-[8.5px] font-bold uppercase tracking-[0.08em]">{a.words}</small>
          </span>
        ) : null}
        {progress || (!href && inertReason) ? (
          <span className="flex min-w-0 shrink-0 items-center gap-[7px]">
            {typeof pct === 'number' ? (
              <ProgressRing
                pct={pct}
                size={30}
                stroke={4}
                color="var(--sn-gold-500)"
                trackColor={dark ? 'rgb(255 255 255 / 0.16)' : 'rgb(var(--color-ink) / 0.12)'}
                sweep={{ delayMs: 450 + 50 * index }}
              >
                <span className="relative font-sans text-[8.5px] font-semibold leading-none">{pct}%</span>
              </ProgressRing>
            ) : pct === null ? (
              <span
                className={`inline-grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-[10px] font-semibold ${
                  dark ? 'bg-white/15 text-white/70' : 'bg-ink/10 text-[color:var(--sn-ink-500)]'
                }`}
              >
                –
              </span>
            ) : null}
            {rem ? (
              <span className="whitespace-nowrap text-[12.5px] font-bold leading-[1.05] tracking-[-0.01em]">
                {rem.lead}
                {rem.sub || progress?.note ? (
                  <small className="mt-0.5 block text-[9px] font-medium uppercase tracking-[0.06em] opacity-65">
                    {rem.sub ?? progress?.note}
                  </small>
                ) : null}
              </span>
            ) : null}
            {!href && inertReason && !rem ? (
              <span className="text-[11px] leading-snug opacity-70">{inertReason}</span>
            ) : null}
          </span>
        ) : null}
      </span>
    </CardShell>
  );
}
